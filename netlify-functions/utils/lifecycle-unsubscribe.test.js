import { afterEach, describe, expect, it } from 'vitest';

const {
  createUnsubscribeToken,
  verifyUnsubscribeToken,
  getLifecycleUnsubscribeUrl,
} = require('./lifecycle-unsubscribe.js');

const originalSecret = process.env.LIFECYCLE_UNSUBSCRIBE_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.LIFECYCLE_UNSUBSCRIBE_SECRET;
  else process.env.LIFECYCLE_UNSUBSCRIBE_SECRET = originalSecret;
});

describe('lifecycle unsubscribe tokens', () => {
  it('round-trips a signed identity without exposing the email in the URL', () => {
    process.env.LIFECYCLE_UNSUBSCRIBE_SECRET = 'test-secret';
    const token = createUnsubscribeToken({ userId: 'user-1', email: 'Lead@example.com' });

    expect(token).toBeTruthy();
    expect(token).not.toContain('Lead@example.com');
    expect(verifyUnsubscribeToken(token)).toEqual({ userId: 'user-1', email: 'lead@example.com' });
  });

  it('rejects tampered tokens', () => {
    process.env.LIFECYCLE_UNSUBSCRIBE_SECRET = 'test-secret';
    const token = createUnsubscribeToken({ userId: 'user-1', email: 'lead@example.com' });
    const tampered = `${token.slice(0, -1)}x`;

    expect(verifyUnsubscribeToken(tampered)).toBeNull();
  });

  it('builds a Netlify function URL', () => {
    process.env.LIFECYCLE_UNSUBSCRIBE_SECRET = 'test-secret';
    expect(getLifecycleUnsubscribeUrl({ user_id: 'user-1', user_email: 'lead@example.com' }))
      .toMatch(/^https:\/\/www\.alt-text\.pro\/\.netlify\/functions\/unsubscribe-lifecycle\?token=/);
  });
});
