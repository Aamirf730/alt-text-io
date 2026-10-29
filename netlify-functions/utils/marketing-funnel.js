const { fetchAllRows } = require('./paginated-query');
// In the order a customer moves through them: the plugin is downloaded
// before it can be connected.
const FUNNEL_STAGES = [
  { key: 'page_viewed', label: 'Visitor' },
  { key: 'demo_used', label: 'Demo used' },
  { key: 'signup_created', label: 'Signup created' },
  { key: 'plugin_downloaded', label: 'Plugin downloaded' },
  { key: 'connect_started', label: 'Connect started' },
  { key: 'connect_completed', label: 'Connect completed' },
  { key: 'checkout_started', label: 'Checkout started' },
  { key: 'purchase_completed', label: 'Purchase completed' },
];

// High-volume, anonymous events are aggregated in SQL and never loaded row by
// row (marketing_event_aggregates, migration 20261029120200).
const AGGREGATE_ONLY_EVENTS = ['page_viewed'];

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

/**
 * Funnel stages with conversion rates from per-stage counts
 * (Map key -> { events, unique_actors }).
 */
function buildStages(countsByKey, fallbackStartActors = 0) {
  const countFor = key => countsByKey.get(key) || { events: 0, unique_actors: 0 };
  const firstStageActors = countFor(FUNNEL_STAGES[0].key).unique_actors || fallbackStartActors;

  return FUNNEL_STAGES.map((stage, index) => {
    const uniqueActors = Number(countFor(stage.key).unique_actors || 0);
    const previousActors = index > 0 ? Number(countFor(FUNNEL_STAGES[index - 1].key).unique_actors || 0) : null;

    return {
      key: stage.key,
      label: stage.label,
      events: Number(countFor(stage.key).events || 0),
      unique_actors: uniqueActors,
      conversion_from_previous:
        previousActors && previousActors > 0 ? uniqueActors / previousActors : null,
      conversion_from_start:
        firstStageActors > 0 ? uniqueActors / firstStageActors : null,
    };
  });
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

  const stages = buildStages(new Map(FUNNEL_STAGES.map(stage => [stage.key, {
    events: stageEventCounts.get(stage.key) || 0,
    unique_actors: stageActorSets.get(stage.key)?.size || 0,
  }])), actors.size);

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

/**
 * Row-level events for actor-level analysis (dropoffs). Page views are left
 * out; their counts come from marketing_event_aggregates.
 */
async function fetchMarketingEvents(supabase, { startAt, endAt, excludeEventNames = AGGREGATE_ONLY_EVENTS } = {}) {
  // fetchAllRows throws at its ceiling instead of silently dropping the
  // newest events, which used to undercount recent conversions.
  return fetchAllRows(
    (from, to) => {
      let query = supabase
        .from('marketing_events')
        .select('id,event_name,source,anonymous_id,user_id,user_email,page_path,referrer,occurred_at,created_at')
        .gte('occurred_at', startAt.toISOString())
        .lt('occurred_at', endAt.toISOString());
      if (excludeEventNames.length > 0) {
        query = query.not('event_name', 'in', `(${excludeEventNames.join(',')})`);
      }
      return query
        .order('occurred_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to);
    },
    { label: 'marketing funnel events' }
  );
}

async function fetchEventAggregates(supabase, { startAt, endAt }) {
  const { data, error } = await supabase.rpc('marketing_event_aggregates', {
    p_start_at: startAt.toISOString(),
    p_end_at: endAt.toISOString(),
    p_top_limit: 8,
  });
  if (error) throw new Error(`Failed to aggregate marketing events: ${error.message}`);
  return data || {};
}

function countsFromAggregates(aggregates) {
  return new Map(Object.entries(aggregates?.by_event || {}).map(([key, value]) => [key, {
    events: Number(value?.events || 0),
    unique_actors: Number(value?.unique_actors || 0),
  }]));
}

/**
 * Replace the row-derived counts with the SQL aggregates, which include
 * page views. Dropoffs stay row-derived.
 */
function applyAggregates(report, aggregates) {
  const counts = countsFromAggregates(aggregates);
  const dailyByDate = new Map((aggregates?.daily || []).map(day => [day.date, day]));

  return {
    ...report,
    totals: {
      ...report.totals,
      events: Number(aggregates?.events || 0),
      unique_actors: Number(aggregates?.unique_actors || 0),
      known_users: Number(aggregates?.known_users ?? report.totals.known_users),
    },
    stages: buildStages(counts, Number(aggregates?.unique_actors || 0)),
    daily_series: report.daily_series.map(day => {
      const aggregate = dailyByDate.get(day.date);
      if (!aggregate) {
        return { ...day, total_events: 0, unique_actors: 0, events: Object.fromEntries(FUNNEL_STAGES.map(stage => [stage.key, 0])) };
      }
      return {
        date: day.date,
        total_events: Number(aggregate.total_events || 0),
        unique_actors: Number(aggregate.unique_actors || 0),
        events: Object.fromEntries(FUNNEL_STAGES.map(stage => [stage.key, Number(aggregate.events?.[stage.key] || 0)])),
      };
    }),
    event_counts: rankEntries([...counts.entries()].map(([key, value]) => [key, value.events]), 20),
    top_sources: aggregates?.top_sources || [],
    top_referrers: aggregates?.top_referrers || [],
    top_pages: aggregates?.top_pages || [],
  };
}

function summaryFromAggregates(aggregates, { startAt, endAt }) {
  return {
    range: { start_at: startAt.toISOString(), end_at: endAt.toISOString(), timezone: 'UTC' },
    totals: {
      events: Number(aggregates?.events || 0),
      unique_actors: Number(aggregates?.unique_actors || 0),
    },
    stages: buildStages(countsFromAggregates(aggregates), Number(aggregates?.unique_actors || 0)),
  };
}

async function getMarketingFunnelReport(supabase, options = {}) {
  const days = parsePositiveInt(options.days, 7, 1, 90);
  const endAt = options.endAt ? new Date(options.endAt) : new Date();
  const startAt = options.startAt
    ? new Date(options.startAt)
    : new Date(endAt.getTime() - days * 86400000);
  const previousStartAt = new Date(startAt.getTime() - (endAt.getTime() - startAt.getTime()));

  const [events, aggregates, previousAggregates] = await Promise.all([
    fetchMarketingEvents(supabase, { startAt, endAt }),
    fetchEventAggregates(supabase, { startAt, endAt }),
    fetchEventAggregates(supabase, { startAt: previousStartAt, endAt: startAt }),
  ]);

  const rowReport = buildMarketingFunnelReport(events, {
    startAt,
    endAt,
    generatedAt: options.generatedAt,
  });
  const current = applyAggregates(rowReport, aggregates);
  const previous = summaryFromAggregates(previousAggregates, { startAt: previousStartAt, endAt: startAt });

  return {
    ...current,
    comparison: compareReports(current, previous),
  };
}

function formatSignedNumber(value) {
  const number = Number(value || 0);
  return number > 0 ? `+${number}` : String(number);
}

function formatChange(stageComparison) {
  if (!stageComparison) return 'N/A';
  const delta = formatSignedNumber(stageComparison.unique_actors_delta);
  if (stageComparison.unique_actors_change === null || stageComparison.unique_actors_change === undefined) {
    return `${delta} (new)`;
  }
  const percent = Math.round(stageComparison.unique_actors_change * 1000) / 10;
  return `${delta} (${percent > 0 ? '+' : ''}${percent}%)`;
}

function comparisonFor(report, key) {
  return (report.comparison?.stages || []).find(stage => stage.key === key) || null;
}

function renderOperationsText(operations) {
  if (!operations) return [];
  return [
    '',
    'Operations:',
    `Unmatched payments awaiting assignment: ${operations.unresolved_reconciliations ?? 'unknown'}`,
    `Polar cancellations pending after account deletion: ${operations.pending_subscription_cancellations ?? 'unknown'}`,
  ];
}

function renderFunnelReportText(report) {
  const lines = [
    'Alt Text Pro daily funnel report',
    `Generated: ${formatDateTime(report.generated_at)} UTC`,
    `Range: ${formatDateTime(report.range.start_at)} to ${formatDateTime(report.range.end_at)} UTC`,
    '',
    `Total events: ${report.totals.events} (${formatSignedNumber(report.comparison?.totals?.events_delta)} vs previous period)`,
    `Unique actors: ${report.totals.unique_actors} (${formatSignedNumber(report.comparison?.totals?.unique_actors_delta)} vs previous period)`,
    '',
    'Funnel (actors vs the previous period):',
    ...report.stages.map(stage =>
      `${stage.label}: ${stage.unique_actors} actors (${formatChange(comparisonFor(report, stage.key))}), ${stage.events} events, ${formatPercent(stage.conversion_from_previous)} from previous stage`
    ),
    '',
    'Dropoffs:',
    ...report.dropoffs.map(dropoff => `${dropoff.label}: ${dropoff.count}`),
    ...renderOperationsText(report.operations),
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
      <td style="padding:8px 10px;border-bottom:1px solid #EFE3A3;">${escapeHtml(stage.label)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #EFE3A3;text-align:right;">${stage.unique_actors}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #EFE3A3;text-align:right;">${escapeHtml(formatChange(comparisonFor(report, stage.key)))}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #EFE3A3;text-align:right;">${stage.events}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #EFE3A3;text-align:right;">${formatPercent(stage.conversion_from_previous)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #EFE3A3;text-align:right;">${formatPercent(stage.conversion_from_start)}</td>
    </tr>
  `).join('');

  const operations = report.operations;
  const operationsHtml = operations ? `
      <h2 style="color:#3F3F46;margin-top:24px;">Operations</h2>
      <ul>
        <li style="margin:6px 0;"><strong>Unmatched payments awaiting assignment:</strong> ${escapeHtml(operations.unresolved_reconciliations ?? 'unknown')}</li>
        <li style="margin:6px 0;"><strong>Polar cancellations pending after account deletion:</strong> ${escapeHtml(operations.pending_subscription_cancellations ?? 'unknown')}</li>
      </ul>` : '';

  const dropoffs = report.dropoffs.map(dropoff => `
    <li style="margin:6px 0;"><strong>${escapeHtml(dropoff.label)}:</strong> ${dropoff.count}</li>
  `).join('');

  return `
    <div style="font-family:Arial,sans-serif;max-width:760px;margin:0 auto;color:#3F3F46;">
      <h1 style="color:#3F3F46;">Alt Text Pro daily funnel report</h1>
      <p style="color:#6B6B73;">${escapeHtml(formatDateTime(report.range.start_at))} to ${escapeHtml(formatDateTime(report.range.end_at))} UTC</p>
      <div style="display:flex;gap:12px;margin:20px 0;">
        <div style="padding:14px 16px;background:#FFF3B0;border:1px solid #FEE11C;border-radius:8px;">
          <div style="font-size:12px;text-transform:uppercase;color:#3F3F46;">Events</div>
          <div style="font-size:28px;font-weight:700;">${report.totals.events}</div>
          <div style="font-size:12px;color:#6B6B73;">${escapeHtml(formatSignedNumber(report.comparison?.totals?.events_delta))} vs previous</div>
        </div>
        <div style="padding:14px 16px;background:#FFFBEA;border:1px solid #EFE3A3;border-radius:8px;">
          <div style="font-size:12px;text-transform:uppercase;color:#3F3F46;">Unique actors</div>
          <div style="font-size:28px;font-weight:700;">${report.totals.unique_actors}</div>
          <div style="font-size:12px;color:#6B6B73;">${escapeHtml(formatSignedNumber(report.comparison?.totals?.unique_actors_delta))} vs previous</div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #EFE3A3;">
        <thead style="background:#FFFBEA;">
          <tr>
            <th style="padding:8px 10px;text-align:left;">Stage</th>
            <th style="padding:8px 10px;text-align:right;">Actors</th>
            <th style="padding:8px 10px;text-align:right;">vs previous</th>
            <th style="padding:8px 10px;text-align:right;">Events</th>
            <th style="padding:8px 10px;text-align:right;">Previous</th>
            <th style="padding:8px 10px;text-align:right;">Start</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <h2 style="color:#3F3F46;margin-top:24px;">Dropoffs</h2>
      <ul>${dropoffs}</ul>
      ${operationsHtml}
    </div>
  `;
}

module.exports = {
  AGGREGATE_ONLY_EVENTS,
  FUNNEL_STAGES,
  DROPOFFS,
  parsePositiveInt,
  applyAggregates,
  buildMarketingFunnelReport,
  buildStages,
  compareReports,
  fetchMarketingEvents,
  getMarketingFunnelReport,
  renderFunnelReportText,
  renderFunnelReportHtml,
};
