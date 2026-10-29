import { describe, expect, it, vi } from 'vitest';

const {
  authenticateAdmin,
  isAdminUser,
  recordAdminAction,
} = require('./admin-auth.js');

const env = { SUPERUSER_EMAILS: ' Boss@Example.com , ops@example.com' };
const confirmed = { id: 'admin-1', email: 'boss@example.com', email_confirmed_at: '2026-01-01T00:00:00Z' };

function clientFor(user, error = null) {
  return { auth: { getUser: vi.fn(async () => ({ data: { user }, error })) } };
}

describe('admin authorization', () => {
  it('requires a listed email AND a confirmed address', () => {
    expect(isAdminUser(confirmed, env)).toBe(true);
    expect(isAdminUser({ ...confirmed, email: 'BOSS@example.com' }, env)).toBe(true);
    expect(isAdminUser({ ...confirmed, email_confirmed_at: null }, env)).toBe(false);
    expect(isAdminUser({ ...confirmed, email: 'someone@example.com' }, env)).toBe(false);
    expect(isAdminUser(null, env)).toBe(false);
    expect(isAdminUser(confirmed, { SUPERUSER_EMAILS: '' })).toBe(false);
  });

  it('returns 401 without a bearer token and 403 for an unconfirmed listed email', async () => {
    const missing = await authenticateAdmin({ headers: {} }, { supabase: clientFor(confirmed), env });
    expect(missing.response.statusCode).toBe(401);

    const unconfirmed = await authenticateAdmin(
      { headers: { authorization: 'Bearer token' } },
      { supabase: clientFor({ ...confirmed, email_confirmed_at: null }), env },
    );
    expect(unconfirmed.response.statusCode).toBe(403);
  });

  it('returns 401 for an invalid token and the user for a confirmed admin', async () => {
    const invalid = await authenticateAdmin(
      { headers: { Authorization: 'Bearer bad' } },
      { supabase: clientFor(null, { message: 'bad jwt' }), env },
    );
    expect(invalid.response.statusCode).toBe(401);

    const ok = await authenticateAdmin(
      { headers: { Authorization: 'Bearer good' } },
      { supabase: clientFor(confirmed), env },
    );
    expect(ok.user).toEqual(confirmed);
    expect(ok.response).toBeUndefined();
  });

  it('writes one audit row per admin action and can require it', async () => {
    const rows = [];
    const supabase = { from: () => ({ insert: async row => { rows.push(row); return { error: null }; } }) };

    await recordAdminAction(supabase, {
      actor: { id: 'admin-1', email: 'Boss@Example.com' },
      action: 'admin.user_viewed',
      resourceType: 'user',
      resourceId: 'user-1',
      event: { headers: { 'user-agent': 'test' } },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actor_email: 'boss@example.com', action: 'admin.user_viewed', resource_id: 'user-1' });

    const failing = { from: () => ({ insert: async () => ({ error: { message: 'down' } }) }) };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(recordAdminAction(failing, { action: 'x' })).resolves.toBe(false);
    await expect(recordAdminAction(failing, { action: 'x', required: true })).rejects.toThrow('audit log');
  });
});
