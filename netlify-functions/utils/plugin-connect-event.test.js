import { describe, expect, it, vi } from 'vitest';

const {
  recordPluginConnectCompleted,
  getPluginConnectionStatus,
  normalizeSiteUrl,
  normalizeWpLocale,
  extractPluginSite,
  recordPluginSiteSeen,
  markPluginSiteDisconnected,
  listPluginSites,
  getPluginSiteConnectionStatus,
  resetPluginSiteTouchCache,
} = require('./plugin-connect-event.js');

function createSupabaseMock({ existingEvents = [], selectError = null, insertError = null, updateError = null } = {}) {
  const insert = vi.fn(() => Promise.resolve({ error: insertError }));
  const eqUpdate = vi.fn(() => Promise.resolve({ error: updateError }));
  const update = vi.fn(() => ({ eq: eqUpdate }));
  const limit = vi.fn(() => Promise.resolve({ data: existingEvents, error: selectError }));
  const thirdEq = vi.fn(() => ({ limit }));
  const secondEq = vi.fn(() => ({ eq: thirdEq }));
  const firstEq = vi.fn(() => ({ eq: secondEq }));
  const select = vi.fn(() => ({ eq: firstEq }));
  const from = vi.fn(() => ({ select, insert, update }));

  return {
    supabase: { from },
    calls: {
      from,
      select,
      firstEq,
      secondEq,
      thirdEq,
      limit,
      insert,
      update,
      eqUpdate,
    },
  };
}

describe('plugin connect event recording', () => {
  it('records one connect_completed event for a validated plugin key', async () => {
    const { supabase, calls } = createSupabaseMock();

    const result = await recordPluginConnectCompleted(supabase, {
      userId: 'user-1',
      userEmail: 'lead@example.com',
      pluginVersion: '1.5.9',
      endpointName: 'auth-validate',
      occurredAt: '2026-06-27T00:00:00.000Z',
    });

    expect(result).toEqual({ recorded: true, reason: 'inserted' });
    expect(calls.insert).toHaveBeenCalledWith({
      event_name: 'connect_completed',
      source: 'wordpress_plugin_auth',
      user_id: 'user-1',
      user_email: 'lead@example.com',
      properties: {
        plugin_version: '1.5.9',
        validation_endpoint: 'auth-validate',
      },
      occurred_at: '2026-06-27T00:00:00.000Z',
    });
  });

  it('does not record duplicate plugin-auth connect_completed events for the same user', async () => {
    const { supabase, calls } = createSupabaseMock({
      existingEvents: [{
        id: 'existing-event',
        user_email: 'lead@example.com',
        properties: {
          validation_endpoint: 'auth-validate',
        },
      }],
    });

    const result = await recordPluginConnectCompleted(supabase, {
      userId: 'user-1',
      userEmail: 'lead@example.com',
    });

    expect(result).toEqual({ recorded: false, reason: 'already_recorded' });
    expect(calls.thirdEq).toHaveBeenCalledWith('source', 'wordpress_plugin_auth');
    expect(calls.insert).not.toHaveBeenCalled();
  });

  it('updates the existing connect event when a new plugin version is seen', async () => {
    const { supabase, calls } = createSupabaseMock({
      existingEvents: [{
        id: 'existing-event',
        user_email: 'lead@example.com',
        properties: {
          validation_endpoint: 'auth-validate',
        },
      }],
    });

    const result = await recordPluginConnectCompleted(supabase, {
      userId: 'user-1',
      userEmail: 'lead@example.com',
      pluginVersion: '1.5.9',
      endpointName: 'get-usage',
    });

    expect(result).toEqual({ recorded: false, reason: 'updated_existing' });
    expect(calls.update).toHaveBeenCalledWith({
      user_email: 'lead@example.com',
      properties: {
        validation_endpoint: 'get-usage',
        plugin_version: '1.5.9',
      },
    });
    expect(calls.eqUpdate).toHaveBeenCalledWith('id', 'existing-event');
    expect(calls.insert).not.toHaveBeenCalled();
  });

  it('reports a completed WordPress connection without treating an API key as proof', async () => {
    const maybeSingle = vi.fn(() => Promise.resolve({
      data: {
        occurred_at: '2026-08-17T10:00:00.000Z',
        created_at: '2026-08-17T10:00:00.000Z',
        source: 'wordpress_plugin_auth',
      },
      error: null,
    }));
    const limit = vi.fn(() => ({ maybeSingle }));
    const secondOrder = vi.fn(() => ({ limit }));
    const firstOrder = vi.fn(() => ({ order: secondOrder }));
    const inSource = vi.fn(() => ({ order: firstOrder }));
    const userEq = vi.fn(() => ({ in: inSource }));
    const eventEq = vi.fn(() => ({ eq: userEq }));
    const select = vi.fn(() => ({ eq: eventEq }));
    const from = vi.fn(() => ({ select }));

    const result = await getPluginConnectionStatus({ from }, 'user-1');

    expect(result).toEqual({
      connected: true,
      connectedAt: '2026-08-17T10:00:00.000Z',
      source: 'wordpress_plugin_auth',
    });
    expect(inSource).toHaveBeenCalledWith('source', [
      'wordpress_plugin_auth',
      'wordpress_connect',
    ]);
  });

  it('does not treat a missing connection event as connected', async () => {
    const maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
    const limit = vi.fn(() => ({ maybeSingle }));
    const secondOrder = vi.fn(() => ({ limit }));
    const firstOrder = vi.fn(() => ({ order: secondOrder }));
    const inSource = vi.fn(() => ({ order: firstOrder }));
    const userEq = vi.fn(() => ({ in: inSource }));
    const eventEq = vi.fn(() => ({ eq: userEq }));
    const select = vi.fn(() => ({ eq: eventEq }));
    const from = vi.fn(() => ({ select }));

    await expect(getPluginConnectionStatus({ from }, 'user-1')).resolves.toEqual({
      connected: false,
      connectedAt: null,
      source: null,
    });
  });
});

