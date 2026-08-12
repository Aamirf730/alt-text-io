/**
 * Error Monitoring & Reporting
 * File: netlify-functions/utils/error-reporter.js
 *
 * Provides structured error logging for all Netlify functions.
 * Optionally integrates with Sentry when SENTRY_DSN is configured.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * SETUP: Optional Sentry Integration
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * 1. Create a free account at https://sentry.io/
 * 2. Create a new Node.js project
 * 3. Copy the DSN and add to Netlify env vars:
 *      SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
 *
 * Without Sentry, all errors are logged as structured JSON to stdout/stderr,
 * which is captured by Netlify's built-in log system.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

let sentryClient = null;
let sentryInitAttempted = false;

const ENVIRONMENT = process.env.CONTEXT || process.env.NODE_ENV || 'development';
const APP_VERSION = process.env.COMMIT_REF?.substring(0, 8) || 'local';
const SENSITIVE_CONTEXT_KEY = /(authorization|cookie|secret|token|api.?key|password|email|user.?id|actor|ip|body|query|alt.?text|image)/i;

function sanitizeText(value) {
    return String(value || '')
        .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [redacted]')
        .replace(/\b(?:alt|altai)_[A-Za-z0-9_-]{8,}\b/g, '[redacted-api-key]')
        .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted-email]')
        .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, '[redacted-id]')
        .slice(0, 4000);
}

function sanitizeArray(items, depth) {
    if (depth > 3) return [];

    return items.slice(0, 20).map((item) => {
        if (typeof item === 'string') return sanitizeText(item).slice(0, 500);
        if (typeof item === 'number' || typeof item === 'boolean' || item === null) return item;
        if (Array.isArray(item)) return sanitizeArray(item, depth + 1);
        if (item && typeof item === 'object') return sanitizeExtra(item, depth);
        return undefined;
    }).filter((item) => item !== undefined);
}

function sanitizeExtra(extra, depth = 0) {
    if (!extra || typeof extra !== 'object' || depth > 3) return undefined;

    const output = {};
    for (const [key, value] of Object.entries(extra).slice(0, 40)) {
        if (SENSITIVE_CONTEXT_KEY.test(key)) continue;

        if (typeof value === 'string') output[key] = sanitizeText(value).slice(0, 500);
        else if (typeof value === 'number' || typeof value === 'boolean' || value === null) output[key] = value;
        else if (Array.isArray(value)) output[key] = sanitizeArray(value, depth + 1);
        else if (typeof value === 'object') output[key] = sanitizeExtra(value, depth + 1);
    }

    return output;
}

/**
 * Lazy-init Sentry (only when DSN is configured)
 */
