import { describe, expect, it, vi } from 'vitest';

const { getLowCreditThreshold, recordCreditEvent, recordCreditsLowEvent } = require('./credits-low-event.js');

function createSupabaseMock({
  latestLowCredit = null,
  latestPurchase = null,
  selectErrors = [],
  insertError = null,
} = {}) {
  const selectResults = [
    { data: latestLowCredit ? [latestLowCredit] : [], error: selectErrors[0] || null },
    { data: latestPurchase ? [latestPurchase] : [], error: selectErrors[1] || null },
  ];

  const insert = vi.fn(() => Promise.resolve({ error: insertError }));
  const limit = vi.fn(() => Promise.resolve(selectResults.shift()));
  const order = vi.fn(() => ({ limit }));
  const secondEq = vi.fn(() => ({ order }));
  const firstEq = vi.fn(() => ({ eq: secondEq }));
  const select = vi.fn(() => ({ eq: firstEq }));
  const from = vi.fn(() => ({ select, insert }));

  return {
    supabase: { from },
    calls: {
      insert,
      secondEq,
    },
  };
}

describe('credits low event recording', () => {
  it('records credits_low when credits are low and no current-cycle event exists', async () => {
    const { supabase, calls } = createSupabaseMock();

    const result = await recordCreditsLowEvent(supabase, {
      userId: 'user-1',
      userEmail: 'lead@example.com',
      creditsRemaining: 5,
      occurredAt: '2026-06-30T12:24:38.095Z',
    });

    expect(result).toEqual({ recorded: true, reason: 'inserted' });
    expect(calls.insert).toHaveBeenCalledWith({
      event_name: 'credits_low',
      source: 'wordpress_plugin_usage',
      user_id: 'user-1',
      user_email: 'lead@example.com',
      properties: {
        credits_remaining: 5,
        trigger: 'server_generation',
      },
      occurred_at: '2026-06-30T12:24:38.095Z',
    });
  });

  it('does not record duplicate low-credit events in the same credit cycle', async () => {
    const { supabase, calls } = createSupabaseMock({
      latestLowCredit: { id: 'event-1', occurred_at: '2026-06-30T12:00:00.000Z' },
    });

    const result = await recordCreditsLowEvent(supabase, {
      userId: 'user-1',
      userEmail: 'lead@example.com',
      creditsRemaining: 4,
    });

    expect(result).toEqual({ recorded: false, reason: 'already_recorded_current_cycle' });
    expect(calls.insert).not.toHaveBeenCalled();
  });

  it('records a new low-credit event after a later purchase', async () => {
    const { supabase, calls } = createSupabaseMock({
      latestLowCredit: { id: 'event-1', occurred_at: '2026-06-01T10:00:00.000Z' },
      latestPurchase: { id: 'event-2', occurred_at: '2026-06-15T10:00:00.000Z' },
    });

    const result = await recordCreditsLowEvent(supabase, {
      userId: 'user-1',
      userEmail: 'lead@example.com',
      creditsRemaining: 3,
    });

    expect(result).toEqual({ recorded: true, reason: 'inserted' });
    expect(calls.insert).toHaveBeenCalledTimes(1);
  });

  it('warns larger plans earlier: 10% of the allowance, between 5 and 100', () => {
    expect(getLowCreditThreshold(15)).toBe(5);
    expect(getLowCreditThreshold(500)).toBe(50);
    expect(getLowCreditThreshold(5000)).toBe(100);
    expect(getLowCreditThreshold(null)).toBe(5);
  });

  it('records a new low-credit event after a monthly refill, not only after a purchase', async () => {
    const { supabase, calls } = createSupabaseMock({
      latestLowCredit: { id: 'low-1', occurred_at: '2026-09-20T00:00:00.000Z' },
    });

    const result = await recordCreditsLowEvent(supabase, {
      userId: 'user-1',
      creditsRemaining: 40,
      monthlyAllowance: 500,
      cycleStartedAt: '2026-10-01T00:00:00.000Z',
    });

    expect(result).toEqual({ recorded: true, reason: 'inserted' });
    expect(calls.insert).toHaveBeenCalledTimes(1);
  });

  it('does not record twice in the same refill cycle', async () => {
    const { supabase, calls } = createSupabaseMock({
      latestLowCredit: { id: 'low-1', occurred_at: '2026-10-05T00:00:00.000Z' },
    });

    const result = await recordCreditsLowEvent(supabase, {
      userId: 'user-1',
      creditsRemaining: 3,
      cycleStartedAt: '2026-10-01T00:00:00.000Z',
    });

    expect(result.reason).toBe('already_recorded_current_cycle');
    expect(calls.insert).not.toHaveBeenCalled();
  });

  it('records credits_exhausted only at zero credits', async () => {
    const low = createSupabaseMock();
    expect((await recordCreditEvent(low.supabase, { eventName: 'credits_exhausted', userId: 'user-1', creditsRemaining: 2 })).reason)
      .toBe('not_low_credit');

    const out = createSupabaseMock();
    const result = await recordCreditEvent(out.supabase, { eventName: 'credits_exhausted', userId: 'user-1', creditsRemaining: 0 });
    expect(result.recorded).toBe(true);
    expect(out.calls.insert.mock.calls[0][0]).toMatchObject({ event_name: 'credits_exhausted' });
  });
});
