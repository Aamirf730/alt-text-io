import { afterEach, describe, expect, it } from 'vitest';

const {
  LEGACY_TOKEN_CUTOFF_MS,
  TOKEN_TTL_MS,
  createUnsubscribeToken,
  getSigningKey,
  inspectUnsubscribeToken,
  verifyUnsubscribeToken,
  getLifecycleUnsubscribeUrl,
} = require('./lifecycle-unsubscribe.js');

const crypto = require('node:crypto');

const originalSecret = process.env.LIFECYCLE_UNSUBSCRIBE_SECRET;
const originalAutomationSecret = process.env.LIFECYCLE_AUTOMATION_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.LIFECYCLE_UNSUBSCRIBE_SECRET;
  else process.env.LIFECYCLE_UNSUBSCRIBE_SECRET = originalSecret;
  if (originalAutomationSecret === undefined) delete process.env.LIFECYCLE_AUTOMATION_SECRET;
  else process.env.LIFECYCLE_AUTOMATION_SECRET = originalAutomationSecret;
});

function legacyToken(secret, identity) {
  const payload = Buffer.from(JSON.stringify(identity), 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

describe('lifecycle unsubscribe tokens', () => {
  it('round-trips a signed identity without exposing the email in the URL', () => {
    process.env.LIFECYCLE_UNSUBSCRIBE_SECRET = 'test-secret';
    const token = createUnsubscribeToken({ userId: 'user-1', email: 'Lead@example.com' });

    expect(token).toBeTruthy();
    expect(token.startsWith('v2.')).toBe(true);
    expect(token).not.toContain('Lead@example.com');
    expect(verifyUnsubscribeToken(token)).toEqual({ userId: 'user-1', email: 'lead@example.com' });
  });

  it('rejects tampered tokens', () => {
    process.env.LIFECYCLE_UNSUBSCRIBE_SECRET = 'test-secret';
    const token = createUnsubscribeToken({ userId: 'user-1', email: 'lead@example.com' });
    const tampered = `${token.slice(0, -1)}${token.endsWith('x') ? 'y' : 'x'}`;

    expect(verifyUnsubscribeToken(tampered)).toBeNull();
    expect(inspectUnsubscribeToken(tampered).status).toBe('invalid');
  });

  it('expires tokens after their lifetime', () => {
    process.env.LIFECYCLE_UNSUBSCRIBE_SECRET = 'test-secret';
    const now = Date.parse('2026-10-29T00:00:00Z');
    const token = createUnsubscribeToken({ userId: 'user-1', email: 'lead@example.com' }, { now });

    expect(inspectUnsubscribeToken(token, { now: now + TOKEN_TTL_MS - 1000 }).status).toBe('valid');
    const expired = inspectUnsubscribeToken(token, { now: now + TOKEN_TTL_MS + 1000 });
    expect(expired.status).toBe('expired');
    expect(expired.identity).toEqual({ userId: 'user-1', email: 'lead@example.com' });
  });

  it('keeps legacy (v1) tokens working until the cutoff', () => {
    process.env.LIFECYCLE_UNSUBSCRIBE_SECRET = 'test-secret';
    const token = legacyToken('test-secret', { user_id: 'user-1', email: 'lead@example.com' });

    expect(inspectUnsubscribeToken(token, { now: LEGACY_TOKEN_CUTOFF_MS - 1 }).status).toBe('valid');
    expect(inspectUnsubscribeToken(token, { now: LEGACY_TOKEN_CUTOFF_MS }).status).toBe('expired');
  });

  it('signs with a key derived from the automation secret, never the secret itself', () => {
    delete process.env.LIFECYCLE_UNSUBSCRIBE_SECRET;
    process.env.LIFECYCLE_AUTOMATION_SECRET = 'automation-secret';

    const key = getSigningKey();
    expect(key).toBeTruthy();
    expect(key).not.toBe('automation-secret');

    const token = createUnsubscribeToken({ userId: 'user-1', email: 'lead@example.com' });
    expect(verifyUnsubscribeToken(token)).toEqual({ userId: 'user-1', email: 'lead@example.com' });
    // Legacy tokens signed with the raw automation secret still verify.
    expect(verifyUnsubscribeToken(legacyToken('automation-secret', { user_id: 'user-1', email: 'lead@example.com' }), {
      now: LEGACY_TOKEN_CUTOFF_MS - 1,
    })).toEqual({ userId: 'user-1', email: 'lead@example.com' });
  });

  it('builds a Netlify function URL', () => {
    process.env.LIFECYCLE_UNSUBSCRIBE_SECRET = 'test-secret';
    expect(getLifecycleUnsubscribeUrl({ user_id: 'user-1', user_email: 'lead@example.com' }))
      .toMatch(/^https:\/\/www\.alt-text\.pro\/\.netlify\/functions\/unsubscribe-lifecycle\?token=/);
  });
});
