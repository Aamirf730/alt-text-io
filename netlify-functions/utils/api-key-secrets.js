const crypto = require('node:crypto');

const ENCRYPTION_VERSION = 'v1';
const IV_BYTES = 12;

function hashApiKey(apiKey) {
  return crypto
    .createHash('sha256')
    .update(String(apiKey), 'utf8')
    .digest('hex');
}

function generateApiKey() {
  return `alt_${crypto.randomBytes(32).toString('base64url')}`;
}

function getEncryptionKey() {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error('API key encryption secret is not configured');
  }

  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

function encryptApiKey(apiKey) {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(String(apiKey), 'utf8'),
    cipher.final(),
  ]);

  return [
    ENCRYPTION_VERSION,
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

function decryptApiKey(encryptedApiKey) {
  if (typeof encryptedApiKey !== 'string') return null;

  const [version, ivEncoded, tagEncoded, ciphertextEncoded] = encryptedApiKey.split('.');
  if (version !== ENCRYPTION_VERSION || !ivEncoded || !tagEncoded || !ciphertextEncoded) {
    return null;
  }

  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      getEncryptionKey(),
      Buffer.from(ivEncoded, 'base64url')
    );
    decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'));

    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextEncoded, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch (_error) {
    return null;
  }
}

module.exports = {
  decryptApiKey,
  encryptApiKey,
  generateApiKey,
  hashApiKey,
};
