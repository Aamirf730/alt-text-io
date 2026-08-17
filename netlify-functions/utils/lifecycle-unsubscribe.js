const crypto = require('node:crypto');

const SITE_URL = 'https://www.alt-text.pro';

function getUnsubscribeSecret() {
  return process.env.LIFECYCLE_UNSUBSCRIBE_SECRET || process.env.LIFECYCLE_AUTOMATION_SECRET || '';
}

function createUnsubscribeToken({ userId, user_id: userIdSnake, email, user_email: userEmail } = {}) {
  const resolvedUserId = userId || userIdSnake;
  const resolvedEmail = email || userEmail;
  const secret = getUnsubscribeSecret();
  if (!secret || !resolvedUserId || !resolvedEmail) return null;

  const payload = Buffer.from(JSON.stringify({
    user_id: String(resolvedUserId),
    email: String(resolvedEmail).trim().toLowerCase(),
  }), 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifyUnsubscribeToken(token) {
  const secret = getUnsubscribeSecret();
  if (!secret || typeof token !== 'string') return null;

  const [payload, signature] = token.split('.');
  if (!payload || !signature || token.split('.').length !== 2) return null;

  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const providedBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const identity = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!identity?.user_id || !identity?.email) return null;
    return {
      userId: String(identity.user_id),
      email: String(identity.email).trim().toLowerCase(),
    };
  } catch (_error) {
    return null;
  }
}

function getLifecycleUnsubscribeUrl(candidate) {
  const token = createUnsubscribeToken(candidate);
  if (!token) return null;

  return `${SITE_URL}/.netlify/functions/unsubscribe-lifecycle?token=${encodeURIComponent(token)}`;
}

module.exports = {
  createUnsubscribeToken,
  getLifecycleUnsubscribeUrl,
  verifyUnsubscribeToken,
};
