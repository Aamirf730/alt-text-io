import { describe, it, expect, beforeEach, vi } from 'vitest';

// Clear module cache before each test so we get a fresh module state
beforeEach(() => {
    vi.resetModules();
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
