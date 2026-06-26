/**
 * Distributed Rate Limiter
 * File: netlify-functions/utils/rate-limiter.js
 *
 * Uses Upstash Redis for production-grade distributed rate limiting.
 * Falls back to in-memory rate limiting when Upstash is not configured.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * SETUP: Free Upstash Redis
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * 1. Create a free account at https://upstash.com/
 * 2. Create a new Redis database (pick the closest region)
 * 3. Copy the REST URL and Token from the database dashboard
 * 4. Add these to your Netlify environment variables:
 *      UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
 *      UPSTASH_REDIS_REST_TOKEN=AXxxxxxxxxxxxxxxxxxxxx
 *
 * The free tier gives you 10,000 commands/day which is plenty for rate limiting.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

let redisClient = null;
let rateLimiter = null;
let useRedis = false;

// Track initialization
let initAttempted = false;
let initError = null;

/**
 * Initialize Redis-based rate limiting (lazy, only on first use)
 */
function initRedis() {
    if (initAttempted) return useRedis;
    initAttempted = true;

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
        console.log('[RateLimiter] Upstash Redis not configured — using in-memory fallback.');
        console.log('[RateLimiter] Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for distributed rate limiting.');
        useRedis = false;
        return false;
    }

    try {
        const { Redis } = require('@upstash/redis');
        const { Ratelimit } = require('@upstash/ratelimit');

        redisClient = new Redis({ url, token });

        // Create a sliding window rate limiter
        // 60 requests per 60 seconds per key (IP address)
        rateLimiter = new Ratelimit({
            redis: redisClient,
            limiter: Ratelimit.slidingWindow(60, '60 s'),
            analytics: true,
            prefix: 'alttext:ratelimit',
        });

        useRedis = true;
        console.log('[RateLimiter] ✓ Upstash Redis connected — distributed rate limiting active.');
        return true;
    } catch (err) {
        initError = err;
        useRedis = false;
        console.error('[RateLimiter] Failed to initialize Upstash Redis:', err.message);
        console.log('[RateLimiter] Falling back to in-memory rate limiting.');
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// IN-MEMORY FALLBACK (for development or when Redis is not configured)
// ═══════════════════════════════════════════════════════════════════════════════
const memoryStore = new Map();
const INSTANCE_ID = Math.random().toString(36).substring(2, 8);
let instanceRequestCount = 0;

/**
 * In-memory rate limit check (fallback)
 */
function checkMemoryRateLimit(key, maxRequests, windowMs) {
    const now = Date.now();
    instanceRequestCount++;

    let entry = memoryStore.get(key);
    if (!entry || entry.windowStart + windowMs < now) {
        entry = { windowStart: now, count: 0 };
    }

    entry.count++;
    memoryStore.set(key, entry);

    const remaining = Math.max(0, maxRequests - entry.count);
    const resetAt = new Date(entry.windowStart + windowMs);
    const allowed = entry.count <= maxRequests;

    if (!allowed) {
        console.warn(`[RateLimiter:Memory] IP ${key} exceeded limit (${entry.count}/${maxRequests}) on instance ${INSTANCE_ID}`);
    }

    // Periodic cleanup
    if (memoryStore.size > 5000 || (instanceRequestCount % 1000 === 0 && memoryStore.size > 100)) {
        const cutoff = now - windowMs;
        for (const [k, v] of memoryStore) {
            if (v.windowStart < cutoff) memoryStore.delete(k);
        }
    }

    return {
        allowed,
        limit: maxRequests,
        remaining,
        resetAt,
        count: entry.count,
        backend: 'memory',
        instanceId: INSTANCE_ID,
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check rate limit for a given identifier (usually client IP).
 * Uses Upstash Redis if configured, otherwise falls back to in-memory.
 *
 * @param {string} identifier - Unique identifier (e.g., client IP)
 * @param {number} maxRequests - Max requests per window (default: 60)
 * @param {number} windowMs - Window duration in ms (default: 60000)
 * @returns {Promise<Object>} - { allowed, remaining, resetAt, backend }
 */
async function checkRateLimit(identifier, maxRequests = 60, windowMs = 60000) {
    // Lazy init
    initRedis();

    if (useRedis && rateLimiter) {
        try {
            const result = await rateLimiter.limit(identifier);

            if (!result.success) {
                console.warn(`[RateLimiter:Redis] IP ${identifier} exceeded limit`);
            }

            return {
                allowed: result.success,
                limit: maxRequests,
                remaining: result.remaining,
                resetAt: new Date(result.reset),
                count: maxRequests - result.remaining,
                backend: 'redis',
            };
        } catch (err) {
            // Redis error — fall back to memory for this request
            console.error('[RateLimiter] Redis error, falling back to memory:', err.message);
            return checkMemoryRateLimit(identifier, maxRequests, windowMs);
        }
    }

    // Fallback: in-memory
    return checkMemoryRateLimit(identifier, maxRequests, windowMs);
}

/**
 * Create a stricter rate limiter for sensitive endpoints (e.g., auth).
 * @param {string} identifier
 * @param {number} maxRequests - Default: 10
 * @param {number} windowMs - Default: 60000 (1 min)
 */
async function checkStrictRateLimit(identifier, maxRequests = 10, windowMs = 60000) {
    if (useRedis && redisClient) {
        try {
            const { Ratelimit } = require('@upstash/ratelimit');
            const strictLimiter = new Ratelimit({
                redis: redisClient,
                limiter: Ratelimit.slidingWindow(maxRequests, `${Math.round(windowMs / 1000)} s`),
                prefix: 'alttext:strict',
            });
            const result = await strictLimiter.limit(identifier);
            return {
                allowed: result.success,
                limit: maxRequests,
                remaining: result.remaining,
                resetAt: new Date(result.reset),
                backend: 'redis',
            };
        } catch (err) {
            return checkMemoryRateLimit(identifier, maxRequests, windowMs);
        }
    }
    return checkMemoryRateLimit(identifier, maxRequests, windowMs);
}

/**
 * Get rate limiting status info (for health checks / monitoring)
 */
function getRateLimitInfo() {
    initRedis();
    return {
        backend: useRedis ? 'redis' : 'memory',
        instanceId: INSTANCE_ID,
        instanceRequests: instanceRequestCount,
        memoryStoreSize: memoryStore.size,
        redisConfigured: !!process.env.UPSTASH_REDIS_REST_URL,
        initError: initError?.message || null,
    };
}

module.exports = {
    checkRateLimit,
    checkStrictRateLimit,
    getRateLimitInfo,
    INSTANCE_ID,
};
