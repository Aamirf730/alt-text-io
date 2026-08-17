import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());

describe('audit findings 4.5 through 4.10', () => {
  it('keeps delete-user provider errors out of production responses', () => {
    const source = readFileSync(resolve(root, 'netlify-functions/delete-users.js'), 'utf8');

    expect(source).toContain('getDevelopmentErrorDetails');
    expect(source).not.toContain('details: listError.message');
    expect(source).not.toContain('error: deleteError.message');
    expect(source).not.toContain('error: error.message');
  });

  it('uses ranged pagination for usage and admin data sources', () => {
    const sourceFiles = [
      'netlify-functions/get-usage.js',
      'netlify-functions/utils/api-key-validator.js',
      'netlify-functions/admin-get-users.js',
      'netlify-functions/utils/lifecycle-status.js',
    ];

    for (const relativePath of sourceFiles) {
      const source = readFileSync(resolve(root, relativePath), 'utf8');
      expect(source, relativePath).toContain('fetchAllRows');
      expect(source, relativePath).toContain('.range(from, to)');
    }
  });

  it('uses paginated send lookup for lifecycle deduplication', () => {
    const source = readFileSync(resolve(root, 'netlify-functions/lifecycle-automation.js'), 'utf8');

    expect(source).toContain("{ label: 'automation sends' }");
    expect(source).toContain('.range(from, to)');
    expect(source).not.toContain(".select('automation_key,actor_key')\n    .in");
  });

  it('keeps Gemini calls bounded and distinguishes database recheck failures from no credits', () => {
    const source = readFileSync(resolve(root, 'netlify-functions/generate-alt-text.js'), 'utf8');
    const generation = require('../netlify-functions/generate-alt-text.js');

    expect(source).toContain('getGeminiRequestTimeoutMs');
    expect(source).toContain('getGeminiGenerationBudgetMs');
    expect(source).toContain('timeout: timeoutMs || getGeminiRequestTimeoutMs()');
    expect(source).toContain("error: 'Credit status temporarily unavailable. Please try again.'");
    expect(source).toContain('if (user.usage_unavailable)');
    expect(source).toContain('if (recheckError)');
    expect(generation._private.createAiTimeoutError()).toMatchObject({
      code: 'AI_TIMEOUT',
      statusCode: 504,
    });
  });
});
