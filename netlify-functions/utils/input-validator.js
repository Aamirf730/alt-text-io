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
// OUTPUT LANGUAGE
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_ALT_TEXT_LANGUAGE = Object.freeze({ code: 'en', name: 'English' });

// Languages the generator is told to write in, keyed by lowercase BCP-47 tag.
// Regional entries only exist where the written language really differs.
// Anything not listed falls back to its primary language, then to English.
const ALT_TEXT_LANGUAGES = Object.freeze({
    af: 'Afrikaans',
    ar: 'Arabic',
    az: 'Azerbaijani',
    be: 'Belarusian',
    bg: 'Bulgarian',
    bn: 'Bengali',
    bs: 'Bosnian',
    ca: 'Catalan',
    cs: 'Czech',
    cy: 'Welsh',
    da: 'Danish',
    de: 'German',
    el: 'Greek',
    en: 'English',
    'en-gb': 'British English',
    'en-us': 'American English',
    es: 'Spanish',
    'es-419': 'Latin American Spanish',
    'es-mx': 'Mexican Spanish',
    et: 'Estonian',
    eu: 'Basque',
    fa: 'Persian',
    fi: 'Finnish',
    fil: 'Filipino',
    fr: 'French',
    'fr-ca': 'Canadian French',
    ga: 'Irish',
    gl: 'Galician',
    gu: 'Gujarati',
    he: 'Hebrew',
    hi: 'Hindi',
    hr: 'Croatian',
    hu: 'Hungarian',
    hy: 'Armenian',
    id: 'Indonesian',
    is: 'Icelandic',
    it: 'Italian',
    ja: 'Japanese',
    ka: 'Georgian',
    kk: 'Kazakh',
    km: 'Khmer',
    kn: 'Kannada',
    ko: 'Korean',
    lt: 'Lithuanian',
    lv: 'Latvian',
    mk: 'Macedonian',
    ml: 'Malayalam',
    mr: 'Marathi',
    ms: 'Malay',
    nb: 'Norwegian Bokmål',
    ne: 'Nepali',
    nl: 'Dutch',
    nn: 'Norwegian Nynorsk',
    pa: 'Punjabi',
    pl: 'Polish',
    pt: 'Portuguese',
    'pt-br': 'Brazilian Portuguese',
    'pt-pt': 'European Portuguese',
    ro: 'Romanian',
    ru: 'Russian',
    si: 'Sinhala',
    sk: 'Slovak',
    sl: 'Slovenian',
    sq: 'Albanian',
    sr: 'Serbian',
    sv: 'Swedish',
    sw: 'Swahili',
    ta: 'Tamil',
    te: 'Telugu',
    th: 'Thai',
    tl: 'Filipino',
    tr: 'Turkish',
    uk: 'Ukrainian',
    ur: 'Urdu',
    uz: 'Uzbek',
    vi: 'Vietnamese',
    'zh-cn': 'Simplified Chinese',
    'zh-hans': 'Simplified Chinese',
    'zh-sg': 'Simplified Chinese',
    'zh-tw': 'Traditional Chinese',
    'zh-hant': 'Traditional Chinese',
    'zh-hk': 'Traditional Chinese',
    zh: 'Simplified Chinese',
});

// Older or alternative primary tags that WordPress or browsers still send.
const LANGUAGE_ALIASES = Object.freeze({
    iw: 'he',
    in: 'id',
    no: 'nb',
    'zh-mo': 'zh-hk',
});

const LANGUAGE_TAG_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]{2,8}){0,3}$/;

/**
 * Resolve a requested output language to one the generator supports.
 *
 * Accepts BCP-47 tags ("de-DE", "pt-BR") and WordPress locales ("de_DE",
 * "de_DE_formal"). Anything malformed or unknown falls back to English, so
 * the request never fails because of the language field.
 *
 * @param {*} value - Requested language
 * @returns {{ code: string, name: string, fallback: boolean }}
 */
function normalizeAltTextLanguage(value) {
    const fallback = { ...DEFAULT_ALT_TEXT_LANGUAGE, fallback: value !== undefined && value !== null && value !== '' };

    if (typeof value !== 'string') return fallback;

    const tag = value.trim().replace(/_/g, '-').toLowerCase();
    if (!tag || tag.length > 35 || !LANGUAGE_TAG_PATTERN.test(tag)) return fallback;

    const parts = tag.split('-');
    const primary = LANGUAGE_ALIASES[parts[0]] || parts[0];
    const candidates = [];
    if (parts.length > 1) {
        const regional = `${primary}-${parts[1]}`;
        candidates.push(LANGUAGE_ALIASES[regional] || regional);
    }
    candidates.push(primary);

    for (const candidate of candidates) {
        if (Object.prototype.hasOwnProperty.call(ALT_TEXT_LANGUAGES, candidate)) {
            return { code: candidate, name: ALT_TEXT_LANGUAGES[candidate], fallback: false };
        }
    }

    return fallback;
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
    ALT_TEXT_LANGUAGES,
    DEFAULT_ALT_TEXT_LANGUAGE,
    normalizeAltTextLanguage,
    parseJsonBody,
    sanitizeString,
    validateString,
    validateEmail,
    validateEmailArray,
    validateAuthToken,
    badRequest,
    unauthorized,
};
