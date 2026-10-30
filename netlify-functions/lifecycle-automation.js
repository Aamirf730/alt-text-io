// Scheduled lifecycle email automation for Alt Text Pro.

const nodemailer = require('nodemailer');
const { timingSafeEqual } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
const { getCustomerEmailFrom, getSupportEmail } = require('./utils/email-config');
const {
  LIFECYCLE_PRIORITY,
  buildLifecycleCandidates,
  buildLifecycleMailOptions,
  fetchAuthUsers,
  fetchLifecycleUsageCounts,
  fetchRecentMarketingEvents,
  filterCandidatesByAuthUsers,
  recordUpcomingAnnualRenewals,
  selectLifecycleCandidatePerActor,
} = require('./utils/lifecycle-automation');
const { fetchAllRows } = require('./utils/paginated-query');
const { withErrorReporting } = require('./utils/error-reporter');

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

// Retry policy. Only a row explicitly marked "failed" (the SMTP send threw)
// is retried on a later run, at most MAX_SEND_ATTEMPTS times in all.
//
// A row still "pending" after STALE_PENDING_MS was interrupted somewhere
// between the reservation and the status update: the email may well have
// been delivered (sendMail resolved, then the function died or the "sent"
// update failed). It is never retried automatically; it becomes "unknown"
// and is reported, so a person can check before anything is resent.
const MAX_SEND_ATTEMPTS = 3;
const STALE_PENDING_MS = 60 * 60 * 1000;
const FAILED_RETRY_DELAY_MS = 30 * 60 * 1000;
// Sends per run, and the time after which no new send starts. The scheduled
// function has 30 seconds; reading events and users takes part of that, and
// each send is an SMTP round trip plus two database writes.
const DEFAULT_MAX_SENDS_PER_RUN = 15;
const MAX_SENDS_PER_RUN_LIMIT = 30;
const SEND_TIME_BUDGET_MS = 18 * 1000;
// One lifecycle email per person per day at most, across all rules.
const ACTOR_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function chunk(values, size = IN_FILTER_CHUNK_SIZE) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function sendKey(automationKey, actorKey) {
  return `${automationKey}:${actorKey}`;
}

