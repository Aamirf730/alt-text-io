// Netlify Function for storing marketing and funnel events.

const { createClient } = require('@supabase/supabase-js');
const { checkRateLimit, getClientIp } = require('./utils/cors');

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
  'bulk_started',
  'bulk_completed',
  'credits_low',
  'checkout_started',
  'purchase_completed',
  'subscription_canceled',
]);

function corsHeaders(event) {
  const origin = event.headers.origin || event.headers.Origin || '*';
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function sanitizeProperties(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};

  return Object.entries(input).slice(0, 60).reduce((acc, [key, value]) => {
    if (!/^[a-zA-Z0-9_.-]{1,80}$/.test(key)) return acc;

    if (typeof value === 'string') {
      acc[key] = value.slice(0, 800);
      return acc;
    }

    if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
      acc[key] = value;
    }

    return acc;
  }, {});
}

function textValue(value, fallback = null, maxLength = 255) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

exports.handler = async (event) => {
  const headers = corsHeaders(event);

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

  const clientIp = getClientIp(event);
  const rateLimit = await checkRateLimit(`track-event:${clientIp}`, 120, 60000);
  if (!rateLimit.allowed) {
    return {
      statusCode: 429,
      headers: {
        ...headers,
        'Retry-After': Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000)).toString(),
      },
      body: JSON.stringify({ error: 'Too many requests' }),
    };
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

  const properties = sanitizeProperties(body.properties);

  if (!supabase) {
    console.warn('track-event: Supabase is not configured; accepting event without storage.');
    return {
      statusCode: 202,
      headers,
      body: JSON.stringify({ success: true, stored: false }),
    };
  }

  const insertPayload = {
    event_name: eventName,
    source: textValue(body.source, 'web_app', 80),
    anonymous_id: textValue(body.anonymous_id, null, 120),
    user_id: textValue(body.user_id, null, 80),
    user_email: textValue(body.user_email, null, 320),
    properties,
    page_path: textValue(properties.path, null, 500),
    referrer: textValue(properties.referrer, null, 500),
    user_agent: textValue(event.headers['user-agent'], null, 500),
    ip_address: clientIp,
    occurred_at: textValue(body.occurred_at, null, 40) || new Date().toISOString(),
  };

  const { error } = await supabase
    .from('marketing_events')
    .insert(insertPayload);

  if (error) {
    console.error('track-event: insert failed', error);
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
