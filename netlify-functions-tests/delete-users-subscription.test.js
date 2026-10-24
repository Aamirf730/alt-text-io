import { afterEach, describe, expect, it, vi } from 'vitest';

const { _private } = require('../netlify-functions/delete-users.js');

const liveProfile = { subscription_id: 'sub_123', subscription_status: 'active', subscription_plan: 'tier2' };

describe('admin deletion stops Polar billing first', () => {
  const originalToken = process.env.POLAR_ACCESS_TOKEN;
  const originalEnvironment = process.env.POLAR_ENVIRONMENT;

  afterEach(() => {
    process.env.POLAR_ACCESS_TOKEN = originalToken;
    process.env.POLAR_ENVIRONMENT = originalEnvironment;
  });

  it('revokes a running subscription through the Polar API', async () => {
    process.env.POLAR_ACCESS_TOKEN = 'polar-test-token';
    delete process.env.POLAR_ENVIRONMENT;
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));

    const result = await _private.revokePolarSubscription(liveProfile, { fetchImpl });

    expect(result).toEqual({ ok: true, revoked: true });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.polar.sh/v1/subscriptions/sub_123',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('does nothing for free or already revoked accounts', async () => {
    const fetchImpl = vi.fn();

    expect(await _private.revokePolarSubscription({ subscription_id: null, subscription_status: 'active' }, { fetchImpl }))
      .toEqual({ ok: true, revoked: false });
    expect(await _private.revokePolarSubscription({ subscription_id: 'sub_1', subscription_status: 'revoked' }, { fetchImpl }))
      .toEqual({ ok: true, revoked: false });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('treats an already cancelled or missing Polar subscription as done', async () => {
    process.env.POLAR_ACCESS_TOKEN = 'polar-test-token';
    const already = vi.fn(async () => ({ ok: false, status: 403, json: async () => ({ error: 'AlreadyCanceledSubscription' }) }));
    const missing = vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }));

    expect(await _private.revokePolarSubscription(liveProfile, { fetchImpl: already })).toEqual({ ok: true, revoked: false });
    expect(await _private.revokePolarSubscription(liveProfile, { fetchImpl: missing })).toEqual({ ok: true, revoked: false });
  });

  it('blocks the deletion when Polar cannot cancel the subscription', async () => {
    process.env.POLAR_ACCESS_TOKEN = 'polar-test-token';
    const failing = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }));

    const result = await _private.revokePolarSubscription(liveProfile, { fetchImpl: failing });

    expect(result.ok).toBe(false);
  });

  it('uses the sandbox API in the sandbox environment', async () => {
    process.env.POLAR_ACCESS_TOKEN = 'polar-test-token';
    process.env.POLAR_ENVIRONMENT = 'sandbox';
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));

    await _private.revokePolarSubscription(liveProfile, { fetchImpl });

    expect(fetchImpl.mock.calls[0][0]).toBe('https://sandbox-api.polar.sh/v1/subscriptions/sub_123');
  });
});
