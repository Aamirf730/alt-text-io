import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
}));

vi.mock('@/lib/utils', () => ({
  getApiBase: () => 'https://api.example.test',
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
    },
  },
}));

import { sanitizeAnalyticsReferrer, sanitizeAnalyticsSearch, trackMarketingEvent } from './analytics';

describe('trackMarketingEvent authentication', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.getSession.mockReset();
    mocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })));
  });

  it('forwards the session token but never sends caller-provided identity', async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: { access_token: 'verified-session-token' },
      },
    });

    trackMarketingEvent('signup_created', {
      source: 'landing_page',
      userId: 'caller-user-id',
      userEmail: 'caller@example.com',
      properties: { signup_method: 'email' },
    });

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect(options?.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer verified-session-token',
    });

    const payload = JSON.parse(String(options?.body));
    expect(payload.user_id).toBeUndefined();
    expect(payload.user_email).toBeUndefined();
    expect(payload).toMatchObject({
      event_name: 'signup_created',
      source: 'landing_page',
    });

    vi.mocked(fetch).mockClear();
    mocks.getSession.mockClear();

    trackMarketingEvent('checkout_started', {
      source: 'dashboard',
    });

    // Once cached, the keepalive request starts in the same task without a
    // second asynchronous session lookup that could lose a redirect race.
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(mocks.getSession).not.toHaveBeenCalled();
  });
});

describe('analytics URL sanitising', () => {
  it('never records the query string on auth, reset, connect or confirmation pages', () => {
    expect(sanitizeAnalyticsSearch('/auth/confirm', '?token_hash=abc&type=email&next=/connect')).toBeUndefined();
    expect(sanitizeAnalyticsSearch('/reset-password', '?code=abc')).toBeUndefined();
    expect(sanitizeAnalyticsSearch('/connect', '?callback_url=https://site.test&state=xyz')).toBeUndefined();
    expect(sanitizeAnalyticsSearch('/email-confirmed', '?utm_source=mail')).toBeUndefined();
  });

  it('strips token-like parameters on every other page and keeps campaign tags', () => {
    expect(
      sanitizeAnalyticsSearch('/', '?utm_source=news&access_token=a&refresh_token=b&code=c&customer_session_token=d&api_key=e'),
    ).toBe('?utm_source=news');
    expect(sanitizeAnalyticsSearch('/payment-success', '?checkout_id=1&customer_session_token=x')).toBe('?checkout_id=1');
    expect(sanitizeAnalyticsSearch('/', '?token=abc')).toBeUndefined();
    expect(sanitizeAnalyticsSearch('/', '')).toBeUndefined();
  });

  it('keeps only the origin and path of the referrer', () => {
    expect(sanitizeAnalyticsReferrer('https://www.alt-text.pro/auth/confirm?token_hash=abc#access_token=x'))
      .toBe('https://www.alt-text.pro/auth/confirm');
    expect(sanitizeAnalyticsReferrer('')).toBeUndefined();
    expect(sanitizeAnalyticsReferrer('not a url')).toBeUndefined();
  });

  it('sends a sanitised location with tracked events', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })));
    window.history.replaceState({}, '', '/auth/confirm?token_hash=secret-hash&type=email');

    trackMarketingEvent('signup_created', { source: 'landing_page' });

    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    const [, options] = vi.mocked(fetch).mock.calls.at(-1)!;
    const payload = JSON.parse(String(options?.body));
    expect(payload.properties.path).toBe('/auth/confirm');
    expect(payload.properties.search).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain('secret-hash');
    window.history.replaceState({}, '', '/');
  });
});
