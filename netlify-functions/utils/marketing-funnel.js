const { fetchAllRows } = require('./paginated-query');
const FUNNEL_STAGES = [
  { key: 'page_viewed', label: 'Visitor' },
  { key: 'demo_used', label: 'Demo used' },
  { key: 'signup_created', label: 'Signup created' },
  { key: 'connect_started', label: 'Connect started' },
  { key: 'connect_completed', label: 'Connect completed' },
  { key: 'plugin_downloaded', label: 'Plugin downloaded' },
  { key: 'checkout_started', label: 'Checkout started' },
  { key: 'purchase_completed', label: 'Purchase completed' },
];

const DROPOFFS = [
  {
    key: 'signup_no_connect',
    label: 'Signup but no plugin connect',
    has: ['signup_created'],
    missing: ['connect_completed'],
  },
  {
    key: 'connect_no_checkout',
    label: 'Connected but no checkout',
    has: ['connect_completed'],
    missing: ['checkout_started', 'purchase_completed'],
  },
  {
    key: 'checkout_no_purchase',
    label: 'Checkout started but no purchase',
    has: ['checkout_started'],
    missing: ['purchase_completed'],
  },
  {
    key: 'plugin_no_first_image',
    label: 'Plugin downloaded but no web app image generation',
    has: ['plugin_downloaded'],
    missing: ['first_image_processed'],
  },
  {
    key: 'credits_low_no_purchase',
    label: 'Low credits but no purchase',
    has: ['credits_low'],
    missing: ['purchase_completed'],
  },
];

function parsePositiveInt(value, fallback, min = 1, max = 90) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function toIsoDateKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'N/A';
  return `${Math.round(value * 1000) / 10}%`;
}

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

function rankEntries(entries, limit = 8) {
  return [...entries]
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

function increment(map, key, amount = 1) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + amount);
}

function buildDateKeys(startAt, endAt) {
  const keys = [];
  const cursor = new Date(Date.UTC(
    startAt.getUTCFullYear(),
    startAt.getUTCMonth(),
    startAt.getUTCDate()
  ));
  const end = new Date(Date.UTC(
    endAt.getUTCFullYear(),
    endAt.getUTCMonth(),
    endAt.getUTCDate()
  ));

  while (cursor <= end) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return keys;
}

