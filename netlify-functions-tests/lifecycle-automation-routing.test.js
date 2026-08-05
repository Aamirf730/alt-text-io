import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const lifecycleAutomation = require('../netlify-functions/lifecycle-automation.js');
const scheduledLifecycleAutomation = require('../netlify-functions/lifecycle-automation-scheduled.js');

describe('lifecycle automation Netlify routing', () => {
  it('exposes a scheduled wrapper that delegates to the shared handler', () => {
    const wrapperSource = readFileSync(
      resolve(process.cwd(), 'netlify-functions/lifecycle-automation-scheduled.js'),
      'utf8'
    );

    expect(typeof scheduledLifecycleAutomation.handler).toBe('function');
    expect(typeof lifecycleAutomation.handler).toBe('function');
    expect(wrapperSource).toContain("const { handler } = require('./lifecycle-automation');");
  });

  it('schedules only the wrapper so the protected preview remains HTTP-accessible', () => {
    const config = readFileSync(resolve(process.cwd(), 'netlify.toml'), 'utf8');

    expect(config).toContain('[functions."lifecycle-automation-scheduled"]');
    expect(config).toContain('schedule = "0 */2 * * *"');
    expect(config).not.toContain('[functions."lifecycle-automation"]');
  });
});
