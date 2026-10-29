import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

const fetchMock = vi.hoisted(() => vi.fn());
vi.stubGlobal('fetch', fetchMock);

if (typeof globalThis.WebSocket === 'undefined') {
  vi.stubGlobal('WebSocket', class WebSocket {});
}

const {
  API_KEY_STATUS,
  getCurrentCycleCreditsUsedResult,
  validateApiKey,
  validateApiKeyResult,
  apiKeyFailureResponse,
} = require('./api-key-validator.js');

const API_KEY = 'alt_test_key_with_enough_length_123456';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const PROFILE = {
  id: 'user-1',
  email: 'owner@example.com',
  credits_remaining: 20,
  bonus_credits_remaining: 0,
  purchased_credits_remaining: 0,
  total_processed: 0,
  subscription_plan: 'free',
  subscription_status: 'active',
  billing_cycle: null,
  monthly_credit_allowance: null,
  credits_last_renewed_at: '2026-10-01T00:00:00.000Z',
  updated_at: '2026-10-01T00:00:00.000Z',
};

// Answer PostgREST requests by table. Each handler gets the URL and the
// number of calls already made to that table.
function routeSupabase(handlers) {
  const counts = {};
  fetchMock.mockImplementation(async (input) => {
    const url = String(input?.url || input);
    for (const [table, handler] of Object.entries(handlers)) {
      if (url.includes(`/rest/v1/${table}`)) {
        counts[table] = (counts[table] || 0) + 1;
        return handler(url, counts[table]);
      }
    }
    return json([]);
  });
}

describe('validateApiKeyResult', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('returns the user for an active key', async () => {
    routeSupabase({
      api_keys: () => json([{ id: 'key-1', user_id: 'user-1', is_active: true, created_at: '2026-10-01' }]),
      profiles: () => json([PROFILE]),
      usage_logs: () => json([]),
    });

    const result = await validateApiKeyResult(API_KEY);
    expect(result.status).toBe(API_KEY_STATUS.VALID);
    expect(result.user).toMatchObject({ id: 'user-1', email: 'owner@example.com', blocked_at: null });
    await expect(validateApiKey(API_KEY)).resolves.toMatchObject({ id: 'user-1' });
  });

  it('reports an unknown key as invalid', async () => {
    routeSupabase({ api_keys: () => json([]) });

    await expect(validateApiKeyResult(API_KEY)).resolves.toEqual({ status: API_KEY_STATUS.INVALID });
    await expect(validateApiKeyResult('not_a_key')).resolves.toEqual({ status: API_KEY_STATUS.INVALID });
  });

  it('reports a database error as unavailable, not invalid', async () => {
    routeSupabase({
      api_keys: () => json({ code: '57014', message: 'canceling statement due to statement timeout' }, 500),
    });

    const result = await validateApiKeyResult(API_KEY);
    expect(result.status).toBe(API_KEY_STATUS.UNAVAILABLE);
    await expect(validateApiKey(API_KEY)).resolves.toBeNull();
  });

  it('reports a profile lookup error as unavailable', async () => {
    routeSupabase({
      api_keys: () => json([{ id: 'key-1', user_id: 'user-1', is_active: true }]),
      profiles: () => json({ code: '08006', message: 'connection failure' }, 500),
    });

    await expect(validateApiKeyResult(API_KEY)).resolves.toMatchObject({ status: API_KEY_STATUS.UNAVAILABLE });
  });

  it('treats a key without a profile as invalid', async () => {
    routeSupabase({
      api_keys: () => json([{ id: 'key-1', user_id: 'user-1', is_active: true }]),
      profiles: () => json([]),
    });

    await expect(validateApiKeyResult(API_KEY)).resolves.toEqual({ status: API_KEY_STATUS.INVALID });
  });

  it('flags a blocked account as suspended', async () => {
    routeSupabase({
      api_keys: () => json([{ id: 'key-1', user_id: 'user-1', is_active: true }]),
      profiles: () => json([{ ...PROFILE, blocked_at: '2026-10-28T00:00:00.000Z', blocked_reason: 'abuse' }]),
      usage_logs: () => json([]),
    });

    const result = await validateApiKeyResult(API_KEY);
    expect(result.status).toBe(API_KEY_STATUS.SUSPENDED);
    expect(result.user.blocked_at).toBe('2026-10-28T00:00:00.000Z');
    await expect(validateApiKey(API_KEY)).resolves.toBeNull();
  });

  it('still validates before the block columns exist', async () => {
    const profileUrls = [];
    routeSupabase({
      api_keys: () => json([{ id: 'key-1', user_id: 'user-1', is_active: true }]),
      profiles: (url, call) => {
        profileUrls.push(decodeURIComponent(url));
        return call === 1
          ? json({ code: '42703', message: 'column profiles.blocked_at does not exist' }, 400)
          : json([PROFILE]);
      },
      usage_logs: () => json([]),
    });

    const result = await validateApiKeyResult(API_KEY);
    expect(result.status).toBe(API_KEY_STATUS.VALID);
    expect(profileUrls[0]).toContain('blocked_at');
    expect(profileUrls[1]).not.toContain('blocked_at');
  });
});