describe('plugin site normalization', () => {
  it('normalizes home URLs for storage and lookup', () => {
    expect(normalizeSiteUrl('https://Example.COM/')).toBe('https://example.com');
    expect(normalizeSiteUrl(' https://example.com/blog/ ')).toBe('https://example.com/blog');
    expect(normalizeSiteUrl('https://user:pass@example.com:443/?a=1#x')).toBe('https://example.com');
    expect(normalizeSiteUrl('http://localhost:8080/wp')).toBe('http://localhost:8080/wp');
  });

  it('rejects anything that is not an http(s) URL', () => {
    expect(normalizeSiteUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeSiteUrl('ftp://example.com')).toBeNull();
    expect(normalizeSiteUrl('example.com')).toBeNull();
    expect(normalizeSiteUrl('')).toBeNull();
    expect(normalizeSiteUrl(null)).toBeNull();
    expect(normalizeSiteUrl(`https://example.com/${'a'.repeat(600)}`)).toBeNull();
  });

  it('accepts WordPress locales only', () => {
    expect(normalizeWpLocale('de_DE')).toBe('de_DE');
    expect(normalizeWpLocale('de_DE_formal')).toBe('de_DE_formal');
    expect(normalizeWpLocale('fi')).toBe('fi');
    expect(normalizeWpLocale('<script>')).toBeNull();
  });

  it('reads the site from plugin headers in any case', () => {
    expect(extractPluginSite({
      headers: {
        'X-Site-URL': 'https://Shop.example.com/',
        'x-plugin-version': '1.7.28',
        'X-WP-Locale': 'nl_NL',
      },
    })).toEqual({
      siteUrl: 'https://shop.example.com',
      pluginVersion: '1.7.28',
      wpLocale: 'nl_NL',
    });

    expect(extractPluginSite({ headers: {} })).toBeNull();
    expect(extractPluginSite({ headers: { 'x-site-url': 'not a url' } })).toBeNull();
  });
});

