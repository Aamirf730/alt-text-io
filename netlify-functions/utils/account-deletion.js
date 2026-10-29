// Account deletion shared by the admin endpoint (delete-users) and the
// self-service endpoint (delete-account).
//
// Order, and why:
//   1. Read the account. Superusers are never deleted from here.
//   2. Polar preflight, for any non-free plan (whatever the stored status).
//      With a subscription_id, that subscription must be readable. Without
//      one (legacy or missed-webhook profiles), the customer's active
//      subscriptions are listed by polar_customer_id and by external
//      customer ID (= user ID). Polar must be configured and answer;
//      otherwise abort before anything changes.
//   3. Insert the audit row (user ID, email, actor, reason, subscriptions).
//      When something must be cancelled it is written as
//      subscription_cancellation = "pending" before the delete, so a function
//      that dies after the delete still leaves a row the retry job finds.
//      No audit row, no deletion.
//   4. Delete the auth user. In the same transaction the database trigger
//      prepare_account_deletion (migration 20261029120000) keeps the payments
//      (user_id set null, email stamped in user_email_at_deletion) and scrubs
//      user_email / ip_address from marketing_events and
//      marketing_automation_sends.
//   5. Cancel (revoke) the Polar subscription.
//
// Deleting before cancelling means a failure can never leave a live account
// with a revoked subscription. Polar's DELETE /v1/subscriptions/{id} is
// idempotent (404 and AlreadyCanceled count as done), so if step 5 fails (or
// never runs) the audit row stays subscription_cancellation = "pending", and
// retryPendingSubscriptionCancellations (run by the daily report job)
// retries it from the audit row, only once the auth user is gone. A row it
// cannot finish (no subscription recorded, or too many attempts) becomes
// "gave_up" and is reported, so it stops blocking the queue.

const { isSuperuserEmail, normalizeEmail } = require('./admin-auth');
const { getClientIp } = require('./cors');

const DELETION_AUDIT_ACTION = 'account.deleted';
const ENDED_POLAR_STATUSES = new Set(['canceled', 'incomplete_expired']);
const POLAR_TIMEOUT_MS = 10000;

function getPolarApiBase(env = process.env) {
  return env.POLAR_ENVIRONMENT === 'sandbox'
    ? 'https://sandbox-api.polar.sh'
    : 'https://api.polar.sh';
}

/**
 * A subscription must be cancelled whenever the profile carries a Polar
 * subscription ID on a non-free plan, regardless of the stored status: the
 * stored status can lag Polar (past_due while a renewal is retried, cancel
 * at period end, missed webhooks).
 */
function isPaidPlan(profile) {
  return String(profile?.subscription_plan || 'free').trim().toLowerCase() !== 'free';
}

function needsSubscriptionCancellation(profile) {
  const subscriptionId = String(profile?.subscription_id || '').trim();
  return Boolean(subscriptionId) && isPaidPlan(profile);
}

/**
 * A paid profile without a stored subscription ID (legacy rows, or a missed
 * subscription.active webhook) may still have a live Polar subscription, so
 * it has to be looked up in Polar before the account is deleted.
 */
function needsSubscriptionLookup(profile) {
  return isPaidPlan(profile) && !String(profile?.subscription_id || '').trim();
}

async function listPolarSubscriptions(query, { fetchImpl, env }) {
  const params = new URLSearchParams({ ...query, active: 'true', limit: '100' });
  const response = await fetchImpl(
    `${getPolarApiBase(env)}/v1/subscriptions/?${params.toString()}`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(POLAR_TIMEOUT_MS),
    }
  );
  if (!response.ok) throw new Error(`Polar returned ${response.status}`);
  const body = await response.json().catch(() => null);
  if (!body || !Array.isArray(body.items)) throw new Error('Polar returned an unexpected subscription list');
  return body.items;
}

/**
 * Active Polar subscriptions for a customer, by Polar customer ID and by
 * external customer ID (our user ID). Never guesses: any failure is
 * returned as not ok so the caller can abort the deletion.
 */
async function findActivePolarSubscriptions({ customerId, externalCustomerId }, { fetchImpl = fetch, env = process.env } = {}) {
  if (!env.POLAR_ACCESS_TOKEN) {
    return { ok: false, code: 'polar_not_configured', error: new Error('POLAR_ACCESS_TOKEN is not configured') };
  }

  const queries = [];
  const customer = String(customerId || '').trim();
  const external = String(externalCustomerId || '').trim();
  if (customer) queries.push({ customer_id: customer });
  if (external) queries.push({ external_customer_id: external });
  if (queries.length === 0) {
    return { ok: false, code: 'polar_lookup_unavailable', error: new Error('No Polar customer identity to look up') };
  }

  try {
    const ids = new Set();
    for (const query of queries) {
      const items = await listPolarSubscriptions(query, { fetchImpl, env });
      for (const item of items) {
        const id = String(item?.id || '').trim();
        const status = String(item?.status || '').toLowerCase();
        if (id && !ENDED_POLAR_STATUSES.has(status)) ids.add(id);
      }
    }
    return { ok: true, subscriptionIds: [...ids] };
  } catch (error) {
    return { ok: false, code: 'polar_unavailable', error };
  }
}

