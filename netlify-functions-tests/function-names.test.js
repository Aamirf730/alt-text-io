import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

// Netlify deploys every top-level .js file in netlify-functions/ as a
// function and rejects the whole deploy when a name has anything other than
// letters, digits, hyphens or underscores (a test file such as
// "auth-validate.test.js" failed the 2026-11-05 production deploy).
// Tests belong in netlify-functions-tests/ or netlify-functions/utils/.
describe('Netlify function file names', () => {
  it('uses only names Netlify accepts', () => {
    const dir = join(__dirname, '..', 'netlify-functions');
    const invalid = readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(js|mjs|cjs|ts)$/.test(entry.name))
      .map((entry) => entry.name.replace(/\.(js|mjs|cjs|ts)$/, ''))
      .filter((name) => !/^[A-Za-z0-9_-]+$/.test(name));

    expect(invalid).toEqual([]);
  });
});
