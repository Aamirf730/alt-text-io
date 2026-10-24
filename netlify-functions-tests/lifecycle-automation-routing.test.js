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

  it("attests Netlify's POST schedule event, which carries HTTP markers", () => {
    process.env.LIFECYCLE_AUTOMATION_SECRET = 'test-secret';

    // Production evidence: every scheduled run returned in ~4 ms with no
    // output because this exact event shape was refused at the secret check.
    const delegated = scheduledLifecycleAutomation._private.buildDelegatedEvent({
      httpMethod: 'POST',
      path: '/.netlify/functions/lifecycle-automation-scheduled',
      headers: { 'content-type': 'application/json' },
      queryStringParameters: {},
      body: JSON.stringify({ next_run: '2026-06-25T14:00:00.000Z' }),
    });

    expect(delegated.headers).toEqual({ 'x-lifecycle-automation-secret': 'test-secret' });
    expect(lifecycleAutomation._private.isAuthorizedRun(delegated)).toMatchObject({
      allowed: true,
      mode: 'scheduled',
    });
  });

  it.each([
    ['an empty body', '{}'],
    ['a non-date next_run', JSON.stringify({ next_run: 'soon' })],
    ['malformed JSON', '{next_run'],
    ['a dry-run query without a schedule body', undefined],
  ])('does not inject the secret for %s', (_label, body) => {
    process.env.LIFECYCLE_AUTOMATION_SECRET = 'test-secret';
    const event = {
      httpMethod: 'POST',
      path: '/.netlify/functions/lifecycle-automation-scheduled',
      headers: {},
      queryStringParameters: { dry_run: 'false' },
      body,
    };

    const delegated = scheduledLifecycleAutomation._private.buildDelegatedEvent(event);

    expect(delegated).toBe(event);
    expect(lifecycleAutomation._private.isAuthorizedRun(delegated)).toMatchObject({
      allowed: false,
      mode: 'blocked',
    });
  });

  it('still requires the secret on the URL-reachable shared handler', () => {
    process.env.LIFECYCLE_AUTOMATION_SECRET = 'test-secret';

    expect(lifecycleAutomation._private.isAuthorizedRun({
      httpMethod: 'POST',
      path: '/.netlify/functions/lifecycle-automation',
      headers: {},
      body: JSON.stringify({ next_run: '2026-06-25T14:00:00.000Z' }),
    })).toMatchObject({ allowed: false, mode: 'blocked' });
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
