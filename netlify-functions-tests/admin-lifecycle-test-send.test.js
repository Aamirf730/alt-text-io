import { describe, expect, it } from 'vitest';

const { _private } = require('../netlify-functions/admin-lifecycle-test-send.js');

function fakeClient(rows, calls = []) {
  const query = {
    select: () => query,
    eq: (column, value) => {
      calls.push([column, value]);
      return query;
    },
    limit: async () => ({ data: rows, error: null }),
  };
  return { from: () => query };
}

describe('admin lifecycle test send target checks', () => {
  it('refuses an event-built candidate whose profile unsubscribed', async () => {
    const calls = [];
    const reason = await _private.getTargetProfileBlockReason(
      fakeClient([{ id: 'user-1', marketing_unsubscribed_at: '2026-10-01T00:00:00Z' }], calls),
      { user_id: 'user-1', user_email: 'person@example.com' },
      'person@example.com',
    );

    expect(reason).toBe('unsubscribed');
    expect(calls).toEqual([['id', 'user-1']]);
  });

  it('checks by email when the candidate has no user id', async () => {
    const calls = [];
    const reason = await _private.getTargetProfileBlockReason(
      fakeClient([
        { id: 'user-1', marketing_unsubscribed_at: null },
        { id: 'user-2', marketing_unsubscribed_at: '2026-10-01T00:00:00Z' },
      ], calls),
      { user_id: null },
      'person@example.com',
    );

    expect(reason).toBe('unsubscribed');
    expect(calls).toEqual([['email', 'person@example.com']]);
  });

  it('refuses a candidate with no matching account', async () => {
    const reason = await _private.getTargetProfileBlockReason(
      fakeClient([]),
      { user_id: 'missing' },
      'person@example.com',
    );

    expect(reason).toBe('profile_not_found');
  });

  it('allows an opted-in account', async () => {
    const reason = await _private.getTargetProfileBlockReason(
      fakeClient([{ id: 'user-1', marketing_unsubscribed_at: null }]),
      { user_id: 'user-1' },
      'person@example.com',
    );

    expect(reason).toBeNull();
  });
});
