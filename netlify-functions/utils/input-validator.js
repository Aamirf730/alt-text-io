/**
 * Input Validation & Sanitization Utilities
 * File: netlify-functions/utils/input-validator.js
 *
 * Shared validation functions used across all Netlify functions
 * to prevent injection attacks, enforce size limits, and sanitize user input.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const LIMITS = {
    // String field lengths
    MAX_NAME_LENGTH: 200,
    MAX_EMAIL_LENGTH: 254,        // RFC 5321
    MAX_SUBJECT_LENGTH: 500,
    MAX_MESSAGE_LENGTH: 10000,
    MAX_CONTEXT_LENGTH: 2000,     // Alt-text context field
    MAX_TOKEN_LENGTH: 4096,       // JWT / API key

    // Array limits
    MAX_EMAILS_TO_DELETE: 50,

    // Body size
    MAX_JSON_BODY_SIZE: 25 * 1024 * 1024, // 25 MB (for base64 images)
    MAX_SMALL_BODY_SIZE: 64 * 1024,       // 64 KB (for normal forms)
};

// ═══════════════════════════════════════════════════════════════════════════════
// PARSING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Safely parse JSON from the request body with size validation.
 *
 * @param {string} body - Raw request body
 * @param {Object} options
 * @param {number} options.maxSize - Max body size in bytes (default: 64KB)
 * @returns {{ data: Object|null, error: string|null }}
 */
function parseJsonBody(body, { maxSize = LIMITS.MAX_SMALL_BODY_SIZE } = {}) {
    if (!body) {
        return { data: null, error: 'Request body is required' };
    }

    if (typeof body !== 'string') {
        return { data: null, error: 'Request body must be a string' };
    }

    if (Buffer.byteLength(body, 'utf8') > maxSize) {
        const maxMB = (maxSize / 1024 / 1024).toFixed(1);
        return { data: null, error: `Request body exceeds maximum size of ${maxMB}MB` };
    }

    try {
        const parsed = JSON.parse(body);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            return { data: null, error: 'Request body must be a JSON object' };
        }
        return { data: parsed, error: null };
    } catch (e) {
        return { data: null, error: 'Invalid JSON in request body' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STRING VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Sanitize a string: trim whitespace and optionally strip HTML tags.
 *
 * @param {*} value - Input value
 * @param {Object} options
 * @param {boolean} options.stripHtml - Remove HTML tags (default: true)
 * @returns {string} - Sanitized string or empty string
 */
function sanitizeString(value, { stripHtml = true } = {}) {
    if (value === null || value === undefined) return '';
    const str = String(value).trim();
    if (stripHtml) {
        return str.replace(/<[^>]*>/g, '');
    }
    return str;
}

/**
 * Validate a string field against length constraints.
 *
 * @param {*} value - Input value
 * @param {string} fieldName - Human-readable field name for error messages
 * @param {Object} options
 * @param {boolean} options.required - Whether the field is required
 * @param {number} options.maxLength - Maximum allowed length
 * @param {number} options.minLength - Minimum allowed length (default: 1 if required)
 * @returns {{ value: string, error: string|null }}
 */
function validateString(value, fieldName, { required = false, maxLength = 1000, minLength } = {}) {
    const sanitized = sanitizeString(value);

    if (required && sanitized.length === 0) {
        return { value: '', error: `${fieldName} is required` };
    }

    if (sanitized.length === 0) {
        return { value: '', error: null };
    }

    const min = minLength !== undefined ? minLength : (required ? 1 : 0);
    if (sanitized.length < min) {
        return { value: sanitized, error: `${fieldName} must be at least ${min} characters` };
    }

    if (sanitized.length > maxLength) {
        return { value: sanitized, error: `${fieldName} must be at most ${maxLength} characters` };
    }

    return { value: sanitized, error: null };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate an email address.
 *
 * @param {*} value - Input value
 * @param {Object} options
 * @param {boolean} options.required - Whether the field is required
 * @returns {{ value: string, error: string|null }}
 */
function validateEmail(value, { required = false } = {}) {
    const sanitized = sanitizeString(value);

    if (required && !sanitized) {
        return { value: '', error: 'Email is required' };
    }

    if (!sanitized) {
        return { value: '', error: null };
    }

    if (sanitized.length > LIMITS.MAX_EMAIL_LENGTH) {
        return { value: sanitized, error: `Email must be at most ${LIMITS.MAX_EMAIL_LENGTH} characters` };
    }

    // RFC 5322 simplified — covers 99%+ of real emails
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!emailRegex.test(sanitized)) {
        return { value: sanitized, error: 'Invalid email format' };
    }

    return { value: sanitized, error: null };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ARRAY VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate an array of emails.
 *
 * @param {*} value - Input value (should be an array)
 * @param {Object} options
 * @param {number} options.maxItems - Maximum array length
 * @returns {{ value: string[], error: string|null }}
 */
function validateEmailArray(value, { maxItems = LIMITS.MAX_EMAILS_TO_DELETE } = {}) {
    if (!Array.isArray(value)) {
        return { value: [], error: 'Expected an array of email addresses' };
    }

    if (value.length === 0) {
        return { value: [], error: 'At least one email address is required' };
    }

    if (value.length > maxItems) {
        return { value: [], error: `Maximum of ${maxItems} emails per request` };
    }

    const validated = [];
    for (let i = 0; i < value.length; i++) {
        const { value: email, error } = validateEmail(value[i], { required: true });
        if (error) {
            return { value: [], error: `Invalid email at position ${i + 1}: ${error}` };
        }
        validated.push(email);
    }

    return { value: validated, error: null };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH TOKEN VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract and validate the authorization token from headers.
 *
 * @param {Object} headers - Request headers
 * @returns {{ token: string|null, error: string|null }}
 */
function validateAuthToken(headers) {
    const authHeader = headers?.authorization || headers?.Authorization;

    if (!authHeader) {
        return { token: null, error: 'Authorization header required' };
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
        return { token: null, error: 'Authorization token is empty' };
    }

    if (token.length > LIMITS.MAX_TOKEN_LENGTH) {
        return { token: null, error: 'Authorization token is too long' };
    }

    // Check for obviously malicious tokens (null bytes, control chars)
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(token)) {
        return { token: null, error: 'Authorization token contains invalid characters' };
    }

    return { token, error: null };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVENIENCE: Build 400 response
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a standard 400 Bad Request response.
 *
 * @param {Object} headers - CORS headers
 * @param {string} message - Error message
 * @returns {Object} Netlify response
 */
function badRequest(headers, message) {
    return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: message }),
    };
}

/**
 * Create a standard 401 Unauthorized response.
 *
 * @param {Object} headers - CORS headers
 * @param {string} message - Error message
 * @returns {Object} Netlify response
 */
function unauthorized(headers, message = 'Authorization required') {
    return {
        statusCode: 401,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: message }),
    };
}

module.exports = {
    LIMITS,
    parseJsonBody,
    sanitizeString,
    validateString,
    validateEmail,
    validateEmailArray,
    validateAuthToken,
    badRequest,
    unauthorized,
};
