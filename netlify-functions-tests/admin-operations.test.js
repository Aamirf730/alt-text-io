import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const unsubscribe = require('../netlify-functions/unsubscribe-lifecycle.js');
const deleteAccount = require('../netlify-functions/delete-account.js');
const userAction = require('../netlify-functions/admin-user-action.js');
const reconciliation = require('../netlify-functions/admin-payment-reconciliation.js');
const userDetail = require('../netlify-functions/admin-user-detail.js');
const adminUsers = require('../netlify-functions/admin-get-users.js');
const auditLog = require('../netlify-functions/admin-audit-log.js');
const { createUnsubscribeToken } = require('../netlify-functions/utils/lifecycle-unsubscribe.js');

describe('unsubscribe endpoint', () => {
  const previous = process.env.LIFECYCLE_UNSUBSCRIBE_SECRET;
  beforeEach(() => { process.env.LIFECYCLE_UNSUBSCRIBE_SECRET = 'unsub-secret'; });
  afterEach(() => {
    if (previous === undefined) delete process.env.LIFECYCLE_UNSUBSCRIBE_SECRET;
    else process.env.LIFECYCLE_UNSUBSCRIBE_SECRET = previous;
  });

  function client(updates) {
    return {
      from: () => {
        const builder = {
          update: (row) => { updates.push(row); return builder; },
          eq: () => builder,
          is: () => builder,
          select: async () => ({ data: [{ id: 'user-1' }], error: null }),
        };
        return builder;
      },
    };
  }

  it('shows a confirmation page on GET and changes nothing', async () => {
    const updates = [];
    const handler = unsubscribe._private.createHandler({ supabaseClient: client(updates) });
    const token = createUnsubscribeToken({ userId: 'user-1', email: 'a@example.com' });

    const response = await handler({ httpMethod: 'GET', queryStringParameters: { token } });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('<form method="post"');
    expect(updates).toHaveLength(0);
  });

  it('unsubscribes on the RFC 8058 one-click POST', async () => {
    const updates = [];
    const handler = unsubscribe._private.createHandler({ supabaseClient: client(updates) });
    const token = createUnsubscribeToken({ userId: 'user-1', email: 'a@example.com' });

    const response = await handler({
      httpMethod: 'POST',
      queryStringParameters: { token },
      body: 'List-Unsubscribe=One-Click',
    });

    expect(response.statusCode).toBe(200);
    expect(updates).toHaveLength(1);
    expect(updates[0]).toHaveProperty('marketing_unsubscribed_at');
  });

  it('refuses a forged token', async () => {
    const updates = [];
    const handler = unsubscribe._private.createHandler({ supabaseClient: client(updates) });
    const response = await handler({ httpMethod: 'POST', queryStringParameters: { token: 'v2.e30.forged' } });

    expect(response.statusCode).toBe(400);
    expect(updates).toHaveLength(0);
  });
});

describe('self-service delete-account', () => {
  const allow = vi.fn(async () => ({ allowed: true }));
  const user = { id: 'user-1', email: 'Buyer@Example.com', email_confirmed_at: '2026-01-01' };
  const supabaseClient = { auth: { getUser: vi.fn(async () => ({ data: { user }, error: null })) } };
  const request = (body, headers = { authorization: 'Bearer token' }) => ({
    httpMethod: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  it('requires a bearer token', async () => {
    const handler = deleteAccount._private.createHandler({ supabaseClient, checkRateLimitFn: allow, deleteAccountFn: vi.fn() });
    const response = await handler(request({ confirm_email: 'buyer@example.com' }, {}));
    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body)).toMatchObject({ error: 'unauthorized' });
  });

  it('requires the typed email to match, ignoring case', async () => {
    const deleteAccountFn = vi.fn(async () => ({ ok: true, status: 'deleted', subscriptionCancellation: 'not_needed' }));
    const handler = deleteAccount._private.createHandler({ supabaseClient, checkRateLimitFn: allow, deleteAccountFn });

    const mismatch = await handler(request({ confirm_email: 'other@example.com' }));
    expect(mismatch.statusCode).toBe(400);
    expect(JSON.parse(mismatch.body)).toMatchObject({ error: 'email_mismatch' });
    expect(deleteAccountFn).not.toHaveBeenCalled();

    const ok = await handler(request({ confirm_email: '  BUYER@example.com ' }));
    expect(ok.statusCode).toBe(200);
    expect(JSON.parse(ok.body)).toMatchObject({ success: true });
    expect(deleteAccountFn).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1', actorType: 'self' }));
  });

  it('emails a deletion confirmation, and a failed email does not fail the deletion', async () => {
    const deleteAccountFn = vi.fn(async () => ({ ok: true, status: 'deleted', subscriptionCancellation: 'cancelled' }));
    const sendEmailFn = vi.fn(async () => {});
    const handler = deleteAccount._private.createHandler({ supabaseClient, checkRateLimitFn: allow, deleteAccountFn, sendEmailFn });

    const response = await handler(request({ confirm_email: 'buyer@example.com' }));
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({ confirmation_email_sent: true });
    const [{ to, subject, content }] = sendEmailFn.mock.calls[0];
    expect(to).toBe('buyer@example.com');
    expect(subject).toBe('Your Alt Text Pro account has been deleted');
    expect(content.paragraphs.join(' ')).toContain('no further charges');

    const failing = deleteAccount._private.createHandler({
      supabaseClient,
      checkRateLimitFn: allow,
      deleteAccountFn,
      sendEmailFn: vi.fn(async () => { throw new Error('smtp down'); }),
    });
    const stillOk = await failing(request({ confirm_email: 'buyer@example.com' }));
    expect(stillOk.statusCode).toBe(200);
    expect(JSON.parse(stillOk.body)).toMatchObject({ success: true, confirmation_email_sent: false });
  });

  it('refuses superusers', async () => {
    const previous = process.env.SUPERUSER_EMAILS;
    process.env.SUPERUSER_EMAILS = 'buyer@example.com';
    const deleteAccountFn = vi.fn();
    const handler = deleteAccount._private.createHandler({ supabaseClient, checkRateLimitFn: allow, deleteAccountFn });

    const response = await handler(request({ confirm_email: 'buyer@example.com' }));

    expect(response.statusCode).toBe(403);
    expect(deleteAccountFn).not.toHaveBeenCalled();
    if (previous === undefined) delete process.env.SUPERUSER_EMAILS;
    else process.env.SUPERUSER_EMAILS = previous;
  });

  it('is rate limited', async () => {
    const limited = vi.fn(async () => ({ allowed: false, resetAt: new Date(Date.now() + 60000), limit: 5 }));
    const handler = deleteAccount._private.createHandler({ supabaseClient, checkRateLimitFn: limited, deleteAccountFn: vi.fn() });
    const response = await handler(request({ confirm_email: 'buyer@example.com' }));
    expect(response.statusCode).toBe(429);
  });

  it('passes failures through as { error, message }', async () => {
    const deleteAccountFn = vi.fn(async () => ({ ok: false, status: 'aborted', code: 'subscription_cancel_unavailable', message: 'Try later' }));
    const handler = deleteAccount._private.createHandler({ supabaseClient, checkRateLimitFn: allow, deleteAccountFn });

    const response = await handler(request({ confirm_email: 'buyer@example.com' }));

    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.body)).toEqual({ error: 'subscription_cancel_unavailable', message: 'Try later' });
  });
});

