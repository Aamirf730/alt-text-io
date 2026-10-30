// Protected admin endpoint for one-recipient lifecycle email dry-runs/test sends.

const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
const { getCustomerEmailFrom, getSupportEmail } = require('./utils/email-config');
const {
  getCorsHeaders,
  handlePreflight,
  getClientIp,
  checkRateLimit,
  rateLimitExceededResponse,
  methodNotAllowedResponse,
} = require('./utils/cors');
const { authenticateAdmin } = require('./utils/admin-auth');
const { withErrorReporting } = require('./utils/error-reporter');
const {
  LIFECYCLE_RULES,
  buildLifecycleCandidates,
  buildLifecycleMailOptions,
  fetchRecentMarketingEvents,
} = require('./utils/lifecycle-automation');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

const ALLOWED_TEST_RULES = new Set([
  'signup_welcome',
  'signup_no_connect',
  'connect_no_first_image',
  'checkout_no_purchase',
  'purchase_onboarding',
  'credits_low_no_purchase',
  'credits_out_no_purchase',
  'annual_renewal_reminder',
  'cancellation_winback',
]);
const LOW_CREDIT_THRESHOLD = 5;

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
      attempts: 1,
      last_attempt_at: new Date().toISOString(),
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
  return createTransporter().sendMail(buildLifecycleMailOptions(candidate, {
    from: getCustomerEmailFrom(),
    supportEmail: getSupportEmail(),
  }));
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

function latestEvent(events, eventName) {
  return [...events]
    .filter(event => event.event_name === eventName)
    .sort((a, b) => new Date(b.occurred_at || b.created_at || 0) - new Date(a.occurred_at || a.created_at || 0))[0] || null;
}

function hasEventAfter(events, eventName, occurredAt) {
  const threshold = new Date(occurredAt).getTime();
  return events.some(event =>
    event.event_name === eventName &&
    new Date(event.occurred_at || event.created_at || 0).getTime() >= threshold
  );
}

function isMature(occurredAt, delayHours) {
  return Date.now() - new Date(occurredAt).getTime() >= delayHours * 60 * 60 * 1000;
}

/**
 * Returns why a test send to this candidate must be refused, or null. Every
 * candidate path is checked, including candidates built from marketing
 * events, so a test send can never reach an account that opted out.
 */
async function getTargetProfileBlockReason(client, candidate, email) {
  let query = client
    .from('profiles')
    .select('id,marketing_unsubscribed_at');

  query = candidate?.user_id
    ? query.eq('id', candidate.user_id)
    : query.eq('email', email);

  const { data, error } = await query.limit(20);

  if (error) {
    throw new Error(`Failed to check target email preferences: ${error.message}`);
  }

  const profiles = Array.isArray(data) ? data : [];
  if (profiles.length === 0) return 'profile_not_found';
  if (profiles.some(profile => profile.marketing_unsubscribed_at)) return 'unsubscribed';
  return null;
}

