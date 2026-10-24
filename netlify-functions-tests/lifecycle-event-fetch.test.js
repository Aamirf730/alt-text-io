import { describe, expect, it } from 'vitest';

const {
  LIFECYCLE_RULES,
  fetchRecentMarketingEvents,
} = require('../netlify-functions/utils/lifecycle-automation.js');

function fakeSupabase(pages) {
  const calls = [];
  let pageIndex = 0;
  return {
    calls,
    from() {
      const call = { in: null, ranges: [] };
      calls.push(call);
      const builder = {
        select: () => builder,
        gte: () => builder,
        order: () => builder,
        in: (column, values) => {
          call.in = [column, values];
          return builder;
        },
        range: async (from, to) => {
          call.ranges.push([from, to]);
          const data = pages[pageIndex] || [];
          pageIndex += 1;
          return { data, error: null };
        },
      };
      return builder;
    },
  };
}

describe('lifecycle marketing event reads', () => {
  it('reads only the events lifecycle rules use, never page views', async () => {
    const supabase = fakeSupabase([[{ id: 1, event_name: 'signup_created' }]]);

    await fetchRecentMarketingEvents(supabase, { days: 30 });

    const [column, names] = supabase.calls[0].in;
    expect(column).toBe('event_name');
    expect(names).not.toContain('page_viewed');
    for (const rule of LIFECYCLE_RULES) {
      expect(names).toContain(rule.trigger);
    }
  });

  it('keeps paging past 10,000 rows instead of dropping the newest events', async () => {
    const fullPage = Array.from({ length: 1000 }, (_, index) => ({ id: index }));
    const pages = Array.from({ length: 11 }, () => fullPage).concat([[{ id: 'newest' }]]);
    const supabase = fakeSupabase(pages);

    const events = await fetchRecentMarketingEvents(supabase, { days: 30 });

    expect(events).toHaveLength(11001);
    expect(events.at(-1)).toEqual({ id: 'newest' });
  });
});
