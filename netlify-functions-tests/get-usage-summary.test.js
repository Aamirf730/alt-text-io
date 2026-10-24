import { describe, expect, it } from 'vitest';

const { _private } = require('../netlify-functions/get-usage.js');

// A minimal PostgREST-style builder that records how each query was shaped.
function fakeClient({ count = 0, cycleRows = [], recentRows = [] }) {
  const queries = [];

  const from = () => {
    const query = { filters: [], head: false, ranges: [], limitValue: null };
    queries.push(query);

    const builder = {
      select: (columns, options = {}) => {
        query.columns = columns;
        query.head = Boolean(options.head);
        return builder;
      },
      eq: (column, value) => {
        query.filters.push(['eq', column, value]);
        return builder;
      },
      gte: (column, value) => {
        query.filters.push(['gte', column, value]);
        return builder;
      },
      order: () => builder,
      range: async (fromRow, toRow) => {
        query.ranges.push([fromRow, toRow]);
        return { data: cycleRows.slice(fromRow, toRow + 1), error: null };
      },
      limit: async (value) => {
        query.limitValue = value;
        return { data: recentRows.slice(0, value), error: null };
      },
      then: (resolve) => resolve({ count, error: null }),
    };
    return builder;
  };

  return { client: { from }, queries };
}

describe('get-usage summary', () => {
  it('counts lifetime usage without loading every row and sums only this cycle', async () => {
    const cycleStart = new Date('2026-10-01T00:00:00.000Z');
    const { client, queries } = fakeClient({
      count: 250000,
      cycleRows: [{ credits_used: 1 }, { credits_used: 1 }, { credits_used: 2 }],
      recentRows: Array.from({ length: 15 }, (_, index) => ({ id: index })),
    });

    const summary = await _private.loadUsageSummary(client, 'user-1', cycleStart);

    expect(summary).toEqual({
      totalGenerated: 250000,
      creditsUsed: 4,
      recentUsage: Array.from({ length: 10 }, (_, index) => ({ id: index })),
    });

    const [totalQuery, cycleQuery, recentQuery] = queries;
    expect(totalQuery.head).toBe(true);
    expect(cycleQuery.filters).toContainEqual(['gte', 'created_at', '2026-10-01T00:00:00.000Z']);
    expect(cycleQuery.columns).toBe('id,credits_used,created_at');
    expect(recentQuery.limitValue).toBe(10);
  });
});