async function readPolarSubscription(subscriptionId, { fetchImpl = fetch, env = process.env } = {}) {
  const accessToken = env.POLAR_ACCESS_TOKEN;
  if (!accessToken) {
    return { ok: false, code: 'polar_not_configured', error: new Error('POLAR_ACCESS_TOKEN is not configured') };
  }

  try {
    const response = await fetchImpl(
      `${getPolarApiBase(env)}/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(POLAR_TIMEOUT_MS),
      }
    );

    if (response.status === 404) return { ok: true, exists: false, status: null };
    if (!response.ok) {
      return { ok: false, code: 'polar_unavailable', error: new Error(`Polar returned ${response.status}`) };
    }

    const body = await response.json().catch(() => ({}));
    return { ok: true, exists: true, status: String(body?.status || '').toLowerCase() || null };
  } catch (error) {
    return { ok: false, code: 'polar_unavailable', error };
  }
}

/**
 * Revoke a Polar subscription immediately. Idempotent: an already cancelled
 * or missing subscription counts as done.
 */
async function cancelPolarSubscription(subscriptionId, { fetchImpl = fetch, env = process.env } = {}) {
  const accessToken = env.POLAR_ACCESS_TOKEN;
  if (!accessToken) {
    return { ok: false, revoked: false, error: new Error('POLAR_ACCESS_TOKEN is not configured') };
  }

  try {
    const response = await fetchImpl(
      `${getPolarApiBase(env)}/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(POLAR_TIMEOUT_MS),
      }
    );

    if (response.ok) return { ok: true, revoked: true };
    if (response.status === 404) return { ok: true, revoked: false };

    const body = await response.json().catch(() => ({}));
    if (response.status === 403 && /AlreadyCanceled/i.test(String(body?.error || body?.type || ''))) {
      return { ok: true, revoked: false };
    }

    return { ok: false, revoked: false, error: new Error(`Polar returned ${response.status}`) };
  } catch (error) {
    return { ok: false, revoked: false, error };
  }
}

/** Cancel every listed subscription; ok only when all are done. */
async function cancelPolarSubscriptions(subscriptionIds, options) {
  let revoked = false;
  for (const id of subscriptionIds) {
    const result = await cancelPolarSubscription(id, options);
    if (!result.ok) return { ok: false, revoked, error: result.error };
    revoked = revoked || result.revoked;
  }
  return { ok: true, revoked };
}

function reportFailure(error, context) {
  try {
    const { reportError } = require('./error-reporter');
    reportError(error, { functionName: 'account-deletion', extra: context });
  } catch (_ignored) {
    console.error('account-deletion: failed to report error');
  }
}

async function updateAuditDetails(supabase, auditId, details) {
  if (!auditId) return;
  const { error } = await supabase
    .from('audit_logs')
    .update({ details })
    .eq('id', auditId);
  if (error) console.error('account-deletion: audit row update failed');
}

async function getAuthUser(supabase, userId) {
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error) {
    if (error.status === 404 || /not found/i.test(String(error.message || ''))) return { user: null };
    return { error };
  }
  return { user: data?.user || null };
}

/**
 * Delete one account. Never throws for expected outcomes.
 *
 * @returns {Promise<{
 *   ok: boolean,
 *   status: 'deleted'|'not_found'|'protected'|'aborted',
 *   code?: string,
 *   message?: string,
 *   email?: string,
 *   subscriptionCancellation?: 'not_needed'|'cancelled'|'already_cancelled'|'pending',
 *   (audit details.subscription_cancellation may also be 'not_attempted'
 *   after a failed delete, or 'gave_up' when the retry job stops),
 *   auditId?: string,
 * }>}
 */
