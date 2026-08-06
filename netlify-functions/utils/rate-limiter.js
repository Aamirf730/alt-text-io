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

const crypto = require('node:crypto');

let redisClient = null;
let RatelimitClass = null;
const redisRateLimiters = new Map();
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
        RatelimitClass = Ratelimit;

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

/**
 * Get a Redis limiter for the requested policy.
 *
 * Each policy gets its own limiter and Redis keyspace. This is important because
 * the same client IP can use multiple endpoints with different limits; sharing a
 * single 60/minute limiter would silently weaken stricter endpoint policies.
 */
function getRedisRateLimiter(maxRequests, windowMs) {
    if (!RatelimitClass || !redisClient) return null;

    const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
    const policyKey = `${maxRequests}:${windowSeconds}`;
    const existingLimiter = redisRateLimiters.get(policyKey);
    if (existingLimiter) return existingLimiter;

    // Keep the original namespace for the default policy so existing counters
    // continue to work across the change. Non-default policies are isolated from
    // it and from one another.
    const prefix = policyKey === '60:60'
        ? 'alttext:ratelimit'
        : `alttext:ratelimit:${policyKey}`;

    const limiter = new RatelimitClass({
        redis: redisClient,
        limiter: RatelimitClass.slidingWindow(maxRequests, `${windowSeconds} s`),
        analytics: true,
        prefix,
    });

    redisRateLimiters.set(policyKey, limiter);
    return limiter;
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
        console.warn(`[RateLimiter:Memory] Identifier ${key} exceeded limit (${entry.count}/${maxRequests}) on instance ${INSTANCE_ID}`);
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

    let limiter = null;
    if (useRedis) {
        try {
            limiter = getRedisRateLimiter(maxRequests, windowMs);
        } catch (err) {
            console.error('[RateLimiter] Failed to create Redis limiter, falling back to memory:', err.message);
            return checkMemoryRateLimit(identifier, maxRequests, windowMs);
        }
    }

    if (limiter) {
        try {
            const result = await limiter.limit(identifier);

            if (!result.success) {
                console.warn(`[RateLimiter:Redis] Identifier ${identifier} exceeded limit`);
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
 * Build a safe, deterministic identifier for an authenticated credential.
 *
 * API keys and access tokens must never be written to Redis keys or logs. The
 * authenticated generation endpoint uses this to enforce a quota that follows
 * the credential across IP addresses without exposing the credential itself.
 *
 * @param {string} endpoint - Endpoint namespace for the quota
 * @param {string} credential - API key or stable authenticated user identity
 * @returns {string} - Namespaced, one-way hashed rate-limit identifier
 */
function getCredentialRateLimitKey(endpoint, credential) {
    const digest = crypto
        .createHash('sha256')
        .update(String(credential))
        .digest('hex');

    return `${endpoint}:credential:${digest}`;
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
    getCredentialRateLimitKey,
    getRateLimitInfo,
    INSTANCE_ID,
};
