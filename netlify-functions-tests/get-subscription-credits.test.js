import { describe, expect, it } from 'vitest';

const { _private } = require('../netlify-functions/get-subscription.js');

function fakeUsageClient(rows, { failOnCreditSource = false } = {}) {
  const queries = [];
  const from = () => {
    const query = { filters: [] };
    queries.push(query);
    const builder = {
      select: (columns) => {
        query.columns = columns;
        return builder;
      },
      eq: (column, value) => {
        query.filters.push(['eq', column, value]);
        return builder;
      },
      gte: (column, value) => {
        query.filters.push(['gte', column, value]);
        return builder;
      },
      order: () => builder,
      range: async (fromRow, toRow) => {
        if (failOnCreditSource && query.columns.includes('credit_source')) {
          return { data: null, error: { message: 'column usage_logs.credit_source does not exist' } };
        }
        return { data: rows.slice(fromRow, toRow + 1), error: null };
      },
    };
    return builder;
  };
  return { client: { from }, queries };
}

describe('get-subscription credits', () => {
  it('counts only plan-source usage (NULL counts as plan) against the allowance', async () => {
    const { client, queries } = fakeUsageClient([
      { credits_used: 1, credit_source: 'plan' },
      { credits_used: 1, credit_source: null },
      { credits_used: 1, credit_source: 'bonus' },
      { credits_used: 1, credit_source: 'purchased' },
    ]);
    const cycleStart = new Date('2026-10-01T00:00:00.000Z');

    await expect(_private.loadCyclePlanCreditsUsed(client, 'user-1', cycleStart)).resolves.toBe(2);
    expect(queries[0].filters).toEqual([
      ['eq', 'user_id', 'user-1'],
      ['gte', 'created_at', '2026-10-01T00:00:00.000Z'],
    ]);
  });

  it('falls back to counting every row before credit_source is deployed', async () => {
    const { client } = fakeUsageClient(
      [{ credits_used: 1 }, { credits_used: 1 }, { credits_used: 1 }],
      { failOnCreditSource: true },
    );

    await expect(
      _private.loadCyclePlanCreditsUsed(client, 'user-1', new Date('2026-10-01T00:00:00.000Z')),
    ).resolves.toBe(3);
  });

  it('reports plan, bonus and purchased credits the way get-usage does', () => {
    const credits = _private.buildSubscriptionCredits({
      subscription_plan: 'tier2',
      monthly_credit_allowance: 1500,
      credits_remaining: 1000 + 40 + 700,
      bonus_credits_remaining: 40,
      purchased_credits_remaining: 700,
    }, 1500, 500);

    expect(credits).toMatchObject({
      credits_remaining: 1740,
      monthly_credits_remaining: 1740,
      monthly_credit_limit: 1500,
      monthly_credits_used: 500,
      plan_credits_remaining: 1000,
      bonus_credits_remaining: 40,
      purchased_credits_remaining: 700,
      is_monthly_limited: true,
    });
  });

  it('includes the signup bonus for a Free account', () => {
    const credits = _private.buildSubscriptionCredits({
      subscription_plan: 'free',
      credits_remaining: 160,
      bonus_credits_remaining: 150,
      purchased_credits_remaining: 0,
    }, 15, 5);

    expect(credits.credits_remaining).toBe(160);
    expect(credits.plan_credits_remaining).toBe(10);
  });

  it('starts the cycle at the last renewal, or the first of the month', () => {
    expect(_private.getCycleStart({ credits_last_renewed_at: '2026-10-12T08:00:00.000Z' }).toISOString())
      .toBe('2026-10-12T08:00:00.000Z');
    expect(_private.getCycleStart({}, new Date('2026-10-29T12:00:00.000Z')).toISOString())
      .toBe('2026-10-01T00:00:00.000Z');
  });
});
