import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const deletion = require('../netlify-functions/utils/account-deletion.js');

const env = { POLAR_ACCESS_TOKEN: 'polar-test-token', SUPERUSER_EMAILS: 'boss@example.com' };
const paidProfile = {
  id: 'user-1',
  email: 'buyer@example.com',
  subscription_id: 'sub_123',
  subscription_status: 'active',
  subscription_plan: 'tier2',
  polar_customer_id: 'cus_1',
  billing_cycle: 'monthly',
};

function response(status, body = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

/**
 * Minimal Supabase double: records every call in `log` so tests can assert
 * the order (audit insert -> delete -> Polar cancel -> audit update).
 */
function fakeSupabase({ profile = paidProfile, authUser, deleteError = null, auditInsertError = null, log = [] } = {}) {
  const user = authUser === undefined
    ? { id: 'user-1', email: 'Buyer@Example.com' }
    : authUser;
  return {
    log,
    auth: {
      admin: {
        getUserById: vi.fn(async () => ({ data: { user }, error: null })),
        deleteUser: vi.fn(async (id) => {
          log.push(['deleteUser', id]);
          return { error: deleteError };
        }),
      },
    },
    from(table) {
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => ({ data: profile, error: null }),
        insert: (row) => {
          log.push(['insert', table, row]);
          return {
            select: () => ({
              single: async () => (auditInsertError
                ? { data: null, error: auditInsertError }
                : { data: { id: 'audit-1' }, error: null }),
            }),
          };
        },
        update: (row) => {
          log.push(['update', table, row]);
          return { eq: async () => ({ error: null }) };
        },
      };
      return builder;
    },
  };
}

describe('account deletion subscription cancellation', () => {
  it('cancels whenever there is a subscription ID on a non-free plan, whatever the status', () => {
    expect(deletion.needsSubscriptionCancellation({ subscription_id: 'sub_1', subscription_plan: 'tier1', subscription_status: 'expired' })).toBe(true);
    expect(deletion.needsSubscriptionCancellation({ subscription_id: 'sub_1', subscription_plan: 'tier1', subscription_status: 'pending' })).toBe(true);
    expect(deletion.needsSubscriptionCancellation({ subscription_id: 'sub_1', subscription_plan: 'tier2', subscription_status: 'past_due' })).toBe(true);
    expect(deletion.needsSubscriptionCancellation({ subscription_id: null, subscription_plan: 'tier1' })).toBe(false);
    expect(deletion.needsSubscriptionCancellation({ subscription_id: 'sub_1', subscription_plan: 'free' })).toBe(false);
  });

  it('revokes through the Polar API and treats missing or already cancelled as done', async () => {
    const ok = vi.fn(async () => response(200));
    expect(await deletion.cancelPolarSubscription('sub_123', { fetchImpl: ok, env })).toEqual({ ok: true, revoked: true });
    expect(ok).toHaveBeenCalledWith('https://api.polar.sh/v1/subscriptions/sub_123', expect.objectContaining({ method: 'DELETE' }));

    const missing = vi.fn(async () => response(404));
    const already = vi.fn(async () => response(403, { error: 'AlreadyCanceledSubscription' }));
    expect(await deletion.cancelPolarSubscription('sub_123', { fetchImpl: missing, env })).toEqual({ ok: true, revoked: false });
    expect(await deletion.cancelPolarSubscription('sub_123', { fetchImpl: already, env })).toEqual({ ok: true, revoked: false });
  });

  it('uses the sandbox API in the sandbox environment', async () => {
    const fetchImpl = vi.fn(async () => response(200));
    await deletion.cancelPolarSubscription('sub_123', { fetchImpl, env: { ...env, POLAR_ENVIRONMENT: 'sandbox' } });
    expect(fetchImpl.mock.calls[0][0]).toBe('https://sandbox-api.polar.sh/v1/subscriptions/sub_123');
  });
});

