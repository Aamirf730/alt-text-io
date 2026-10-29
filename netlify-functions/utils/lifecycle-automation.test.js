import { describe, expect, it, vi } from 'vitest';

const {
  buildLifecycleCandidates,
  fetchAuthUsers,
  fetchLifecycleUsageCounts,
  filterCandidatesByAuthUsers,
  selectLifecycleCandidatePerActor,
  renderLifecycleEmail,
} = require('./lifecycle-automation.js');

describe('lifecycle automation candidate selection', () => {
  it('includes a signed unsubscribe link when lifecycle secrets are configured', () => {
    const previousSecret = process.env.LIFECYCLE_AUTOMATION_SECRET;
    process.env.LIFECYCLE_AUTOMATION_SECRET = 'test-secret';

    const message = renderLifecycleEmail({
      user_id: 'user-1',
      user_email: 'lead@example.com',
      subject: 'A subject',
      preview: 'A preview',
      cta_text: 'Open dashboard',
      cta_url: 'https://www.alt-text.pro/dashboard',
    });

    expect(message.html).toContain('Unsubscribe');
    expect(message.text).toContain('Unsubscribe: https://www.alt-text.pro/.netlify/functions/unsubscribe-lifecycle?token=');

    if (previousSecret === undefined) delete process.env.LIFECYCLE_AUTOMATION_SECRET;
    else process.env.LIFECYCLE_AUTOMATION_SECRET = previousSecret;
  });
  it('selects signup users who have not connected after the delay', () => {
    const candidates = buildLifecycleCandidates([
      {
        id: 'signup-1',
        event_name: 'signup_created',
        user_id: 'user-1',
        user_email: 'lead@example.com',
        anonymous_id: 'anon-1',
        source: 'landing_page',
        properties: { identity_verified: true },
        occurred_at: '2026-06-25T00:00:00.000Z',
      },
    ], {
      now: '2026-06-25T05:00:00.000Z',
    });

    expect(candidates.map(candidate => candidate.automation_key).sort()).toEqual(['signup_no_connect', 'signup_welcome']);
    expect(candidates.find(candidate => candidate.automation_key === 'signup_no_connect')).toMatchObject({
      actor_key: 'user:user-1',
      user_email: 'lead@example.com',
    });
  });

  const signupEvent = (occurredAt, extra = {}) => ({
    id: 'signup-1',
    event_name: 'signup_created',
    user_id: 'user-1',
    user_email: 'lead@example.com',
    source: 'landing_page',
    properties: { identity_verified: true },
    occurred_at: occurredAt,
    ...extra,
  });

  it('welcomes a new sign-up straight away with the setup steps', () => {
    const candidates = buildLifecycleCandidates([signupEvent('2026-06-25T00:00:00.000Z')], {
      now: '2026-06-25T00:30:00.000Z',
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      automation_key: 'signup_welcome',
      cta_url: 'https://wordpress.org/plugins/alt-text-pro/',
    });
    expect(candidates[0].body_lines).toHaveLength(3);

    const message = renderLifecycleEmail(candidates[0], { unsubscribeUrl: null });
    expect(message.html).toContain('<ol');
    expect(message.text).toContain('1. Install Alt Text Pro from WordPress.org');
  });

  it('does not send a late welcome to sign-ups older than two days', () => {
    const candidates = buildLifecycleCandidates([signupEvent('2026-06-20T00:00:00.000Z')], {
      now: '2026-06-25T00:00:00.000Z',
    });

    expect(candidates.map(candidate => candidate.automation_key)).toEqual(['signup_no_connect']);
  });

  it('skips setup steps in the welcome when the sign-up came from the plugin and is connected', () => {
    const candidates = buildLifecycleCandidates([
      signupEvent('2026-06-25T00:00:00.000Z'),
      {
        id: 'connect-1',
        event_name: 'connect_completed',
        user_id: 'user-1',
        user_email: 'lead@example.com',
        source: 'wordpress_plugin_auth',
        properties: {},
        occurred_at: '2026-06-25T00:01:00.000Z',
      },
    ], { now: '2026-06-25T00:30:00.000Z' });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      automation_key: 'signup_welcome',
      cta_url: 'https://www.alt-text.pro/dashboard',
    });
    expect(candidates[0].body_lines.join(' ')).not.toContain('Install');
  });

  it('does not welcome someone who already bought, since the purchase email covers it', () => {
    const candidates = buildLifecycleCandidates([
      signupEvent('2026-06-25T00:00:00.000Z'),
      {
        id: 'purchase-1',
        event_name: 'purchase_completed',
        user_id: 'user-1',
        user_email: 'lead@example.com',
        source: 'polar_webhook',
        properties: {},
        occurred_at: '2026-06-25T00:05:00.000Z',
      },
    ], { now: '2026-06-25T00:30:00.000Z' });

    expect(candidates.map(candidate => candidate.automation_key)).toEqual(['purchase_onboarding']);
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
        properties: { identity_verified: true },
        occurred_at: '2026-06-25T00:00:00.000Z',
      },
      {
        id: 'connect-1',
        event_name: 'connect_completed',
        user_id: 'user-1',
        user_email: 'lead@example.com',
        anonymous_id: 'anon-1',
        source: 'wordpress_connect',
        properties: { identity_verified: true },
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
        properties: { identity_verified: true },
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
        properties: { identity_verified: true },
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
        properties: { identity_verified: true },
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
        user_id: 'user-stitched',
        user_email: 'lead@example.com',
        anonymous_id: 'anon-stitched',
        source: 'landing_page',
        properties: { identity_verified: true },
        occurred_at: '2026-06-25T00:00:00.000Z',
      },
      {
        id: 'connect-1',
        event_name: 'connect_completed',
        user_id: 'user-stitched',
        user_email: 'lead@example.com',
        anonymous_id: 'anon-stitched',
        source: 'wordpress_connect',
        properties: { identity_verified: true },
        occurred_at: '2026-06-25T02:00:00.000Z',
      },
    ], {
      now: '2026-06-25T09:00:00.000Z',
    });

    expect(candidates.some(candidate => candidate.automation_key === 'signup_no_connect')).toBe(false);
    expect(candidates.some(candidate => candidate.automation_key === 'connect_no_first_image')).toBe(true);
  });

  it('does not remind a connected WordPress user who already has plugin usage', () => {
    const candidates = buildLifecycleCandidates([
      {
        id: 'connect-used',
        event_name: 'connect_completed',
        user_id: 'user-used',
        user_email: 'used@example.com',
        source: 'wordpress_plugin_auth',
        occurred_at: '2026-06-25T00:00:00.000Z',
      },
    ], {
      now: '2026-06-25T08:00:00.000Z',
      usageCountsByUserId: new Map([['user-used', 3]]),
    });

    expect(candidates.some(candidate => candidate.automation_key === 'connect_no_first_image')).toBe(false);
  });

  it('keeps only the highest-priority lifecycle message for each account', () => {
    const selected = selectLifecycleCandidatePerActor([
      {
        automation_key: 'connect_no_first_image',
        actor_key: 'user:user-overlap',
        trigger_occurred_at: '2026-06-25T00:00:00.000Z',
      },
      {
        automation_key: 'credits_low_no_purchase',
        actor_key: 'user:user-overlap',
        trigger_occurred_at: '2026-06-25T02:00:00.000Z',
      },
      {
        automation_key: 'signup_no_connect',
        actor_key: 'user:user-other',
        trigger_occurred_at: '2026-06-25T01:00:00.000Z',
      },
    ]);

    expect(selected).toHaveLength(2);
    expect(selected.find(candidate => candidate.actor_key === 'user:user-overlap')?.automation_key)
      .toBe('credits_low_no_purchase');
  });

  it('prioritizes purchase onboarding over earlier setup reminders', () => {
    const selected = selectLifecycleCandidatePerActor([
      {
        automation_key: 'connect_no_first_image',
        actor_key: 'user:buyer',
        trigger_occurred_at: '2026-06-25T00:00:00.000Z',
      },
      {
        automation_key: 'purchase_onboarding',
        actor_key: 'user:buyer',
        trigger_occurred_at: '2026-06-25T03:00:00.000Z',
      },
    ]);

    expect(selected).toHaveLength(1);
    expect(selected[0].automation_key).toBe('purchase_onboarding');
  });

  it('does not create lifecycle candidates from unverified public trigger events', () => {
    const candidates = buildLifecycleCandidates([
      {
        id: 'forged-signup',
        event_name: 'signup_created',
        user_id: 'victim-user',
        user_email: 'victim@example.com',
        source: 'landing_page',
        occurred_at: '2026-06-25T00:00:00.000Z',
      },
      {
        id: 'forged-purchase',
        event_name: 'purchase_completed',
        user_id: 'victim-user',
        user_email: 'victim@example.com',
        source: 'web_app',
        properties: { identity_verified: true },
        occurred_at: '2026-06-25T00:00:00.000Z',
      },
    ], {
      now: '2026-06-25T05:00:00.000Z',
    });

    expect(candidates).toHaveLength(0);
  });

  it('accepts purchase onboarding only from the authoritative Polar webhook source', () => {
    const candidates = buildLifecycleCandidates([
      {
        id: 'purchase-verified',
        event_name: 'purchase_completed',
        user_id: 'buyer-user',
        user_email: 'buyer@example.com',
        source: 'polar_webhook',
        occurred_at: '2026-06-25T00:00:00.000Z',
      },
    ], {
      now: '2026-06-25T00:01:00.000Z',
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0].automation_key).toBe('purchase_onboarding');
  });

  it('keeps only recipients whose user ID and email match Supabase Auth', () => {
    const candidates = [
      { user_id: 'user-1', user_email: 'Owner@Example.com' },
      { user_id: 'user-2', user_email: 'wrong@example.com' },
      { user_id: null, user_email: 'owner@example.com' },
      { user_id: 'user-4', user_email: 'unconfirmed@example.com' },
    ];

    const verified = filterCandidatesByAuthUsers(candidates, [
      { id: 'user-1', email: 'owner@example.com', email_confirmed_at: '2026-08-05T12:00:00.000Z' },
      { id: 'user-2', email: 'actual@example.com', email_confirmed_at: '2026-08-05T12:00:00.000Z' },
      { id: 'user-4', email: 'unconfirmed@example.com', email_confirmed_at: null },
    ]);

    expect(verified).toEqual([candidates[0]]);
  });

  it('loads the complete paginated Auth user directory before filtering recipients', async () => {
    const listUsers = vi.fn(async ({ page }) => ({
      data: {
        users: page === 1
          ? [
            { id: 'user-1', email: 'one@example.com', email_confirmed_at: '2026-08-05T12:00:00.000Z' },
            { id: 'user-2', email: 'two@example.com', email_confirmed_at: '2026-08-05T12:00:00.000Z' },
          ]
          : [{ id: 'user-3', email: 'three@example.com', email_confirmed_at: '2026-08-05T12:00:00.000Z' }],
      },
      error: null,
    }));

    const users = await fetchAuthUsers({ auth: { admin: { listUsers } } }, {
      perPage: 2,
      maxPages: 3,
    });

    expect(users).toHaveLength(3);
    expect(listUsers).toHaveBeenNthCalledWith(1, { page: 1, perPage: 2 });
    expect(listUsers).toHaveBeenNthCalledWith(2, { page: 2, perPage: 2 });
  });

  it('fails closed when the Auth user directory cannot be loaded', async () => {
    const listUsers = vi.fn(async () => ({
      data: null,
      error: { message: 'Auth service unavailable' },
    }));

    await expect(fetchAuthUsers({ auth: { admin: { listUsers } } }))
      .rejects.toThrow('Failed to verify lifecycle recipients');
  });

  it('accepts an exact full-page boundary when the following page is empty', async () => {
    const listUsers = vi.fn(async ({ page }) => ({
      data: {
        users: page === 1
          ? [
            { id: 'user-1', email: 'one@example.com', email_confirmed_at: '2026-08-05T12:00:00.000Z' },
            { id: 'user-2', email: 'two@example.com', email_confirmed_at: '2026-08-05T12:00:00.000Z' },
          ]
          : [],
      },
      error: null,
    }));

    const users = await fetchAuthUsers({ auth: { admin: { listUsers } } }, {
      perPage: 2,
      maxPages: 1,
    });

    expect(users).toHaveLength(2);
    expect(listUsers).toHaveBeenNthCalledWith(2, { page: 2, perPage: 2 });
  });

  it('loads lifecycle usage counts across pages', async () => {
    const range = vi.fn(async (from, to) => ({
      data: from === 0
        ? [{ user_id: 'user-1', total_usage_count: 4 }]
        : [],
      error: null,
    }));
    const order = vi.fn(() => ({ range }));
    const usageCounts = await fetchLifecycleUsageCounts({
      from: () => ({
        select: () => ({ order }),
      }),
    });

    expect(usageCounts).toEqual(new Map([['user-1', 4]]));
    expect(order).toHaveBeenCalledWith('user_id', { ascending: true });
    expect(range).toHaveBeenCalledWith(0, 999);
  });
});
