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

describe('admin lifecycle test send status fallback', () => {
  const hoursAgo = hours => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  it('builds a connect reminder for a signup with no marketing events', () => {
    const candidate = _private.buildStatusFallbackCandidate({
      automationKey: 'signup_no_connect',
      email: 'person@example.com',
      row: { user_id: 'user-1', follow_up_status: 'Needs plugin reminder', signup_at: hoursAgo(48) },
    });

    expect(candidate).toMatchObject({
      automation_key: 'signup_no_connect',
      actor_key: 'user:user-1',
      user_id: 'user-1',
      user_email: 'person@example.com',
      source_event_id: null,
      trigger_event_name: 'signup_created',
      cta_url: 'https://www.alt-text.pro/connect',
    });
  });

  it('builds a first-generation reminder from a connection known only by status', () => {
    const candidate = _private.buildStatusFallbackCandidate({
      automationKey: 'connect_no_first_image',
      email: 'person@example.com',
      sourceEventId: 'event-1',
      row: { user_id: 'user-1', follow_up_status: 'Needs first generation reminder', plugin_connected_at: hoursAgo(7) },
    });

    expect(candidate).toMatchObject({
      automation_key: 'connect_no_first_image',
      source_event_id: 'event-1',
      trigger_event_name: 'connect_completed',
    });
  });

  it('refuses a rule that does not match the row status', () => {
    expect(_private.buildStatusFallbackCandidate({
      automationKey: 'connect_no_first_image',
      email: 'person@example.com',
      row: { user_id: 'user-1', follow_up_status: 'Needs plugin reminder', signup_at: hoursAgo(48) },
    })).toBeNull();
  });

  it('keeps the scheduled waiting period', () => {
    expect(_private.buildStatusFallbackCandidate({
      automationKey: 'signup_no_connect',
      email: 'person@example.com',
      row: { user_id: 'user-1', follow_up_status: 'Needs plugin reminder', signup_at: hoursAgo(1) },
    })).toBeNull();
  });
});