describe('apiKeyFailureResponse', () => {
  it('maps lookup outcomes to 401, 403 and a retryable 503', () => {
    const invalid = apiKeyFailureResponse({}, { status: API_KEY_STATUS.INVALID });
    expect(invalid.statusCode).toBe(401);
    expect(JSON.parse(invalid.body)).toMatchObject({ code: 'invalid_api_key' });

    const suspended = apiKeyFailureResponse({}, { status: API_KEY_STATUS.SUSPENDED });
    expect(suspended.statusCode).toBe(403);
    expect(JSON.parse(suspended.body)).toMatchObject({ error: 'account_suspended' });
    expect(JSON.parse(suspended.body).message).toMatch(/suspended/);

    const unavailable = apiKeyFailureResponse({ 'X-Test': '1' }, { status: API_KEY_STATUS.UNAVAILABLE });
    expect(unavailable.statusCode).toBe(503);
    expect(unavailable.headers).toMatchObject({ 'X-Test': '1', 'Retry-After': '30' });
    expect(JSON.parse(unavailable.body)).toMatchObject({ code: 'auth_unavailable', retryable: true, retry_after_seconds: 30 });
  });
});

describe('current-cycle plan usage', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('counts only plan-paid rows toward the allowance and every row as processed', async () => {
    routeSupabase({
      usage_logs: () => json([
        { credits_used: 1, credit_source: 'plan', id: 1 },
        { credits_used: 1, credit_source: null, id: 2 },
        { credits_used: 1, credit_source: 'bonus', id: 3 },
        { credits_used: 1, credit_source: 'purchased', id: 4 },
      ]),
    });

    await expect(getCurrentCycleCreditsUsedResult('user-1', '2026-10-01T00:00:00.000Z')).resolves.toEqual({
      success: true,
      creditsUsed: 2,
      imagesProcessed: 4,
    });
  });

  it('falls back to counting every row before credit_source exists', async () => {
    const urls = [];
    routeSupabase({
      usage_logs: (url, call) => {
        urls.push(decodeURIComponent(url));
        return call === 1
          ? json({ code: '42703', message: 'column usage_logs.credit_source does not exist' }, 400)
          : json([{ credits_used: 1, id: 1 }, { credits_used: 2, id: 2 }]);
      },
    });

    await expect(getCurrentCycleCreditsUsedResult('user-1', '2026-10-01T00:00:00.000Z')).resolves.toEqual({
      success: true,
      creditsUsed: 3,
      imagesProcessed: 3,
    });
    expect(urls[0]).toContain('credit_source');
    expect(urls[1]).not.toContain('credit_source');
  });

  it('keeps a past_due account usable', async () => {
    routeSupabase({
      api_keys: () => json([{ id: 'key-1', user_id: 'user-1', is_active: true }]),
      profiles: () => json([{ ...PROFILE, subscription_plan: 'tier1', subscription_status: 'past_due' }]),
      usage_logs: () => json([]),
    });

    const result = await validateApiKeyResult(API_KEY);
    expect(result.status).toBe(API_KEY_STATUS.VALID);
    expect(result.user.subscription_status).toBe('past_due');
  });
});
