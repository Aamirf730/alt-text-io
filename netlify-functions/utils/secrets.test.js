import { describe, expect, it } from 'vitest';

const { secretsMatch } = require('./secrets.js');

describe('secretsMatch', () => {
  it('matches only identical non-empty secrets', () => {
    expect(secretsMatch('s3cret-value', 's3cret-value')).toBe(true);
    expect(secretsMatch('s3cret-value', 's3cret-valuE')).toBe(false);
    expect(secretsMatch('short', 'longer-secret')).toBe(false);
  });

  it('never matches an empty or missing secret on either side', () => {
    expect(secretsMatch('', '')).toBe(false);
    expect(secretsMatch('', 'configured')).toBe(false);
    expect(secretsMatch('provided', '')).toBe(false);
    expect(secretsMatch(undefined, undefined)).toBe(false);
    expect(secretsMatch(null, 'configured')).toBe(false);
  });
});
