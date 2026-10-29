import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';

const fetchMock = vi.hoisted(() => vi.fn());
vi.stubGlobal('fetch', fetchMock);

if (typeof globalThis.WebSocket === 'undefined') {
  vi.stubGlobal('WebSocket', class WebSocket {});
}

const generation = require('../netlify-functions/generate-alt-text.js');
const authValidate = require('../netlify-functions/auth-validate.js');
const siteDisconnect = require('../netlify-functions/site-disconnect.js');

const root = resolve(process.cwd());
const API_KEY = 'alt_test_key_with_enough_length_123456';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function routeSupabase(handlers) {
  const calls = [];
  fetchMock.mockImplementation(async (input, init) => {
    const url = String(input?.url || input);
    calls.push({ url: decodeURIComponent(url), init });
    for (const [pattern, handler] of Object.entries(handlers)) {
      if (url.includes(pattern)) return handler(url, init);
    }
    return json([]);
  });
  return calls;
}

let ipCounter = 0;
function pluginEvent(overrides = {}) {
  ipCounter += 1;
  return {
    httpMethod: 'POST',
    path: '/.netlify/functions/generate-alt-text',
    headers: {
      authorization: `Bearer ${API_KEY}`,
      'x-forwarded-for': `203.0.113.${ipCounter}`,
      'x-site-url': 'https://Example.com/',
      'x-plugin-version': '1.7.28',
      'x-wp-locale': 'de_DE',
    },
    body: JSON.stringify({ image_base64: 'iVBORw0KGgo=', language: 'de-DE' }),
    ...overrides,
  };
}

const PROFILE = {
  id: 'user-1',
  email: 'owner@example.com',
  credits_remaining: 0,
  bonus_credits_remaining: 0,
  purchased_credits_remaining: 0,
  subscription_plan: 'free',
  subscription_status: 'active',
  credits_last_renewed_at: '2026-10-01T00:00:00.000Z',
};

describe('generate-alt-text authentication outcomes', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('answers a key lookup outage with a retryable 503, not 401', async () => {
    routeSupabase({ '/rest/v1/api_keys': () => json({ message: 'timeout' }, 500) });

    const response = await generation.handler(pluginEvent());
    expect(response.statusCode).toBe(503);
    expect(response.headers['Retry-After']).toBe('30');
    expect(JSON.parse(response.body)).toMatchObject({ code: 'auth_unavailable', retryable: true });
  });

  it('answers an unknown key with 401', async () => {
    routeSupabase({ '/rest/v1/api_keys': () => json([]) });

    const response = await generation.handler(pluginEvent());
    expect(response.statusCode).toBe(401);
  });

  it('rejects a blocked account with 403 account_suspended', async () => {
    routeSupabase({
      '/rest/v1/api_keys': () => json([{ id: 'key-1', user_id: 'user-1', is_active: true }]),
      '/rest/v1/profiles': () => json([{ ...PROFILE, credits_remaining: 50, blocked_at: '2026-10-28T00:00:00.000Z' }]),
    });

    const response = await generation.handler(pluginEvent());
    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body)).toMatchObject({ error: 'account_suspended' });
  });

  it('records the plugin site and reports no credits with a code the plugin can read', async () => {
    const calls = routeSupabase({
      '/rest/v1/api_keys': () => json([{ id: 'key-1', user_id: 'user-1', is_active: true }]),
      '/rest/v1/profiles': () => json([PROFILE]),
      '/rest/v1/usage_logs': () => json([]),
      '/rest/v1/rpc/touch_plugin_site': () => json(null),
    });

    const response = await generation.handler(pluginEvent());
    expect(response.statusCode).toBe(402);
    expect(JSON.parse(response.body)).toMatchObject({ code: 'no_credits' });

    const touch = calls.find((call) => call.url.includes('/rpc/touch_plugin_site'));
    expect(touch).toBeTruthy();
    expect(JSON.parse(touch.init.body)).toEqual({
      p_user_id: 'user-1',
      p_site_url: 'https://example.com',
      p_plugin_version: '1.7.28',
      p_wp_locale: 'de_DE',
    });
  });

  it('keeps generating when the site write fails', async () => {
    routeSupabase({
      '/rest/v1/api_keys': () => json([{ id: 'key-1', user_id: 'user-2', is_active: true }]),
      '/rest/v1/profiles': () => json([{ ...PROFILE, id: 'user-2' }]),
      '/rest/v1/usage_logs': () => json([]),
      '/rest/v1/rpc/touch_plugin_site': () => json({ message: 'relation "plugin_sites" does not exist' }, 404),
    });

    const response = await generation.handler(pluginEvent());
    // Out of credits, but authentication and the request itself went on.
    expect(response.statusCode).toBe(402);
  });

  it('limits per API key more tightly than per IP', () => {
    expect(generation._private.GENERATION_IP_RATE_LIMIT).toBeGreaterThan(generation._private.GENERATION_CREDENTIAL_RATE_LIMIT);
  });
});

