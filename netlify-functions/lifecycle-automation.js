// Scheduled lifecycle email automation for Alt Text Pro.

const nodemailer = require('nodemailer');
const { timingSafeEqual } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
const { getEmailFrom } = require('./utils/email-config');
const {
  buildLifecycleCandidates,
  fetchAuthUsers,
  fetchLifecycleUsageCounts,
  fetchRecentMarketingEvents,
  filterCandidatesByAuthUsers,
  renderLifecycleEmail,
  selectLifecycleCandidatePerActor,
} = require('./utils/lifecycle-automation');
const { fetchAllRows } = require('./utils/paginated-query');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

function parseBoolean(value) {
  return ['1', 'true', 'yes'].includes(String(value || '').toLowerCase());
}

function parsePositiveInt(value, fallback, min = 1, max = 100) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function parseScheduledBody(event) {
  try {
    const body = JSON.parse(event.body || '{}');
    if (typeof body.next_run !== 'string') return null;

    const nextRun = new Date(body.next_run);
    if (Number.isNaN(nextRun.getTime())) return null;

    return body;
  } catch (_) {
    return null;
  }
}

function getHeader(headers, name) {
  const target = name.toLowerCase();
  const key = Object.keys(headers || {}).find(header => header.toLowerCase() === target);
  return key ? headers[key] : undefined;
}

function getProvidedSecret(event) {
  const headers = event.headers || {};
  return getHeader(headers, 'x-lifecycle-automation-secret');
}

