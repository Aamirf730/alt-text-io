import { afterEach, describe, expect, it } from 'vitest';

const dailyFunnelReport = require('../netlify-functions/daily-funnel-report.js');
const scheduledDailyFunnelReport = require('../netlify-functions/daily-funnel-report-scheduled.js');

describe('daily funnel report authorization', () => {
  const originalDailySecret = process.env.DAILY_FUNNEL_REPORT_SECRET;
  const originalLifecycleSecret = process.env.LIFECYCLE_AUTOMATION_SECRET;

  afterEach(() => {
    if (originalDailySecret === undefined) delete process.env.DAILY_FUNNEL_REPORT_SECRET;
    else process.env.DAILY_FUNNEL_REPORT_SECRET = originalDailySecret;

    if (originalLifecycleSecret === undefined) delete process.env.LIFECYCLE_AUTOMATION_SECRET;
    else process.env.LIFECYCLE_AUTOMATION_SECRET = originalLifecycleSecret;
  });

  it('blocks direct requests without the report secret', () => {
    process.env.DAILY_FUNNEL_REPORT_SECRET = 'report-secret';

    expect(dailyFunnelReport._private.isAuthorizedRun({
      httpMethod: 'POST',
      headers: {},
      body: '{}',
    })).toMatchObject({ allowed: false, mode: 'blocked' });
  });

  it('allows an explicitly secret-authenticated manual request', () => {
    process.env.DAILY_FUNNEL_REPORT_SECRET = 'report-secret';

    expect(dailyFunnelReport._private.isAuthorizedRun({
      httpMethod: 'POST',
      headers: { 'X-Daily-Funnel-Report-Secret': 'report-secret' },
      body: '{}',
    })).toMatchObject({ allowed: true, mode: 'manual' });
  });

  it('does not inject the scheduler secret into an HTTP-shaped wrapper request', () => {
    process.env.DAILY_FUNNEL_REPORT_SECRET = 'report-secret';

    const delegated = scheduledDailyFunnelReport._private.buildDelegatedEvent({
      httpMethod: 'POST',
      path: '/.netlify/functions/daily-funnel-report-scheduled',
      headers: {},
      body: '{}',
    });

    expect(delegated.headers).toEqual({});
    expect(dailyFunnelReport._private.isAuthorizedRun(delegated)).toMatchObject({
      allowed: false,
      mode: 'blocked',
    });
  });

  it('attests a scheduler-shaped wrapper event with the configured secret', () => {
    process.env.DAILY_FUNNEL_REPORT_SECRET = 'report-secret';

    const delegated = scheduledDailyFunnelReport._private.buildDelegatedEvent({
      body: '{}',
    });

    expect(delegated).toMatchObject({
      __scheduledInvocation: true,
      headers: { 'x-daily-funnel-report-secret': 'report-secret' },
    });
    expect(dailyFunnelReport._private.isAuthorizedRun(delegated)).toMatchObject({
      allowed: true,
      mode: 'scheduled',
    });
  });
});
