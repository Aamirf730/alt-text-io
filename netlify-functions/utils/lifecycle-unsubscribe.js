const crypto = require('node:crypto');

const SITE_URL = 'https://www.alt-text.pro';
const UNSUBSCRIBE_PATH = '/.netlify/functions/unsubscribe-lifecycle';

// Version 2 tokens: "v2.<payload>.<signature>", payload { u, e, iat, exp }.
// They are honoured for a year, longer than any lifecycle email stays useful.
const TOKEN_VERSION = 'v2';
const TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000;

// Version 1 tokens ("<payload>.<signature>", no expiry) are in emails sent
// before this change. Unsubscribe links must keep working for a while after
// a send, so v1 tokens stay valid until this date, then are refused.
const LEGACY_TOKEN_CUTOFF_MS = Date.parse('2027-03-01T00:00:00Z');

// Signing key.
// - LIFECYCLE_UNSUBSCRIBE_SECRET when set (recommended, its own secret).
// - Fallback: a key derived from LIFECYCLE_AUTOMATION_SECRET with HMAC and a
//   fixed label, so the secret that authorizes automation runs is never used
//   directly as the token-signing key, and a signed token reveals nothing
//   usable against the automation endpoint.
const DERIVATION_LABEL = 'alt-text-pro:lifecycle-unsubscribe:v2';

function getSigningKey(env = process.env) {
  if (env.LIFECYCLE_UNSUBSCRIBE_SECRET) return env.LIFECYCLE_UNSUBSCRIBE_SECRET;
  if (env.LIFECYCLE_AUTOMATION_SECRET) {
    return crypto.createHmac('sha256', env.LIFECYCLE_AUTOMATION_SECRET).update(DERIVATION_LABEL).digest('base64url');
  }
  return '';
}

// v1 tokens were signed with the raw unsubscribe secret, or the raw
// automation secret when no unsubscribe secret existed.
function getLegacySigningKey(env = process.env) {
  return env.LIFECYCLE_UNSUBSCRIBE_SECRET || env.LIFECYCLE_AUTOMATION_SECRET || '';
}

function sign(key, value) {
  return crypto.createHmac('sha256', key).update(value).digest('base64url');
}

function signatureMatches(key, value, signature) {
  const expected = Buffer.from(sign(key, value), 'utf8');
  const provided = Buffer.from(String(signature || ''), 'utf8');
  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
}

function decodePayload(payload) {
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch (_error) {
    return null;
  }
}

function createUnsubscribeToken({ userId, user_id: userIdSnake, email, user_email: userEmail } = {}, {
  now = Date.now(),
  env = process.env,
} = {}) {
  const resolvedUserId = userId || userIdSnake;
  const resolvedEmail = email || userEmail;
  const key = getSigningKey(env);
  if (!key || !resolvedUserId || !resolvedEmail) return null;

  const payload = Buffer.from(JSON.stringify({
    u: String(resolvedUserId),
    e: String(resolvedEmail).trim().toLowerCase(),
    iat: Math.floor(now / 1000),
    exp: Math.floor((now + TOKEN_TTL_MS) / 1000),
  }), 'utf8').toString('base64url');

  const signed = `${TOKEN_VERSION}.${payload}`;
  return `${signed}.${sign(key, signed)}`;
}

/**
 * Classify a token: { status: 'valid' | 'expired' | 'invalid', identity }.
 * An expired token still carries a verified identity so the page can say
 * the link expired rather than that it is forged.
 */
function inspectUnsubscribeToken(token, { now = Date.now(), env = process.env } = {}) {
  if (typeof token !== 'string' || token.length > 2048) return { status: 'invalid', identity: null };
  const parts = token.split('.');

  if (parts.length === 3 && parts[0] === TOKEN_VERSION) {
    const key = getSigningKey(env);
    const signed = `${parts[0]}.${parts[1]}`;
    if (!key || !signatureMatches(key, signed, parts[2])) return { status: 'invalid', identity: null };

    const body = decodePayload(parts[1]);
    if (!body?.u || !body?.e || !Number.isFinite(body?.exp)) return { status: 'invalid', identity: null };
    const identity = { userId: String(body.u), email: String(body.e).trim().toLowerCase() };
    return { status: body.exp * 1000 < now ? 'expired' : 'valid', identity };
  }

  if (parts.length === 2) {
    const key = getLegacySigningKey(env);
    if (!key || !signatureMatches(key, parts[0], parts[1])) return { status: 'invalid', identity: null };

    const body = decodePayload(parts[0]);
    if (!body?.user_id || !body?.email) return { status: 'invalid', identity: null };
    const identity = { userId: String(body.user_id), email: String(body.email).trim().toLowerCase() };
    return { status: now >= LEGACY_TOKEN_CUTOFF_MS ? 'expired' : 'valid', identity };
  }

  return { status: 'invalid', identity: null };
}

/** Identity for a currently valid token, otherwise null. */
function verifyUnsubscribeToken(token, options = {}) {
  const result = inspectUnsubscribeToken(token, options);
  return result.status === 'valid' ? result.identity : null;
}

function getLifecycleUnsubscribeUrl(candidate, options = {}) {
  const token = createUnsubscribeToken(candidate, options);
  if (!token) return null;

  return `${SITE_URL}${UNSUBSCRIBE_PATH}?token=${encodeURIComponent(token)}`;
}

/**
 * RFC 2369 / RFC 8058 headers. The URL accepts a one-click POST
 * ("List-Unsubscribe=One-Click"); a mailto fallback covers older clients.
 */
function getListUnsubscribeHeaders(unsubscribeUrl, supportEmail) {
  if (!unsubscribeUrl) return {};
  const targets = [`<${unsubscribeUrl}>`];
  if (supportEmail && /^[^\s<>@]+@[^\s<>@]+$/.test(supportEmail)) {
    targets.push(`<mailto:${supportEmail}?subject=unsubscribe>`);
  }
  return {
    'List-Unsubscribe': targets.join(', '),
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

module.exports = {
  LEGACY_TOKEN_CUTOFF_MS,
  TOKEN_TTL_MS,
  createUnsubscribeToken,
  getLifecycleUnsubscribeUrl,
  getListUnsubscribeHeaders,
  getSigningKey,
  inspectUnsubscribeToken,
  verifyUnsubscribeToken,
};