function initSentry() {
    if (sentryInitAttempted) return !!sentryClient;
    sentryInitAttempted = true;

    const dsn = process.env.SENTRY_DSN;
    if (!dsn) {
        // Sentry not configured — structured console logging only
        return false;
    }

    try {
        const Sentry = require('@sentry/node');
        Sentry.init({
            dsn,
            environment: ENVIRONMENT,
            release: `alt-text-pro@${APP_VERSION}`,
            tracesSampleRate: 0.1, // 10% of transactions
            sendDefaultPii: false,
            beforeSend(event) {
                // Scrub sensitive data
                if (event.request?.headers) {
                    delete event.request.headers['authorization'];
                    delete event.request.headers['x-api-key'];
                    delete event.request.headers['cookie'];
                }
                if (event.request) {
                    delete event.request.data;
                    delete event.request.query_string;
                }
                delete event.user;
                if (event.message) event.message = sanitizeText(event.message);
                if (event.logentry?.message) event.logentry.message = sanitizeText(event.logentry.message);
                for (const exception of event.exception?.values || []) {
                    if (exception.value) exception.value = sanitizeText(exception.value);
                    if (exception.stacktrace?.frames) {
                        for (const frame of exception.stacktrace.frames) {
                            delete frame.vars;
                        }
                    }
                }
                event.extra = sanitizeExtra(event.extra);
                return event;
            },
        });
        sentryClient = Sentry;
        console.log('[ErrorReporter] ✓ Sentry initialized');
        return true;
    } catch (err) {
        console.warn('[ErrorReporter] Sentry init failed:', err.message);
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEVERITY LEVELS
// ═══════════════════════════════════════════════════════════════════════════════
const Severity = {
    DEBUG: 'debug',
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    FATAL: 'fatal',
};

// ═══════════════════════════════════════════════════════════════════════════════
// STRUCTURED LOG ENTRY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build a structured log entry (always logged, independent of Sentry)
 */
function buildLogEntry(severity, message, context = {}) {
    return {
        timestamp: new Date().toISOString(),
        severity,
        message: sanitizeText(message),
        environment: ENVIRONMENT,
        version: APP_VERSION,
        function: context.functionName || 'unknown',
        ...(context.requestId && { requestId: sanitizeText(context.requestId).slice(0, 128) }),
        ...(context.extra && { extra: sanitizeExtra(context.extra) }),
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Report an error. Logs structured JSON and optionally sends to Sentry.
 *
 * @param {Error|string} error - The error or message
 * @param {Object} context - Additional context
 * @param {string} context.functionName - Name of the Netlify function
 * @param {string} context.requestId - Unique request identifier
 * @param {Object} context.extra - Any extra data
 */
function reportError(error, context = {}) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? sanitizeText(error.stack) : undefined;

    // Always log structured entry
    const entry = buildLogEntry(Severity.ERROR, message, context);
    if (stack) entry.stack = stack;
    console.error('[ERROR]', JSON.stringify(entry));

    // Send to Sentry if available
    initSentry();
    if (sentryClient) {
        sentryClient.withScope((scope) => {
            if (context.functionName) scope.setTag('function', context.functionName);
            if (context.extra) scope.setExtras(sanitizeExtra(context.extra) || {});

            if (error instanceof Error) {
                sentryClient.captureException(error);
            } else {
                sentryClient.captureMessage(message, 'error');
            }
        });
    }
}

/**
 * Report a warning (non-critical issue).
 */
function reportWarning(message, context = {}) {
    const entry = buildLogEntry(Severity.WARNING, message, context);
    console.warn('[WARN]', JSON.stringify(entry));

    initSentry();
    if (sentryClient) {
        sentryClient.withScope((scope) => {
            if (context.functionName) scope.setTag('function', context.functionName);
            if (context.extra) scope.setExtras(sanitizeExtra(context.extra) || {});
            sentryClient.captureMessage(message, 'warning');
        });
    }
}

/**
 * Log an info-level event (for monitoring dashboards).
 */
function reportInfo(message, context = {}) {
    const entry = buildLogEntry(Severity.INFO, message, context);
    console.log('[INFO]', JSON.stringify(entry));
}

/**
 * Wrap a Netlify function handler with automatic error monitoring.
 * Catches unhandled errors and reports them before returning a 500.
 *
 * Usage:
 *   const { withErrorReporting } = require('./utils/error-reporter');
 *   exports.handler = withErrorReporting('my-function', async (event, context) => {
 *     // your handler logic
 *   });
 *
 * @param {string} functionName - Name of this function (for tagging)
 * @param {Function} handler - The actual Netlify handler function
 * @returns {Function} - Wrapped handler
 */
function withErrorReporting(functionName, handler) {
    return async (event, netlifyContext) => {
        const requestId = event.headers?.['x-request-id'] ||
            event.headers?.['x-nf-request-id'] ||
            Math.random().toString(36).substring(2, 10);

        const startTime = Date.now();

        try {
            const result = await handler(event, netlifyContext);

            // Log slow requests (> 5 seconds)
            const duration = Date.now() - startTime;
            if (duration > 5000) {
                reportWarning(`Slow request: ${duration}ms`, {
                    functionName,
                    requestId,
                    extra: { duration, path: event.path, method: event.httpMethod },
                });
            }

            return result;
        } catch (error) {
            reportError(error, {
                functionName,
                requestId,
                extra: {
                    method: event.httpMethod,
                    path: event.path,
                },
            });

            // Flush Sentry before function terminates
            if (sentryClient) {
                try { await sentryClient.flush(2000); } catch (_) { /* ignore */ }
            }

            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Internal server error',
                    requestId,
                }),
            };
        }
    };
}

/**
 * Flush any pending Sentry events (call before function terminates in edge cases).
 */
async function flush(timeout = 2000) {
    if (sentryClient) {
        try { await sentryClient.flush(timeout); } catch (_) { /* ignore */ }
    }
}

module.exports = {
    reportError,
    reportWarning,
    reportInfo,
    withErrorReporting,
    flush,
    Severity,
    sanitizeExtra,
    sanitizeText,
};
