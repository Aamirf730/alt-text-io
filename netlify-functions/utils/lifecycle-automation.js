const SITE_URL = 'https://www.alt-text.pro';
const { getLifecycleUnsubscribeUrl, getListUnsubscribeHeaders } = require('./lifecycle-unsubscribe');
const { fetchAllRows } = require('./paginated-query');

const LIFECYCLE_RULES = [
  {
    key: 'signup_no_connect',
    trigger: 'signup_created',
    allowVerifiedIdentity: true,
    trustedSources: [],
    missingAfterTrigger: ['connect_completed'],
    delayHours: 4,
    subject: 'Connect Alt Text Pro to your WordPress site',
    preview: 'Your account is ready. Connect the plugin to start generating alt text from WordPress.',
    ctaText: 'Connect WordPress',
    ctaUrl: `${SITE_URL}/connect`,
  },
  {
    key: 'connect_no_first_image',
    trigger: 'connect_completed',
    allowVerifiedIdentity: true,
    trustedSources: ['wordpress_plugin_auth'],
    missingAfterTrigger: ['first_image_processed'],
    delayHours: 6,
    subject: 'Generate your first image alt text',
    preview: 'Your WordPress site is connected. The next step is processing your first image.',
    ctaText: 'Open Dashboard',
    ctaUrl: `${SITE_URL}/dashboard`,
  },
  {
    key: 'checkout_no_purchase',
    trigger: 'checkout_started',
    allowVerifiedIdentity: true,
    trustedSources: [],
    missingAfterTrigger: ['purchase_completed'],
    delayHours: 1,
    subject: 'Need help finishing your Alt Text Pro checkout?',
    preview: 'You started checkout but did not finish. Your selected plan is still available.',
    ctaText: 'View Plans',
    ctaUrl: `${SITE_URL}/#pricing`,
  },
  {
    key: 'purchase_onboarding',
    trigger: 'purchase_completed',
    allowVerifiedIdentity: false,
    trustedSources: ['polar_webhook'],
    missingAfterTrigger: [],
    delayHours: 0,
    subject: 'Welcome to Alt Text Pro',
    preview: 'Your purchase is complete. Here are the fastest setup steps for WordPress.',
    ctaText: 'Download Plugin',
    ctaUrl: `${SITE_URL}/wordpress-plugin/alt-text-pro-plugin.zip`,
  },
  {
    key: 'credits_low_no_purchase',
    trigger: 'credits_low',
    allowVerifiedIdentity: true,
    trustedSources: ['wordpress_plugin_usage', 'dashboard_usage'],
    missingAfterTrigger: ['purchase_completed'],
    delayHours: 0,
    subject: 'Your Alt Text Pro credits are running low',
    preview: 'Add credits or upgrade your plan before your image workflow slows down.',
    ctaText: 'Add Credits',
    ctaUrl: `${SITE_URL}/dashboard`,
  },
];

// When an account qualifies for multiple lifecycle messages, keep only the
// message that best reflects its current state. This prevents contradictory
// emails (for example, "generate your first image" and "credits are low")
// from being sent to the same customer in one or consecutive scheduled runs.
const LIFECYCLE_PRIORITY = [
  'purchase_onboarding',
  'credits_low_no_purchase',
  'checkout_no_purchase',
  'connect_no_first_image',
  'signup_no_connect',
];

function getActorAliases(event) {
  const aliases = [];
  if (event.user_id) aliases.push(`user:${event.user_id}`);
  if (event.user_email) aliases.push(`email:${String(event.user_email).toLowerCase()}`);
  if (event.anonymous_id) aliases.push(`anon:${event.anonymous_id}`);
  return aliases.length > 0
    ? aliases
    : [`event:${event.id || `${event.event_name}:${event.occurred_at}`}`];
}

function buildActorResolver(events) {
  const parent = new Map();

  function find(key) {
    if (!parent.has(key)) parent.set(key, key);
    const current = parent.get(key);
    if (current === key) return key;
    const root = find(current);
    parent.set(key, root);
    return root;
  }

  function union(a, b) {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootB, rootA);
  }

  for (const event of events) {
    const aliases = getActorAliases(event);
    aliases.forEach(alias => find(alias));
    aliases.slice(1).forEach(alias => union(aliases[0], alias));
  }

  return (event) => find(getActorAliases(event)[0]);
}

