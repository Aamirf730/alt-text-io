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

import { trackMarketingEvent } from './analytics';

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