describe('plugin site recording', () => {
  it('touches the site through the throttled RPC and skips repeats within the hour', async () => {
    resetPluginSiteTouchCache();
    const rpc = vi.fn(() => Promise.resolve({ error: null }));
    const supabase = { rpc };
    const site = { userId: 'user-1', siteUrl: 'https://example.com/', pluginVersion: '1.7.28', wpLocale: 'en_US' };

    await expect(recordPluginSiteSeen(supabase, site, { now: 1000 })).resolves.toEqual({ recorded: true, reason: 'touched' });
    expect(rpc).toHaveBeenCalledWith('touch_plugin_site', {
      p_user_id: 'user-1',
      p_site_url: 'https://example.com',
      p_plugin_version: '1.7.28',
      p_wp_locale: 'en_US',
    });

    await expect(recordPluginSiteSeen(supabase, site, { now: 2000 })).resolves.toEqual({ recorded: false, reason: 'throttled' });
    expect(rpc).toHaveBeenCalledTimes(1);

    await recordPluginSiteSeen(supabase, site, { now: 2000 + 60 * 60 * 1000 });
    expect(rpc).toHaveBeenCalledTimes(2);

    // auth-validate always writes, so a reconnect clears a disconnect.
    await recordPluginSiteSeen(supabase, site, { throttle: false, now: 3000 + 60 * 60 * 1000 });
    expect(rpc).toHaveBeenCalledTimes(3);
  });

  it('never throws when the write fails', async () => {
    resetPluginSiteTouchCache();
    const failing = { rpc: vi.fn(() => Promise.resolve({ error: { message: 'relation does not exist' } })) };
    await expect(recordPluginSiteSeen(failing, { userId: 'user-1', siteUrl: 'https://example.com' }))
      .resolves.toEqual({ recorded: false, reason: 'touch_failed' });

    const throwing = { rpc: vi.fn(() => Promise.reject(new Error('network down'))) };
    await expect(recordPluginSiteSeen(throwing, { userId: 'user-1', siteUrl: 'https://example.com' }))
      .resolves.toEqual({ recorded: false, reason: 'unexpected_failure' });

    await expect(recordPluginSiteSeen(throwing, { userId: 'user-1', siteUrl: 'nope' }))
      .resolves.toEqual({ recorded: false, reason: 'missing_context' });
  });

  it('marks only the open row for this user and site as disconnected', async () => {
    const select = vi.fn(() => Promise.resolve({ data: [{ id: 'site-1' }], error: null }));
    const is = vi.fn(() => ({ select }));
    const siteEq = vi.fn(() => ({ is }));
    const userEq = vi.fn(() => ({ eq: siteEq }));
    const update = vi.fn(() => ({ eq: userEq }));
    const from = vi.fn(() => ({ update }));

    const result = await markPluginSiteDisconnected({ from }, { userId: 'user-1', siteUrl: 'https://Example.com/' });

    expect(result).toEqual({ success: true, siteUrl: 'https://example.com', disconnected: true });
    expect(from).toHaveBeenCalledWith('plugin_sites');
    expect(update.mock.calls[0][0]).toHaveProperty('disconnected_at');
    expect(userEq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(siteEq).toHaveBeenCalledWith('site_url', 'https://example.com');
    expect(is).toHaveBeenCalledWith('disconnected_at', null);
  });

  it('lists sites newest first with only the public fields', async () => {
    const limit = vi.fn(() => Promise.resolve({
      data: [{
        site_url: 'https://example.com',
        plugin_version: '1.7.28',
        wp_locale: 'en_US',
        first_seen_at: '2026-10-01T00:00:00.000Z',
        last_seen_at: '2026-10-29T00:00:00.000Z',
        disconnected_at: null,
        user_id: 'user-1',
      }],
      error: null,
    }));
    const order = vi.fn(() => ({ limit }));
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));

    const sites = await listPluginSites({ from }, 'user-1');

    expect(order).toHaveBeenCalledWith('last_seen_at', { ascending: false });
    expect(sites).toEqual([{
      site_url: 'https://example.com',
      plugin_version: '1.7.28',
      wp_locale: 'en_US',
      first_seen_at: '2026-10-01T00:00:00.000Z',
      last_seen_at: '2026-10-29T00:00:00.000Z',
      disconnected_at: null,
    }]);
  });
});

describe('plugin site connection status', () => {
  function statusClient(result) {
    const calls = {};
    const limit = vi.fn(() => Promise.resolve(result));
    const order = vi.fn(() => ({ limit }));
    const gte = vi.fn(() => ({ order }));
    const is = vi.fn(() => ({ gte }));
    const eq = vi.fn(() => ({ is }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    Object.assign(calls, { from, select, eq, is, gte, order, limit });
    return { client: { from }, calls };
  }

  it('is connected when an open site was seen in the last 30 days', async () => {
    const now = Date.parse('2026-10-29T00:00:00.000Z');
    const { client, calls } = statusClient({
      data: [{ site_url: 'https://example.com', last_seen_at: '2026-10-20T00:00:00.000Z' }],
      error: null,
    });

    await expect(getPluginSiteConnectionStatus(client, 'user-1', { now })).resolves.toEqual({
      connected: true,
      connectedAt: '2026-10-20T00:00:00.000Z',
      source: 'plugin_sites',
    });
    expect(calls.is).toHaveBeenCalledWith('disconnected_at', null);
    expect(calls.gte).toHaveBeenCalledWith('last_seen_at', '2026-09-29T00:00:00.000Z');
  });

  it('is not connected when no open site was seen recently', async () => {
    const { client } = statusClient({ data: [], error: null });
    await expect(getPluginSiteConnectionStatus(client, 'user-1')).resolves.toEqual({
      connected: false,
      connectedAt: null,
      source: null,
    });
  });
});
