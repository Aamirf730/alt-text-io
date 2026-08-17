import { describe, it, expect, beforeEach } from 'vitest';
import {
  decryptApiKey,
  encryptApiKey,
  generateApiKey,
  hashApiKey,
} from './api-key-secrets.js';

describe('API key secret utilities', () => {
  beforeEach(() => {
    process.env.API_KEY_ENCRYPTION_SECRET = 'test-api-key-encryption-secret';
  });

  it('generates unpredictable, correctly prefixed keys', () => {
    const first = generateApiKey();
    const second = generateApiKey();

    expect(first).toMatch(/^alt_[A-Za-z0-9_-]{43}$/);
    expect(second).toMatch(/^alt_[A-Za-z0-9_-]{43}$/);
    expect(first).not.toBe(second);
  });

  it('hashes keys deterministically without exposing the key', () => {
    expect(hashApiKey('alt_test')).toBe(hashApiKey('alt_test'));
    expect(hashApiKey('alt_test')).not.toBe('alt_test');
  });

  it('round-trips encrypted keys', () => {
    const key = 'alt_test_secret';
    const encrypted = encryptApiKey(key);

    expect(encrypted).toMatch(/^v1\./);
    expect(decryptApiKey(encrypted)).toBe(key);
  });

  it('rejects tampered ciphertext', () => {
    const encrypted = encryptApiKey('alt_test_secret');
    const parts = encrypted.split('.');
    const replacement = parts[3][0] === 'A' ? 'B' : 'A';
    parts[3] = `${replacement}${parts[3].slice(1)}`;

    expect(decryptApiKey(parts.join('.'))).toBeNull();
  });

  it('fails closed instead of deriving encryption from the service-role key', () => {
    const originalEncryptionSecret = process.env.API_KEY_ENCRYPTION_SECRET;
    const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    delete process.env.API_KEY_ENCRYPTION_SECRET;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key-that-must-not-be-used';

    expect(() => encryptApiKey('alt_test_secret')).toThrow('API_KEY_ENCRYPTION_SECRET is not configured');

    if (originalEncryptionSecret === undefined) delete process.env.API_KEY_ENCRYPTION_SECRET;
    else process.env.API_KEY_ENCRYPTION_SECRET = originalEncryptionSecret;
    if (originalServiceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey;
  });
});