function getPreferredActorKey(actor) {
  if (actor.user_id) return `user:${actor.user_id}`;
  if (actor.user_email) return `email:${actor.user_email.toLowerCase()}`;
  return actor.key;
}

function buildLifecycleActors(events) {
  const resolveActorKey = buildActorResolver(events);
  const actors = new Map();

  for (const event of events) {
    const key = resolveActorKey(event);
    const actor = actors.get(key) || {
      key,
      user_id: null,
      user_email: null,
      anonymous_id: null,
      source: event.source || 'unknown',
      events: [],
      eventsByName: new Map(),
    };

    actor.user_id = actor.user_id || event.user_id || null;
    actor.user_email = actor.user_email || (event.user_email ? String(event.user_email).toLowerCase() : null);
    actor.anonymous_id = actor.anonymous_id || event.anonymous_id || null;
    actor.events.push(event);

    const eventList = actor.eventsByName.get(event.event_name) || [];
    eventList.push(event);
    actor.eventsByName.set(event.event_name, eventList);
    actors.set(key, actor);
  }

  for (const actor of actors.values()) {
    actor.events.sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at));
    for (const eventsForName of actor.eventsByName.values()) {
      eventsForName.sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at));
    }
  }

  return [...actors.values()];
}

function isTrustedTriggerEvent(event, rule) {
  const source = String(event.source || '').toLowerCase();
  if (rule.trustedSources.includes(source)) return true;

  return rule.allowVerifiedIdentity === true
    && event.properties?.identity_verified === true;
}

function getLatestTriggerEvent(actor, rule) {
  const events = actor.eventsByName.get(rule.trigger) || [];
  return [...events].reverse().find(event => isTrustedTriggerEvent(event, rule)) || null;
}

function hasAnyEventAfter(actor, eventNames, occurredAt) {
  const threshold = new Date(occurredAt).getTime();
  return eventNames.some(eventName => {
    const events = actor.eventsByName.get(eventName) || [];
    return events.some(event => new Date(event.occurred_at).getTime() >= threshold);
  });
}

function buildLifecycleCandidates(events, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const usageCountsByUserId = options.usageCountsByUserId instanceof Map
    ? options.usageCountsByUserId
    : new Map();
  const actors = buildLifecycleActors(events);
  const candidates = [];

  for (const actor of actors) {
    if (!actor.user_email) continue;

    for (const rule of LIFECYCLE_RULES) {
      const triggerEvent = getLatestTriggerEvent(actor, rule);
      if (!triggerEvent) continue;

      const triggerAt = new Date(triggerEvent.occurred_at || triggerEvent.created_at);
      const isMature = now.getTime() - triggerAt.getTime() >= rule.delayHours * 60 * 60 * 1000;
      if (!isMature) continue;

      // The WordPress plugin records usage in user_usage_stats but does not
      // emit the dashboard-only first_image_processed event. Keep scheduled
      // onboarding consistent with the admin test-send path by suppressing
      // this reminder once the user has generated any image.
      if (
        rule.key === 'connect_no_first_image'
        && actor.user_id
        && Number(usageCountsByUserId.get(String(actor.user_id)) || 0) > 0
      ) {
        continue;
      }

      if (rule.missingAfterTrigger.length > 0 && hasAnyEventAfter(actor, rule.missingAfterTrigger, triggerAt)) {
        continue;
      }

      candidates.push({
        automation_key: rule.key,
        actor_key: getPreferredActorKey(actor),
        user_id: actor.user_id,
        user_email: actor.user_email,
        source_event_id: triggerEvent.id,
        trigger_event_name: rule.trigger,
        trigger_occurred_at: triggerAt.toISOString(),
        subject: rule.subject,
        preview: rule.preview,
        cta_text: rule.ctaText,
        cta_url: rule.ctaUrl,
      });
    }
  }

  return candidates.sort((a, b) => new Date(a.trigger_occurred_at) - new Date(b.trigger_occurred_at));
}