async function buildSingleUserCandidate(email, automationKey) {
  // Profile emails are not unique, so take the newest account explicitly
  // instead of failing on duplicates.
  const { data: profileRows, error: profileError } = await supabase
    .from('profiles')
    .select('id,email,subscription_plan,credits_remaining,bonus_credits_remaining,purchased_credits_remaining,marketing_unsubscribed_at,created_at')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1);

  if (profileError) {
    throw new Error(`Failed to fetch target profile: ${profileError.message}`);
  }

  const profile = Array.isArray(profileRows) ? profileRows[0] : null;

  if (!profile) return null;
  if (profile.marketing_unsubscribed_at) return null;

  const eventSelect = 'id,event_name,source,user_id,user_email,anonymous_id,occurred_at,created_at';
  const [eventsByUser, eventsByEmail] = await Promise.all([
    supabase
      .from('marketing_events')
      .select(eventSelect)
      .eq('user_id', profile.id)
      .order('occurred_at', { ascending: true }),
    supabase
      .from('marketing_events')
      .select(eventSelect)
      .eq('user_email', email)
      .order('occurred_at', { ascending: true }),
  ]);

  if (eventsByUser.error) {
    throw new Error(`Failed to fetch target lifecycle events: ${eventsByUser.error.message}`);
  }
  if (eventsByEmail.error) {
    throw new Error(`Failed to fetch target lifecycle events: ${eventsByEmail.error.message}`);
  }

  const events = [...new Map(
    [...(eventsByUser.data || []), ...(eventsByEmail.data || [])]
      .map(event => [event.id, event])
  ).values()].sort(
    (a, b) => new Date(a.occurred_at || a.created_at || 0) - new Date(b.occurred_at || b.created_at || 0)
  );

  const { data: usage, error: usageError } = await supabase
    .from('user_usage_stats')
    .select('total_usage_count,total_credits_used,last_usage_at')
    .eq('user_id', profile.id)
    .maybeSingle();

  if (usageError) {
    throw new Error(`Failed to fetch target usage stats: ${usageError.message}`);
  }

  const targetEvents = events;
  const totalUsageCount = Number(usage?.total_usage_count || 0);
  const actorKey = `user:${profile.id}`;

  if (automationKey === 'connect_no_first_image') {
    const connectEvent = latestEvent(targetEvents, 'connect_completed');
    if (!connectEvent || !isMature(connectEvent.occurred_at || connectEvent.created_at, 6)) return null;
    if (totalUsageCount > 0 || hasEventAfter(targetEvents, 'first_image_processed', connectEvent.occurred_at || connectEvent.created_at)) return null;

    return {
      automation_key: 'connect_no_first_image',
      actor_key: actorKey,
      user_id: profile.id,
      user_email: email,
      source_event_id: connectEvent.id,
      trigger_event_name: 'connect_completed',
      trigger_occurred_at: new Date(connectEvent.occurred_at || connectEvent.created_at).toISOString(),
      subject: 'Generate your first image alt text',
      preview: 'Your WordPress site is connected. The next step is processing your first image.',
      cta_text: 'Open Dashboard',
      cta_url: 'https://www.alt-text.pro/dashboard',
    };
  }

  if (automationKey === 'signup_welcome') {
    // A test send previews the email for any account with a sign-up, ignoring
    // the 48-hour window the scheduled run uses.
    const signupEvent = latestEvent(targetEvents, 'signup_created');
    if (!signupEvent) return null;
    const signupAt = signupEvent.occurred_at || signupEvent.created_at;
    const rule = LIFECYCLE_RULES.find(candidateRule => candidateRule.key === 'signup_welcome');
    const content = hasEventAfter(targetEvents, 'connect_completed', signupAt)
      ? { ...rule, ...rule.connectedVariant }
      : rule;

    return {
      automation_key: 'signup_welcome',
      actor_key: actorKey,
      user_id: profile.id,
      user_email: email,
      source_event_id: signupEvent.id,
      trigger_event_name: 'signup_created',
      trigger_occurred_at: new Date(signupAt).toISOString(),
      subject: content.subject,
      preview: content.preview,
      body_lines: content.bodyLines || [],
      cta_text: content.ctaText,
      cta_url: content.ctaUrl,
    };
  }

  if (automationKey === 'signup_no_connect') {
    const signupEvent = latestEvent(targetEvents, 'signup_created');
    if (!signupEvent || !isMature(signupEvent.occurred_at || signupEvent.created_at, 4)) return null;
    if (hasEventAfter(targetEvents, 'connect_completed', signupEvent.occurred_at || signupEvent.created_at)) return null;

    return {
      automation_key: 'signup_no_connect',
      actor_key: actorKey,
      user_id: profile.id,
      user_email: email,
      source_event_id: signupEvent.id,
      trigger_event_name: 'signup_created',
      trigger_occurred_at: new Date(signupEvent.occurred_at || signupEvent.created_at).toISOString(),
      subject: 'Connect Alt Text Pro to your WordPress site',
      preview: 'Your account is ready. Connect the plugin to start generating alt text from WordPress.',
      cta_text: 'Connect WordPress',
      cta_url: 'https://www.alt-text.pro/connect',
    };
  }

  if (automationKey === 'checkout_no_purchase') {
    const checkoutEvent = latestEvent(targetEvents, 'checkout_started');
    if (!checkoutEvent || !isMature(checkoutEvent.occurred_at || checkoutEvent.created_at, 1)) return null;
    if (hasEventAfter(targetEvents, 'purchase_completed', checkoutEvent.occurred_at || checkoutEvent.created_at)) return null;

    return {
      automation_key: 'checkout_no_purchase',
      actor_key: actorKey,
      user_id: profile.id,
      user_email: email,
      source_event_id: checkoutEvent.id,
      trigger_event_name: 'checkout_started',
      trigger_occurred_at: new Date(checkoutEvent.occurred_at || checkoutEvent.created_at).toISOString(),
      subject: 'Need help finishing your Alt Text Pro checkout?',
      preview: 'You started checkout but did not finish. Your selected plan is still available.',
      cta_text: 'View Plans',
      cta_url: 'https://www.alt-text.pro/#pricing',
    };
  }

  if (automationKey === 'credits_out_no_purchase') {
    const outEvent = latestEvent(targetEvents, 'credits_exhausted');
    if (!outEvent) return null;
    const outAt = outEvent.occurred_at || outEvent.created_at;
    if (hasEventAfter(targetEvents, 'purchase_completed', outAt)) return null;
    const rule = LIFECYCLE_RULES.find(candidateRule => candidateRule.key === 'credits_out_no_purchase');

    return {
      automation_key: 'credits_out_no_purchase',
      actor_key: actorKey,
      user_id: profile.id,
      user_email: email,
      source_event_id: outEvent.id,
      trigger_event_name: 'credits_exhausted',
      trigger_occurred_at: new Date(outAt).toISOString(),
      subject: rule.subject,
      preview: rule.preview,
      body_lines: rule.bodyLines || [],
      cta_text: rule.ctaText,
      cta_url: rule.ctaUrl,
    };
  }

  if (automationKey === 'credits_low_no_purchase') {
    const lowCreditEvent = latestEvent(targetEvents, 'credits_low');
    if (lowCreditEvent) {
      if (hasEventAfter(targetEvents, 'purchase_completed', lowCreditEvent.occurred_at || lowCreditEvent.created_at)) return null;

      return {
        automation_key: 'credits_low_no_purchase',
        actor_key: actorKey,
        user_id: profile.id,
        user_email: email,
        source_event_id: lowCreditEvent.id,
        trigger_event_name: 'credits_low',
        trigger_occurred_at: new Date(lowCreditEvent.occurred_at || lowCreditEvent.created_at).toISOString(),
        subject: 'Your Alt Text Pro credits are running low',
        preview: 'Add credits or upgrade your plan before your image workflow slows down.',
        cta_text: 'Add Credits',
        cta_url: 'https://www.alt-text.pro/dashboard',
      };
    }

    // Spendable balance includes bonus and credit-pack credits.
    const creditsRemaining = Math.max(
      Number(profile.credits_remaining || 0),
      Number(profile.bonus_credits_remaining || 0),
      Number(profile.purchased_credits_remaining || 0)
    );
    const isLowCredits = creditsRemaining <= LOW_CREDIT_THRESHOLD;
    const hasPaidPlan = String(profile.subscription_plan || 'free') !== 'free'
      || Number(profile.purchased_credits_remaining || 0) > 0;
    const fallbackOccurredAt = usage?.last_usage_at || profile.created_at;

    if (!isLowCredits || hasPaidPlan || !fallbackOccurredAt || totalUsageCount <= 0) return null;
    if (hasEventAfter(targetEvents, 'purchase_completed', fallbackOccurredAt)) return null;

    return {
      automation_key: 'credits_low_no_purchase',
      actor_key: actorKey,
      user_id: profile.id,
      user_email: email,
      source_event_id: null,
      trigger_event_name: 'credits_low',
      trigger_occurred_at: new Date(fallbackOccurredAt).toISOString(),
      subject: 'Your Alt Text Pro credits are running low',
      preview: 'Add credits or upgrade your plan before your image workflow slows down.',
      cta_text: 'Add Credits',
      cta_url: 'https://www.alt-text.pro/dashboard',
    };
  }

  return null;
}