function buildMarketingFunnelReport(events, options = {}) {
  const now = options.generatedAt ? new Date(options.generatedAt) : new Date();
  const startAt = options.startAt ? new Date(options.startAt) : new Date(now.getTime() - 7 * 86400000);
  const endAt = options.endAt ? new Date(options.endAt) : now;
  const resolveActorKey = buildActorResolver(events);

  const stageActorSets = new Map(FUNNEL_STAGES.map(stage => [stage.key, new Set()]));
  const stageEventCounts = new Map(FUNNEL_STAGES.map(stage => [stage.key, 0]));
  const eventCounts = new Map();
  const sourceCounts = new Map();
  const referrerCounts = new Map();
  const pageCounts = new Map();
  const actors = new Map();
  const daily = new Map(buildDateKeys(startAt, endAt).map(date => [date, {
    date,
    total_events: 0,
    unique_actors: new Set(),
    events: Object.fromEntries(FUNNEL_STAGES.map(stage => [stage.key, 0])),
  }]));

  for (const event of events) {
    const eventName = event.event_name;
    const actorKey = resolveActorKey(event);
    const occurredAt = event.occurred_at || event.created_at || now.toISOString();
    const dateKey = toIsoDateKey(occurredAt);

    increment(eventCounts, eventName);
    increment(sourceCounts, event.source || 'unknown');
    increment(referrerCounts, event.referrer || event.properties?.referrer || 'direct');
    increment(pageCounts, event.page_path || event.properties?.path || 'unknown');

    const actor = actors.get(actorKey) || {
      key: actorKey,
      user_id: event.user_id || null,
      user_email: event.user_email || null,
      anonymous_id: event.anonymous_id || null,
      source: event.source || 'unknown',
      first_seen_at: occurredAt,
      last_seen_at: occurredAt,
      events: new Set(),
    };

    actor.user_id = actor.user_id || event.user_id || null;
    actor.user_email = actor.user_email || event.user_email || null;
    actor.anonymous_id = actor.anonymous_id || event.anonymous_id || null;
    actor.events.add(eventName);
    if (new Date(occurredAt) < new Date(actor.first_seen_at)) actor.first_seen_at = occurredAt;
    if (new Date(occurredAt) > new Date(actor.last_seen_at)) actor.last_seen_at = occurredAt;
    actors.set(actorKey, actor);

    if (stageActorSets.has(eventName)) {
      stageActorSets.get(eventName).add(actorKey);
      stageEventCounts.set(eventName, (stageEventCounts.get(eventName) || 0) + 1);
    }

    const day = daily.get(dateKey);
    if (day) {
      day.total_events += 1;
      day.unique_actors.add(actorKey);
      if (day.events[eventName] !== undefined) {
        day.events[eventName] += 1;
      }
    }
  }

  const firstStageActors = stageActorSets.get(FUNNEL_STAGES[0].key)?.size || actors.size;
  const stages = FUNNEL_STAGES.map((stage, index) => {
    const uniqueActors = stageActorSets.get(stage.key)?.size || 0;
    const previousStage = index > 0 ? FUNNEL_STAGES[index - 1] : null;
    const previousActors = previousStage ? (stageActorSets.get(previousStage.key)?.size || 0) : null;

    return {
      key: stage.key,
      label: stage.label,
      events: stageEventCounts.get(stage.key) || 0,
      unique_actors: uniqueActors,
      conversion_from_previous:
        previousActors && previousActors > 0 ? uniqueActors / previousActors : null,
      conversion_from_start:
        firstStageActors > 0 ? uniqueActors / firstStageActors : null,
    };
  });

  const actorList = [...actors.values()];
  const dropoffs = DROPOFFS.map(dropoff => {
    const matches = actorList.filter(actor => {
      const hasRequired = dropoff.has.every(eventName => actor.events.has(eventName));
      const hasMissing = dropoff.missing.some(eventName => actor.events.has(eventName));
      return hasRequired && !hasMissing;
    });

    return {
      key: dropoff.key,
      label: dropoff.label,
      count: matches.length,
      sample: matches
        .sort((a, b) => new Date(b.last_seen_at) - new Date(a.last_seen_at))
        .slice(0, 8)
        .map(actor => ({
          email: actor.user_email,
          user_id: actor.user_id,
          anonymous_id: actor.anonymous_id,
          source: actor.source,
          last_seen_at: actor.last_seen_at,
        })),
    };
  });

  const daily_series = [...daily.values()].map(day => ({
    ...day,
    unique_actors: day.unique_actors.size,
  }));

  return {
    generated_at: now.toISOString(),
    range: {
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      timezone: 'UTC',
    },
    totals: {
      events: events.length,
      unique_actors: actors.size,
      known_users: actorList.filter(actor => actor.user_id).length,
      known_emails: actorList.filter(actor => actor.user_email).length,
    },
    stages,
    dropoffs,
    daily_series,
    event_counts: rankEntries(eventCounts, 20),
    top_sources: rankEntries(sourceCounts),
    top_referrers: rankEntries(referrerCounts),
    top_pages: rankEntries(pageCounts),
  };
}

function compareReports(current, previous) {
  const previousStages = new Map(previous.stages.map(stage => [stage.key, stage]));

  return {
    previous_range: previous.range,
    totals: {
      events_delta: current.totals.events - previous.totals.events,
      unique_actors_delta: current.totals.unique_actors - previous.totals.unique_actors,
    },
    stages: current.stages.map(stage => {
      const previousStage = previousStages.get(stage.key);
      const previousActors = previousStage?.unique_actors || 0;
      const actorDelta = stage.unique_actors - previousActors;

      return {
        key: stage.key,
        label: stage.label,
        unique_actors_delta: actorDelta,
        unique_actors_change:
          previousActors > 0 ? actorDelta / previousActors : null,
      };
    }),
  };
}

