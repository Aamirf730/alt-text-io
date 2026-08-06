import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const TEST_SECRET = 'm5-test-encryption-secret';

beforeEach(() => {
  process.env.API_KEY_ENCRYPTION_SECRET = TEST_SECRET;
});

afterEach(() => {
  delete process.env.API_KEY_ENCRYPTION_SECRET;
});

describe('API key secrets', () => {
  it('generates a high-entropy key without user or timestamp material', async () => {
    const { generateApiKey } = await import('./api-key-secrets.js');
    const first = generateApiKey();
    const second = generateApiKey();

    expect(first).toMatch(/^alt_[A-Za-z0-9_-]{43}$/);
    expect(second).toMatch(/^alt_[A-Za-z0-9_-]{43}$/);
    expect(second).not.toBe(first);
  });

  it('hashes API keys deterministically without returning the raw value', async () => {
    const { hashApiKey } = await import('./api-key-secrets.js');
    const key = 'alt_test_key_value';
    const hash = hashApiKey(key);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(key);
    expect(hashApiKey(key)).toBe(hash);
  });

  it('encrypts and decrypts API keys with authenticated encryption', async () => {
    const { decryptApiKey, encryptApiKey } = await import('./api-key-secrets.js');
    const key = 'alt_a_secret_that_must_not_be_stored_plaintext';
    const encrypted = encryptApiKey(key);

    expect(encrypted).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(encrypted).not.toContain(key);
    expect(decryptApiKey(encrypted)).toBe(key);
  });

  it('rejects tampered ciphertext', async () => {
    const { decryptApiKey, encryptApiKey } = await import('./api-key-secrets.js');
    const encrypted = encryptApiKey('alt_tamper_test');
    const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith('A') ? 'B' : 'A'}`;

    expect(decryptApiKey(tampered)).toBeNull();
  });
});
