import { describe, expect, it, vi } from 'vitest';

const { _private } = require('../netlify-functions/track-event.js');

function request(body, headers = {}) {
  return { httpMethod: 'POST', headers, body: JSON.stringify(body) };
}

function supabaseMock() {
  const inserted = [];
  return {
    inserted,
    client: {
      auth: { getUser: vi.fn(async () => ({ data: { user: null }, error: null })) },
      from: vi.fn(() => ({ insert: vi.fn(async payload => { inserted.push(payload); return { error: null }; }) })),
    },
  };
}

describe('track-event anonymous abuse limits', () => {
  it('applies a tighter per-IP limit to anonymous page views than to other anonymous events', async () => {
    const { client } = supabaseMock();
    const checkRateLimitFn = vi.fn(async () => ({ allowed: true }));
    const handler = _private.createHandler({ supabaseClient: client, checkRateLimitFn });

    await handler(request({ event_name: 'page_viewed', anonymous_id: 'anon-1', source: 'landing_page' }, { 'x-forwarded-for': '203.0.113.9' }));
    await handler(request({ event_name: 'demo_used', anonymous_id: 'anon-1', source: 'landing_page' }, { 'x-forwarded-for': '203.0.113.9' }));

    const keys = checkRateLimitFn.mock.calls.map(call => [call[0].replace(/:[^:]*$/, ''), call[1]]);
    expect(keys).toContainEqual(['track-event:anon:page', _private.ANONYMOUS_PAGE_VIEW_RATE_LIMIT]);
    expect(keys).toContainEqual(['track-event:anon:event', _private.ANONYMOUS_EVENT_RATE_LIMIT]);
  });

  it('returns 429 once the anonymous page-view limit is spent', async () => {
    const { client, inserted } = supabaseMock();
    const checkRateLimitFn = vi.fn(async key => (key.startsWith('track-event:anon:')
      ? { allowed: false, resetAt: new Date(Date.now() + 60000), limit: 30 }
      : { allowed: true }));
    const handler = _private.createHandler({ supabaseClient: client, checkRateLimitFn });

    const response = await handler(request({ event_name: 'page_viewed', anonymous_id: 'anon-1' }));

    expect(response.statusCode).toBe(429);
    expect(inserted).toHaveLength(0);
  });

  it('rejects sources outside the safe pattern', async () => {
    const { client, inserted } = supabaseMock();
    const handler = _private.createHandler({ supabaseClient: client, checkRateLimitFn: vi.fn(async () => ({ allowed: true })) });

    const response = await handler(request({ event_name: 'page_viewed', anonymous_id: 'a', source: '<script>alert(1)</script>' }));

    expect(response.statusCode).toBe(400);
    expect(inserted).toHaveLength(0);
  });

  it('caps property count, string length and total size', () => {
    const big = Object.fromEntries(Array.from({ length: 80 }, (_, index) => [`k${index}`, 'x'.repeat(1000)]));
    const cleaned = _private.sanitizeProperties(big);

    expect(Object.keys(cleaned).length).toBeLessThanOrEqual(30);
    expect(Object.values(cleaned).every(value => value.length <= 300)).toBe(true);
    expect(Buffer.byteLength(JSON.stringify(cleaned), 'utf8')).toBeLessThanOrEqual(_private.MAX_PROPERTIES_BYTES);
  });
});