async function fetchMarketingEvents(supabase, { startAt, endAt }) {
  // fetchAllRows throws at its ceiling instead of silently dropping the
  // newest events, which used to undercount recent conversions.
  return fetchAllRows(
    (from, to) => supabase
      .from('marketing_events')
      .select('id,event_name,source,anonymous_id,user_id,user_email,properties,page_path,referrer,occurred_at,created_at')
      .gte('occurred_at', startAt.toISOString())
      .lt('occurred_at', endAt.toISOString())
      .order('occurred_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to),
    { label: 'marketing funnel events' }
  );
}

async function getMarketingFunnelReport(supabase, options = {}) {
  const days = parsePositiveInt(options.days, 7, 1, 90);
  const endAt = options.endAt ? new Date(options.endAt) : new Date();
  const startAt = options.startAt
    ? new Date(options.startAt)
    : new Date(endAt.getTime() - days * 86400000);
  const previousStartAt = new Date(startAt.getTime() - (endAt.getTime() - startAt.getTime()));

  const [events, previousEvents] = await Promise.all([
    fetchMarketingEvents(supabase, { startAt, endAt, maxRows: options.maxRows || 10000 }),
    fetchMarketingEvents(supabase, {
      startAt: previousStartAt,
      endAt: startAt,
      maxRows: options.maxRows || 10000,
    }),
  ]);

  const current = buildMarketingFunnelReport(events, {
    startAt,
    endAt,
    generatedAt: options.generatedAt,
  });
  const previous = buildMarketingFunnelReport(previousEvents, {
    startAt: previousStartAt,
    endAt: startAt,
    generatedAt: options.generatedAt,
  });

  return {
    ...current,
    comparison: compareReports(current, previous),
  };
}

function renderFunnelReportText(report) {
  const lines = [
    'Alt Text Pro daily funnel report',
    `Generated: ${formatDateTime(report.generated_at)} UTC`,
    `Range: ${formatDateTime(report.range.start_at)} to ${formatDateTime(report.range.end_at)} UTC`,
    '',
    `Total events: ${report.totals.events}`,
    `Unique actors: ${report.totals.unique_actors}`,
    '',
    'Funnel:',
    ...report.stages.map(stage =>
      `${stage.label}: ${stage.unique_actors} actors, ${stage.events} events, ${formatPercent(stage.conversion_from_previous)} from previous`
    ),
    '',
    'Dropoffs:',
    ...report.dropoffs.map(dropoff => `${dropoff.label}: ${dropoff.count}`),
  ];

  return lines.join('\n');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderFunnelReportHtml(report) {
  const rows = report.stages.map(stage => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(stage.label)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">${stage.unique_actors}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">${stage.events}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatPercent(stage.conversion_from_previous)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatPercent(stage.conversion_from_start)}</td>
    </tr>
  `).join('');

  const dropoffs = report.dropoffs.map(dropoff => `
    <li style="margin:6px 0;"><strong>${escapeHtml(dropoff.label)}:</strong> ${dropoff.count}</li>
  `).join('');

  return `
    <div style="font-family:Arial,sans-serif;max-width:760px;margin:0 auto;color:#000000;">
      <h1 style="color:#000000;">Alt Text Pro daily funnel report</h1>
      <p style="color:#475569;">${escapeHtml(formatDateTime(report.range.start_at))} to ${escapeHtml(formatDateTime(report.range.end_at))} UTC</p>
      <div style="display:flex;gap:12px;margin:20px 0;">
        <div style="padding:14px 16px;background:#FFF9C4;border:1px solid #FEE11C;border-radius:8px;">
          <div style="font-size:12px;text-transform:uppercase;color:#000000;">Events</div>
          <div style="font-size:28px;font-weight:700;">${report.totals.events}</div>
        </div>
        <div style="padding:14px 16px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;">
          <div style="font-size:12px;text-transform:uppercase;color:#000000;">Unique actors</div>
          <div style="font-size:28px;font-weight:700;">${report.totals.unique_actors}</div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;">
        <thead style="background:#f8fafc;">
          <tr>
            <th style="padding:8px 10px;text-align:left;">Stage</th>
            <th style="padding:8px 10px;text-align:right;">Actors</th>
            <th style="padding:8px 10px;text-align:right;">Events</th>
            <th style="padding:8px 10px;text-align:right;">Previous</th>
            <th style="padding:8px 10px;text-align:right;">Start</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <h2 style="color:#000000;margin-top:24px;">Dropoffs</h2>
      <ul>${dropoffs}</ul>
    </div>
  `;
}

module.exports = {
  FUNNEL_STAGES,
  DROPOFFS,
  parsePositiveInt,
  buildMarketingFunnelReport,
  compareReports,
  fetchMarketingEvents,
  getMarketingFunnelReport,
  renderFunnelReportText,
  renderFunnelReportHtml,
};
