import { describe, expect, it, vi } from 'vitest';

const { _private } = require('../netlify-functions/delete-users.js');

describe('delete-users auth directory pagination', () => {
  it('loads users beyond the first Auth page', async () => {
    const listUsers = vi.fn(async ({ page }) => ({
      data: {
        users: page === 1
          ? [{ id: 'user-1' }, { id: 'user-2' }]
          : [{ id: 'user-3' }],
      },
      error: null,
    }));

    const users = await _private.fetchAllAuthUsers({ listUsers }, { perPage: 2, maxPages: 3 });

    expect(users).toHaveLength(3);
    expect(listUsers).toHaveBeenNthCalledWith(1, { page: 1, perPage: 2 });
    expect(listUsers).toHaveBeenNthCalledWith(2, { page: 2, perPage: 2 });
  });

  it('fails closed at the pagination safety ceiling', async () => {
    const listUsers = vi.fn(async () => ({
      data: { users: [{ id: 'full-page' }] },
      error: null,
    }));

    await expect(_private.fetchAllAuthUsers({ listUsers }, { perPage: 1, maxPages: 2 }))
      .rejects.toThrow('pagination limit reached');
  });
});
