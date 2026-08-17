import { afterEach, describe, expect, it } from 'vitest';

const { _private } = require('../lifecycle-automation.js');

describe('lifecycle automation authorization', () => {
  const originalSecret = process.env.LIFECYCLE_AUTOMATION_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.LIFECYCLE_AUTOMATION_SECRET;
    } else {
      process.env.LIFECYCLE_AUTOMATION_SECRET = originalSecret;
    }
  });

  it('blocks schedule-shaped invocations without the automation secret', () => {
    delete process.env.LIFECYCLE_AUTOMATION_SECRET;

    const auth = _private.isAuthorizedRun({
      body: JSON.stringify({ next_run: '2026-06-25T14:00:00.000Z' }),
      headers: {},
      queryStringParameters: {},
    });

    expect(auth).toMatchObject({
      allowed: false,
      mode: 'blocked',
    });
  });

  it('allows an internally attested scheduled invocation with the automation secret', () => {
    process.env.LIFECYCLE_AUTOMATION_SECRET = 'test-secret';

    const auth = _private.isAuthorizedRun({
      body: JSON.stringify({ next_run: '2026-06-25T14:00:00.000Z' }),
      headers: { 'X-Lifecycle-Automation-Secret': 'test-secret' },
      queryStringParameters: {},
      __scheduledInvocation: true,
    });

    expect(auth).toMatchObject({
      allowed: true,
      mode: 'scheduled',
    });
  });

  it('blocks public HTTP attempts that spoof a scheduled next_run body', () => {
    delete process.env.LIFECYCLE_AUTOMATION_SECRET;

    const auth = _private.isAuthorizedRun({
      httpMethod: 'POST',
      path: '/.netlify/functions/lifecycle-automation',
      body: JSON.stringify({ next_run: '2026-06-25T14:00:00.000Z' }),
      headers: { host: 'www.alt-text.pro' },
      queryStringParameters: {},
    });

    expect(auth).toMatchObject({
      allowed: false,
      mode: 'blocked',
    });
  });

  it('allows public manual invocations with the lifecycle secret', () => {
    process.env.LIFECYCLE_AUTOMATION_SECRET = 'test-secret';

    const auth = _private.isAuthorizedRun({
      httpMethod: 'POST',
      path: '/.netlify/functions/lifecycle-automation',
      body: '{}',
      headers: { 'X-Lifecycle-Automation-Secret': 'test-secret' },
      queryStringParameters: {},
    });

    expect(auth).toMatchObject({
      allowed: true,
      mode: 'manual',
    });
  });

  it('does not accept the lifecycle secret from a query string', () => {
    process.env.LIFECYCLE_AUTOMATION_SECRET = 'test-secret';

    const auth = _private.isAuthorizedRun({
      httpMethod: 'POST',
      path: '/.netlify/functions/lifecycle-automation',
      body: '{}',
      headers: {},
      queryStringParameters: { secret: 'test-secret' },
    });

    expect(auth).toMatchObject({
      allowed: false,
      mode: 'blocked',
    });
  });

  it('rejects malformed scheduled bodies', () => {
    const scheduledBody = _private.parseScheduledBody({
      body: JSON.stringify({ next_run: 'not-a-date' }),
    });

    expect(scheduledBody).toBeNull();
  });
});
