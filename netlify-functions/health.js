/**
 * Health Check Endpoint
 * File: netlify-functions/health.js
 *
 * Provides service health status for monitoring tools (UptimeRobot, Pingdom, etc).
 *
 * Endpoints (via query param):
 *   GET /.netlify/functions/health              → basic liveness check
 *   GET /.netlify/functions/health?check=db     → database connectivity
 *   GET /.netlify/functions/health?check=ai     → AI service (Gemini) reachability
 *   GET /.netlify/functions/health?check=all    → all checks combined
 */

const { createClient } = require('@supabase/supabase-js');
const { reportInfo, reportError } = require('./utils/error-reporter');

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
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        environment: process.env.CONTEXT || process.env.NODE_ENV || 'unknown',
        version: process.env.COMMIT_REF?.substring(0, 8) || 'local',
        node: process.version,
    };
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
            error: 'Supabase not configured (missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)',
        };
    }

    try {
        // Simple count query — fast and low-cost
        const { count, error } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });

        const latency = Date.now() - start;

        if (error) {
            return {
                status: 'unhealthy',
                latency_ms: latency,
                error: error.message,
            };
        }

        return {
            status: 'healthy',
            latency_ms: latency,
            row_count: count,
        };
    } catch (err) {
        return {
            status: 'unhealthy',
            latency_ms: Date.now() - start,
            error: err.message,
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
            error: 'AI_API_KEY or GEMINI_API_KEY not configured',
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
            const body = await res.text();
            return {
                status: 'unhealthy',
                latency_ms: latency,
                http_status: res.status,
                error: body
                    .replace(/api_key:[A-Za-z0-9_-]+/g, 'api_key:[redacted]')
                    .replace(/key=[A-Za-z0-9_-]+/g, 'key=[redacted]')
                    .substring(0, 200),
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
            error: err.message,
        };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Handler
// ═══════════════════════════════════════════════════════════════════════════════

exports.handler = async (event) => {
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

    const check = (event.queryStringParameters?.check || 'basic').toLowerCase();

    try {
        let result;

        switch (check) {
            case 'db':
            case 'database':
                result = {
                    service: 'alt-text-pro',
                    checks: {
                        basic: checkBasic(),
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
                        ai: await checkAI(),
                    },
                };
                break;

            case 'all':
            case 'full': {
                const [db, ai] = await Promise.all([checkDatabase(), checkAI()]);
                result = {
                    service: 'alt-text-pro',
                    checks: {
                        basic: checkBasic(),
                        database: db,
                        ai,
                    },
                };
                break;
            }

            default:
                // Basic liveness check — fast, no external calls
                result = {
                    service: 'alt-text-pro',
                    checks: {
                        basic: checkBasic(),
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
                error: error.message,
            }),
        };
    }
};
