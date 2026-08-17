/**
 * Health Check Endpoint
 * File: netlify-functions/health.js
 *
 * Provides service health status for monitoring tools (UptimeRobot, Pingdom, etc).
 *
 * Endpoints (via query param):
 *   GET /.netlify/functions/health              → liveness and rate-limit backend check
 *   Detailed db, ai, and all checks require X-Health-Check-Secret.
 */

const { createClient } = require('@supabase/supabase-js');
const { timingSafeEqual } = require('node:crypto');
const { reportInfo, reportError } = require('./utils/error-reporter');
const {
    checkRateLimitHealth,
    getRateLimitStatus,
} = require('./utils/rate-limiter');
const {
    checkRateLimit,
    getClientIp,
    rateLimitExceededResponse,
} = require('./utils/cors');

const HEALTH_RATE_LIMIT = 30;
const HEALTH_RATE_WINDOW_MS = 60 * 1000;
const HEALTH_DATABASE_TIMEOUT_MS = 3000;

// Lazy-init Supabase only when needed
let _supabase = null;
function getSupabase() {
    if (!_supabase) {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !key) return null;
        _supabase = createClient(url, key);
    }
    return _supabase;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Individual checks
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Basic liveness — always succeeds if the function is running.
 */
function checkBasic() {
    return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
    };
}

function withTimeout(promise, timeoutMs) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
            settled = true;
            reject(new Error('Database health check timed out'));
        }, timeoutMs);

        Promise.resolve(promise).then(
            (value) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                reject(error);
            },
        );
    });
}

/**
 * Database connectivity — runs a lightweight query against Supabase.
 */
async function checkDatabase() {
    const start = Date.now();
    const supabase = getSupabase();

    if (!supabase) {
        return {
            status: 'unhealthy',
            latency_ms: 0,
            error: 'database_unavailable',
        };
    }

    try {
        // Simple count query — fast and low-cost
        const query = supabase
            .from('profiles')
            .select('id', { head: true });
        const request = typeof query?.abortSignal === 'function'
            ? query.abortSignal(AbortSignal.timeout(HEALTH_DATABASE_TIMEOUT_MS))
            : query;
        const { error } = await withTimeout(request, HEALTH_DATABASE_TIMEOUT_MS);

        const latency = Date.now() - start;

        if (error) {
            return {
                status: 'unhealthy',
                latency_ms: latency,
                error: 'database_unavailable',
            };
        }

        return {
            status: 'healthy',
            latency_ms: latency,
        };
    } catch (err) {
        return {
            status: 'unhealthy',
            latency_ms: Date.now() - start,
            error: 'database_unavailable',
        };
    }
}

/**
 * AI service reachability — pings the Gemini API endpoint.
 * Does NOT consume quota (just checks connectivity).
 */
