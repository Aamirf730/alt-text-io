/**
 * Audit Logger for Alt-Text Pro
 * File: netlify-functions/utils/audit-logger.js
 *
 * Records security-sensitive operations to the audit_logs table in Supabase.
 * All entries are immutable (append-only) for compliance and forensics.
 *
 * Usage:
 *   const { auditLog, ACTIONS } = require('./utils/audit-logger');
 *
 *   await auditLog({
 *     action: ACTIONS.SUBSCRIPTION_UPGRADE,
 *     actorId: userId,
 *     resourceType: 'profile',
 *     resourceId: userId,
 *     details: { from: 'free', to: 'tier1' },
 *     event,  // Netlify event for IP/UA extraction
 *   });
 */

const { createClient } = require('@supabase/supabase-js');

// ─────────────────────────────────────────────────────────────────────────────
// ACTION CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const ACTIONS = {
    // Credit operations
    CREDIT_DEDUCT: 'credit.deduct',
    CREDIT_ADD: 'credit.add',
    CREDIT_RESET: 'credit.reset',

    // Subscription operations
    SUBSCRIPTION_UPGRADE: 'subscription.upgrade',
    SUBSCRIPTION_DOWNGRADE: 'subscription.downgrade',
    SUBSCRIPTION_CANCEL: 'subscription.cancel',
    SUBSCRIPTION_RENEW: 'subscription.renew',

    // API key operations
    API_KEY_CREATE: 'api_key.create',
    API_KEY_REVOKE: 'api_key.revoke',
    API_KEY_VALIDATE: 'api_key.validate',

    // Admin operations
    ADMIN_DELETE_USER: 'admin.delete_user',
    ADMIN_GET_USERS: 'admin.get_users',
    ADMIN_UPDATE_USER: 'admin.update_user',

    // Auth operations
    AUTH_LOGIN: 'auth.login',
    AUTH_SIGNUP: 'auth.signup',
    AUTH_PASSWORD_RESET: 'auth.password_reset',

    // Payment operations
    PAYMENT_COMPLETED: 'payment.completed',
    PAYMENT_FAILED: 'payment.failed',
    PAYMENT_REFUNDED: 'payment.refunded',
};

const SEVERITY = {
    INFO: 'info',
    WARNING: 'warning',
    CRITICAL: 'critical',
};

// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE CLIENT (service role — bypasses RLS)
// ─────────────────────────────────────────────────────────────────────────────

let _supabaseAdmin = null;

function getSupabaseAdmin() {
    if (_supabaseAdmin) return _supabaseAdmin;

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        return null; // Gracefully degrade — don't crash if env vars missing
    }

    _supabaseAdmin = createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    return _supabaseAdmin;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract IP and User-Agent from a Netlify event object.
 */
function extractRequestMeta(event) {
    if (!event) return {};

    const headers = event.headers || {};
    return {
        ip_address:
            headers['x-forwarded-for']?.split(',')[0]?.trim() ||
            headers['client-ip'] ||
            null,
        user_agent: headers['user-agent'] || null,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Write an audit log entry.
 *
 * @param {Object} params
 * @param {string} params.action        - Action constant from ACTIONS
 * @param {string} [params.actorId]     - UUID of the user performing the action
 * @param {string} [params.actorEmail]  - Email of the actor (for easy querying)
 * @param {string} [params.resourceType] - Type of resource affected
 * @param {string} [params.resourceId]  - ID of the affected resource
 * @param {Object} [params.details]     - Additional context as JSON
 * @param {string} [params.severity]    - 'info' | 'warning' | 'critical'
 * @param {Object} [params.event]       - Netlify event for IP/UA extraction
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function auditLog({
    action,
    actorId = null,
    actorEmail = null,
    resourceType = null,
    resourceId = null,
    details = {},
    severity = SEVERITY.INFO,
    event = null,
}) {
    // Always log to structured console (works even without Supabase)
    const logEntry = {
        audit: true,
        action,
        actorId,
        actorEmail,
        resourceType,
        resourceId,
        severity,
        details,
        timestamp: new Date().toISOString(),
    };
    console.log(JSON.stringify(logEntry));

    // Persist to Supabase
    const supabase = getSupabaseAdmin();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    const requestMeta = extractRequestMeta(event);

    try {
        const { error } = await supabase.from('audit_logs').insert({
            actor_id: actorId,
            actor_email: actorEmail,
            action,
            resource_type: resourceType,
            resource_id: resourceId,
            details,
            severity,
            ...requestMeta,
        });

        if (error) {
            console.error(JSON.stringify({ audit_persist_error: error.message }));
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (err) {
        // Never let audit logging crash the main request
        console.error(JSON.stringify({ audit_persist_error: err.message }));
        return { success: false, error: err.message };
    }
}

module.exports = {
    auditLog,
    ACTIONS,
    SEVERITY,
    extractRequestMeta,
};