function toTime(value) {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

/**
 * done: never send again for this rule and person.
 * retry: a failed attempt (the send threw) that may be tried again now.
 * in_flight: an attempt that is recent; leave it alone this run.
 * stale_pending: an interrupted attempt that may have been delivered. Never
 *   resent; the run marks it "unknown" and reports it.
 */
function classifyExistingSend(row, now = Date.now()) {
  const status = String(row?.status || '');
  if (status === 'sent' || status === 'skipped' || status === 'unknown') return 'done';

  const attempts = Number(row?.attempts || 1);
  const lastAttemptAt = toTime(row?.last_attempt_at || row?.updated_at || row?.created_at);

  if (status === 'failed') {
    if (attempts >= MAX_SEND_ATTEMPTS) return 'done';
    return now - lastAttemptAt >= FAILED_RETRY_DELAY_MS ? 'retry' : 'in_flight';
  }

  if (status === 'pending') {
    return now - lastAttemptAt < STALE_PENDING_MS ? 'in_flight' : 'stale_pending';
  }

  return 'done';
}

/**
 * Decide what to send this run. Already-sent and in-flight rule/person pairs
 * are removed BEFORE one email per person is picked, so a sent
 * higher-priority email no longer blocks the next one. A person who got any
 * lifecycle email in the last day, or has one in flight, is skipped.
 */
function isRenewal(existing, candidate) {
  if (!candidate?.repeat_per_trigger || !existing) return false;
  if (!['sent', 'skipped', 'unknown'].includes(String(existing.status || ''))) return false;
  if (!candidate.source_event_id || String(existing.source_event_id || '') === String(candidate.source_event_id)) return false;
  const lastSendAt = toTime(existing.sent_at || existing.last_attempt_at || existing.updated_at || existing.created_at);
  return toTime(candidate.trigger_occurred_at) > lastSendAt;
}

function planLifecycleSends(candidates, existingRows = [], { now = Date.now(), maxPerRun = DEFAULT_MAX_SENDS_PER_RUN } = {}) {
  const existingByKey = new Map();
  const blockedActors = new Set();
  const stalePending = [];

  for (const row of existingRows) {
    existingByKey.set(sendKey(row.automation_key, row.actor_key), row);
    const state = classifyExistingSend(row, now);
    if (state === 'stale_pending') stalePending.push(row);
    // A send that may have gone out counts for the per-person cooldown.
    const possiblySent = row.status === 'unknown' || state === 'stale_pending';
    const recentlySent = (row.status === 'sent' || possiblySent)
      && now - toTime(row.sent_at || row.last_attempt_at || row.updated_at) < ACTOR_COOLDOWN_MS;
    if (recentlySent || state === 'in_flight') blockedActors.add(row.actor_key);
  }

  const counts = { done: 0, in_flight: 0, cooldown: 0 };
  const open = [];
  for (const candidate of candidates) {
    const existing = existingByKey.get(sendKey(candidate.automation_key, candidate.actor_key));
    let state = existing ? classifyExistingSend(existing, now) : 'new';
    // A repeatable email (one per credit cycle) reuses the person's row for
    // a newer trigger event than the one it was last sent for.
    if (state === 'done' && isRenewal(existing, candidate)) state = 'renew';
    if (state === 'done' || state === 'stale_pending') { counts.done += 1; continue; }
    if (state === 'in_flight') { counts.in_flight += 1; continue; }
    if (blockedActors.has(candidate.actor_key)) { counts.cooldown += 1; continue; }
    open.push(candidate);
  }

  const selected = selectLifecycleCandidatePerActor(open);
  return {
    sends: selected.slice(0, maxPerRun).map(candidate => ({
      candidate,
      existing: existingByKey.get(sendKey(candidate.automation_key, candidate.actor_key)) || null,
    })),
    eligible: selected.length,
    suppressed_competing_candidates: open.length - selected.length,
    stale_pending: stalePending,
    ...counts,
  };
}

async function getExistingSendRows(candidates) {
  if (candidates.length === 0) return [];

  // Every rule key, so a recent email from another rule is visible for the
  // per-person cooldown.
  const automationKeys = [...new Set([...LIFECYCLE_PRIORITY, ...candidates.map(candidate => candidate.automation_key)])];
  const actorKeys = [...new Set(candidates.map(candidate => candidate.actor_key))];
  const rows = [];

  for (const actorKeyChunk of chunk(actorKeys)) {
    const data = await fetchAllRows(
      (from, to) => supabase
        .from('marketing_automation_sends')
        .select('id,automation_key,actor_key,source_event_id,status,attempts,sent_at,last_attempt_at,updated_at,created_at')
        .in('automation_key', automationKeys)
        .in('actor_key', actorKeyChunk)
        .order('automation_key', { ascending: true })
        .order('actor_key', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
      { label: 'automation sends' }
    );
    rows.push(...data);
  }

  return rows;
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

function sendMetadata(candidate) {
  return {
    trigger_event_name: candidate.trigger_event_name,
    trigger_occurred_at: candidate.trigger_occurred_at,
    cta_url: candidate.cta_url,
  };
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
      attempts: 1,
      last_attempt_at: new Date().toISOString(),
      metadata: sendMetadata(candidate),
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') return null;
    throw new Error(`Failed to reserve automation send: ${error.message}`);
  }

  return data;
}

/**
 * Claim a failed or stuck row for another attempt. The status/attempts guard
 * makes the claim exclusive if two runs overlap.
 */
async function claimRetry(existing, candidate) {
  const nowIso = new Date().toISOString();
  // A renewal is a new email for a newer trigger, so its attempts restart.
  const isRenewalClaim = isRenewal(existing, candidate);
  const { data, error } = await supabase
    .from('marketing_automation_sends')
    .update({
      status: 'pending',
      attempts: isRenewalClaim ? 1 : Number(existing.attempts || 1) + 1,
      last_attempt_at: nowIso,
      updated_at: nowIso,
      sent_at: isRenewalClaim ? null : existing.sent_at ?? null,
      error_message: null,
      user_email: candidate.user_email,
      source_event_id: candidate.source_event_id,
      subject: candidate.subject,
      metadata: { ...sendMetadata(candidate), ...(isRenewalClaim ? { renewal: true } : { retry: true }) },
    })
    .eq('id', existing.id)
    .eq('status', existing.status)
    .eq('attempts', Number(existing.attempts || 1))
    .select('id');

  if (error) throw new Error(`Failed to claim automation retry: ${error.message}`);
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
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

/**
 * Stale "pending" rows may have been delivered. Mark them "unknown" (only
 * if still pending, so a late "sent" update wins) and report them once.
 */
async function markStalePendingUnknown(rows, { client = supabase, reportError } = {}) {
  let marked = 0;
  for (const row of rows) {
    const { data, error } = await client
      .from('marketing_automation_sends')
      .update({
        status: 'unknown',
        error_message: 'Interrupted after the send started; delivery unknown. Not retried automatically.',
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('status', 'pending')
      .select('id');
    if (error) {
      console.error('lifecycle-automation: could not mark a stale send unknown');
      continue;
    }
    if (Array.isArray(data) && data.length > 0) marked += 1;
  }

  if (marked > 0) {
    const report = reportError || require('./utils/error-reporter').reportError;
    report(new Error(`Lifecycle automation: ${marked} interrupted send(s) marked unknown; check before resending`), {
      functionName: 'lifecycle-automation',
      extra: { reason: 'stale_pending_marked_unknown', count: marked, ids: rows.map(row => row.id).slice(0, 20) },
    });
  }
  return marked;
}

/**
 * Send the planned emails. Once sendMail has resolved the email is out, so
 * the row is never made retryable after that point: a failure to record
 * "sent" is reported and the row is left pending (it later becomes
 * "unknown", never resent). Only a send that threw is marked "failed".
 * No new send starts after the time budget.
 */
async function executeLifecycleSends(sends, {
  transporter,
  claimRetry: claim = claimRetry,
  reserveSend: reserve = reserveSend,
  markSend: mark = markSend,
  sendEmail = sendLifecycleEmail,
  reportError,
  startedAt = Date.now(),
  timeBudgetMs = SEND_TIME_BUDGET_MS,
  clock = Date.now,
} = {}) {
  const results = { sent: 0, retried: 0, failed: 0, lost_claims: 0, unrecorded_sent: 0, deferred: 0 };
  const report = (error, extra) => {
    const reporter = reportError || require('./utils/error-reporter').reportError;
    reporter(error, { functionName: 'lifecycle-automation', extra });
  };

  for (let index = 0; index < sends.length; index += 1) {
    if (clock() - startedAt >= timeBudgetMs) {
      results.deferred = sends.length - index;
      break;
    }

    const { candidate, existing } = sends[index];
    const reservation = existing
      ? await claim(existing, candidate)
      : await reserve(candidate);
    if (!reservation) {
      results.lost_claims += 1;
      continue;
    }
    if (existing) results.retried += 1;

    try {
      await sendEmail(transporter, candidate);
    } catch (error) {
      results.failed += 1;
      try {
        await mark(reservation.id, {
          status: 'failed',
          error_message: String(error?.message || error).slice(0, 1000),
        });
      } catch (_markError) {
        // Left pending: it becomes "unknown" later, never resent blindly.
        console.error('lifecycle-automation: could not record a failed send');
      }
      continue;
    }

    results.sent += 1;
    try {
      await mark(reservation.id, {
        status: 'sent',
        sent_at: new Date().toISOString(),
        error_message: null,
      });
    } catch (markError) {
      results.unrecorded_sent += 1;
      console.error('lifecycle-automation: email sent but its status could not be recorded');
      report(markError, { reason: 'sent_status_not_recorded', send_id: reservation.id });
    }
  }

  return results;
}

async function sendLifecycleEmail(transporter, candidate) {
  return transporter.sendMail(buildLifecycleMailOptions(candidate, {
    from: getCustomerEmailFrom(),
    supportEmail: getSupportEmail(),
  }));
}

function failure(statusCode, body, error) {
  const { reportError } = require('./utils/error-reporter');
  reportError(error, { functionName: 'lifecycle-automation', extra: { reason: body.reason || null } });
  return { statusCode, body: JSON.stringify({ success: false, ...body }) };
}

async function handler(event) {
  const startedAt = Date.now();
  const auth = isAuthorizedRun(event);
  if (!auth.allowed) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Lifecycle automation requires a valid secret.' }),
    };
  }

  try {
    if (!supabase) {
      return failure(503, { sent: 0, reason: 'supabase_not_configured' }, new Error('Lifecycle automation: Supabase is not configured'));
    }

    const dryRun = parseBoolean(event.queryStringParameters?.dry_run) ||
      parseBoolean(process.env.LIFECYCLE_AUTOMATION_DRY_RUN);

    if (!dryRun && (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD)) {
      return failure(503, { sent: 0, reason: 'email_not_configured' }, new Error('Lifecycle automation: email transport is not configured'));
    }

    const days = parsePositiveInt(process.env.LIFECYCLE_AUTOMATION_LOOKBACK_DAYS, 30, 1, 90);
    const maxPerRun = parsePositiveInt(
      process.env.LIFECYCLE_AUTOMATION_MAX_SENDS,
      DEFAULT_MAX_SENDS_PER_RUN,
      1,
      MAX_SENDS_PER_RUN_LIMIT
    );

    // Annual plans renewing within a week get a reminder event first. A dry
    // run must not write, and a failure here must not stop the other emails.
    let renewalsRecorded = 0;
    if (!dryRun) {
      try {
        renewalsRecorded = await recordUpcomingAnnualRenewals(supabase);
      } catch (renewalError) {
        console.error('lifecycle-automation: could not record upcoming renewals');
        require('./utils/error-reporter').reportError(renewalError, { functionName: 'lifecycle-automation', extra: { reason: 'renewal_upcoming' } });
      }
    }

    // Reads only the event names the rules use (never page views).
    const events = await fetchRecentMarketingEvents(supabase, { days });
    const connectedUserIds = events
      .filter(item => item.event_name === 'connect_completed' && item.user_id)
      .map(item => item.user_id);
    const usageCountsByUserId = connectedUserIds.length > 0
      ? await fetchLifecycleUsageCounts(supabase, connectedUserIds)
      : new Map();
    const candidates = buildLifecycleCandidates(events, { usageCountsByUserId });
    const authUsers = candidates.length > 0 ? await fetchAuthUsers(supabase) : [];
    const verifiedCandidates = filterCandidatesByAuthUsers(candidates, authUsers);
    const optedInCandidates = await filterUnsubscribedCandidates(verifiedCandidates);
    const existingRows = await getExistingSendRows(optedInCandidates);
    const plan = planLifecycleSends(optedInCandidates, existingRows, { maxPerRun });

    const summary = {
      mode: auth.mode,
      renewal_reminders_recorded: renewalsRecorded,
      candidates: candidates.length,
      verified_candidates: verifiedCandidates.length,
      rejected_recipients: candidates.length - verifiedCandidates.length,
      unsubscribed: verifiedCandidates.length - optedInCandidates.length,
      already_sent: plan.done,
      in_flight: plan.in_flight,
      cooldown: plan.cooldown,
      eligible_candidates: plan.eligible,
      suppressed_competing_candidates: plan.suppressed_competing_candidates,
      stale_pending: plan.stale_pending.length,
      unsent: plan.sends.length,
    };

    if (dryRun) {
      const includePreview = auth.mode === 'manual';
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          dry_run: true,
          ...summary,
          preview: includePreview
            ? plan.sends.map(({ candidate, existing }) => ({
              automation_key: candidate.automation_key,
              user_email: candidate.user_email,
              trigger_occurred_at: candidate.trigger_occurred_at,
              retry: Boolean(existing),
            }))
            : undefined,
        }),
      };
    }

    const transporter = createTransporter();
    const markedUnknown = await markStalePendingUnknown(plan.stale_pending);
    const results = {
      ...(await executeLifecycleSends(plan.sends, { transporter, startedAt })),
      marked_unknown: markedUnknown,
    };

    console.log('lifecycle-automation completed', { ...summary, ...results });

    if (results.failed > 0) {
      return failure(500, { ...summary, ...results, reason: 'sends_failed' }, new Error(
        `Lifecycle automation: ${results.failed} of ${results.sent + results.failed} sends failed`
      ));
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, ...summary, ...results }),
    };
  } catch (error) {
    const { reportError } = require('./utils/error-reporter');
    reportError(error, { functionName: 'lifecycle-automation' });

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Lifecycle automation failed',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      }),
    };
  }
}

exports.handler = withErrorReporting('lifecycle-automation', handler);

exports._private = {
  DEFAULT_MAX_SENDS_PER_RUN,
  MAX_SENDS_PER_RUN_LIMIT,
  MAX_SEND_ATTEMPTS,
  SEND_TIME_BUDGET_MS,
  STALE_PENDING_MS,
  classifyExistingSend,
  executeLifecycleSends,
  markStalePendingUnknown,
  getHeader,
  getProvidedSecret,
  isAuthorizedRun,
  parseScheduledBody,
  planLifecycleSends,
  filterUnsubscribedCandidates,
};
