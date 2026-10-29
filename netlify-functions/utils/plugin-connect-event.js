const { getHeaderValue, normalizePluginVersion } = require('./plugin-version');

// A site counts as connected while it has used the API key this recently.
const PLUGIN_SITE_ACTIVE_DAYS = 30;

// generate-alt-text runs often; skip the database call when this warm
// instance already recorded the same site within the hour. The SQL function
// applies the same one-hour throttle across instances.
const PLUGIN_SITE_TOUCH_INTERVAL_MS = 60 * 60 * 1000;
const PLUGIN_SITE_TOUCH_CACHE_LIMIT = 5000;
const recentPluginSiteTouches = new Map();

async function recordPluginConnectCompleted(supabase, {
  userId,
  userEmail,
  endpointName = 'auth-validate',
  occurredAt = new Date().toISOString(),
  pluginVersion = null,
} = {}) {
  if (!supabase || !userId) {
    return { recorded: false, reason: 'missing_context' };
  }

  const normalizedPluginVersion = normalizePluginVersion(pluginVersion);

  try {
    const { data: existingEvents, error: existingError } = await supabase
      .from('marketing_events')
      .select('id, properties, user_email')
      .eq('event_name', 'connect_completed')
      .eq('user_id', userId)
      .eq('source', 'wordpress_plugin_auth')
      .limit(1);

    if (existingError) {
      console.warn('plugin-connect-event: duplicate check failed', existingError.message);
      return { recorded: false, reason: 'duplicate_check_failed' };
    }

    if (existingEvents && existingEvents.length > 0) {
      const existingEvent = existingEvents[0];
      const nextProperties = {
        ...(existingEvent.properties && typeof existingEvent.properties === 'object' ? existingEvent.properties : {}),
        validation_endpoint: endpointName,
      };

      if (normalizedPluginVersion) {
        nextProperties.plugin_version = normalizedPluginVersion;
      }

      const currentPluginVersion = normalizePluginVersion(existingEvent?.properties?.plugin_version || null);
      const shouldUpdate = existingEvent.user_email !== (userEmail || null)
        || existingEvent?.properties?.validation_endpoint !== endpointName
        || (normalizedPluginVersion && currentPluginVersion !== normalizedPluginVersion);

      if (!shouldUpdate) {
        return { recorded: false, reason: 'already_recorded' };
      }

      const { error: updateError } = await supabase
        .from('marketing_events')
        .update({
          user_email: userEmail || null,
          properties: nextProperties,
        })
        .eq('id', existingEvent.id);

      if (updateError) {
        console.warn('plugin-connect-event: update failed', updateError.message);
        return { recorded: false, reason: 'update_failed' };
      }

      return { recorded: false, reason: 'updated_existing' };
    }

    const { error: insertError } = await supabase
      .from('marketing_events')
      .insert({
        event_name: 'connect_completed',
        source: 'wordpress_plugin_auth',
        user_id: userId,
        user_email: userEmail || null,
        properties: {
          validation_endpoint: endpointName,
          ...(normalizedPluginVersion ? { plugin_version: normalizedPluginVersion } : {}),
        },
        occurred_at: occurredAt,
      });

    if (insertError) {
      console.warn('plugin-connect-event: insert failed', insertError.message);
      return { recorded: false, reason: 'insert_failed' };
    }

    return { recorded: true, reason: 'inserted' };
  } catch (error) {
    console.warn('plugin-connect-event: unexpected failure', error.message);
    return { recorded: false, reason: 'unexpected_failure' };
  }
}

async function getPluginConnectionStatus(supabase, userId) {
  if (!supabase || !userId) {
    return {
      connected: false,
      connectedAt: null,
      source: null,
    };
  }

  try {
    const { data, error } = await supabase
      .from('marketing_events')
      .select('occurred_at, created_at, source')
      .eq('event_name', 'connect_completed')
      .eq('user_id', userId)
      .in('source', ['wordpress_plugin_auth', 'wordpress_connect'])
      .order('occurred_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('plugin-connect-event: status lookup failed', error.message);
      return {
        connected: false,
        connectedAt: null,
        source: null,
      };
    }

    return {
      connected: Boolean(data),
      connectedAt: data?.occurred_at || data?.created_at || null,
      source: data?.source || null,
    };
  } catch (error) {
    console.warn('plugin-connect-event: status lookup failed', error.message);
    return {
      connected: false,
      connectedAt: null,
      source: null,
    };
  }
}

/**
 * Normalize a WordPress home URL for storage and lookup: http(s) only, no
 * credentials, query or fragment, lowercase host, no trailing slash. The
 * path is kept so subdirectory installs stay distinct.
 */
function normalizeSiteUrl(value) {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2048) return null;

  let url;
  try {
    url = new URL(trimmed);
  } catch (_error) {
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!host) return null;

  const port = url.port ? `:${url.port}` : '';
  const path = url.pathname.replace(/\/+$/, '');
  const normalized = `${url.protocol}//${host}${port}${path}`;

  return normalized.length <= 500 ? normalized : null;
}

function normalizeWpLocale(value) {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!/^[a-z]{2,3}(?:_[A-Z]{2})?(?:_[a-z0-9]+)?$/.test(trimmed)) return null;

  return trimmed.slice(0, 20);
}

/**
 * Read the site the plugin reports in its request headers. Returns null when
 * no valid site URL was sent (older plugin versions or other clients).
 */
