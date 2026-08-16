import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Module from 'node:module';

const ORIGINAL_ENV = {
    NODE_ENV: process.env.NODE_ENV,
    NETLIFY: process.env.NETLIFY,
    CONTEXT: process.env.CONTEXT,
    RATE_LIMIT_ALLOW_MEMORY_FALLBACK: process.env.RATE_LIMIT_ALLOW_MEMORY_FALLBACK,
};

const mockRedisLimiters = [];
const mockUpstashRedis = {
    Redis: class MockRedis {
        constructor(config) {
            this.config = config;
        }
    },
};
const mockUpstashRatelimit = {
    Ratelimit: class MockRatelimit {
        static slidingWindow(tokens, window) {
            return { tokens, window };
        }

        constructor(config) {
            this.config = config;
            this.requests = new Map();
            mockRedisLimiters.push(this);
        }

        async limit(identifier) {
            const count = (this.requests.get(identifier) || 0) + 1;
            this.requests.set(identifier, count);

            const limit = this.config.limiter.tokens;
            return {
                success: count <= limit,
                limit,
                remaining: Math.max(0, limit - count),
                reset: Date.now() + 60000,
            };
        }
    },
};

// Clear module cache before each test so we get a fresh module state
beforeEach(() => {
    vi.resetModules();
    mockRedisLimiters.length = 0;
    // Ensure Upstash env vars are NOT set (forces in-memory fallback)
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.NETLIFY;
    delete process.env.CONTEXT;
    delete process.env.RATE_LIMIT_ALLOW_MEMORY_FALLBACK;
    process.env.NODE_ENV = 'test';
});

afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_ENV.NODE_ENV;
    process.env.NETLIFY = ORIGINAL_ENV.NETLIFY;
    process.env.CONTEXT = ORIGINAL_ENV.CONTEXT;
    process.env.RATE_LIMIT_ALLOW_MEMORY_FALLBACK = ORIGINAL_ENV.RATE_LIMIT_ALLOW_MEMORY_FALLBACK;
});

describe('rate-limiter (in-memory fallback)', () => {
    it('allows requests within the limit', async () => {
        const { checkRateLimit } = await import('./rate-limiter.js');
        const result = await checkRateLimit('127.0.0.1', 5, 60000);

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(4);
        expect(result.backend).toBe('memory');
    });

    it('blocks requests exceeding the limit', async () => {
        const { checkRateLimit } = await import('./rate-limiter.js');

        // Exhaust the limit
        for (let i = 0; i < 5; i++) {
            await checkRateLimit('10.0.0.1', 5, 60000);
        }

        // 6th request should be blocked
        const result = await checkRateLimit('10.0.0.1', 5, 60000);
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
    });

    it('tracks different IPs independently', async () => {
        const { checkRateLimit } = await import('./rate-limiter.js');

        // Exhaust limit for IP A
        for (let i = 0; i < 3; i++) {
            await checkRateLimit('192.168.1.1', 3, 60000);
        }

        // IP B should still be allowed
        const resultB = await checkRateLimit('192.168.1.2', 3, 60000);
        expect(resultB.allowed).toBe(true);

        // IP A should be blocked
        const resultA = await checkRateLimit('192.168.1.1', 3, 60000);
        expect(resultA.allowed).toBe(false);
    });

    it('returns correct structure from getRateLimitInfo', async () => {
        const { getRateLimitInfo } = await import('./rate-limiter.js');
        const info = getRateLimitInfo();

        expect(info).toHaveProperty('backend', 'memory');
        expect(info).toHaveProperty('instanceId');
        expect(info).toHaveProperty('instanceRequests');
        expect(info).toHaveProperty('memoryStoreSize');
        expect(info).toHaveProperty('redisConfigured', false);
        expect(info).toHaveProperty('fallbackAllowed', true);
    });

    it('checkStrictRateLimit enforces lower limits', async () => {
        const { checkStrictRateLimit } = await import('./rate-limiter.js');

        // Strict: 2 requests per window
        const r1 = await checkStrictRateLimit('strict-ip', 2, 60000);
        expect(r1.allowed).toBe(true);

        const r2 = await checkStrictRateLimit('strict-ip', 2, 60000);
        expect(r2.allowed).toBe(true);

        const r3 = await checkStrictRateLimit('strict-ip', 2, 60000);
        expect(r3.allowed).toBe(false);
    });

    it('keeps a credential quota stable across IPs without exposing the credential', async () => {
        const { checkRateLimit, getCredentialRateLimitKey } = await import('./rate-limiter.js');
        const credential = 'alt_test_secret_should_not_be_in_a_rate_limit_key';
        const credentialKey = getCredentialRateLimitKey('generate-alt-text', credential);

        expect(credentialKey).toMatch(/^generate-alt-text:credential:[a-f0-9]{64}$/);
        expect(credentialKey).not.toContain(credential);

        await checkRateLimit(credentialKey, 2, 60000);
        await checkRateLimit(credentialKey, 2, 60000);
        const blocked = await checkRateLimit(credentialKey, 2, 60000);

        expect(blocked.allowed).toBe(false);
        expect(getCredentialRateLimitKey('generate-alt-text', credential)).toBe(credentialKey);
        expect(getCredentialRateLimitKey('generate-alt-text', 'a-different-credential')).not.toBe(credentialKey);
        expect(getCredentialRateLimitKey('get-usage', credential)).not.toBe(credentialKey);
    });
});

