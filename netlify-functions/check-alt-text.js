// Netlify Function for the free public alt text checker.
//
// Fetches one page the visitor names (through the SSRF-safe fetcher), lists
// its images and classifies their alt text. No AI calls, no account, and the
// checked URL is never stored or logged.

const {
  checkRateLimit,
  getClientIp,
  getCorsHeaders,
  rateLimitExceededResponse,
} = require('./utils/cors');
const { SafeFetchError, fetchPage, normalizeUserUrl } = require('./utils/safe-fetch');
const { analyzeHtml } = require('./utils/alt-checker');

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_BODY_BYTES = 4096;

const ERROR_STATUS = {
  invalid_url: 400,
  blocked_address: 400,
  dns_failed: 422,
  connection_failed: 422,
  timeout: 422,
  not_html: 422,
  page_status: 422,
  too_many_redirects: 422,
};

function json(statusCode, headers, body) {
  return {
    statusCode,
    headers: { ...headers, 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}

function createHandler({
  checkRateLimitFn = checkRateLimit,
  fetchPageFn = fetchPage,
  analyzeFn = analyzeHtml,
  logFn = (outcome) => console.info('[check-alt-text]', outcome),
} = {}) {
  return async (event) => {
    const requestHeaders = event.headers || {};
    const headers = getCorsHeaders(requestHeaders, ['POST', 'OPTIONS']);

    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
      return json(405, headers, { error: 'Method not allowed', code: 'method_not_allowed' });
    }

    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body || '', 'base64').toString('utf8')
      : String(event.body || '');
    if (rawBody.length > MAX_BODY_BYTES) {
      return json(413, headers, { error: 'Request too large', code: 'invalid_request' });
    }

    let body;
    try {
      body = JSON.parse(rawBody || '{}');
    } catch (error) {
      return json(400, headers, { error: 'Invalid JSON body', code: 'invalid_request' });
    }

    let url;
    try {
      url = normalizeUserUrl(body && body.url);
    } catch (error) {
      logFn(error.code || 'invalid_url');
      return json(400, headers, { error: error.message, code: error.code || 'invalid_url' });
    }

    const clientIp = getClientIp({ ...event, headers: requestHeaders });
    const rateLimit = await checkRateLimitFn(`check-alt-text:${clientIp}`, RATE_LIMIT, RATE_WINDOW_MS);
    if (!rateLimit.allowed) {
      logFn('rate_limited');
      const response = rateLimitExceededResponse(headers, rateLimit);
      if (response.statusCode === 429) {
        const parsed = JSON.parse(response.body);
        parsed.message = `You have run ${RATE_LIMIT} checks in the last few minutes. Please wait a little and try again.`;
        response.body = JSON.stringify(parsed);
      }
      return response;
    }

    try {
      const page = await fetchPageFn(url);
      const result = analyzeFn(page.html, page.finalUrl);
      logFn(`ok:${result.totals.images}`);

      return json(200, headers, {
        checkedUrl: url.href,
        finalUrl: page.finalUrl,
        htmlTruncated: page.truncated,
        ...result,
      });
    } catch (error) {
      if (error instanceof SafeFetchError || (error && ERROR_STATUS[error.code])) {
        logFn(error.code);
        const payload = { error: error.message, code: error.code };
        if (error.upstreamStatus) payload.upstreamStatus = error.upstreamStatus;
        return json(ERROR_STATUS[error.code] || 422, headers, payload);
      }

      logFn('internal_error');
      return json(500, headers, {
        error: 'Something went wrong while checking that page. Please try again.',
        code: 'internal_error',
      });
    }
  };
}

exports.handler = createHandler();
exports._private = {
  ERROR_STATUS,
  RATE_LIMIT,
  RATE_WINDOW_MS,
  createHandler,
};
