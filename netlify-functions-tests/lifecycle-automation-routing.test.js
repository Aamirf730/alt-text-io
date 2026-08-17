import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const lifecycleAutomation = require('../netlify-functions/lifecycle-automation.js');
const scheduledLifecycleAutomation = require('../netlify-functions/lifecycle-automation-scheduled.js');

describe('lifecycle automation Netlify routing', () => {
  const originalSecret = process.env.LIFECYCLE_AUTOMATION_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.LIFECYCLE_AUTOMATION_SECRET;
    } else {
      process.env.LIFECYCLE_AUTOMATION_SECRET = originalSecret;
    }
  });

  it('exposes a scheduled wrapper that delegates to the shared handler', () => {
    const wrapperSource = readFileSync(
      resolve(process.cwd(), 'netlify-functions/lifecycle-automation-scheduled.js'),
      'utf8'
    );

    expect(typeof scheduledLifecycleAutomation.handler).toBe('function');
    expect(typeof lifecycleAutomation.handler).toBe('function');
    expect(wrapperSource).toContain("const { handler } = require('./lifecycle-automation');");
  });

  it('does not inject the scheduler secret into HTTP-shaped requests', () => {
    process.env.LIFECYCLE_AUTOMATION_SECRET = 'test-secret';

    const delegated = scheduledLifecycleAutomation._private.buildDelegatedEvent({
      httpMethod: 'POST',
      path: '/.netlify/functions/lifecycle-automation-scheduled',
      headers: {},
      queryStringParameters: {},
      body: JSON.stringify({ next_run: '2026-06-25T14:00:00.000Z' }),
    });

    expect(delegated.httpMethod).toBe('POST');
    expect(delegated.headers).toEqual({});
    expect(lifecycleAutomation._private.isAuthorizedRun(delegated)).toMatchObject({
      allowed: false,
      mode: 'blocked',
    });
  });

  it('attests a scheduler-shaped event with the configured secret', () => {
    process.env.LIFECYCLE_AUTOMATION_SECRET = 'test-secret';

    const delegated = scheduledLifecycleAutomation._private.buildDelegatedEvent({
      body: JSON.stringify({ next_run: '2026-06-25T14:00:00.000Z' }),
    });

    expect(delegated).toMatchObject({
      __scheduledInvocation: true,
      headers: { 'x-lifecycle-automation-secret': 'test-secret' },
    });
    expect(lifecycleAutomation._private.isAuthorizedRun(delegated)).toMatchObject({
      allowed: true,
      mode: 'scheduled',
    });
  });

  it('schedules only the wrapper so the protected preview remains HTTP-accessible', () => {
    const config = readFileSync(resolve(process.cwd(), 'netlify.toml'), 'utf8');

    expect(config).toContain('[functions."lifecycle-automation-scheduled"]');
    expect(config).toContain('schedule = "0 */2 * * *"');
    expect(config).not.toContain('[functions."lifecycle-automation"]');
  });
});
