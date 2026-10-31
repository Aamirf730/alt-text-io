import { describe, expect, it } from 'vitest';

const { buildNewProfile, createMissingProfile, isMissingProfile } = require('./ensure-profile');

function fakeClient({ error = null } = {}) {
  const calls = [];
  return {
    calls,
    from: (table) => ({
      upsert: async (row, options) => {
        calls.push({ table, row, options });
        return { error };
      },
    }),
  };
}

describe('ensure-profile', () => {
  it('gives a missing profile the same values a new sign-up gets', () => {
    const now = new Date('2026-10-31T08:00:00.000Z');
    expect(buildNewProfile({ id: 'user-1', email: 'a@example.com' }, now)).toEqual({
      id: 'user-1',
      email: 'a@example.com',
      subscription_plan: 'free',
      subscription_status: 'active',
      credits_remaining: 165,
      bonus_credits_remaining: 150,
      total_processed: 0,
      credits_last_renewed_at: '2026-10-31T08:00:00.000Z',
      created_at: '2026-10-31T08:00:00.000Z',
      updated_at: '2026-10-31T08:00:00.000Z',
    });
  });

  it('treats only "no row" as a missing profile, never an outage', () => {
    expect(isMissingProfile(null, { code: 'PGRST116' })).toBe(true);
    expect(isMissingProfile(null, null)).toBe(true);
    expect(isMissingProfile(null, { code: '57014', message: 'canceling statement due to statement timeout' })).toBe(false);
    expect(isMissingProfile({ id: 'user-1' }, null)).toBe(false);
  });

  it('inserts without overwriting a profile that already exists', async () => {
    const client = fakeClient();
    await expect(createMissingProfile(client, { id: 'user-1', email: 'a@example.com' })).resolves.toBe(true);
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0].table).toBe('profiles');
    expect(client.calls[0].options).toEqual({ onConflict: 'id', ignoreDuplicates: true });
  });

  it('reports failure instead of throwing when the insert fails', async () => {
    const client = fakeClient({ error: { message: 'permission denied' } });
    await expect(createMissingProfile(client, { id: 'user-1' })).resolves.toBe(false);
    await expect(createMissingProfile(client, null)).resolves.toBe(false);
  });
});
