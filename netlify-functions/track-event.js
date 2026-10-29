// Netlify Function for storing marketing and funnel events.

const { createClient } = require('@supabase/supabase-js');
const {
  checkRateLimit,
  getClientIp,
  getCorsHeaders,
  rateLimitExceededResponse,
  validateAuthHeader,
} = require('./utils/cors');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

const ALLOWED_EVENTS = new Set([
  'page_viewed',
  'signup_created',
  'demo_used',
  'plugin_downloaded',
  'connect_started',
  'connect_completed',
  'first_image_processed',
  'credits_low',
  'checkout_started',
  'purchase_completed',
  'subscription_canceled',
]);

// These events may be recorded without an account, but anonymous requests are
// never allowed to attach user identity or trigger lifecycle email automations.
const ANONYMOUS_EVENTS = new Set([
  'page_viewed',
  'demo_used',
  'plugin_downloaded',
  'connect_started',
]);

// These sources are written only by verified server-side integrations. A
// browser must not be able to impersonate them to bypass lifecycle safeguards.
const RESERVED_SOURCES = new Set([
  'polar_webhook',
  'wordpress_plugin_auth',
  'wordpress_plugin_usage',
]);

// Purchase completion is authoritative only when written by the verified
// Polar webhook. The browser still records its local ad-conversion signal, but
// it cannot create a database purchase event through this public endpoint.
const SERVER_ONLY_EVENTS = new Set([
  'purchase_completed',
]);

// Caps for caller-supplied data. Anonymous traffic is the cheapest to forge,
// so it gets its own, tighter per-IP limits on top of the shared one.
const MAX_PROPERTY_KEYS = 30;
const MAX_PROPERTY_STRING_LENGTH = 300;
const MAX_PROPERTIES_BYTES = 4096;
const SOURCE_PATTERN = /^[a-z0-9][a-z0-9_.-]{0,39}$/i;
const REQUEST_RATE_LIMIT = 120;
const ANONYMOUS_PAGE_VIEW_RATE_LIMIT = 30;
const ANONYMOUS_EVENT_RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60000;

function sanitizeProperties(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};

  const output = {};
  let size = 2;
  for (const [key, value] of Object.entries(input).slice(0, MAX_PROPERTY_KEYS)) {
    if (!/^[a-zA-Z0-9_.-]{1,80}$/.test(key)) continue;

    let cleanValue;
    if (typeof value === 'string') {
      cleanValue = value.slice(0, MAX_PROPERTY_STRING_LENGTH);
    } else if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
      cleanValue = value;
    } else {
      continue;
    }

    const entrySize = Buffer.byteLength(JSON.stringify(key), 'utf8')
      + Buffer.byteLength(JSON.stringify(cleanValue), 'utf8') + 2;
    if (size + entrySize > MAX_PROPERTIES_BYTES) break;
    size += entrySize;
    output[key] = cleanValue;
  }

  return output;
}

function textValue(value, fallback = null, maxLength = 255) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

async function getVerifiedUser(event, supabaseClient) {
  const auth = validateAuthHeader(event);
  if (!auth.valid) {
    return { user: null, error: null };
  }

  if (!supabaseClient) {
    return {
      user: null,
      error: 'Authentication service is unavailable',
    };
  }

  const { data, error } = await supabaseClient.auth.getUser(auth.token);
  if (error || !data?.user) {
    return {
      user: null,
      error: 'Invalid or expired authentication token',
    };
  }

  return { user: data.user, error: null };
}

async function hasExistingSignupEvent(supabaseClient, userId) {
  const { data, error } = await supabaseClient
    .from('marketing_events')
    .select('id')
    .eq('event_name', 'signup_created')
    .eq('user_id', userId)
    .limit(1);

  if (error) {
    return { exists: false, error };
  }

  return { exists: Array.isArray(data) && data.length > 0, error: null };
}

