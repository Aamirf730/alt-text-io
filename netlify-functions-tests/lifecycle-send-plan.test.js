import { afterEach, describe, expect, it, vi } from 'vitest';

const lifecycle = require('../netlify-functions/lifecycle-automation.js');
const { buildLifecycleMailOptions, fetchLifecycleUsageCounts } = require('../netlify-functions/utils/lifecycle-automation.js');

const {
  classifyExistingSend,
  executeLifecycleSends,
  markStalePendingUnknown,
  planLifecycleSends,
  MAX_SEND_ATTEMPTS,
  MAX_SENDS_PER_RUN_LIMIT,
  SEND_TIME_BUDGET_MS,
  STALE_PENDING_MS,
} = lifecycle._private;

const NOW = Date.parse('2026-10-29T12:00:00Z');
const hoursAgo = hours => new Date(NOW - hours * 3600000).toISOString();

function candidate(automationKey, actorKey = 'user:u1', triggerAt = hoursAgo(10)) {
  return {
    automation_key: automationKey,
    actor_key: actorKey,
    user_id: actorKey.replace('user:', ''),
    user_email: `${actorKey.replace('user:', '')}@example.com`,
    trigger_occurred_at: triggerAt,
    subject: 's',
  };
}

describe('lifecycle send retry classification', () => {
  it('never resends a sent email', () => {
    expect(classifyExistingSend({ status: 'sent', attempts: 1 }, NOW)).toBe('done');
  });

  it('retries a failed send after the delay, up to the attempt limit', () => {
    expect(classifyExistingSend({ status: 'failed', attempts: 1, last_attempt_at: hoursAgo(2) }, NOW)).toBe('retry');
    expect(classifyExistingSend({ status: 'failed', attempts: 1, last_attempt_at: hoursAgo(0.1) }, NOW)).toBe('in_flight');
    expect(classifyExistingSend({ status: 'failed', attempts: MAX_SEND_ATTEMPTS, last_attempt_at: hoursAgo(5) }, NOW)).toBe('done');
  });

  it('never retries a stale pending send, which may have been delivered', () => {
    expect(classifyExistingSend({ status: 'pending', attempts: 1, last_attempt_at: hoursAgo(0.5) }, NOW)).toBe('in_flight');
    expect(classifyExistingSend({ status: 'pending', attempts: 1, last_attempt_at: new Date(NOW - STALE_PENDING_MS - 1).toISOString() }, NOW)).toBe('stale_pending');
    expect(classifyExistingSend({ status: 'unknown', attempts: 1, last_attempt_at: hoursAgo(48) }, NOW)).toBe('done');
  });
});

describe('planLifecycleSends', () => {
  it('filters already-sent emails before picking one per person', () => {
    // credits_low outranks connect_no_first_image, but it was already sent
    // eight days ago; the next email must not be blocked by it.
    const plan = planLifecycleSends(
      [candidate('credits_low_no_purchase'), candidate('connect_no_first_image')],
      [{ automation_key: 'credits_low_no_purchase', actor_key: 'user:u1', status: 'sent', attempts: 1, sent_at: hoursAgo(24 * 8) }],
      { now: NOW },
    );

    expect(plan.sends.map(send => send.candidate.automation_key)).toEqual(['connect_no_first_image']);
    expect(plan.done).toBe(1);
  });

  it('holds back a person who got another lifecycle email in the last day', () => {
    const plan = planLifecycleSends(
      [candidate('connect_no_first_image')],
      [{ automation_key: 'signup_no_connect', actor_key: 'user:u1', status: 'sent', attempts: 1, sent_at: hoursAgo(3) }],
      { now: NOW },
    );

    expect(plan.sends).toHaveLength(0);
    expect(plan.cooldown).toBe(1);
  });

  it('returns failed rows as retries with their existing row', () => {
    const existing = { id: 'send-1', automation_key: 'signup_no_connect', actor_key: 'user:u1', status: 'failed', attempts: 1, last_attempt_at: hoursAgo(3) };
    const plan = planLifecycleSends([candidate('signup_no_connect')], [existing], { now: NOW });

    expect(plan.sends).toHaveLength(1);
    expect(plan.sends[0].existing).toBe(existing);
  });

  it('reports stale pending rows and does not plan them as sends', () => {
    const stale = { id: 'send-stale', automation_key: 'signup_no_connect', actor_key: 'user:u1', status: 'pending', attempts: 1, last_attempt_at: hoursAgo(3) };
    const plan = planLifecycleSends(
      [candidate('signup_no_connect'), candidate('connect_no_first_image')],
      [stale],
      { now: NOW },
    );

    expect(plan.sends).toHaveLength(0);
    expect(plan.stale_pending).toEqual([stale]);
    // The possibly delivered email also holds the person in the daily cooldown.
    expect(plan.cooldown).toBe(1);
  });

  it('respects the per-run cap', () => {
    const plan = planLifecycleSends(
      [candidate('signup_no_connect', 'user:a'), candidate('signup_no_connect', 'user:b'), candidate('signup_no_connect', 'user:c')],
      [],
      { now: NOW, maxPerRun: 2 },
    );
    expect(plan.sends).toHaveLength(2);
    expect(plan.eligible).toBe(3);
  });
});