async function handler(event) {
  const headers = getCorsHeaders(event.headers, ['POST', 'OPTIONS']);
  const preflightResponse = handlePreflight(event);
  if (preflightResponse) return preflightResponse;

  if (event.httpMethod !== 'POST') {
    return methodNotAllowedResponse(headers);
  }

  const clientIp = getClientIp(event);
  const rateLimit = await checkRateLimit(`admin-lifecycle-test-send:${clientIp}`, 10, 60000);
  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(headers, rateLimit);
  }

  try {
    const { user: adminUser, response } = await authenticateAdmin(event, { supabase, headers });
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
    let matches = candidates.filter(candidate =>
      normalizeEmail(candidate.user_email) === email &&
      candidate.automation_key === automationKey
    );

    if (matches.length === 0) {
      const singleUserCandidate = await buildSingleUserCandidate(email, automationKey);
      matches = singleUserCandidate ? [singleUserCandidate] : [];
    }

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

    const blockReason = await getTargetProfileBlockReason(supabase, candidate, email);
    if (blockReason) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({
          success: false,
          sent: false,
          reason: blockReason,
          candidate: safeCandidate(candidate),
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
}

exports.handler = withErrorReporting('admin-lifecycle-test-send', handler);

exports._private = {
  getTargetProfileBlockReason,
};