describe('deleteAccount', () => {
  let reportSpy;
  beforeEach(() => {
    const reporter = require('../netlify-functions/utils/error-reporter.js');
    reportSpy = vi.spyOn(reporter, 'reportError').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('writes the audit row, deletes, then cancels Polar, in that order', async () => {
    const supabase = fakeSupabase();
    const fetchImpl = vi.fn(async (_url, init) => (init.method === 'GET'
      ? response(200, { status: 'active' })
      : response(200)));

    const result = await deletion.deleteAccount({
      supabase, userId: 'user-1', actor: { id: 'admin-1', email: 'Boss@Example.com' }, reason: 'Requested by email', fetchImpl, env,
    });

    expect(result).toMatchObject({ ok: true, status: 'deleted', subscriptionCancellation: 'cancelled', email: 'buyer@example.com' });
    const steps = supabase.log.map(entry => entry[0]);
    expect(steps).toEqual(['insert', 'deleteUser', 'update']);
    expect(fetchImpl.mock.calls.map(call => call[1].method)).toEqual(['GET', 'DELETE']);

    const auditRow = supabase.log[0][2];
    expect(auditRow).toMatchObject({
      action: 'account.deleted',
      resource_id: 'user-1',
      actor_id: 'admin-1',
      actor_email: 'boss@example.com',
    });
    expect(auditRow.details).toMatchObject({
      email: 'buyer@example.com',
      reason: 'Requested by email',
      subscription_id: 'sub_123',
      subscription_ids: ['sub_123'],
      // Written before the delete, so a crash after it still leaves a retry.
      subscription_cancellation: 'pending',
    });
    expect(supabase.log[2][2].details).toMatchObject({ state: 'deleted', subscription_cancellation: 'cancelled' });
  });

  it('aborts before deleting when Polar cannot be reached', async () => {
    const supabase = fakeSupabase();
    const fetchImpl = vi.fn(async () => response(500));

    const result = await deletion.deleteAccount({ supabase, userId: 'user-1', actor: { id: 'admin-1' }, fetchImpl, env });

    expect(result).toMatchObject({ ok: false, status: 'aborted', code: 'subscription_cancel_unavailable' });
    expect(supabase.auth.admin.deleteUser).not.toHaveBeenCalled();
    expect(supabase.log).toEqual([]);
    expect(reportSpy).toHaveBeenCalled();
  });

  it('aborts when Polar is not configured for a paid account', async () => {
    const supabase = fakeSupabase();
    const result = await deletion.deleteAccount({
      supabase, userId: 'user-1', actor: { id: 'admin-1' }, fetchImpl: vi.fn(), env: { SUPERUSER_EMAILS: '' },
    });

    expect(result.ok).toBe(false);
    expect(supabase.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it('never deletes without an audit row', async () => {
    const supabase = fakeSupabase({ profile: { ...paidProfile, subscription_id: null, subscription_plan: 'free' }, auditInsertError: { message: 'down' } });

    const result = await deletion.deleteAccount({ supabase, userId: 'user-1', actor: { id: 'admin-1' }, fetchImpl: vi.fn(), env });

    expect(result).toMatchObject({ ok: false, code: 'audit_failed' });
    expect(supabase.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it('keeps the account deleted and queues a retry when the cancel fails after the delete', async () => {
    const supabase = fakeSupabase();
    const fetchImpl = vi.fn(async (_url, init) => (init.method === 'GET'
      ? response(200, { status: 'active' })
      : response(502)));

    const result = await deletion.deleteAccount({ supabase, userId: 'user-1', actor: { id: 'admin-1' }, fetchImpl, env });

    expect(result).toMatchObject({ ok: true, status: 'deleted', subscriptionCancellation: 'pending' });
    expect(supabase.log.at(-1)[2].details).toMatchObject({ subscription_cancellation: 'pending', cancellation_attempts: 1 });
    expect(reportSpy).toHaveBeenCalled();
  });

  it('does not cancel anything when the delete fails', async () => {
    const supabase = fakeSupabase({ deleteError: { message: 'db down' } });
    const fetchImpl = vi.fn(async () => response(200, { status: 'active' }));

    const result = await deletion.deleteAccount({ supabase, userId: 'user-1', actor: { id: 'admin-1' }, fetchImpl, env });

    expect(result).toMatchObject({ ok: false, code: 'delete_failed' });
    expect(fetchImpl.mock.calls.map(call => call[1].method)).toEqual(['GET']);
    expect(supabase.log.at(-1)[2].details).toMatchObject({ state: 'failed', subscription_cancellation: 'not_attempted' });
  });

  it('skips the cancel when Polar already ended the subscription', async () => {
    const supabase = fakeSupabase();
    const fetchImpl = vi.fn(async () => response(200, { status: 'canceled' }));

    const result = await deletion.deleteAccount({ supabase, userId: 'user-1', actor: { id: 'admin-1' }, fetchImpl, env });

    expect(result).toMatchObject({ ok: true, subscriptionCancellation: 'already_cancelled' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('marks the audit row pending before deleting, so a crash after the delete is retried', async () => {
    const supabase = fakeSupabase();
    let detailsAtDelete = null;
    supabase.auth.admin.deleteUser = vi.fn(async () => {
      detailsAtDelete = supabase.log[0][2].details;
      throw new Error('function timed out');
    });
    const fetchImpl = vi.fn(async () => response(200, { status: 'active' }));

    await expect(deletion.deleteAccount({ supabase, userId: 'user-1', actor: { id: 'admin-1' }, fetchImpl, env }))
      .rejects.toThrow('function timed out');

    expect(detailsAtDelete).toMatchObject({ state: 'deleting', subscription_cancellation: 'pending', subscription_ids: ['sub_123'] });
  });

  describe('paid profile without a stored subscription ID', () => {
    const legacyProfile = { ...paidProfile, subscription_id: null };

    it('looks up active subscriptions in Polar by customer ID and external ID, then cancels them', async () => {
      const supabase = fakeSupabase({ profile: legacyProfile });
      const fetchImpl = vi.fn(async (url, init) => {
        if (init.method === 'DELETE') return response(200);
        if (url.includes('customer_id=cus_1')) {
          return response(200, { items: [{ id: 'sub_live', status: 'active' }, { id: 'sub_old', status: 'canceled' }] });
        }
        return response(200, { items: [{ id: 'sub_live', status: 'active' }, { id: 'sub_ext', status: 'past_due' }] });
      });

      const result = await deletion.deleteAccount({ supabase, userId: 'user-1', actor: { id: 'admin-1' }, fetchImpl, env });

      expect(result).toMatchObject({ ok: true, status: 'deleted', subscriptionCancellation: 'cancelled' });
      const urls = fetchImpl.mock.calls.map(call => `${call[1].method} ${call[0]}`);
      expect(urls).toEqual([
        'GET https://api.polar.sh/v1/subscriptions/?customer_id=cus_1&active=true&limit=100',
        'GET https://api.polar.sh/v1/subscriptions/?external_customer_id=user-1&active=true&limit=100',
        'DELETE https://api.polar.sh/v1/subscriptions/sub_live',
        'DELETE https://api.polar.sh/v1/subscriptions/sub_ext',
      ]);
      expect(supabase.log[0][2].details).toMatchObject({ subscription_ids: ['sub_live', 'sub_ext'], subscription_cancellation: 'pending' });
      expect(supabase.log.at(-1)[2].details).toMatchObject({ state: 'deleted', subscription_cancellation: 'cancelled' });
    });

    it('looks up by external customer ID when there is no Polar customer ID', async () => {
      const supabase = fakeSupabase({ profile: { ...legacyProfile, polar_customer_id: null } });
      const fetchImpl = vi.fn(async () => response(200, { items: [] }));

      const result = await deletion.deleteAccount({ supabase, userId: 'user-1', actor: { id: 'admin-1' }, fetchImpl, env });

      expect(result).toMatchObject({ ok: true, subscriptionCancellation: 'not_needed' });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(fetchImpl.mock.calls[0][0]).toContain('external_customer_id=user-1');
      expect(supabase.log[0][2].details).toMatchObject({ subscription_lookup: 'none_found', subscription_cancellation: 'not_needed' });
    });

    it('aborts with subscription_cancel_unavailable when Polar is not configured', async () => {
      const supabase = fakeSupabase({ profile: legacyProfile });
      const fetchImpl = vi.fn();

      const result = await deletion.deleteAccount({
        supabase, userId: 'user-1', actor: { id: 'admin-1' }, fetchImpl, env: { SUPERUSER_EMAILS: '' },
      });

      expect(result).toMatchObject({ ok: false, status: 'aborted', code: 'subscription_cancel_unavailable' });
      expect(fetchImpl).not.toHaveBeenCalled();
      expect(supabase.auth.admin.deleteUser).not.toHaveBeenCalled();
      expect(supabase.log).toEqual([]);
    });

    it('aborts with subscription_cancel_unavailable when the lookup fails', async () => {
      const supabase = fakeSupabase({ profile: legacyProfile });
      const fetchImpl = vi.fn(async () => response(503));

      const result = await deletion.deleteAccount({ supabase, userId: 'user-1', actor: { id: 'admin-1' }, fetchImpl, env });

      expect(result).toMatchObject({ ok: false, code: 'subscription_cancel_unavailable' });
      expect(supabase.auth.admin.deleteUser).not.toHaveBeenCalled();
      expect(reportSpy).toHaveBeenCalled();
    });

    it('does not look anything up for a free profile', () => {
      expect(deletion.needsSubscriptionLookup({ subscription_id: null, subscription_plan: 'free' })).toBe(false);
      expect(deletion.needsSubscriptionLookup({ subscription_id: null, subscription_plan: 'tier1' })).toBe(true);
      expect(deletion.needsSubscriptionLookup({ subscription_id: 'sub_1', subscription_plan: 'tier1' })).toBe(false);
    });
  });

  it('refuses superuser accounts', async () => {
    const supabase = fakeSupabase({ authUser: { id: 'user-9', email: 'boss@example.com' } });

    const result = await deletion.deleteAccount({ supabase, userId: 'user-9', actor: { id: 'user-9' }, actorType: 'self', fetchImpl: vi.fn(), env });

    expect(result).toMatchObject({ ok: false, status: 'protected' });
    expect(supabase.auth.admin.deleteUser).not.toHaveBeenCalled();
  });
});

describe('retryPendingSubscriptionCancellations', () => {
  const NOW = Date.parse('2026-10-29T12:00:00Z');
  const OLD = '2026-10-28T12:00:00Z';
  let reportSpy;
  beforeEach(() => {
    const reporter = require('../netlify-functions/utils/error-reporter.js');
    reportSpy = vi.spyOn(reporter, 'reportError').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  function retrySupabase(rows, { existingUsers = [] } = {}) {
    const updates = [];
    return {
      updates,
      auth: {
        admin: {
          getUserById: vi.fn(async (id) => (existingUsers.includes(id)
            ? { data: { user: { id } }, error: null }
            : { data: { user: null }, error: { status: 404, message: 'User not found' } })),
        },
      },
      from() {
        const builder = {
          select: () => builder,
          eq: () => builder,
          order: () => builder,
          limit: async () => ({ data: rows, error: null }),
          update: (row) => {
            return {
              eq: async (_field, id) => {
                updates.push({ id, details: row.details });
                return { error: null };
              },
            };
          },
        };
        return builder;
      },
    };
  }

  const pendingRow = (overrides = {}, details = {}) => ({
    id: 'audit-1',
    resource_id: 'user-1',
    created_at: OLD,
    details: { subscription_id: 'sub_1', subscription_cancellation: 'pending', cancellation_attempts: 1, ...details },
    ...overrides,
  });

  it('retries pending cancellations from the audit row once the user is gone', async () => {
    const supabase = retrySupabase([pendingRow()]);
    const fetchImpl = vi.fn(async () => response(200));

    const summary = await deletion.retryPendingSubscriptionCancellations(supabase, { fetchImpl, env, now: NOW });

    expect(summary).toEqual({ attempted: 1, cancelled: 1, still_pending: 0, gave_up: 0, not_attempted: 0 });
    expect(supabase.auth.admin.getUserById).toHaveBeenCalledWith('user-1');
    expect(supabase.updates[0].details).toMatchObject({ subscription_cancellation: 'cancelled', cancellation_attempts: 2 });
  });

  it('cancels every subscription listed on the row', async () => {
    const supabase = retrySupabase([pendingRow({}, { subscription_id: null, subscription_ids: ['sub_a', 'sub_b'] })]);
    const fetchImpl = vi.fn(async () => response(200));

    await deletion.retryPendingSubscriptionCancellations(supabase, { fetchImpl, env, now: NOW });

    expect(fetchImpl.mock.calls.map(call => call[0])).toEqual([
      'https://api.polar.sh/v1/subscriptions/sub_a',
      'https://api.polar.sh/v1/subscriptions/sub_b',
    ]);
  });

  it('never cancels while the auth user still exists', async () => {
    const supabase = retrySupabase([
      pendingRow({ id: 'audit-old' }),
      pendingRow({ id: 'audit-new', resource_id: 'user-2', created_at: new Date(NOW - 60000).toISOString() }),
    ], { existingUsers: ['user-1', 'user-2'] });
    const fetchImpl = vi.fn(async () => response(200));

    const summary = await deletion.retryPendingSubscriptionCancellations(supabase, { fetchImpl, env, now: NOW });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ attempted: 0, not_attempted: 1, still_pending: 1 });
    // The old row belongs to a deletion that did not happen; the recent one
    // may still be running and is left alone.
    expect(supabase.updates).toEqual([
      { id: 'audit-old', details: expect.objectContaining({ subscription_cancellation: 'not_attempted' }) },
    ]);
  });

  it('gives up (and reports) rows at the attempt limit or with nothing to cancel', async () => {
    const supabase = retrySupabase([
      pendingRow({ id: 'audit-max' }, { cancellation_attempts: 50 }),
      pendingRow({ id: 'audit-empty' }, { subscription_id: null, subscription_ids: [] }),
    ]);
    const fetchImpl = vi.fn();

    const summary = await deletion.retryPendingSubscriptionCancellations(supabase, { fetchImpl, env, now: NOW });

    expect(summary).toMatchObject({ gave_up: 2, attempted: 0, still_pending: 0 });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(supabase.updates.map(update => [update.id, update.details.subscription_cancellation, update.details.cancellation_gave_up_reason])).toEqual([
      ['audit-max', 'gave_up', 'max_attempts'],
      ['audit-empty', 'gave_up', 'no_subscription_recorded'],
    ]);
    expect(reportSpy).toHaveBeenCalledTimes(2);
  });

  it('keeps the row pending when the cancel fails again', async () => {
    const supabase = retrySupabase([pendingRow()]);
    const fetchImpl = vi.fn(async () => response(502));

    const summary = await deletion.retryPendingSubscriptionCancellations(supabase, { fetchImpl, env, now: NOW });

    expect(summary).toMatchObject({ attempted: 1, still_pending: 1 });
    expect(supabase.updates[0].details).toMatchObject({ subscription_cancellation: 'pending', cancellation_attempts: 2 });
  });
});
