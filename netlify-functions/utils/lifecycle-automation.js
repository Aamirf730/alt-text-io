const SITE_URL = 'https://www.alt-text.pro';

const LIFECYCLE_RULES = [
  {
    key: 'signup_no_connect',
    trigger: 'signup_created',
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
    missingAfterTrigger: ['purchase_completed'],
    delayHours: 0,
    subject: 'Your Alt Text Pro credits are running low',
    preview: 'Add credits or upgrade your plan before your image workflow slows down.',
    ctaText: 'Add Credits',
    ctaUrl: `${SITE_URL}/dashboard`,
  },
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

function getLatestEvent(actor, eventName) {
  const events = actor.eventsByName.get(eventName) || [];
  return events[events.length - 1] || null;
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
  const actors = buildLifecycleActors(events);
  const candidates = [];

  for (const actor of actors) {
    if (!actor.user_email) continue;

    for (const rule of LIFECYCLE_RULES) {
      const triggerEvent = getLatestEvent(actor, rule.trigger);
      if (!triggerEvent) continue;

      const triggerAt = new Date(triggerEvent.occurred_at || triggerEvent.created_at);
      const isMature = now.getTime() - triggerAt.getTime() >= rule.delayHours * 60 * 60 * 1000;
      if (!isMature) continue;

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

function renderLifecycleEmail(candidate) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#0f172a;">
      <div style="padding:24px 0;border-bottom:1px solid #e5e7eb;">
        <h1 style="margin:0;color:#0D4F5E;font-size:26px;">Alt Text Pro</h1>
      </div>
      <div style="padding:28px 0;">
        <h2 style="margin:0 0 12px;font-size:22px;color:#0f172a;">${candidate.subject}</h2>
        <p style="font-size:16px;line-height:1.6;color:#475569;">${candidate.preview}</p>
        <a href="${candidate.cta_url}" style="display:inline-block;margin-top:16px;background:#0D4F5E;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700;">${candidate.cta_text}</a>
        <p style="margin-top:24px;font-size:14px;color:#64748b;">Need help? Reply to this email and we will help you finish the setup.</p>
      </div>
      <div style="padding-top:16px;border-top:1px solid #e5e7eb;color:#94a3b8;font-size:12px;">
        You are receiving this because you started using Alt Text Pro.
      </div>
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
  ].join('\n');

  return { html, text };
}

async function fetchRecentMarketingEvents(supabase, { days = 30, maxRows = 10000 } = {}) {
  const startAt = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const pageSize = 1000;
  const events = [];

  for (let from = 0; from < maxRows; from += pageSize) {
    const to = Math.min(from + pageSize - 1, maxRows - 1);
    const { data, error } = await supabase
      .from('marketing_events')
      .select('id,event_name,source,anonymous_id,user_id,user_email,properties,page_path,referrer,occurred_at,created_at')
      .gte('occurred_at', startAt.toISOString())
      .order('occurred_at', { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch marketing events: ${error.message}`);
    }

    events.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }

  return events;
}

module.exports = {
  LIFECYCLE_RULES,
  buildLifecycleActors,
  buildLifecycleCandidates,
  fetchRecentMarketingEvents,
  renderLifecycleEmail,
};
