import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const endpointSource = readFileSync(join(repoRoot, 'netlify-functions/get-api-key.js'), 'utf8');
const secretsSource = readFileSync(join(repoRoot, 'netlify-functions/utils/api-key-secrets.js'), 'utf8');
const validatorSource = readFileSync(join(repoRoot, 'netlify-functions/utils/api-key-validator.js'), 'utf8');
const migrationSource = readFileSync(
  join(repoRoot, 'supabase/migrations/20260806153415_secure_api_key_storage.sql'),
  'utf8'
);

describe('M5 API-key storage wiring', () => {
  it('does not retain the predictable fallback generator', () => {
    expect(endpointSource).not.toContain('Math.random');
    expect(endpointSource).toContain('generateApiKey()');
    expect(secretsSource).toContain('randomBytes(32)');
  });

  it('validates through the hash and keeps legacy migration explicit', () => {
    expect(validatorSource).toContain(".eq('api_key_hash', apiKeyHash)");
    expect(validatorSource).toContain('encryptApiKey(apiKey)');
    expect(validatorSource).toContain("api_key: null");
  });

  it('adds hashed and encrypted columns and closes the plaintext RPC route', () => {
    expect(migrationSource).toContain('add column if not exists api_key_hash text');
    expect(migrationSource).toContain('add column if not exists api_key_encrypted text');
    expect(migrationSource).toContain("digest(p_api_key, 'sha256')");
    expect(migrationSource).toContain('revoke all on function public.get_or_create_api_key(uuid)');
  });
});
