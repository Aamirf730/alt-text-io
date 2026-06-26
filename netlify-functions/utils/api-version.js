/**
 * API Versioning Middleware
 * File: netlify-functions/utils/api-version.js
 *
 * Adds API version headers and provides version-aware utilities
 * for all Netlify functions.
 *
 * Current version: v1
 *
 * Usage in a function:
 *   const { withApiVersion, API_VERSION } = require('./utils/api-version');
 *
 *   // Option A: Wrap your handler
 *   exports.handler = withApiVersion(async (event) => { ... });
 *
 *   // Option B: Just add version headers to any response
 *   const { addVersionHeaders } = require('./utils/api-version');
 *   return addVersionHeaders({ statusCode: 200, body: '...' });
 */

const API_VERSION = 'v1';
const API_VERSION_HEADER = 'X-API-Version';
const DEPRECATION_HEADER = 'Deprecation';
const SUNSET_HEADER = 'Sunset';

/**
 * Supported API versions and their status.
 *
 * When a version is deprecated, set `deprecated: true` and
 * optionally provide a `sunset` date (ISO 8601) to indicate
 * when the version will be removed.
 */
const VERSIONS = {
    v1: {
        deprecated: false,
        sunset: null,
        current: true,
    },
    // Future: uncomment when v2 is released
    // v2: {
    //   deprecated: false,
    //   sunset: null,
    //   current: true,
    // },
};

/**
 * Detect the API version from the request path or header.
 *
 * Checks (in order):
 *   1. Path prefix: /api/v1/... → "v1"
 *   2. Custom header: X-API-Version: v1
 *   3. Default: current API_VERSION
 *
 * @param {Object} event - Netlify function event
 * @returns {string} Detected API version (e.g., "v1")
 */
function detectVersion(event) {
    // Check path for version prefix (e.g., /api/v1/generate-alt-text)
    const path = event.path || event.rawUrl || '';
    const pathMatch = path.match(/\/api\/(v\d+)\//);
    if (pathMatch && VERSIONS[pathMatch[1]]) {
        return pathMatch[1];
    }

    // Check custom header
    const headerVersion = event.headers?.[API_VERSION_HEADER.toLowerCase()]
        || event.headers?.[API_VERSION_HEADER];
    if (headerVersion && VERSIONS[headerVersion]) {
        return headerVersion;
    }

    // Default to current version
    return API_VERSION;
}

/**
 * Add version headers to a response object.
 *
 * @param {Object} response - Netlify function response
 * @param {string} version - API version (default: current)
 * @returns {Object} Response with version headers added
 */
function addVersionHeaders(response, version = API_VERSION) {
    const headers = { ...response.headers };

    headers[API_VERSION_HEADER] = version;

    const versionConfig = VERSIONS[version];
    if (versionConfig?.deprecated) {
        headers[DEPRECATION_HEADER] = 'true';
        if (versionConfig.sunset) {
            headers[SUNSET_HEADER] = versionConfig.sunset;
        }
    }

    return { ...response, headers };
}

/**
 * Higher-order wrapper that adds API version headers to every response.
 *
 * @param {Function} handler - Netlify function handler
 * @returns {Function} Wrapped handler with versioning
 */
function withApiVersion(handler) {
    return async (event, context) => {
        const version = detectVersion(event);

        // Inject version into event for use inside the handler
        event.apiVersion = version;

        const response = await handler(event, context);
        return addVersionHeaders(response, version);
    };
}

module.exports = {
    API_VERSION,
    API_VERSION_HEADER,
    VERSIONS,
    detectVersion,
    addVersionHeaders,
    withApiVersion,
};
