import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';

const fetchMock = vi.hoisted(() => vi.fn());
vi.stubGlobal('fetch', fetchMock);

if (typeof globalThis.WebSocket === 'undefined') {
  vi.stubGlobal('WebSocket', class WebSocket {});
}

const { handler } = require('../netlify-functions/auth-validate.js');

const API_KEY = 'alt_test_key_with_enough_length_123456';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// A Starter subscriber (500 plan credits a month) with 200 pack credits left.
// This cycle they used 100 plan credits and 400 bonus credits, so
// total_processed is 500 but only 100 of the allowance is gone.
const PROFILE = {
  id: 'user-1',
  email: 'owner@example.com',
  credits_remaining: 600,
  bonus_credits_remaining: 0,
  purchased_credits_remaining: 200,
  total_processed: 500,
  subscription_plan: 'tier1',
  subscription_status: 'active',
  billing_cycle: 'monthly',
  monthly_credit_allowance: 500,
  credits_last_renewed_at: '2026-11-01T00:00:00.000Z',
  updated_at: '2026-11-01T00:00:00.000Z',
};

const CYCLE_USAGE = [
  ...Array.from({ length: 100 }, (_, i) => ({ id: i + 1, credits_used: 1, credit_source: 'plan', created_at: '2026-11-02T00:00:00.000Z' })),
  ...Array.from({ length: 400 }, (_, i) => ({ id: i + 101, credits_used: 1, credit_source: 'bonus', created_at: '2026-11-03T00:00:00.000Z' })),
];

function routeSupabase({ usageLogs }) {
  fetchMock.mockImplementation(async (input) => {
    const url = String(input?.url || input);
    if (url.includes('/rest/v1/api_keys')) {
      return json([{ id: 'key-1', user_id: 'user-1', is_active: true, created_at: '2026-10-01' }]);
    }
    if (url.includes('/rest/v1/profiles')) {
      // validateApiKeyResult selects a list; auth-validate uses .single().
      return url.includes('select=*') ? json(PROFILE) : json([PROFILE]);
    }
    if (url.includes('/rest/v1/usage_logs')) {
      return usageLogs();
    }
    if (url.includes('/rest/v1/subscription_plans')) {
      return json({ id: 'tier1', credits: 500 });
    }
    return json([]);
  });
}

async function validate() {
  const response = await handler({
    httpMethod: 'POST',
    headers: { authorization: `Bearer ${API_KEY}`, 'x-forwarded-for': '203.0.113.7' },
    body: '{}',
  });
  return { statusCode: response.statusCode, body: JSON.parse(response.body) };
}

describe('auth-validate credit balance', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('counts only plan-paid generations against the monthly allowance', async () => {
    routeSupabase({ usageLogs: () => json(CYCLE_USAGE) });

    const { statusCode, body } = await validate();

    expect(statusCode).toBe(200);
    // 500 - 100 plan credits used, plus 200 pack credits.
    expect(body.data.credits_remaining).toBe(600);
    expect(body.data.monthly_credits_remaining).toBe(600);
    expect(body.data.user.credits_remaining).toBe(600);
  });

  it('still answers from the stored count when cycle usage cannot be read', async () => {
    routeSupabase({
      usageLogs: () => json({ code: '08006', message: 'connection failure' }, 500),
    });

    const { statusCode, body } = await validate();

    expect(statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.credits_remaining).toBe(200);
  });
});
