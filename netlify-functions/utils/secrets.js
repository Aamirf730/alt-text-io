const { timingSafeEqual } = require('node:crypto');

/**
 * Constant-time comparison of a provided secret with the configured one.
 * An empty or missing value on either side is "not configured" and never
 * matches: two empty buffers would otherwise compare equal.
 */
function secretsMatch(provided, expected) {
  if (provided === undefined || provided === null || expected === undefined || expected === null) return false;

  const providedBuffer = Buffer.from(String(provided), 'utf8');
  const expectedBuffer = Buffer.from(String(expected), 'utf8');
  if (providedBuffer.length === 0 || expectedBuffer.length === 0) return false;
  if (providedBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

module.exports = { secretsMatch };
