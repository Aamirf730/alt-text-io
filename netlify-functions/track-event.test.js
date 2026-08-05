import { describe, expect, it, vi } from 'vitest';

const { _private } = require('./track-event.js');

function request(body, headers = {}) {
  return {
    httpMethod: 'POST',
    headers,
    body: JSON.stringify(body),
  };
}

function createSupabaseMock({
  user = null,
  authError = null,
  existingSignup = false,
  insertError = null,
} = {}) {
  const inserted = [];
  const client = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user },
        error: authError,
      })),
    },
    from: vi.fn(() => {
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        limit: vi.fn(async () => ({
          data: existingSignup ? [{ id: 'existing-signup' }] : [],
          error: null,
        })),
        insert: vi.fn(async payload => {
          if (insertError) return { error: insertError };
          inserted.push(payload);
          return { error: null };
        }),
      };

      return query;
    }),
  };

  return { client, inserted };
}

function createTestHandler(supabaseClient, options = {}) {
  return _private.createHandler({
    supabaseClient,
    checkRateLimitFn: vi.fn(async () => ({ allowed: true })),
    ...options,
  });
}

describe('track-event security boundary', () => {
  it.each([
    'polar_webhook',
    'Polar_Webhook',
    'wordpress_plugin_auth',
    'wordpress_plugin_usage',
  ])('rejects public attempts to claim the reserved %s source', async source => {
    const { client } = createSupabaseMock();
    const response = await createTestHandler(client)(request({
      event_name: 'purchase_completed',
      source,
      anonymous_id: 'anon-attacker',
      properties: { order_id: 'attacker-controlled-order' },
    }));

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body)).toEqual({ error: 'Reserved event source' });
  });

  it('requires a verified Supabase session for lifecycle-capable events', async () => {
    const { client, inserted } = createSupabaseMock();
    const response = await createTestHandler(client)(request({
      event_name: 'signup_created',
      source: 'web_app',
      anonymous_id: 'anon-attacker',
      user_email: 'victim@example.com',
    }));

    expect(response.statusCode).toBe(401);
    expect(inserted).toHaveLength(0);
    expect(client.auth.getUser).not.toHaveBeenCalled();
  });

  it('rejects purchase completion even with a session because Polar is authoritative', async () => {
    const { client, inserted } = createSupabaseMock({
      user: { id: 'verified-user', email: 'owner@example.com' },
    });
    const response = await createTestHandler(client)(request({
      event_name: 'purchase_completed',
      source: 'web_app',
      anonymous_id: 'anon-verified',
    }, {
      authorization: 'Bearer verified-session-token',
    }));

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body)).toEqual({ error: 'Server-only event' });
    expect(inserted).toHaveLength(0);
  });

  it('blocks the original unauthenticated purchase-email attack before storage', async () => {
    const { client, inserted } = createSupabaseMock();
    const response = await createTestHandler(client)(request({
      event_name: 'purchase_completed',
      source: 'web_app',
      anonymous_id: 'attacker-browser',
      user_id: 'victim-id',
      user_email: 'victim@example.com',
    }));

    expect(response.statusCode).toBe(403);
    expect(inserted).toHaveLength(0);
    expect(client.auth.getUser).not.toHaveBeenCalled();
  });

  it('keeps anonymous events identity-free even when identity is supplied by the caller', async () => {
    const { client, inserted } = createSupabaseMock();
    const response = await createTestHandler(client)(request({
      event_name: 'page_viewed',
      source: 'landing_page',
      anonymous_id: 'anon-1',
      user_id: 'forged-user',
      user_email: 'victim@example.com',
      properties: { identity_verified: true, path: '/' },
    }));

    expect(response.statusCode).toBe(200);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      anonymous_id: 'anon-1',
      user_id: null,
      user_email: null,
      properties: {
        identity_verified: false,
        path: '/',
      },
    });
  });

  it('derives user identity from the verified session and ignores forged identity fields', async () => {
    const { client, inserted } = createSupabaseMock({
      user: { id: 'verified-user', email: 'Owner@Example.com' },
    });
    const response = await createTestHandler(client)(request({
      event_name: 'signup_created',
      source: 'landing_page',
      anonymous_id: 'anon-verified',
      user_id: 'forged-user',
      user_email: 'victim@example.com',
      properties: { identity_verified: false },
    }, {
      authorization: 'Bearer verified-session-token',
    }));

    expect(response.statusCode).toBe(200);
    expect(client.auth.getUser).toHaveBeenCalledWith('verified-session-token');
    expect(inserted[0]).toMatchObject({
      user_id: 'verified-user',
      user_email: 'owner@example.com',
      properties: { identity_verified: true },
    });
  });

  it('does not create a second signup event for a repeated authenticated connect visit', async () => {
    const { client, inserted } = createSupabaseMock({
      user: { id: 'verified-user', email: 'owner@example.com' },
      existingSignup: true,
    });
    const response = await createTestHandler(client)(request({
      event_name: 'signup_created',
      source: 'wordpress_connect',
      anonymous_id: 'anon-verified',
    }, {
      authorization: 'Bearer verified-session-token',
    }));

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      success: true,
      stored: false,
      duplicate: true,
    });
    expect(inserted).toHaveLength(0);
  });

  it('treats a concurrent signup insert conflict as an idempotent duplicate', async () => {
    const { client, inserted } = createSupabaseMock({
      user: { id: 'verified-user', email: 'owner@example.com' },
      insertError: { code: '23505', message: 'duplicate key value violates unique constraint' },
    });
    const response = await createTestHandler(client)(request({
      event_name: 'signup_created',
      source: 'wordpress_connect',
      anonymous_id: 'anon-verified',
    }, {
      authorization: 'Bearer verified-session-token',
    }));

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      success: true,
      stored: false,
      duplicate: true,
    });
    expect(inserted).toHaveLength(0);
  });

  it('uses a server timestamp instead of a caller-controlled lifecycle timestamp', async () => {
    const { client, inserted } = createSupabaseMock({
      user: { id: 'verified-user', email: 'owner@example.com' },
    });
    const response = await createTestHandler(client, {
      nowFn: () => new Date('2026-08-05T12:00:00.000Z'),
    })(request({
      event_name: 'checkout_started',
      source: 'dashboard',
      anonymous_id: 'anon-verified',
      occurred_at: '2000-01-01T00:00:00.000Z',
    }, {
      authorization: 'Bearer verified-session-token',
    }));

    expect(response.statusCode).toBe(200);
    expect(inserted[0].occurred_at).toBe('2026-08-05T12:00:00.000Z');
  });

  it('rejects an invalid supplied session instead of downgrading it to anonymous', async () => {
    const { client, inserted } = createSupabaseMock({
      authError: { message: 'invalid token' },
    });
    const response = await createTestHandler(client)(request({
      event_name: 'page_viewed',
      source: 'landing_page',
      anonymous_id: 'anon-1',
    }, {
      authorization: 'Bearer invalid-token',
    }));

    expect(response.statusCode).toBe(401);
    expect(inserted).toHaveLength(0);
  });

  it('requires anonymous events to carry an anonymous ID', async () => {
    const { client, inserted } = createSupabaseMock();
    const response = await createTestHandler(client)(request({
      event_name: 'demo_used',
      source: 'landing_page',
    }));

    expect(response.statusCode).toBe(400);
    expect(inserted).toHaveLength(0);
  });

  it('does not echo an unapproved request origin in CORS headers', async () => {
    const { client } = createSupabaseMock();
    const response = await createTestHandler(client)(request({
      event_name: 'page_viewed',
      source: 'landing_page',
      anonymous_id: 'anon-1',
    }, {
      origin: 'https://evil.example',
    }));

    expect(response.statusCode).toBe(200);
    expect(response.headers['Access-Control-Allow-Origin']).toBeUndefined();
  });
});