async function deleteAccount({
  supabase,
  userId,
  actor,
  actorType = 'admin',
  reason = null,
  event = null,
  fetchImpl = fetch,
  env = process.env,
} = {}) {
  if (!supabase || !userId) {
    return { ok: false, status: 'aborted', code: 'invalid_request', message: 'A user ID is required.' };
  }

  // 1. Account
  const authLookup = await getAuthUser(supabase, userId);
  if (authLookup.error) {
    return { ok: false, status: 'aborted', code: 'lookup_failed', message: 'The account could not be read. Nothing was deleted.' };
  }
  const authUser = authLookup.user;
  if (!authUser) {
    return { ok: false, status: 'not_found', code: 'not_found', message: 'Account not found.' };
  }

  const email = normalizeEmail(authUser.email);
  if (isSuperuserEmail(email, env) || (actorType === 'admin' && actor?.id === authUser.id)) {
    return { ok: false, status: 'protected', code: 'protected_account', email, message: 'Admin accounts cannot be deleted here.' };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id,email,subscription_id,subscription_plan,subscription_status,polar_customer_id,billing_cycle')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) {
    return { ok: false, status: 'aborted', code: 'lookup_failed', email, message: 'The account could not be read. Nothing was deleted.' };
  }

  // 2. Polar preflight
  const subscriptionId = String(profile?.subscription_id || '').trim() || null;
  let cancellation = 'not_needed';
  let subscriptionIds = [];
  let subscriptionLookup = null;
  const abortForPolar = (result) => {
    console.error('account-deletion: Polar preflight failed; deletion aborted', { code: result.code });
    reportFailure(result.error || new Error('Polar preflight failed'), { step: 'polar_preflight', code: result.code });
    return {
      ok: false,
      status: 'aborted',
      code: 'subscription_cancel_unavailable',
      email,
      message: 'The subscription could not be checked with the billing provider, so the account was not deleted. Try again later.',
    };
  };

  if (needsSubscriptionCancellation(profile)) {
    const preflight = await readPolarSubscription(subscriptionId, { fetchImpl, env });
    if (!preflight.ok) return abortForPolar(preflight);
    if (!preflight.exists || ENDED_POLAR_STATUSES.has(preflight.status)) {
      cancellation = 'already_cancelled';
    } else {
      subscriptionIds = [subscriptionId];
    }
  } else if (needsSubscriptionLookup(profile)) {
    const lookup = await findActivePolarSubscriptions(
      { customerId: profile?.polar_customer_id, externalCustomerId: userId },
      { fetchImpl, env }
    );
    if (!lookup.ok) return abortForPolar(lookup);
    subscriptionIds = lookup.subscriptionIds;
    subscriptionLookup = subscriptionIds.length > 0 ? 'found' : 'none_found';
  }

  // Written before the delete: if the function dies after deleting, the
  // retry job still finds this row.
  if (subscriptionIds.length > 0) cancellation = 'pending';

  // 3. Audit row first: no audit trail, no deletion.
  const details = {
    email,
    actor_type: actorType,
    reason: reason ? String(reason).slice(0, 500) : null,
    subscription_id: subscriptionId,
    subscription_ids: subscriptionIds,
    ...(subscriptionLookup ? { subscription_lookup: subscriptionLookup } : {}),
    polar_customer_id: profile?.polar_customer_id || null,
    subscription_plan: profile?.subscription_plan || null,
    subscription_status: profile?.subscription_status || null,
    billing_cycle: profile?.billing_cycle || null,
    state: 'deleting',
    subscription_cancellation: cancellation,
    cancellation_attempts: 0,
  };

  const { data: auditRow, error: auditError } = await supabase
    .from('audit_logs')
    .insert({
      actor_id: actor?.id || null,
      actor_email: actor?.email ? normalizeEmail(actor.email) : null,
      action: DELETION_AUDIT_ACTION,
      resource_type: 'user',
      resource_id: String(userId),
      details,
      severity: 'warning',
      ip_address: event ? getClientIp({ ...event, headers: event.headers || {} }) : null,
      user_agent: event?.headers?.['user-agent'] ? String(event.headers['user-agent']).slice(0, 500) : null,
    })
    .select('id')
    .single();

  if (auditError || !auditRow?.id) {
    console.error('account-deletion: audit row insert failed; deletion aborted');
    return { ok: false, status: 'aborted', code: 'audit_failed', email, message: 'The deletion could not be recorded, so nothing was deleted. Try again.' };
  }

  // 4. Delete (payments kept and marketing data scrubbed by the DB trigger).
  const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.error('account-deletion: auth user delete failed');
    await updateAuditDetails(supabase, auditRow.id, {
      ...details,
      state: 'failed',
      subscription_cancellation: cancellation === 'pending' ? 'not_attempted' : cancellation,
    });
    return { ok: false, status: 'aborted', code: 'delete_failed', email, auditId: auditRow.id, message: 'The account could not be deleted. Nothing was cancelled. Try again.' };
  }

  // 5. Cancel billing.
  let cancellationError = null;
  let attempts = 0;
  if (cancellation === 'pending') {
    attempts = 1;
    const cancelResult = await cancelPolarSubscriptions(subscriptionIds, { fetchImpl, env });
    if (cancelResult.ok) {
      cancellation = cancelResult.revoked ? 'cancelled' : 'already_cancelled';
    } else {
      cancellationError = String(cancelResult.error?.message || 'Polar cancellation failed').slice(0, 300);
      console.error('account-deletion: Polar cancellation failed after delete; queued for retry');
      reportFailure(cancelResult.error || new Error('Polar cancellation failed'), {
        step: 'polar_cancel',
        audit_row: auditRow.id,
      });
    }
  }

  await updateAuditDetails(supabase, auditRow.id, {
    ...details,
    state: 'deleted',
    deleted_at: new Date().toISOString(),
    subscription_cancellation: cancellation,
    cancellation_attempts: attempts,
    ...(cancellationError ? { last_cancellation_error: cancellationError } : {}),
  });

  return {
    ok: true,
    status: 'deleted',
    email,
    auditId: auditRow.id,
    subscriptionCancellation: cancellation,
  };
}

