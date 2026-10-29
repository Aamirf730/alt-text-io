const LOW_CREDIT_THRESHOLD = 5;
const { getEventPluginVersion } = require('./plugin-version');
const { fetchAllRows } = require('./paginated-query');

function parsePositiveInt(value, fallback, min = 1, max = 180) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function latestByDate(items, dateField = 'occurred_at') {
  return [...items]
    .filter(Boolean)
    .sort((a, b) => new Date(b[dateField] || b.created_at || 0) - new Date(a[dateField] || a.created_at || 0))[0] || null;
}

function getEventTime(event) {
  return event?.occurred_at || event?.created_at || null;
}

function groupByIdentity(rows, getUserId, getEmail) {
  const byUserId = new Map();
  const byEmail = new Map();

  for (const row of rows || []) {
    const userId = getUserId(row);
    const email = normalizeEmail(getEmail(row));
    if (userId) {
      const items = byUserId.get(userId) || [];
      items.push(row);
      byUserId.set(userId, items);
    }
    if (email) {
      const items = byEmail.get(email) || [];
      items.push(row);
      byEmail.set(email, items);
    }
  }

  return { byUserId, byEmail };
}

function getIdentityRows(grouped, profile) {
  const rows = [
    ...(grouped.byUserId.get(profile.id) || []),
    ...(grouped.byEmail.get(normalizeEmail(profile.email)) || []),
  ];

  const seen = new Set();
  return rows.filter(row => {
    const key = row.id || `${row.automation_key || row.event_name}:${row.created_at || row.occurred_at}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildActivePluginKeyMap(apiKeys = []) {
  const activePluginKeys = new Map();

  for (const key of apiKeys) {
    if (!key?.user_id || !key?.is_active) continue;

    const keyName = String(key.name || '').trim().toLowerCase();
    if (keyName !== 'wordpress plugin') continue;

    const existing = activePluginKeys.get(key.user_id);
    const existingTime = existing ? new Date(existing.created_at || 0).getTime() : 0;
    const currentTime = new Date(key.created_at || 0).getTime();

    if (!existing || currentTime > existingTime) {
      activePluginKeys.set(key.user_id, key);
    }
  }

  return activePluginKeys;
}

// Only the server-written connect event (auth-validate) may supply a plugin
// version. The browser-sent "wordpress_connect" event can claim any version.
const TRUSTED_VERSION_SOURCE = 'wordpress_plugin_auth';

function buildLatestSiteMap(pluginSites = []) {
  const latest = new Map();
  for (const site of pluginSites || []) {
    if (!site?.user_id || site.disconnected_at) continue;
    const current = latest.get(site.user_id);
    if (!current || new Date(site.last_seen_at || 0) > new Date(current.last_seen_at || 0)) {
      latest.set(site.user_id, site);
    }
  }
  return latest;
}

function buildLifecycleStatusReport({
  profiles = [],
  events = [],
  usageStats = [],
  apiKeys = [],
  automationSends = [],
  pluginSites = [],
  generatedAt = new Date().toISOString(),
  days = 30,
} = {}) {
  const eventGroups = groupByIdentity(events, row => row.user_id, row => row.user_email);
  const sendGroups = groupByIdentity(automationSends, row => row.user_id, row => row.user_email);
  const usageByUser = new Map((usageStats || []).map(row => [row.user_id, row]));
  const activePluginKeysByUser = buildActivePluginKeyMap(apiKeys);
  const latestSiteByUser = buildLatestSiteMap(pluginSites);

  const rows = profiles.map(profile => {
    const profileEvents = getIdentityRows(eventGroups, profile);
    const profileSends = getIdentityRows(sendGroups, profile);
    const usage = usageByUser.get(profile.id) || {};
    const eventsByName = new Map();

    for (const event of profileEvents) {
      const list = eventsByName.get(event.event_name) || [];
      list.push(event);
      eventsByName.set(event.event_name, list);
    }

    const signupEvent = latestByDate(eventsByName.get('signup_created') || []);
    const pluginConnectEvent = latestByDate(
      (eventsByName.get('connect_completed') || [])
        .filter(event => event.source === 'wordpress_plugin_auth' || event.source === 'wordpress_connect')
    );
    const pluginKeyFallback = activePluginKeysByUser.get(profile.id) || null;
    const pluginSite = latestSiteByUser.get(profile.id) || null;
    const pluginConnectedAt = getEventTime(pluginConnectEvent) || pluginSite?.first_seen_at || pluginKeyFallback?.created_at || null;
    const pluginConnectionSource = pluginConnectEvent?.source
      || (pluginSite ? 'plugin_sites' : null)
      || (pluginKeyFallback ? 'wordpress_plugin_key' : null);
    const pluginVersion = pluginSite?.plugin_version
      || (pluginConnectEvent?.source === TRUSTED_VERSION_SOURCE ? getEventPluginVersion(pluginConnectEvent) : null);
    const isPluginConnected = Boolean(pluginConnectEvent || pluginSite || pluginKeyFallback);
    const firstImageEvent = latestByDate(eventsByName.get('first_image_processed') || []);
    const checkoutEvent = latestByDate(eventsByName.get('checkout_started') || []);
    const purchaseEvent = latestByDate(eventsByName.get('purchase_completed') || []);
    const lowCreditEvent = latestByDate(eventsByName.get('credits_low') || []);
    const latestSend = latestByDate(profileSends, 'created_at');

    const totalUsageCount = Number(usage.total_usage_count || 0);
    const totalCreditsUsed = Number(usage.total_credits_used || 0);
    // Same spendable balance reserve_credit uses: plan credits, bonus and
    // credit packs. Packs are open to Free accounts, so a Free user with a
    // pack has credits and has purchased.
    const purchasedCredits = Number(profile.purchased_credits_remaining || 0);
    const creditsRemaining = Math.max(
      Number(profile.credits_remaining || 0),
      Number(profile.bonus_credits_remaining || 0),
      purchasedCredits
    );
    const hasPurchase = Boolean(purchaseEvent) || profile.subscription_plan !== 'free' || purchasedCredits > 0;
    const hasFirstGeneration = totalUsageCount > 0 || Boolean(firstImageEvent);
    const isLowCredits = creditsRemaining <= LOW_CREDIT_THRESHOLD;

    let followUpStatus = 'Active';
    if (!isPluginConnected) {
      followUpStatus = 'Needs plugin reminder';
    } else if (!hasFirstGeneration) {
      followUpStatus = 'Needs first generation reminder';
    } else if (isLowCredits && !hasPurchase) {
      followUpStatus = 'Low credits';
    } else if (checkoutEvent && !purchaseEvent && profile.subscription_plan === 'free') {
      followUpStatus = 'Checkout recovery';
    }

    return {
      user_id: profile.id,
      email: profile.email,
      plan: profile.subscription_plan || 'free',
      status: profile.subscription_status || 'active',
      credits_remaining: creditsRemaining,
      total_processed: Number(profile.total_processed || 0),
      total_usage_count: totalUsageCount,
      total_credits_used: totalCreditsUsed,
      signup_at: getEventTime(signupEvent) || profile.created_at || null,
      plugin_connected_at: pluginConnectedAt,
      plugin_connection_source: pluginConnectionSource,
      plugin_version: pluginVersion,
      plugin_site_url: pluginSite?.site_url || null,
      first_generation_at: usage.last_usage_at || getEventTime(firstImageEvent),
      checkout_started_at: getEventTime(checkoutEvent),
      purchase_completed_at: getEventTime(purchaseEvent),
      credits_low_at: getEventTime(lowCreditEvent),
      follow_up_status: followUpStatus,
      latest_follow_up: latestSend ? {
        automation_key: latestSend.automation_key,
        status: latestSend.status,
        subject: latestSend.subject,
        sent_at: latestSend.sent_at,
        created_at: latestSend.created_at,
        error_message: latestSend.error_message,
      } : null,
      follow_ups_sent: profileSends.filter(send => send.status === 'sent').length,
      follow_ups_failed: profileSends.filter(send => send.status === 'failed').length,
      lifecycle_events: {
        signup_created: Boolean(signupEvent),
        connect_completed: isPluginConnected,
        first_image_processed: hasFirstGeneration,
        checkout_started: Boolean(checkoutEvent),
        purchase_completed: Boolean(purchaseEvent),
        credits_low: Boolean(lowCreditEvent),
      },
    };
  }).sort((a, b) => new Date(b.signup_at || 0) - new Date(a.signup_at || 0));

  const summary = rows.reduce((acc, row) => {
    acc.total_users += 1;
    if (row.lifecycle_events.connect_completed) acc.plugin_connected += 1;
    if (row.lifecycle_events.first_image_processed) acc.first_generation += 1;
    if (row.lifecycle_events.purchase_completed || row.plan !== 'free') acc.purchased_or_paid += 1;
    if (row.follow_up_status === 'Needs plugin reminder') acc.needs_plugin_reminder += 1;
    if (row.follow_up_status === 'Needs first generation reminder') acc.needs_first_generation_reminder += 1;
    if (row.follow_up_status === 'Low credits') acc.low_credits += 1;
    if (row.follow_up_status === 'Checkout recovery') acc.checkout_recovery += 1;
    return acc;
  }, {
    total_users: 0,
    plugin_connected: 0,
    first_generation: 0,
    purchased_or_paid: 0,
    needs_plugin_reminder: 0,
    needs_first_generation_reminder: 0,
    low_credits: 0,
    checkout_recovery: 0,
  });

  return {
    generated_at: generatedAt,
    range: {
      days,
      timezone: 'UTC',
    },
    summary,
    users: rows,
  };
}

async function fetchLifecycleStatusReport(supabase, { days = 30 } = {}) {
  const parsedDays = parsePositiveInt(days, 30, 1, 180);
  const startAt = new Date(Date.now() - parsedDays * 24 * 60 * 60 * 1000).toISOString();

  // Every profile, not just the newest 500, so the table, search and the
  // summary counts cover the whole user base.
  const profiles = await fetchAllRows(
    (from, to) => supabase
      .from('profiles')
      .select('id,email,subscription_plan,subscription_status,credits_remaining,bonus_credits_remaining,purchased_credits_remaining,total_processed,created_at')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to),
    { label: 'lifecycle profiles' }
  );

  const [events, usageStats, apiKeys, automationSends] = await Promise.all([
    fetchAllRows(
      (from, to) => supabase
        .from('marketing_events')
        .select('id,event_name,source,user_id,user_email,occurred_at,created_at,properties')
        .gte('occurred_at', startAt)
        .in('event_name', [
          'signup_created',
          'connect_completed',
          'first_image_processed',
          'checkout_started',
          'purchase_completed',
          'credits_low',
        ])
        .order('occurred_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to),
      { label: 'lifecycle marketing events' }
    ),
    fetchAllRows(
      (from, to) => supabase
        .from('user_usage_stats')
        .select('user_id,total_usage_count,total_credits_used,last_usage_at')
        .order('user_id', { ascending: true })
        .range(from, to),
      { label: 'lifecycle usage statistics' }
    ),
    fetchAllRows(
      (from, to) => supabase
        .from('api_keys')
        .select('user_id,name,is_active,created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .order('user_id', { ascending: true })
        .range(from, to),
      { label: 'lifecycle API keys' }
    ),
    fetchAllRows(
      (from, to) => supabase
        .from('marketing_automation_sends')
        .select('id,automation_key,actor_key,user_id,user_email,status,subject,error_message,sent_at,created_at')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to),
      { label: 'lifecycle automation sends' }
    ),
  ]);

  // plugin_sites is written by the plugin API. If its migration has not
  // been applied yet, report without it rather than failing.
  let pluginSites = [];
  try {
    pluginSites = await fetchAllRows(
      (from, to) => supabase
        .from('plugin_sites')
        .select('id,user_id,site_url,plugin_version,first_seen_at,last_seen_at,disconnected_at')
        .is('disconnected_at', null)
        .order('id', { ascending: true })
        .range(from, to),
      { label: 'lifecycle plugin sites' }
    );
  } catch (_error) {
    console.warn('lifecycle-status: plugin_sites unavailable');
  }

  return buildLifecycleStatusReport({
    profiles,
    events,
    usageStats,
    apiKeys,
    automationSends,
    pluginSites,
    days: parsedDays,
  });
}

module.exports = {
  LOW_CREDIT_THRESHOLD,
  buildLifecycleStatusReport,
  fetchLifecycleStatusReport,
  parsePositiveInt,
};
