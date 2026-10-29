import { describe, expect, it } from 'vitest';

const { _private } = require('../netlify-functions/admin-get-users.js');

describe('admin revenue and subscriber metrics', () => {
  it('reports completed payments net of tax', () => {
    expect(_private.getNetPaymentRevenue({ status: 'completed', amount: '14.52', tax_amount: '2.52' })).toBe(12);
  });

  it('keeps the unrefunded part of a partial refund', () => {
    expect(_private.getNetPaymentRevenue({
      status: 'partially_refunded',
      amount: 99,
      tax_amount: 0,
      refunded_amount: 5,
      refunded_tax_amount: 0,
    })).toBe(94);
  });

  it('treats the stored refund as pre-tax (refund tax is stored apart)', () => {
    // $14.52 order with $2.52 tax; a $6.00 pre-tax refund plus $1.26 tax.
    expect(_private.getNetPaymentRevenue({
      status: 'partially_refunded',
      amount: 14.52,
      tax_amount: 2.52,
      refunded_amount: 6,
      refunded_tax_amount: 1.26,
    })).toBe(6);
    // Full refund: the whole pre-tax net was refunded.
    expect(_private.getNetPaymentRevenue({
      status: 'refunded',
      amount: 14.52,
      tax_amount: 2.52,
      refunded_amount: 12,
      refunded_tax_amount: 2.52,
    })).toBe(0);
  });

  it('counts a full refund as zero, including older rows without a refund amount', () => {
    expect(_private.getNetPaymentRevenue({ status: 'refunded', amount: 9 })).toBe(0);
    expect(_private.getNetPaymentRevenue({ status: 'refunded', amount: 9, refunded_amount: 9, refunded_tax_amount: 0 })).toBe(0);
  });

  it('ignores pending and failed payments', () => {
    expect(_private.getNetPaymentRevenue({ status: 'pending', amount: 9 })).toBe(0);
    expect(_private.getNetPaymentRevenue({ status: 'failed', amount: 9 })).toBe(0);
  });

  it('counts only running paid subscriptions as paying subscribers', () => {
    expect(_private.isPayingSubscriber({ subscription_plan: 'tier2', subscription_status: 'active' })).toBe(true);
    expect(_private.isPayingSubscriber({ subscription_plan: 'tier1', subscription_status: 'cancelled' })).toBe(true);
    expect(_private.isPayingSubscriber({ subscription_plan: 'tier2', subscription_status: 'past_due' })).toBe(true);
    expect(_private.isPayingSubscriber({ subscription_plan: 'free', subscription_status: 'active' })).toBe(false);
    expect(_private.isPayingSubscriber({ subscription_plan: 'tier4', subscription_status: 'revoked' })).toBe(false);
  });
});
