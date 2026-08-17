import { describe, expect, it } from 'vitest';

const { fetchAllRows } = require('./paginated-query.js');

describe('fetchAllRows', () => {
  it('continues through full pages until the final short page', async () => {
    const ranges = [];
    const rows = await fetchAllRows(async (from, to) => {
      ranges.push([from, to]);
      if (from === 0) return { data: [{ id: 1 }, { id: 2 }] };
      if (from === 2) return { data: [{ id: 3 }] };
      return { data: [] };
    }, { pageSize: 2, maxPages: 3 });

    expect(rows).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(ranges).toEqual([[0, 1], [2, 3]]);
  });

  it('fails instead of silently truncating when the safety ceiling is reached', async () => {
    await expect(fetchAllRows(
      async () => ({ data: [{ id: 1 }] }),
      { pageSize: 1, maxPages: 1, label: 'test rows' }
    )).rejects.toThrow('pagination limit reached');
  });

  it('surfaces page query errors', async () => {
    await expect(fetchAllRows(
      async () => ({ error: { message: 'database unavailable' } }),
      { label: 'test rows' }
    )).rejects.toThrow('Failed to fetch test rows: database unavailable');
  });
});