describe('admin operator actions', () => {
  const userId = '11111111-2222-4333-8444-555555555555';

  it('requires a reason and a whole number of credits', () => {
    const parse = userAction._private.parseActionRequest;
    expect(parse(JSON.stringify({ user_id: userId, action: 'grant_credits', credits: 10 })).error).toMatch(/reason/);
    expect(parse(JSON.stringify({ user_id: userId, action: 'grant_credits', credits: 1.5, reason: 'Goodwill' })).error).toMatch(/credits/);
    expect(parse(JSON.stringify({ user_id: userId, action: 'impersonate', reason: 'nope' })).error).toBe('Unsupported action');
  });

  it('builds a stable idempotency key from the form key', () => {
    const parse = userAction._private.parseActionRequest;
    const body = JSON.stringify({ user_id: userId, action: 'grant_credits', credits: 50, reason: 'Goodwill', idempotency_key: 'form-key-123' });
    expect(parse(body).request.idempotencyKey).toBe(parse(body).request.idempotencyKey);
    expect(parse(body).request.idempotencyKey).toContain('form-key-123');
  });
});

describe('unmatched payments queue', () => {
  it('summarizes the stored Polar payload for operators', () => {
    const row = reconciliation._private.toRow({
      id: 'rec-1',
      created_at: '2026-10-28T00:00:00Z',
      event_name: 'order.paid',
      status: 'open',
      customer_email: 'buyer@example.com',
      payload: { id: 'ord_1', totalAmount: 1452, currency: 'usd', product: { name: 'Growth' }, billingReason: 'purchase' },
    });

    expect(row).toMatchObject({
      id: 'rec-1',
      event_type: 'order.paid',
      customer_email: 'buyer@example.com',
      amount: 14.52,
      currency: 'USD',
      product: 'Growth',
    });
    expect(row.raw_summary).toMatchObject({ id: 'ord_1', billing_reason: 'purchase' });
    expect(row).not.toHaveProperty('payload');
  });
});

describe('admin lookups and links', () => {
  it('links to the Polar dashboard only when the organization slug is set', () => {
    expect(userDetail._private.buildPolarLinks({ customerId: 'cus_1' }, {})).toEqual({ customer: null, subscription: null, latest_order: null });
    expect(userDetail._private.buildPolarLinks({ customerId: 'cus_1', orderId: 'ord_1' }, { POLAR_ORGANIZATION_SLUG: 'alt-text-pro' }))
      .toMatchObject({
        customer: 'https://polar.sh/dashboard/alt-text-pro/customers/cus_1',
        latest_order: 'https://polar.sh/dashboard/alt-text-pro/sales/ord_1',
      });
  });

  it('normalizes the Users tab query', () => {
    expect(adminUsers._private.parseListQuery({ q: '  site.com ', plan: 'nope', status: 'active', limit: '999' }))
      .toMatchObject({ q: 'site.com', plan: 'all', status: 'active', limit: 200, offset: 0, includeStats: true });
  });

  it('accepts only safe audit-log filters', () => {
    expect(auditLog._private.parseAuditQuery({ action: 'admin.', actor: 'a@b.com', limit: '0' }))
      .toMatchObject({ action: 'admin.', actor: 'a@b.com', limit: 1 });
    expect(auditLog._private.parseAuditQuery({ action: 'x),or(1=1' }).action).toBeNull();
  });
});