function extractPluginSite(event) {
  const headers = event?.headers || {};
  const siteUrl = normalizeSiteUrl(getHeaderValue(headers, 'x-site-url'));
  if (!siteUrl) return null;

  return {
    siteUrl,
    pluginVersion: normalizePluginVersion(
      getHeaderValue(headers, 'x-plugin-version')
      || getHeaderValue(headers, 'x-alt-text-pro-version')
      || null
    ),
    wpLocale: normalizeWpLocale(getHeaderValue(headers, 'x-wp-locale')),
  };
}

/**
 * Record that a site used the account's API key. Best effort: the caller's
 * request never fails because this write failed.
 */
async function recordPluginSiteSeen(supabase, {
  userId,
  siteUrl,
  pluginVersion = null,
  wpLocale = null,
} = {}, { throttle = true, now = Date.now() } = {}) {
  const normalizedSiteUrl = normalizeSiteUrl(siteUrl);
  if (!supabase || !userId || !normalizedSiteUrl) {
    return { recorded: false, reason: 'missing_context' };
  }

  const cacheKey = [userId, normalizedSiteUrl, pluginVersion || '', wpLocale || ''].join('|');
  if (throttle) {
    const lastTouch = recentPluginSiteTouches.get(cacheKey);
    if (lastTouch && now - lastTouch < PLUGIN_SITE_TOUCH_INTERVAL_MS) {
      return { recorded: false, reason: 'throttled' };
    }
  }

  try {
    const { error } = await supabase.rpc('touch_plugin_site', {
      p_user_id: userId,
      p_site_url: normalizedSiteUrl,
      p_plugin_version: normalizePluginVersion(pluginVersion),
      p_wp_locale: normalizeWpLocale(wpLocale),
    });

    if (error) {
      console.warn('plugin-sites: touch failed', error.message);
      return { recorded: false, reason: 'touch_failed' };
    }

    if (recentPluginSiteTouches.size >= PLUGIN_SITE_TOUCH_CACHE_LIMIT) {
      recentPluginSiteTouches.clear();
    }
    recentPluginSiteTouches.set(cacheKey, now);

    return { recorded: true, reason: 'touched' };
  } catch (error) {
    console.warn('plugin-sites: unexpected touch failure', error?.message || error);
    return { recorded: false, reason: 'unexpected_failure' };
  }
}

/**
 * Mark one of the account's sites as disconnected. The API key is shared by
 * every site of the account, so it is never revoked here.
 */
async function markPluginSiteDisconnected(supabase, { userId, siteUrl } = {}) {
  const normalizedSiteUrl = normalizeSiteUrl(siteUrl);
  if (!supabase || !userId || !normalizedSiteUrl) {
    return { success: false, reason: 'missing_context' };
  }

  // Drop the warm-instance throttle so a reconnect is recorded at once.
  for (const key of recentPluginSiteTouches.keys()) {
    if (key.startsWith(`${userId}|${normalizedSiteUrl}|`)) {
      recentPluginSiteTouches.delete(key);
    }
  }

  const { data, error } = await supabase
    .from('plugin_sites')
    .update({ disconnected_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('site_url', normalizedSiteUrl)
    .is('disconnected_at', null)
    .select('id');

  if (error) {
    console.warn('plugin-sites: disconnect failed', error.message);
    return { success: false, reason: 'update_failed' };
  }

  return {
    success: true,
    siteUrl: normalizedSiteUrl,
    disconnected: Array.isArray(data) && data.length > 0,
  };
}

/**
 * List the account's sites, most recently seen first.
 */
async function listPluginSites(supabase, userId) {
  const { data, error } = await supabase
    .from('plugin_sites')
    .select('site_url, plugin_version, wp_locale, first_seen_at, last_seen_at, disconnected_at')
    .eq('user_id', userId)
    .order('last_seen_at', { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(`Failed to list plugin sites: ${error.message || error}`);
  }

  return (data || []).map((row) => ({
    site_url: row.site_url,
    plugin_version: row.plugin_version || null,
    wp_locale: row.wp_locale || null,
    first_seen_at: row.first_seen_at,
    last_seen_at: row.last_seen_at,
    disconnected_at: row.disconnected_at || null,
  }));
}

/**
 * "WordPress connected" for the dashboard: any site that is not
 * disconnected and used the key within PLUGIN_SITE_ACTIVE_DAYS. Falls back to
 * the older marketing-event status only when plugin_sites cannot be read
 * (for example before its migration is applied).
 */
async function getPluginSiteConnectionStatus(supabase, userId, { now = Date.now() } = {}) {
  if (!supabase || !userId) {
    return { connected: false, connectedAt: null, source: null };
  }

  try {
    const cutoff = new Date(now - PLUGIN_SITE_ACTIVE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('plugin_sites')
      .select('site_url, last_seen_at')
      .eq('user_id', userId)
      .is('disconnected_at', null)
      .gte('last_seen_at', cutoff)
      .order('last_seen_at', { ascending: false })
      .limit(1);

    if (error) {
      console.warn('plugin-sites: status lookup failed', error.message);
      return getPluginConnectionStatus(supabase, userId);
    }

    const latest = Array.isArray(data) ? data[0] : null;
    return {
      connected: Boolean(latest),
      connectedAt: latest?.last_seen_at || null,
      source: latest ? 'plugin_sites' : null,
    };
  } catch (error) {
    console.warn('plugin-sites: status lookup failed', error?.message || error);
    return getPluginConnectionStatus(supabase, userId);
  }
}

function resetPluginSiteTouchCache() {
  recentPluginSiteTouches.clear();
}

module.exports = {
  PLUGIN_SITE_ACTIVE_DAYS,
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
};
