import { describe, expect, it, vi } from 'vitest';

const { recordPluginConnectCompleted } = require('./plugin-connect-event.js');

function createSupabaseMock({ existingEvents = [], selectError = null, insertError = null } = {}) {
  const insert = vi.fn(() => Promise.resolve({ error: insertError }));
  const limit = vi.fn(() => Promise.resolve({ data: existingEvents, error: selectError }));
  const secondEq = vi.fn(() => ({ limit }));
  const firstEq = vi.fn(() => ({ eq: secondEq }));
  const select = vi.fn(() => ({ eq: firstEq }));
  const from = vi.fn(() => ({ select, insert }));

  return {
    supabase: { from },
    calls: {
      from,
      select,
      firstEq,
      secondEq,
      limit,
      insert,
    },
  };
}

describe('plugin connect event recording', () => {
  it('records one connect_completed event for a validated plugin key', async () => {
    const { supabase, calls } = createSupabaseMock();

    const result = await recordPluginConnectCompleted(supabase, {
      userId: 'user-1',
      userEmail: 'lead@example.com',
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
        validation_endpoint: 'auth-validate',
      },
      occurred_at: '2026-06-27T00:00:00.000Z',
    });
  });

  it('does not record duplicate connect_completed events for the same user', async () => {
    const { supabase, calls } = createSupabaseMock({
      existingEvents: [{ id: 'existing-event' }],
    });

    const result = await recordPluginConnectCompleted(supabase, {
      userId: 'user-1',
      userEmail: 'lead@example.com',
    });

    expect(result).toEqual({ recorded: false, reason: 'already_recorded' });
    expect(calls.insert).not.toHaveBeenCalled();
  });
});
