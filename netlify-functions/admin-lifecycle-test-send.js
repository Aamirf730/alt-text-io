// Protected admin endpoint for one-recipient lifecycle email dry-runs/test sends.

const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
const {
  getCorsHeaders,
  handlePreflight,
  getClientIp,
  checkRateLimit,
  methodNotAllowedResponse,
  unauthorizedResponse,
  forbiddenResponse,
} = require('./utils/cors');
const {
  buildLifecycleCandidates,
  fetchRecentMarketingEvents,
  renderLifecycleEmail,
} = require('./utils/lifecycle-automation');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

const SUPERUSER_EMAILS = (process.env.SUPERUSER_EMAILS || '')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(Boolean);

const ALLOWED_TEST_RULES = new Set([
  'signup_no_connect',
  'connect_no_first_image',
  'checkout_no_purchase',
  'purchase_onboarding',
  'credits_low_no_purchase',
]);

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function parseBoolean(value) {
  return ['1', 'true', 'yes'].includes(String(value || '').toLowerCase());
}

function createTransporter() {
  const emailService = process.env.EMAIL_SERVICE || 'gmail';
  const emailUser = process.env.EMAIL_USER;
  const emailPassword = process.env.EMAIL_PASSWORD;
  const isCustomDomain = emailUser && !emailUser.includes('@gmail.com');

  if (emailService === 'gmail' || !isCustomDomain) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
    });
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: emailUser,
      pass: emailPassword,
    },
  });
}

async function getAdminUser(event, headers) {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader) {
    return {
      response: unauthorizedResponse(headers, 'Authorization header required'),
    };
  }

  if (!supabase) {
    return {
      response: {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Supabase is not configured' }),
      },
    };
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return {
      response: unauthorizedResponse(headers, 'Invalid or expired token'),
    };
  }

  if (!SUPERUSER_EMAILS.includes(String(user.email || '').toLowerCase())) {
    return {
      response: forbiddenResponse(headers, 'Superuser privileges required'),
    };
  }

  return { user };
}

async function getExistingSend(candidate) {
  const { data, error } = await supabase
    .from('marketing_automation_sends')
    .select('id,automation_key,actor_key,user_email,status,sent_at,created_at')
    .eq('automation_key', candidate.automation_key)
    .eq('actor_key', candidate.actor_key)
    .limit(1);

  if (error) {
    throw new Error(`Failed to check existing lifecycle send: ${error.message}`);
  }

  return data?.[0] || null;
}

async function reserveSend(candidate, adminUser) {
  const { data, error } = await supabase
    .from('marketing_automation_sends')
    .insert({
      automation_key: candidate.automation_key,
      actor_key: candidate.actor_key,
      user_id: candidate.user_id,
      user_email: candidate.user_email,
      source_event_id: candidate.source_event_id,
      status: 'pending',
      subject: candidate.subject,
      metadata: {
        trigger_event_name: candidate.trigger_event_name,
        trigger_occurred_at: candidate.trigger_occurred_at,
        cta_url: candidate.cta_url,
        test_send: true,
        admin_user_id: adminUser.id,
        admin_email: adminUser.email,
      },
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') return null;
    throw new Error(`Failed to reserve lifecycle test send: ${error.message}`);
  }

  return data;
}

async function markSend(id, patch) {
  const { error } = await supabase
    .from('marketing_automation_sends')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to update lifecycle test send: ${error.message}`);
  }
}

async function sendLifecycleEmail(candidate) {
  const { html, text } = renderLifecycleEmail(candidate);
  return createTransporter().sendMail({
    from: process.env.EMAIL_USER,
    to: candidate.user_email,
    subject: candidate.subject,
    text,
    html,
  });
}

function safeCandidate(candidate) {
  return {
    automation_key: candidate.automation_key,
    user_email: candidate.user_email,
    user_id: candidate.user_id,
    trigger_event_name: candidate.trigger_event_name,
    trigger_occurred_at: candidate.trigger_occurred_at,
    subject: candidate.subject,
    preview: candidate.preview,
    cta_text: candidate.cta_text,
    cta_url: candidate.cta_url,
  };
}

exports.handler = async (event) => {
  const headers = getCorsHeaders(event.headers, ['POST', 'OPTIONS']);
  const preflightResponse = handlePreflight(event);
  if (preflightResponse) return preflightResponse;

  if (event.httpMethod !== 'POST') {
    return methodNotAllowedResponse(headers);
  }

  const clientIp = getClientIp(event);
  const rateLimit = await checkRateLimit(`admin-lifecycle-test-send:${clientIp}`, 10, 60000);
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

  try {
    const { user: adminUser, response } = await getAdminUser(event, headers);
    if (response) return response;

    let body = {};
    try {
      body = JSON.parse(event.body || '{}');
    } catch (_) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid JSON body' }),
      };
    }

    const email = normalizeEmail(body.email);
    const automationKey = String(body.automation_key || '').trim();
    const dryRun = parseBoolean(body.dry_run);

    if (!email || !email.includes('@')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'A valid email is required' }),
      };
    }

    if (!ALLOWED_TEST_RULES.has(automationKey)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Unsupported lifecycle rule' }),
      };
    }

    if (!dryRun && (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD)) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Email transport is not configured' }),
      };
    }

    const events = await fetchRecentMarketingEvents(supabase, { days: 90 });
    const candidates = buildLifecycleCandidates(events);
    const matches = candidates.filter(candidate =>
      normalizeEmail(candidate.user_email) === email &&
      candidate.automation_key === automationKey
    );

    if (matches.length !== 1) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({
          success: false,
          sent: false,
          reason: matches.length === 0 ? 'no_matching_candidate' : 'multiple_matching_candidates',
          matches: matches.map(safeCandidate),
        }),
      };
    }

    const candidate = matches[0];
    const existingSend = await getExistingSend(candidate);
    if (existingSend) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({
          success: false,
          sent: false,
          reason: 'already_sent_or_reserved',
          candidate: safeCandidate(candidate),
          existing_send: existingSend,
        }),
      };
    }

    if (dryRun) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          dry_run: true,
          sent: false,
          candidate: safeCandidate(candidate),
        }),
      };
    }

    const reservation = await reserveSend(candidate, adminUser);
    if (!reservation) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({
          success: false,
          sent: false,
          reason: 'already_reserved',
          candidate: safeCandidate(candidate),
        }),
      };
    }

    try {
      await sendLifecycleEmail(candidate);
      await markSend(reservation.id, {
        status: 'sent',
        sent_at: new Date().toISOString(),
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          dry_run: false,
          sent: true,
          send_id: reservation.id,
          candidate: safeCandidate(candidate),
        }),
      };
    } catch (error) {
      await markSend(reservation.id, {
        status: 'failed',
        error_message: String(error.message || error).slice(0, 1000),
      });
      throw error;
    }
  } catch (error) {
    const { reportError } = require('./utils/error-reporter');
    reportError(error, { functionName: 'admin-lifecycle-test-send', ip: getClientIp(event) });

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to run lifecycle test send',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      }),
    };
  }
};
