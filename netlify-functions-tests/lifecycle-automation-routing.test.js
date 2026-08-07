import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const lifecycleAutomation = require('../netlify-functions/lifecycle-automation.js');
const scheduledLifecycleAutomation = require('../netlify-functions/lifecycle-automation-scheduled.js');

describe('lifecycle automation Netlify routing', () => {
  it('keeps the scheduled wrapper on the same lifecycle handler', () => {
    expect(scheduledLifecycleAutomation.handler).toBe(lifecycleAutomation.handler);
  });

  it('schedules only the wrapper so the protected preview remains HTTP-accessible', () => {
    const config = readFileSync(resolve(process.cwd(), 'netlify.toml'), 'utf8');

    expect(config).toContain('[functions."lifecycle-automation-scheduled"]');
    expect(config).toContain('schedule = "0 */2 * * *"');
    expect(config).not.toContain('[functions."lifecycle-automation"]');
  });
});
