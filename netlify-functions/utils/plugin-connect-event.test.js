import { describe, expect, it, vi } from 'vitest';

const { recordPluginConnectCompleted } = require('./plugin-connect-event.js');

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
});
