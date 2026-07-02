import { describe, expect, it } from 'vitest';

const { buildLifecycleStatusReport } = require('./lifecycle-status.js');

describe('lifecycle status report', () => {
  it('classifies signup users who have not connected the plugin', () => {
    const report = buildLifecycleStatusReport({
      profiles: [{
        id: 'user-1',
        email: 'lead@example.com',
        subscription_plan: 'free',
        subscription_status: 'active',
        credits_remaining: 30,
        total_processed: 0,
        created_at: '2026-06-27T00:00:00.000Z',
      }],
      events: [{
        id: 'event-1',
        event_name: 'signup_created',
        user_id: 'user-1',
        user_email: 'lead@example.com',
        occurred_at: '2026-06-27T00:00:00.000Z',
      }],
      usageStats: [],
      automationSends: [],
    });

    expect(report.summary.needs_plugin_reminder).toBe(1);
    expect(report.users[0].follow_up_status).toBe('Needs plugin reminder');
  });

  it('classifies connected users without usage as first-generation follow-up candidates', () => {
    const report = buildLifecycleStatusReport({
      profiles: [{
        id: 'user-1',
        email: 'lead@example.com',
        subscription_plan: 'free',
        subscription_status: 'active',
        credits_remaining: 30,
        total_processed: 0,
        created_at: '2026-06-27T00:00:00.000Z',
      }],
      events: [{
        id: 'event-1',
        event_name: 'connect_completed',
        source: 'wordpress_plugin_auth',
        user_id: 'user-1',
        user_email: 'lead@example.com',
        occurred_at: '2026-06-27T01:00:00.000Z',
      }],
      usageStats: [],
      automationSends: [],
    });

    expect(report.summary.plugin_connected).toBe(1);
    expect(report.summary.needs_first_generation_reminder).toBe(1);
    expect(report.users[0].plugin_connection_source).toBe('wordpress_plugin_auth');
  });

  it('classifies users with usage as active and includes latest follow-up state', () => {
    const report = buildLifecycleStatusReport({
      profiles: [{
        id: 'user-1',
        email: 'lead@example.com',
        subscription_plan: 'free',
        subscription_status: 'active',
        credits_remaining: 28,
        total_processed: 2,
        created_at: '2026-06-27T00:00:00.000Z',
      }],
      events: [{
        id: 'event-1',
        event_name: 'connect_completed',
        source: 'wordpress_plugin_auth',
        user_id: 'user-1',
        user_email: 'lead@example.com',
        occurred_at: '2026-06-27T01:00:00.000Z',
      }],
      usageStats: [{
        user_id: 'user-1',
        total_usage_count: 2,
        total_credits_used: 2,
        last_usage_at: '2026-06-27T02:00:00.000Z',
      }],
      automationSends: [{
        id: 'send-1',
        automation_key: 'connect_no_first_image',
        user_id: 'user-1',
        user_email: 'lead@example.com',
        status: 'sent',
        subject: 'Generate your first image alt text',
        sent_at: '2026-06-27T01:30:00.000Z',
        created_at: '2026-06-27T01:29:00.000Z',
      }],
    });

    expect(report.summary.first_generation).toBe(1);
    expect(report.users[0].follow_up_status).toBe('Active');
    expect(report.users[0].follow_ups_sent).toBe(1);
    expect(report.users[0].latest_follow_up.automation_key).toBe('connect_no_first_image');
  });

  it('treats an active WordPress plugin API key as a connection fallback', () => {
    const report = buildLifecycleStatusReport({
      profiles: [{
        id: 'user-1',
        email: 'legacy@example.com',
        subscription_plan: 'free',
        subscription_status: 'active',
        credits_remaining: 29,
        total_processed: 1,
        created_at: '2026-06-27T00:00:00.000Z',
      }],
      events: [],
      usageStats: [{
        user_id: 'user-1',
        total_usage_count: 1,
        total_credits_used: 1,
        last_usage_at: '2026-06-27T02:00:00.000Z',
      }],
      apiKeys: [{
        user_id: 'user-1',
        name: 'WordPress Plugin',
        is_active: true,
        created_at: '2026-06-27T01:00:00.000Z',
      }],
      automationSends: [],
    });

    expect(report.summary.plugin_connected).toBe(1);
    expect(report.users[0].plugin_connected_at).toBe('2026-06-27T01:00:00.000Z');
    expect(report.users[0].plugin_connection_source).toBe('wordpress_plugin_key');
    expect(report.users[0].follow_up_status).toBe('Active');
    expect(report.users[0].lifecycle_events.connect_completed).toBe(true);
  });
});