function selectLifecycleCandidatePerActor(candidates) {
  const priorityByAutomation = new Map(
    LIFECYCLE_PRIORITY.map((automationKey, index) => [automationKey, index])
  );
  const selectedByActor = new Map();

  for (const candidate of candidates) {
    const actorKey = candidate.actor_key || candidate.user_id || candidate.user_email;
    if (!actorKey) continue;

    const current = selectedByActor.get(actorKey);
    if (!current) {
      selectedByActor.set(actorKey, candidate);
      continue;
    }

    const candidatePriority = priorityByAutomation.get(candidate.automation_key) ?? Number.MAX_SAFE_INTEGER;
    const currentPriority = priorityByAutomation.get(current.automation_key) ?? Number.MAX_SAFE_INTEGER;
    if (candidatePriority < currentPriority) {
      selectedByActor.set(actorKey, candidate);
    }
  }

  return [...selectedByActor.values()]
    .sort((a, b) => new Date(a.trigger_occurred_at) - new Date(b.trigger_occurred_at));
}

async function fetchAuthUsers(supabase, { perPage = 1000, maxPages = 100 } = {}) {
  const users = [];

  for (let page = 1; page <= maxPages + 1; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Failed to verify lifecycle recipients: ${error.message}`);
    }

    const batch = data?.users || [];
    if (page > maxPages) {
      if (batch.length === 0) return users;
      throw new Error('Failed to verify lifecycle recipients: auth user pagination limit reached');
    }

    users.push(...batch);
    if (batch.length < perPage) return users;
  }

  return users;
}

function filterCandidatesByAuthUsers(candidates, authUsers) {
  const emailsByUserId = new Map(
    authUsers
      .filter(user => user?.id && user?.email && user?.email_confirmed_at)
      .map(user => [String(user.id), String(user.email).trim().toLowerCase()])
  );

  return candidates.filter(candidate => {
    if (!candidate.user_id || !candidate.user_email) return false;
    return emailsByUserId.get(String(candidate.user_id)) === String(candidate.user_email).trim().toLowerCase();
  });
}

function renderLifecycleEmail(candidate, { unsubscribeUrl = getLifecycleUnsubscribeUrl(candidate) } = {}) {
  const unsubscribeHtml = unsubscribeUrl
    ? `<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#6B6B73;">Prefer not to receive these emails? <a href="${unsubscribeUrl}" style="color:#3F3F46;text-decoration:underline;">Unsubscribe</a>.</p>`
    : '';

  // Yellow + white layout from docs/design-system.md, inline styles only.
  const html = `
    <div style="margin:0;padding:32px 16px;background:#FFFBEA;font-family:Arial,'Helvetica Neue',sans-serif;color:#3F3F46;">
      <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #EFE3A3;border-radius:16px;overflow:hidden;">
        <div style="padding:28px 32px 8px;">
          <img src="https://www.alt-text.pro/logo-alt-text-pro.png" width="56" height="56" alt="Alt Text Pro" style="display:block;width:56px;height:56px;border:0;">
        </div>
        <div style="padding:12px 32px 32px;">
          <h1 style="margin:0 0 12px;font-size:22px;line-height:1.35;font-weight:700;color:#3F3F46;">${candidate.subject}</h1>
          <p style="margin:0;font-size:16px;line-height:1.6;color:#6B6B73;">${candidate.preview}</p>
          <a href="${candidate.cta_url}" style="display:inline-block;margin-top:24px;background:#FEE11C;color:#3F3F46;text-decoration:none;padding:14px 24px;border-radius:12px;font-size:16px;font-weight:700;line-height:1;">${candidate.cta_text}</a>
          <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#6B6B73;">Need help? Reply to this email and we will help you finish the setup.</p>
          ${unsubscribeHtml}
        </div>
      </div>
      <p style="max-width:560px;margin:16px auto 0;font-size:12px;line-height:1.6;color:#6B6B73;text-align:center;">You are receiving this because you started using Alt Text Pro.</p>
    </div>
  `;

  const text = [
    'Alt Text Pro',
    '',
    candidate.subject,
    candidate.preview,
    '',
    `${candidate.cta_text}: ${candidate.cta_url}`,
    '',
    'Need help? Reply to this email and we will help you finish the setup.',
    ...(unsubscribeUrl ? ['', `Unsubscribe: ${unsubscribeUrl}`] : []),
  ].join('\n');

  return { html, text };
}

/**
 * Full nodemailer options for one lifecycle email, including the
 * List-Unsubscribe / List-Unsubscribe-Post (RFC 8058 one-click) headers.
 */
function buildLifecycleMailOptions(candidate, { from, supportEmail } = {}) {
  const unsubscribeUrl = getLifecycleUnsubscribeUrl(candidate);
  const { html, text } = renderLifecycleEmail(candidate, { unsubscribeUrl });
  return {
    from,
    to: candidate.user_email,
    subject: candidate.subject,
    text,
    html,
    headers: getListUnsubscribeHeaders(unsubscribeUrl, supportEmail),
  };
}

// Only these events drive lifecycle rules. Page views make up most of the
// table, so leaving them out keeps the read small.
const LIFECYCLE_EVENT_NAMES = [...new Set(
  LIFECYCLE_RULES.flatMap(rule => [rule.trigger, ...rule.missingAfterTrigger])
)];

async function fetchRecentMarketingEvents(supabase, { days = 30 } = {}) {
  const startAt = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // fetchAllRows throws at its ceiling instead of silently dropping the
  // newest events, which used to hide recent purchases from the rules.
  return fetchAllRows(
    (from, to) => supabase
      .from('marketing_events')
      .select('id,event_name,source,anonymous_id,user_id,user_email,properties,occurred_at,created_at')
      .gte('occurred_at', startAt.toISOString())
      .in('event_name', LIFECYCLE_EVENT_NAMES)
      .order('occurred_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to),
    { label: 'lifecycle marketing events' }
  );
}

// PostgREST filters travel in the URL, so long ID lists are split.
const USAGE_ID_CHUNK_SIZE = 150;

/**
 * Usage counts by user ID. With userIds, only those users are read (the
 * scheduled run passes the users its connect rule needs); without, every row.
 */
async function fetchLifecycleUsageCounts(supabase, userIds = null) {
  const usageCountsByUserId = new Map();
  const addRows = (rows) => {
    for (const row of rows || []) {
      if (row?.user_id) {
        usageCountsByUserId.set(String(row.user_id), Number(row.total_usage_count || 0));
      }
    }
  };

  if (Array.isArray(userIds)) {
    const ids = [...new Set(userIds.filter(Boolean).map(String))];
    for (let index = 0; index < ids.length; index += USAGE_ID_CHUNK_SIZE) {
      const { data, error } = await supabase
        .from('user_usage_stats')
        .select('user_id,total_usage_count')
        .in('user_id', ids.slice(index, index + USAGE_ID_CHUNK_SIZE));
      if (error) throw new Error(`Failed to fetch lifecycle usage counts: ${error.message}`);
      addRows(data);
    }
    return usageCountsByUserId;
  }

  addRows(await fetchAllRows(
    (from, to) => supabase
      .from('user_usage_stats')
      .select('user_id,total_usage_count')
      .order('user_id', { ascending: true })
      .range(from, to),
    { label: 'lifecycle usage counts' }
  ));
  return usageCountsByUserId;
}

module.exports = {
  LIFECYCLE_EVENT_NAMES,
  LIFECYCLE_PRIORITY,
  LIFECYCLE_RULES,
  buildLifecycleActors,
  buildLifecycleMailOptions,
  buildLifecycleCandidates,
  fetchAuthUsers,
  fetchLifecycleUsageCounts,
  fetchRecentMarketingEvents,
  filterCandidatesByAuthUsers,
  isTrustedTriggerEvent,
  renderLifecycleEmail,
  selectLifecycleCandidatePerActor,
};