describe('executeLifecycleSends', () => {
  const sends = (count = 1, existing = null) => Array.from({ length: count }, (_, index) => ({
    candidate: candidate('signup_no_connect', `user:u${index}`),
    existing,
  }));

  function deps(overrides = {}) {
    const marks = [];
    return {
      marks,
      transporter: {},
      reserveSend: vi.fn(async c => ({ id: `send-${c.actor_key}` })),
      claimRetry: vi.fn(async () => ({ id: 'send-retry' })),
      markSend: vi.fn(async (id, patch) => { marks.push([id, patch.status]); }),
      sendEmail: vi.fn(async () => ({})),
      reportError: vi.fn(),
      ...overrides,
    };
  }

  it('marks a delivered email sent', async () => {
    const d = deps();
    const results = await executeLifecycleSends(sends(), d);

    expect(results).toMatchObject({ sent: 1, failed: 0 });
    expect(d.marks).toEqual([['send-user:u0', 'sent']]);
  });

  it('never marks a delivered email failed when recording "sent" fails', async () => {
    const d = deps({
      markSend: vi.fn(async () => { throw new Error('db down'); }),
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const results = await executeLifecycleSends(sends(), d);

    expect(results).toMatchObject({ sent: 1, failed: 0, unrecorded_sent: 1 });
    expect(d.markSend).toHaveBeenCalledTimes(1);
    expect(d.markSend.mock.calls[0][1].status).toBe('sent');
    expect(d.reportError).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({
      extra: expect.objectContaining({ reason: 'sent_status_not_recorded' }),
    }));
  });

  it('marks a send that threw at SMTP failed, so it can be retried', async () => {
    const d = deps({ sendEmail: vi.fn(async () => { throw new Error('535 auth'); }) });

    const results = await executeLifecycleSends(sends(), d);

    expect(results).toMatchObject({ sent: 0, failed: 1 });
    expect(d.marks).toEqual([['send-user:u0', 'failed']]);
  });

  it('keeps going when recording a failure fails', async () => {
    let calls = 0;
    const d = deps({
      sendEmail: vi.fn(async () => { calls += 1; if (calls === 1) throw new Error('smtp'); }),
      markSend: vi.fn(async (_id, patch) => { if (patch.status === 'failed') throw new Error('db down'); }),
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const results = await executeLifecycleSends(sends(2), d);

    expect(results).toMatchObject({ failed: 1, sent: 1 });
  });

  it('starts no new send after the time budget', async () => {
    let now = 0;
    const d = deps({
      sendEmail: vi.fn(async () => { now += 7000; }),
      clock: () => now,
      startedAt: 0,
    });

    const results = await executeLifecycleSends(sends(5), d);

    expect(SEND_TIME_BUDGET_MS).toBeLessThan(30000);
    expect(results.sent).toBe(Math.ceil(SEND_TIME_BUDGET_MS / 7000));
    expect(results.deferred).toBe(5 - results.sent);
  });

  it('caps the configured sends per run well inside the function timeout', () => {
    expect(MAX_SENDS_PER_RUN_LIMIT).toBeLessThanOrEqual(30);
  });
});

describe('markStalePendingUnknown', () => {
  it('marks only still-pending rows unknown and reports them', async () => {
    const updates = [];
    const client = {
      from: () => {
        const update = { filters: [] };
        const builder = {
          update: (values) => { update.values = values; updates.push(update); return builder; },
          eq: (field, value) => { update.filters.push([field, value]); return builder; },
          select: async () => ({ data: update.filters.some(([, value]) => value === 'send-a') ? [{ id: 'send-a' }] : [], error: null }),
        };
        return builder;
      },
    };
    const reportError = vi.fn();

    const marked = await markStalePendingUnknown([{ id: 'send-a' }, { id: 'send-b' }], { client, reportError });

    expect(marked).toBe(1);
    expect(updates[0].values.status).toBe('unknown');
    expect(updates[0].filters).toEqual([['id', 'send-a'], ['status', 'pending']]);
    expect(reportError).toHaveBeenCalledTimes(1);
  });
});

describe('lifecycle run outcome', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
    vi.restoreAllMocks();
  });

  it('reports failure (non-200, success:false) when it cannot run', async () => {
    // No Supabase env in tests, so the configuration guard answers.
    process.env.LIFECYCLE_AUTOMATION_SECRET = 'secret';
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await lifecycle.handler({
      headers: { 'x-lifecycle-automation-secret': 'secret' },
      queryStringParameters: {},
    });

    expect(result.statusCode).toBeGreaterThanOrEqual(500);
    expect(JSON.parse(result.body).success).toBe(false);
  });
});