describe('alt text language', () => {
  it('cleans non-English output without English-only heuristics', () => {
    const { finalizeLocalizedAltText, isEnglishLanguage } = generation._private;

    expect(finalizeLocalizedAltText(`"L'homme marche sur la plage."`)).toBe("L'homme marche sur la plage.");
    expect(finalizeLocalizedAltText('**Ein Hund im Park.**\nOption 2: anders')).toBe('Ein Hund im Park.');
    expect(finalizeLocalizedAltText('桌上的咖啡。')).toBe('桌上的咖啡。');
    expect(Array.from(finalizeLocalizedAltText('長'.repeat(200))).length).toBe(125);
    expect(() => finalizeLocalizedAltText('  ')).toThrow();

    expect(isEnglishLanguage({ code: 'en' })).toBe(true);
    expect(isEnglishLanguage({ code: 'en-gb' })).toBe(true);
    expect(isEnglishLanguage({ code: 'de' })).toBe(false);
  });

  it('tells the model which language to write in', () => {
    const source = readFileSync(resolve(root, 'netlify-functions/generate-alt-text.js'), 'utf8');
    expect(source).toContain('normalizeAltTextLanguage(requestBody.language)');
    expect(source).toContain('Write the alt text in ${language.name}');
  });
});

describe('auth-validate and site-disconnect', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('returns 503 from auth-validate when the key cannot be checked', async () => {
    routeSupabase({ '/rest/v1/api_keys': () => json({ message: 'timeout' }, 500) });

    const response = await authValidate.handler(pluginEvent({ body: '{}' }));
    expect(response.statusCode).toBe(503);
  });

  it('marks the calling site disconnected without touching the API key', async () => {
    const calls = routeSupabase({
      '/rest/v1/api_keys': () => json([{ id: 'key-1', user_id: 'user-1', is_active: true }]),
      '/rest/v1/profiles': () => json([{ ...PROFILE, credits_remaining: 5 }]),
      '/rest/v1/usage_logs': () => json([]),
      '/rest/v1/plugin_sites': () => json([{ id: 'site-1' }]),
    });

    const response = await siteDisconnect.handler(pluginEvent({ body: '{}' }));
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ success: true, site_url: 'https://example.com', disconnected: true });

    const writes = calls.filter((call) => call.init && call.init.method && call.init.method !== 'GET');
    expect(writes).toHaveLength(1);
    expect(writes[0].url).toContain('/rest/v1/plugin_sites');
    expect(writes[0].init.method).toBe('PATCH');
  });

  it('requires a site URL to disconnect', async () => {
    routeSupabase({
      '/rest/v1/api_keys': () => json([{ id: 'key-1', user_id: 'user-1', is_active: true }]),
      '/rest/v1/profiles': () => json([{ ...PROFILE, credits_remaining: 5 }]),
      '/rest/v1/usage_logs': () => json([]),
    });

    const event = pluginEvent({ body: '{}' });
    delete event.headers['x-site-url'];
    const response = await siteDisconnect.handler(event);
    expect(response.statusCode).toBe(400);
  });
});