function auditSubscriptionIds(details) {
  const listed = Array.isArray(details?.subscription_ids)
    ? details.subscription_ids.map(id => String(id || '').trim()).filter(Boolean)
    : [];
  if (listed.length > 0) return [...new Set(listed)];
  const single = String(details?.subscription_id || '').trim();
  return single ? [single] : [];
}

// A pending row younger than this may belong to a deletion still running.
const PENDING_GRACE_MS = 15 * 60 * 1000;

/**
 * Retry Polar cancellations left pending by deleteAccount. Safe to run on a
 * schedule: cancellation is idempotent.
 *
 * A pending row is cancelled only once its auth user no longer exists: the
 * row is written before the delete, so a deletion that failed (or died
 * before deleting) must not cancel a live customer's billing. Rows that
 * cannot be finished become "gave_up" (reported) or "not_attempted", so they
 * stop occupying the oldest-first batch.
 */
async function retryPendingSubscriptionCancellations(supabase, {
  limit = 20,
  maxAttempts = 50,
  fetchImpl = fetch,
  env = process.env,
  now = Date.now(),
} = {}) {
  const summary = { attempted: 0, cancelled: 0, still_pending: 0, gave_up: 0, not_attempted: 0 };
  if (!supabase) return summary;

  const { data, error } = await supabase
    .from('audit_logs')
    .select('id,resource_id,details,created_at')
    .eq('action', DELETION_AUDIT_ACTION)
    .eq('details->>subscription_cancellation', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw new Error(`Failed to read pending subscription cancellations: ${error.message}`);

  for (const row of data || []) {
    const details = row.details || {};
    const attempts = Number(details.cancellation_attempts || 0);
    const subscriptionIds = auditSubscriptionIds(details);

    if (subscriptionIds.length === 0 || attempts >= maxAttempts) {
      const reason = subscriptionIds.length === 0 ? 'no_subscription_recorded' : 'max_attempts';
      await updateAuditDetails(supabase, row.id, {
        ...details,
        subscription_cancellation: 'gave_up',
        cancellation_gave_up_reason: reason,
        cancellation_gave_up_at: new Date(now).toISOString(),
      });
      reportFailure(new Error(`Polar cancellation retry gave up (${reason})`), {
        step: 'polar_cancel_retry',
        audit_row: row.id,
        reason,
      });
      summary.gave_up += 1;
      continue;
    }

    const authLookup = row.resource_id
      ? await getAuthUser(supabase, row.resource_id)
      : { user: null };
    if (authLookup.error) {
      summary.still_pending += 1;
      continue;
    }
    if (authLookup.user) {
      // The account was not deleted (the delete failed, or is running now).
      if (now - new Date(row.created_at || 0).getTime() < PENDING_GRACE_MS) {
        summary.still_pending += 1;
        continue;
      }
      await updateAuditDetails(supabase, row.id, {
        ...details,
        state: details.state === 'deleting' ? 'failed' : details.state,
        subscription_cancellation: 'not_attempted',
      });
      summary.not_attempted += 1;
      continue;
    }

    summary.attempted += 1;
    const result = await cancelPolarSubscriptions(subscriptionIds, { fetchImpl, env });
    const next = {
      ...details,
      cancellation_attempts: attempts + 1,
      last_cancellation_attempt_at: new Date(now).toISOString(),
    };

    if (result.ok) {
      next.subscription_cancellation = result.revoked ? 'cancelled' : 'already_cancelled';
      delete next.last_cancellation_error;
      summary.cancelled += 1;
    } else {
      next.last_cancellation_error = String(result.error?.message || 'Polar cancellation failed').slice(0, 300);
      summary.still_pending += 1;
    }

    await updateAuditDetails(supabase, row.id, next);
  }

  return summary;
}

module.exports = {
  DELETION_AUDIT_ACTION,
  cancelPolarSubscription,
  deleteAccount,
  findActivePolarSubscriptions,
  getPolarApiBase,
  needsSubscriptionCancellation,
  needsSubscriptionLookup,
  readPolarSubscription,
  retryPendingSubscriptionCancellations,
};
