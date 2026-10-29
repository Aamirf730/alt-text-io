import { describe, expect, it } from 'vitest';

const { buildMarketingFunnelReport } = require('./marketing-funnel.js');

describe('marketing funnel reporting', () => {
  it('counts unique actors by funnel stage and conversion rate', () => {
    const report = buildMarketingFunnelReport([
      {
        id: '1',
        event_name: 'page_viewed',
        anonymous_id: 'anon-a',
        source: 'landing_page',
        page_path: '/',
        occurred_at: '2026-06-25T00:00:00.000Z',
      },
      {
        id: '2',
        event_name: 'demo_used',
        anonymous_id: 'anon-a',
        source: 'landing_page',
        page_path: '/',
        occurred_at: '2026-06-25T00:05:00.000Z',
      },
      {
        id: '3',
        event_name: 'signup_created',
        user_id: 'user-a',
        user_email: 'buyer@example.com',
        anonymous_id: 'anon-a',
        source: 'landing_page',
        occurred_at: '2026-06-25T00:10:00.000Z',
      },
      {
        id: '4',
        event_name: 'checkout_started',
        user_id: 'user-a',
        user_email: 'buyer@example.com',
        source: 'dashboard',
        occurred_at: '2026-06-25T00:20:00.000Z',
      },
      {
        id: '5',
        event_name: 'purchase_completed',
        user_id: 'user-a',
        user_email: 'buyer@example.com',
        source: 'polar_webhook',
        occurred_at: '2026-06-25T00:30:00.000Z',
      },
      {
        id: '6',
        event_name: 'page_viewed',
        anonymous_id: 'anon-b',
        source: 'landing_page',
        page_path: '/',
        occurred_at: '2026-06-25T01:00:00.000Z',
      },
    ], {
      startAt: '2026-06-25T00:00:00.000Z',
      endAt: '2026-06-26T00:00:00.000Z',
      generatedAt: '2026-06-26T00:00:00.000Z',
    });

    const visitor = report.stages.find(stage => stage.key === 'page_viewed');
    const demo = report.stages.find(stage => stage.key === 'demo_used');
    const purchase = report.stages.find(stage => stage.key === 'purchase_completed');

    expect(report.totals.events).toBe(6);
    expect(report.totals.unique_actors).toBe(2);
    expect(visitor.unique_actors).toBe(2);
    expect(demo.unique_actors).toBe(1);
    expect(demo.conversion_from_previous).toBe(0.5);
    expect(purchase.unique_actors).toBe(1);
  });

  it('reports lifecycle dropoffs with recent sample actors', () => {
    const report = buildMarketingFunnelReport([
      {
        id: '1',
        event_name: 'signup_created',
        user_id: 'user-no-connect',
        user_email: 'lead@example.com',
        source: 'landing_page',
        occurred_at: '2026-06-25T00:00:00.000Z',
      },
      {
        id: '2',
        event_name: 'connect_completed',
        user_id: 'user-no-checkout',
        user_email: 'connected@example.com',
        source: 'wordpress_connect',
        occurred_at: '2026-06-25T01:00:00.000Z',
      },
      {
        id: '3',
        event_name: 'checkout_started',
        user_id: 'user-no-purchase',
        user_email: 'checkout@example.com',
        source: 'dashboard',
        occurred_at: '2026-06-25T02:00:00.000Z',
      },
    ], {
      startAt: '2026-06-25T00:00:00.000Z',
      endAt: '2026-06-26T00:00:00.000Z',
      generatedAt: '2026-06-26T00:00:00.000Z',
    });

    const signupDropoff = report.dropoffs.find(dropoff => dropoff.key === 'signup_no_connect');
    const connectDropoff = report.dropoffs.find(dropoff => dropoff.key === 'connect_no_checkout');
    const checkoutDropoff = report.dropoffs.find(dropoff => dropoff.key === 'checkout_no_purchase');

    expect(signupDropoff.count).toBe(1);
    expect(signupDropoff.sample[0].email).toBe('lead@example.com');
    expect(connectDropoff.count).toBe(1);
    expect(checkoutDropoff.count).toBe(1);
  });
});

describe('marketing funnel stage order and SQL aggregates', () => {
  const {
    FUNNEL_STAGES,
    applyAggregates,
    compareReports,
    renderFunnelReportText,
    renderFunnelReportHtml,
  } = require('./marketing-funnel.js');

  it('puts plugin download before connect', () => {
    const keys = FUNNEL_STAGES.map(stage => stage.key);
    expect(keys.indexOf('plugin_downloaded')).toBeLessThan(keys.indexOf('connect_started'));
    expect(keys.indexOf('connect_started')).toBeLessThan(keys.indexOf('connect_completed'));
  });

  it('takes counts from SQL aggregates (page views included) and keeps row-based dropoffs', () => {
    const rowReport = buildMarketingFunnelReport([
      { id: '1', event_name: 'signup_created', user_id: 'u1', user_email: 'a@example.com', occurred_at: '2026-06-25T01:00:00.000Z' },
    ], { startAt: '2026-06-25T00:00:00.000Z', endAt: '2026-06-26T00:00:00.000Z', generatedAt: '2026-06-26T00:00:00.000Z' });

    const report = applyAggregates(rowReport, {
      events: 150001,
      unique_actors: 40000,
      by_event: {
        page_viewed: { events: 150000, unique_actors: 40000 },
        signup_created: { events: 1, unique_actors: 1 },
      },
      daily: [{ date: '2026-06-25', total_events: 150001, unique_actors: 40000, events: { page_viewed: 150000, signup_created: 1 } }],
      top_pages: [{ label: '/', count: 150000 }],
    });

    expect(report.totals.events).toBe(150001);
    expect(report.stages.find(stage => stage.key === 'page_viewed').unique_actors).toBe(40000);
    expect(report.stages.find(stage => stage.key === 'signup_created').conversion_from_start).toBeCloseTo(1 / 40000);
    expect(report.daily_series[0].events.page_viewed).toBe(150000);
    expect(report.top_pages[0]).toEqual({ label: '/', count: 150000 });
    expect(report.dropoffs.find(dropoff => dropoff.key === 'signup_no_connect').count).toBe(1);
  });

  it('shows the period comparison and operator queues in the email', () => {
    const current = buildMarketingFunnelReport([
      { id: '1', event_name: 'signup_created', user_id: 'u1', occurred_at: '2026-06-25T01:00:00.000Z' },
      { id: '2', event_name: 'signup_created', user_id: 'u2', occurred_at: '2026-06-25T02:00:00.000Z' },
    ], { startAt: '2026-06-25T00:00:00.000Z', endAt: '2026-06-26T00:00:00.000Z', generatedAt: '2026-06-26T00:00:00.000Z' });
    const previous = buildMarketingFunnelReport([
      { id: '3', event_name: 'signup_created', user_id: 'u3', occurred_at: '2026-06-24T01:00:00.000Z' },
    ], { startAt: '2026-06-24T00:00:00.000Z', endAt: '2026-06-25T00:00:00.000Z', generatedAt: '2026-06-26T00:00:00.000Z' });
    const report = {
      ...current,
      comparison: compareReports(current, previous),
      operations: { unresolved_reconciliations: 3, pending_subscription_cancellations: 0 },
    };

    const text = renderFunnelReportText(report);
    const html = renderFunnelReportHtml(report);

    expect(text).toContain('Signup created: 2 actors (+1 (+100%))');
    expect(text).toContain('Unmatched payments awaiting assignment: 3');
    expect(html).toContain('vs previous');
    expect(html).toContain('Unmatched payments awaiting assignment:</strong> 3');
  });
});
