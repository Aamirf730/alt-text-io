import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('Netlify function configuration safety', () => {
  it('loads authenticated/admin functions without Supabase environment variables', () => {
    const functions = [
      'auth-validate.js',
      'get-usage.js',
      'get-plans.js',
      'get-api-key.js',
      'get-subscription.js',
      'admin-get-users.js',
      'delete-users.js',
    ];

    for (const functionName of functions) {
      expect(() => execFileSync(
        process.execPath,
        ['-e', `require(${JSON.stringify(`./netlify-functions/${functionName}`)})`],
        {
          cwd: repoRoot,
          env: { NODE_ENV: 'test', PATH: process.env.PATH || '' },
          stdio: 'pipe',
        },
      )).not.toThrow();
    }
  });
});