function createHandler({
  supabaseClient = supabase,
  checkRateLimitFn = checkRateLimit,
  nowFn = () => new Date(),
} = {}) {
  return async (event) => {
    const requestHeaders = event.headers || {};
    const headers = getCorsHeaders(requestHeaders, ['POST', 'OPTIONS']);

    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' }),
      };
    }

    const clientIp = getClientIp({ ...event, headers: requestHeaders });
    const rateLimit = await checkRateLimitFn(`track-event:${clientIp}`, REQUEST_RATE_LIMIT, RATE_WINDOW_MS);
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(headers, rateLimit);
    }

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (error) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid JSON body' }),
      };
    }

    const eventName = textValue(body.event_name || body.eventName, null, 80);
    if (!eventName || !ALLOWED_EVENTS.has(eventName)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Unsupported event name' }),
      };
    }

    const source = textValue(body.source, 'web_app', 80);
    if (!SOURCE_PATTERN.test(source)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid event source' }),
      };
    }

    if (RESERVED_SOURCES.has(source.toLowerCase())) {
      // Authoritative integration events are written directly by verified
      // server-side handlers. Never let the public endpoint claim those sources.
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Reserved event source' }),
      };
    }

    if (SERVER_ONLY_EVENTS.has(eventName)) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Server-only event' }),
      };
    }

    const identity = await getVerifiedUser(event, supabaseClient);
    if (identity.error) {
      return {
        statusCode: identity.error === 'Authentication service is unavailable' ? 503 : 401,
        headers,
        body: JSON.stringify({ error: identity.error }),
      };
    }

    const requiresAuthentication = !ANONYMOUS_EVENTS.has(eventName);
    if (requiresAuthentication && !identity.user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Authentication required for this event' }),
      };
    }

    if (!identity.user) {
      const anonymousLimit = eventName === 'page_viewed'
        ? ANONYMOUS_PAGE_VIEW_RATE_LIMIT
        : ANONYMOUS_EVENT_RATE_LIMIT;
      const anonymousRate = await checkRateLimitFn(
        `track-event:anon:${eventName === 'page_viewed' ? 'page' : 'event'}:${clientIp}`,
        anonymousLimit,
        RATE_WINDOW_MS
      );
      if (!anonymousRate.allowed) {
        return rateLimitExceededResponse(headers, anonymousRate);
      }
    }

    const anonymousId = textValue(body.anonymous_id, null, 120);
    if (!identity.user && !anonymousId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Anonymous ID required' }),
      };
    }

    const properties = {
      ...sanitizeProperties(body.properties),
      identity_verified: Boolean(identity.user),
    };

    if (!supabaseClient) {
      console.warn('track-event: Supabase is not configured; accepting event without storage.');
      return {
        statusCode: 202,
        headers,
        body: JSON.stringify({ success: true, stored: false }),
      };
    }

    if (eventName === 'signup_created' && identity.user?.id) {
      const signupCheck = await hasExistingSignupEvent(supabaseClient, identity.user.id);
      if (signupCheck.error) {
        console.error('track-event: existing signup lookup failed');
        return {
          statusCode: 202,
          headers,
          body: JSON.stringify({ success: true, stored: false }),
        };
      }

      if (signupCheck.exists) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, stored: false, duplicate: true }),
        };
      }
    }

    const insertPayload = {
      event_name: eventName,
      source,
      anonymous_id: anonymousId,
      // User identity is derived only from the verified Supabase session. Caller
      // supplied user_id/user_email values are deliberately ignored.
      user_id: identity.user?.id || null,
      user_email: identity.user?.email ? String(identity.user.email).toLowerCase() : null,
      properties,
      page_path: textValue(properties.path, null, MAX_PROPERTY_STRING_LENGTH),
      referrer: textValue(properties.referrer, null, MAX_PROPERTY_STRING_LENGTH),
      user_agent: textValue(requestHeaders['user-agent'], null, 500),
      ip_address: clientIp,
      // Public clients cannot backdate lifecycle triggers. Authoritative
      // server-side writers record their own event timestamps directly.
      occurred_at: nowFn().toISOString(),
    };

    const { error } = await supabaseClient
      .from('marketing_events')
      .insert(insertPayload);

    if (error) {
      // The signup uniqueness index is the final race-safe idempotency guard.
      // Two requests can both pass the read above; the losing insert is a
      // successful duplicate, not a storage failure.
      if (eventName === 'signup_created' && error.code === '23505') {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, stored: false, duplicate: true }),
        };
      }

      console.error('track-event: insert failed', { code: error.code || 'unknown' });
      return {
        statusCode: 202,
        headers,
        body: JSON.stringify({ success: true, stored: false }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, stored: true }),
    };
  };
}

exports.handler = createHandler();
exports._private = {
  ANONYMOUS_EVENT_RATE_LIMIT,
  ANONYMOUS_PAGE_VIEW_RATE_LIMIT,
  MAX_PROPERTIES_BYTES,
  SOURCE_PATTERN,
  ALLOWED_EVENTS,
  ANONYMOUS_EVENTS,
  RESERVED_SOURCES,
  SERVER_ONLY_EVENTS,
  createHandler,
  getVerifiedUser,
  hasExistingSignupEvent,
  sanitizeProperties,
};
