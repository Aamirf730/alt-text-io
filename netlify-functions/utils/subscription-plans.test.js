import { describe, expect, it } from 'vitest';

const { getPlanDisplayName } = require('./subscription-plans');

describe('getPlanDisplayName', () => {
  it.each([
    ['tier1', 500, 'Starter'],
    ['tier2', 1500, 'Growth'],
    ['tier4', 5000, 'Agency'],
    ['tier2', null, 'Growth'],
  ])('names a current %s subscriber by the current plan', (planId, allowance, expected) => {
    expect(getPlanDisplayName(planId, allowance)).toBe(expected);
  });

  it.each([
    ['tier1', 150, 'Lite'],
    ['tier2', 1000, 'Standard'],
    ['tier4', 3500, 'Agency'],
    ['tier3', 2000, 'Pro'],
    ['standard', null, 'Standard'],
  ])('keeps the original name for a legacy %s subscriber on %s credits', (planId, allowance, expected) => {
    expect(getPlanDisplayName(planId, allowance)).toBe(expected);
  });

  it('labels free and one-time plans', () => {
    expect(getPlanDisplayName('free')).toBe('Free');
    expect(getPlanDisplayName(undefined)).toBe('Free');
    expect(getPlanDisplayName('bulk_pack')).toBe('Credit Pack');
  });
});
