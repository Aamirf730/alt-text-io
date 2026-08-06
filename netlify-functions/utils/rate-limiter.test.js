import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Module from 'node:module';

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
