import { describe, expect, it } from 'vitest';

const { getMonthlyCreditState } = require('./api-key-validator.js');

describe('monthly credit state with promotional credits', () => {
  it('adds persistent bonus credits after the free monthly allowance', () => {
    expect(getMonthlyCreditState({
      subscription_plan: 'free',
      credits_remaining: 1010,
      bonus_credits_remaining: 1000,
      total_processed: 20,
    })).toEqual({
      monthly_credit_limit: 30,
      monthly_credits_used: 20,
      monthly_credits_remaining: 1010,
      bonus_credits_remaining: 1000,
      purchased_credits_remaining: 0,
      is_monthly_limited: true,
    });
  });

  it('keeps the unused bonus available after the plan allowance is exhausted', () => {
    expect(getMonthlyCreditState({
      subscription_plan: 'free',
      credits_remaining: 925,
      bonus_credits_remaining: 925,
      total_processed: 105,
    })).toEqual({
      monthly_credit_limit: 30,
      monthly_credits_used: 105,
      monthly_credits_remaining: 925,
      bonus_credits_remaining: 925,
      purchased_credits_remaining: 0,
      is_monthly_limited: true,
    });
  });

  it('does not change normal free-plan behavior without a bonus', () => {
    expect(getMonthlyCreditState({
      subscription_plan: 'free',
      credits_remaining: 12,
      total_processed: 18,
    }).monthly_credits_remaining).toBe(12);
  });

  it('keeps purchased packs usable after the monthly allowance is exhausted', () => {
    expect(getMonthlyCreditState({
      subscription_plan: 'free',
      credits_remaining: 250,
      purchased_credits_remaining: 250,
      total_processed: 30,
    })).toMatchObject({
      monthly_credits_remaining: 250,
      bonus_credits_remaining: 0,
      purchased_credits_remaining: 250,
    });
  });

  it('reports only the spendable current-cycle balance when a paid aggregate contains future allowance', () => {
    expect(getMonthlyCreditState({
      subscription_plan: 'tier2',
      monthly_credit_allowance: 400,
      credits_remaining: 4760,
      total_processed: 40,
    })).toMatchObject({
      monthly_credit_limit: 400,
      monthly_credits_used: 40,
      monthly_credits_remaining: 360,
    });
  });
});