describe('lifecycle email headers', () => {
  const previous = process.env.LIFECYCLE_UNSUBSCRIBE_SECRET;
  afterEach(() => {
    if (previous === undefined) delete process.env.LIFECYCLE_UNSUBSCRIBE_SECRET;
    else process.env.LIFECYCLE_UNSUBSCRIBE_SECRET = previous;
  });

  it('adds List-Unsubscribe and one-click List-Unsubscribe-Post headers', () => {
    process.env.LIFECYCLE_UNSUBSCRIBE_SECRET = 'unsub-secret';
    const options = buildLifecycleMailOptions({
      user_id: 'u1',
      user_email: 'lead@example.com',
      subject: 'Hello',
      preview: 'p',
      cta_text: 'Go',
      cta_url: 'https://www.alt-text.pro/dashboard',
    }, { from: 'help@alt-text.pro', supportEmail: 'help@alt-text.pro' });

    expect(options.to).toBe('lead@example.com');
    expect(options.headers['List-Unsubscribe']).toMatch(/^<https:\/\/www\.alt-text\.pro\/\.netlify\/functions\/unsubscribe-lifecycle\?token=[^>]+>, <mailto:help@alt-text\.pro\?subject=unsubscribe>$/);
    expect(options.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    // The header and the body link carry the same token.
    const headerUrl = options.headers['List-Unsubscribe'].match(/<(https:[^>]+)>/)[1];
    expect(options.text).toContain(headerUrl);
  });
});

describe('lifecycle usage reads', () => {
  it('reads usage only for the given users, in chunks', async () => {
    const calls = [];
    const supabase = {
      from: () => {
        const builder = {
          select: () => builder,
          in: async (_column, ids) => {
            calls.push(ids.length);
            return { data: ids.map(id => ({ user_id: id, total_usage_count: 2 })), error: null };
          },
        };
        return builder;
      },
    };
    const ids = Array.from({ length: 200 }, (_, index) => `user-${index}`);

    const counts = await fetchLifecycleUsageCounts(supabase, ids);

    expect(calls).toEqual([150, 50]);
    expect(counts.get('user-199')).toBe(2);
  });
});