describe('rate-limiter (production fail-closed)', () => {
    it('returns an unavailable backend when distributed rate limiting is required but Upstash is missing', async () => {
        process.env.NODE_ENV = 'production';
        process.env.NETLIFY = 'true';
        process.env.CONTEXT = 'production';

        const { checkRateLimit, getRateLimitInfo } = await import('./rate-limiter.js');
        const result = await checkRateLimit('prod-ip', 5, 60000);
        const info = getRateLimitInfo();

        expect(result.allowed).toBe(false);
        expect(result.backend).toBe('unavailable');
        expect(result.statusCode).toBe(503);
        expect(info.backend).toBe('unavailable');
        expect(info.fallbackAllowed).toBe(false);
    });

    it('returns an unavailable backend when Redis initialization fails in production', async () => {
        process.env.NODE_ENV = 'production';
        process.env.NETLIFY = 'true';
        process.env.CONTEXT = 'production';
        process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.test';
        process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

        const originalModuleLoad = Module._load;
        Module._load = function load(request, parent, isMain) {
            if (request === '@upstash/redis') {
                throw new Error('redis init failed');
            }
            return originalModuleLoad.call(this, request, parent, isMain);
        };

        try {
            const { checkRateLimit } = await import('./rate-limiter.js');
            const result = await checkRateLimit('prod-ip', 5, 60000);

            expect(result.allowed).toBe(false);
            expect(result.backend).toBe('unavailable');
            expect(result.statusCode).toBe(503);
        } finally {
            Module._load = originalModuleLoad;
        }
    });
});

describe('rate-limiter (Upstash Redis)', () => {
    let originalModuleLoad;

    beforeEach(() => {
        process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.test';
        process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

        originalModuleLoad = Module._load;
        Module._load = function load(request, parent, isMain) {
            if (request === '@upstash/redis') return mockUpstashRedis;
            if (request === '@upstash/ratelimit') return mockUpstashRatelimit;
            return originalModuleLoad.call(this, request, parent, isMain);
        };
    });

    afterEach(() => {
        Module._load = originalModuleLoad;
    });

    it('enforces the requested Redis policy instead of the default 60/minute policy', async () => {
        const { checkRateLimit } = await import('./rate-limiter.js');

        const first = await checkRateLimit('admin-delete:127.0.0.1', 10, 60000);
        expect(first.allowed).toBe(true);
        expect(first.limit).toBe(10);
        expect(first.remaining).toBe(9);
        expect(first.backend).toBe('redis');

        for (let i = 0; i < 9; i++) {
            await checkRateLimit('admin-delete:127.0.0.1', 10, 60000);
        }

        const blocked = await checkRateLimit('admin-delete:127.0.0.1', 10, 60000);
        expect(blocked.allowed).toBe(false);
        expect(blocked.remaining).toBe(0);

        expect(mockRedisLimiters).toHaveLength(1);
        expect(mockRedisLimiters[0].config.limiter).toEqual({ tokens: 10, window: '60 s' });
        expect(mockRedisLimiters[0].config.prefix).toBe('alttext:ratelimit:10:60');
    });

    it('keeps different Redis policies isolated and reuses each policy limiter', async () => {
        const { checkRateLimit } = await import('./rate-limiter.js');

        await checkRateLimit('admin:127.0.0.1', 30, 60000);
        await checkRateLimit('admin-delete:127.0.0.1', 10, 60000);
        await checkRateLimit('admin:127.0.0.1', 30, 60000);
        await checkRateLimit('admin-delete:127.0.0.1', 10, 60000);

        for (let i = 0; i < 28; i++) {
            await checkRateLimit('admin:127.0.0.1', 30, 60000);
        }

        const blockedAdminRequest = await checkRateLimit('admin:127.0.0.1', 30, 60000);
        expect(blockedAdminRequest.allowed).toBe(false);

        expect(mockRedisLimiters).toHaveLength(2);
        expect(mockRedisLimiters.map(({ config }) => config.limiter)).toEqual([
            { tokens: 30, window: '60 s' },
            { tokens: 10, window: '60 s' },
        ]);
    });
});