function secretsMatch(expected, provided) {
  if (typeof expected !== 'string' || typeof provided !== 'string') return false;

  const expectedBuffer = Buffer.from(expected, 'utf8');
  const providedBuffer = Buffer.from(provided, 'utf8');
  if (expectedBuffer.length !== providedBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

function isAuthorizedRun(event) {
  const scheduledBody = parseScheduledBody(event);
  const secret = process.env.LIFECYCLE_AUTOMATION_SECRET;
  const providedSecret = getProvidedSecret(event);

  if (secretsMatch(secret, providedSecret)) {
    return {
      allowed: true,
      mode: event.__scheduledInvocation === true ? 'scheduled' : 'manual',
      scheduledBody: event.__scheduledInvocation === true ? scheduledBody : null,
    };
  }

  return { allowed: false, mode: 'blocked', scheduledBody: null };
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

// PostgREST filters travel in the URL, so long ID lists are split.
const IN_FILTER_CHUNK_SIZE = 150;

function chunk(values, size = IN_FILTER_CHUNK_SIZE) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function getExistingSendSet(candidates) {
  if (candidates.length === 0) return new Set();

  const automationKeys = [...new Set(candidates.map(candidate => candidate.automation_key))];
  const actorKeys = [...new Set(candidates.map(candidate => candidate.actor_key))];
  const existing = new Set();

  for (const actorKeyChunk of chunk(actorKeys)) {
    const data = await fetchAllRows(
      (from, to) => supabase
        .from('marketing_automation_sends')
        .select('automation_key,actor_key,id')
        .in('automation_key', automationKeys)
        .in('actor_key', actorKeyChunk)
        .order('automation_key', { ascending: true })
        .order('actor_key', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
      { label: 'automation sends' }
    );
    for (const row of data) {
      existing.add(`${row.automation_key}:${row.actor_key}`);
    }
  }

  return existing;
}

async function filterUnsubscribedCandidates(candidates) {
  if (!candidates.length) return [];

  const userIds = [...new Set(candidates.map(candidate => candidate.user_id).filter(Boolean))];
  if (!userIds.length) return candidates;

  const unsubscribedIds = new Set();
  for (const userIdChunk of chunk(userIds)) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .in('id', userIdChunk)
      .not('marketing_unsubscribed_at', 'is', null);

    if (error) {
      throw new Error(`Failed to check lifecycle email preferences: ${error.message}`);
    }

    for (const profile of data || []) {
      unsubscribedIds.add(String(profile.id));
    }
  }

  return candidates.filter(candidate => !unsubscribedIds.has(String(candidate.user_id)));
}

async function reserveSend(candidate) {
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
      },
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') return null;
    throw new Error(`Failed to reserve automation send: ${error.message}`);
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
    throw new Error(`Failed to update automation send: ${error.message}`);
  }
}

async function sendLifecycleEmail(transporter, candidate) {
  const { html, text } = renderLifecycleEmail(candidate);
  return transporter.sendMail({
    from: getEmailFrom(),
    to: candidate.user_email,
    subject: candidate.subject,
    text,
    html,
  });
}

exports.handler = async (event) => {
  const auth = isAuthorizedRun(event);
  if (!auth.allowed) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Lifecycle automation requires a valid secret.' }),
    };
  }

  try {
    if (!supabase) {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: false, sent: 0, reason: 'supabase_not_configured' }),
      };
    }

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, sent: 0, reason: 'email_not_configured' }),
      };
    }

    const dryRun = parseBoolean(event.queryStringParameters?.dry_run) ||
      parseBoolean(process.env.LIFECYCLE_AUTOMATION_DRY_RUN);
    const days = parsePositiveInt(process.env.LIFECYCLE_AUTOMATION_LOOKBACK_DAYS, 30, 1, 90);
    const maxPerRun = parsePositiveInt(process.env.LIFECYCLE_AUTOMATION_MAX_SENDS, 25, 1, 100);

    const events = await fetchRecentMarketingEvents(supabase, { days });
    const usageCountsByUserId = events.some(event => event.event_name === 'connect_completed')
      ? await fetchLifecycleUsageCounts(supabase)
      : new Map();
    const candidates = buildLifecycleCandidates(events, { usageCountsByUserId });
    const authUsers = candidates.length > 0 ? await fetchAuthUsers(supabase) : [];
    const verifiedCandidates = filterCandidatesByAuthUsers(candidates, authUsers);
    const optedInCandidates = await filterUnsubscribedCandidates(verifiedCandidates);
    const eligibleCandidates = selectLifecycleCandidatePerActor(optedInCandidates);
    const existingSends = await getExistingSendSet(eligibleCandidates);
    const unsentCandidates = eligibleCandidates
      .filter(candidate => !existingSends.has(`${candidate.automation_key}:${candidate.actor_key}`))
      .slice(0, maxPerRun);

    if (dryRun) {
      const includePreview = auth.mode === 'manual';
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          dry_run: true,
          mode: auth.mode,
          candidates: candidates.length,
          verified_candidates: verifiedCandidates.length,
          eligible_candidates: eligibleCandidates.length,
          unsubscribed: verifiedCandidates.length - optedInCandidates.length,
          suppressed_competing_candidates: verifiedCandidates.length - eligibleCandidates.length,
          rejected_recipients: candidates.length - verifiedCandidates.length,
          unsent: unsentCandidates.length,
          preview: includePreview
            ? unsentCandidates.map(candidate => ({
              automation_key: candidate.automation_key,
              user_email: candidate.user_email,
              trigger_occurred_at: candidate.trigger_occurred_at,
            }))
            : undefined,
        }),
      };
    }

    const transporter = createTransporter();
    const results = {
      sent: 0,
      skipped: candidates.length - unsentCandidates.length,
      rejected_recipients: candidates.length - verifiedCandidates.length,
      failed: 0,
    };

    for (const candidate of unsentCandidates) {
      const reservation = await reserveSend(candidate);
      if (!reservation) {
        results.skipped += 1;
        continue;
      }

      try {
        await sendLifecycleEmail(transporter, candidate);
        await markSend(reservation.id, {
          status: 'sent',
          sent_at: new Date().toISOString(),
        });
        results.sent += 1;
      } catch (error) {
        await markSend(reservation.id, {
          status: 'failed',
          error_message: String(error.message || error).slice(0, 1000),
        });
        results.failed += 1;
      }
    }

    console.log('lifecycle-automation completed', {
      mode: auth.mode,
      candidates: candidates.length,
      verified_candidates: verifiedCandidates.length,
      eligible_candidates: eligibleCandidates.length,
      unsubscribed: verifiedCandidates.length - optedInCandidates.length,
      suppressed_competing_candidates: verifiedCandidates.length - eligibleCandidates.length,
      ...results,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        mode: auth.mode,
        candidates: candidates.length,
        verified_candidates: verifiedCandidates.length,
        eligible_candidates: eligibleCandidates.length,
        unsubscribed: verifiedCandidates.length - optedInCandidates.length,
        suppressed_competing_candidates: verifiedCandidates.length - eligibleCandidates.length,
        ...results,
      }),
    };
  } catch (error) {
    const { reportError } = require('./utils/error-reporter');
    reportError(error, { functionName: 'lifecycle-automation' });

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Lifecycle automation failed',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      }),
    };
  }
};

exports._private = {
  getHeader,
  getProvidedSecret,
  isAuthorizedRun,
  parseScheduledBody,
  filterUnsubscribedCandidates,
};
