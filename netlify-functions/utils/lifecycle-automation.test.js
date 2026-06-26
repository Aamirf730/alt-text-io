import { describe, expect, it } from 'vitest';

const { buildLifecycleCandidates } = require('./lifecycle-automation.js');

describe('lifecycle automation candidate selection', () => {
  it('selects signup users who have not connected after the delay', () => {
    const candidates = buildLifecycleCandidates([
      {
        id: 'signup-1',
        event_name: 'signup_created',
        user_id: 'user-1',
        user_email: 'lead@example.com',
        anonymous_id: 'anon-1',
        source: 'landing_page',
        occurred_at: '2026-06-25T00:00:00.000Z',
      },
    ], {
      now: '2026-06-25T05:00:00.000Z',
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      automation_key: 'signup_no_connect',
      actor_key: 'user:user-1',
      user_email: 'lead@example.com',
    });
  });

  it('does not select a signup if the user connected after signup', () => {
    const candidates = buildLifecycleCandidates([
      {
        id: 'signup-1',
        event_name: 'signup_created',
        user_id: 'user-1',
        user_email: 'lead@example.com',
        anonymous_id: 'anon-1',
        source: 'landing_page',
        occurred_at: '2026-06-25T00:00:00.000Z',
      },
      {
        id: 'connect-1',
        event_name: 'connect_completed',
        user_id: 'user-1',
        user_email: 'lead@example.com',
        anonymous_id: 'anon-1',
        source: 'wordpress_connect',
        occurred_at: '2026-06-25T01:00:00.000Z',
      },
    ], {
      now: '2026-06-25T08:00:00.000Z',
    });

    expect(candidates.some(candidate => candidate.automation_key === 'signup_no_connect')).toBe(false);
  });

  it('selects abandoned checkout only after the delay and before purchase', () => {
    const earlyCandidates = buildLifecycleCandidates([
      {
        id: 'checkout-1',
        event_name: 'checkout_started',
        user_id: 'user-2',
        user_email: 'buyer@example.com',
        source: 'dashboard',
        occurred_at: '2026-06-25T00:00:00.000Z',
      },
    ], {
      now: '2026-06-25T00:30:00.000Z',
    });

    expect(earlyCandidates.some(candidate => candidate.automation_key === 'checkout_no_purchase')).toBe(false);

    const matureCandidates = buildLifecycleCandidates([
      {
        id: 'checkout-1',
        event_name: 'checkout_started',
        user_id: 'user-2',
        user_email: 'buyer@example.com',
        source: 'dashboard',
        occurred_at: '2026-06-25T00:00:00.000Z',
      },
    ], {
      now: '2026-06-25T02:00:00.000Z',
    });

    expect(matureCandidates.some(candidate => candidate.automation_key === 'checkout_no_purchase')).toBe(true);

    const purchasedCandidates = buildLifecycleCandidates([
      {
        id: 'checkout-1',
        event_name: 'checkout_started',
        user_id: 'user-2',
        user_email: 'buyer@example.com',
        source: 'dashboard',
        occurred_at: '2026-06-25T00:00:00.000Z',
      },
      {
        id: 'purchase-1',
        event_name: 'purchase_completed',
        user_id: 'user-2',
        user_email: 'buyer@example.com',
        source: 'polar_webhook',
        occurred_at: '2026-06-25T00:20:00.000Z',
      },
    ], {
      now: '2026-06-25T02:00:00.000Z',
    });

    expect(purchasedCandidates.some(candidate => candidate.automation_key === 'checkout_no_purchase')).toBe(false);
    expect(purchasedCandidates.some(candidate => candidate.automation_key === 'purchase_onboarding')).toBe(true);
  });

  it('stitches anonymous and authenticated events before evaluating missing steps', () => {
    const candidates = buildLifecycleCandidates([
      {
        id: 'signup-1',
        event_name: 'signup_created',
        user_email: 'lead@example.com',
        anonymous_id: 'anon-stitched',
        source: 'landing_page',
        occurred_at: '2026-06-25T00:00:00.000Z',
      },
      {
        id: 'connect-1',
        event_name: 'connect_completed',
        user_id: 'user-stitched',
        user_email: 'lead@example.com',
        anonymous_id: 'anon-stitched',
        source: 'wordpress_connect',
        occurred_at: '2026-06-25T02:00:00.000Z',
      },
    ], {
      now: '2026-06-25T09:00:00.000Z',
    });

    expect(candidates.some(candidate => candidate.automation_key === 'signup_no_connect')).toBe(false);
    expect(candidates.some(candidate => candidate.automation_key === 'connect_no_first_image')).toBe(true);
  });
});