async function checkAI() {
    const start = Date.now();
    const apiKey = process.env.AI_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return {
            status: 'unhealthy',
            latency_ms: 0,
            error: 'ai_unavailable',
        };
    }

    try {
        // List models endpoint — lightweight, doesn't consume generation quota
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=1`,
            { signal: AbortSignal.timeout(5000) }
        );

        const latency = Date.now() - start;

        if (!res.ok) {
            return {
                status: 'unhealthy',
                latency_ms: latency,
                http_status: res.status,
                error: 'ai_unavailable',
            };
        }

        return {
            status: 'healthy',
            latency_ms: latency,
        };
    } catch (err) {
        return {
            status: 'unhealthy',
            latency_ms: Date.now() - start,
            error: 'ai_unavailable',
        };
    }
}

/**
 * Rate-limit backend health — verifies the active backend can actually serve
 * requests, rather than only reporting that its client initialized.
 */
async function checkRateLimiter() {
    return checkRateLimitHealth();
}

/**
 * Public liveness status — reports configuration without probing Redis.
 */
function checkRateLimiterStatus() {
    return getRateLimitStatus();
}

// ═══════════════════════════════════════════════════════════════════════════════
// Handler
// ═══════════════════════════════════════════════════════════════════════════════

function getHeader(headers, name) {
    const target = name.toLowerCase();
    const key = Object.keys(headers || {}).find((header) => header.toLowerCase() === target);
    return key ? headers[key] : undefined;
}

function secretsMatch(provided, expected) {
    if (!provided || !expected) return false;
    const providedBuffer = Buffer.from(String(provided));
    const expectedBuffer = Buffer.from(String(expected));
    return providedBuffer.length === expectedBuffer.length
        && timingSafeEqual(providedBuffer, expectedBuffer);
}

function isDetailedCheckAuthorized(event) {
    return secretsMatch(
        getHeader(event.headers, 'x-health-check-secret'),
        process.env.HEALTH_CHECK_SECRET,
    );
}

function createHandler({
    checkRateLimitFn = checkRateLimit,
    checkRateLimiterFn = checkRateLimiter,
    checkRateLimiterStatusFn = checkRateLimiterStatus,
} = {}) {
    return async function handler(event) {
        // Health checks should always respond, even without CORS
        const headers = {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store',
        };

        if (event.httpMethod !== 'GET') {
            return {
                statusCode: 405,
                headers,
                body: JSON.stringify({ error: 'Method not allowed' }),
            };
        }

        const healthRateLimit = await checkRateLimitFn(
            `health:${getClientIp(event)}`,
            HEALTH_RATE_LIMIT,
            HEALTH_RATE_WINDOW_MS,
        );
        if (!healthRateLimit.allowed && healthRateLimit.backend !== 'unavailable') {
            return rateLimitExceededResponse(headers, healthRateLimit);
        }

        const check = (event.queryStringParameters?.check || 'basic').toLowerCase();
        const isDetailedCheck = ['db', 'database', 'ai', 'gemini', 'all', 'full'].includes(check);

        if (isDetailedCheck && !isDetailedCheckAuthorized(event)) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ error: 'Detailed health check is not available' }),
            };
        }

        try {
            let result;

            switch (check) {
                case 'db':
                case 'database':
                    result = {
                        service: 'alt-text-pro',
                        checks: {
                            basic: checkBasic(),
                            rate_limiter: await checkRateLimiterFn(),
                            database: await checkDatabase(),
                        },
                    };
                    break;

                case 'ai':
                case 'gemini':
                    result = {
                        service: 'alt-text-pro',
                        checks: {
                            basic: checkBasic(),
                            rate_limiter: await checkRateLimiterFn(),
                            ai: await checkAI(),
                        },
                    };
                    break;

                case 'all':
                case 'full': {
                    const [db, ai, rateLimiter] = await Promise.all([
                        checkDatabase(),
                        checkAI(),
                        checkRateLimiterFn(),
                    ]);
                    result = {
                        service: 'alt-text-pro',
                        checks: {
                            basic: checkBasic(),
                            rate_limiter: rateLimiter,
                            database: db,
                            ai,
                        },
                    };
                    break;
                }

                default:
                    // Basic liveness check — no external health probes.
                    result = {
                        service: 'alt-text-pro',
                        checks: {
                            basic: checkBasic(),
                            rate_limiter: checkRateLimiterStatusFn(),
                        },
                    };
            }

            // Determine overall status
            const allChecks = Object.values(result.checks);
            const overall = allChecks.every((c) => c.status === 'healthy') ? 'healthy' : 'degraded';
            result.status = overall;

            const statusCode = overall === 'healthy' ? 200 : 503;

            reportInfo(`Health check: ${check} → ${overall}`, {
                functionName: 'health',
                extra: { check, overall },
            });

            return {
                statusCode,
                headers,
                body: JSON.stringify(result, null, 2),
            };
        } catch (error) {
            reportError(error, { functionName: 'health' });
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    service: 'alt-text-pro',
                    status: 'unhealthy',
                    error: 'health_check_failed',
                }),
            };
        }
    };
}

const handler = createHandler();

exports.handler = handler;
exports._private = {
    checkBasic,
    checkRateLimiter,
    checkRateLimiterStatus,
    createHandler,
    isDetailedCheckAuthorized,
    secretsMatch,
    HEALTH_RATE_LIMIT,
    HEALTH_RATE_WINDOW_MS,
    HEALTH_DATABASE_TIMEOUT_MS,
    withTimeout,
};
