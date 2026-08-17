import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import healthModule from '../netlify-functions/health.js';

const { handler, _private } = healthModule;

afterEach(() => {
  delete process.env.HEALTH_CHECK_SECRET;
});

beforeEach(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.RATE_LIMIT_ALLOW_MEMORY_FALLBACK;
  delete process.env.NETLIFY;
  delete process.env.CONTEXT;
  process.env.NODE_ENV = 'test';
});

describe('health endpoint', () => {
  it('keeps public liveness output free of runtime and deploy metadata', async () => {
    const response = await handler({
      httpMethod: 'GET',
      headers: {},
      queryStringParameters: {},
    });
    const body = JSON.parse(response.body);
    const basic = body.checks.basic;

    expect(response.statusCode).toBe(200);
    expect(basic.status).toBe('healthy');
    expect(basic).not.toHaveProperty('branch');
    expect(basic).not.toHaveProperty('node');
    expect(basic).not.toHaveProperty('version');
    expect(basic).not.toHaveProperty('uptime');
  });

  it('blocks detailed checks without the configured header secret', async () => {
    process.env.HEALTH_CHECK_SECRET = 'correct-secret';
    const response = await handler({
      httpMethod: 'GET',
      headers: {},
      queryStringParameters: { check: 'all' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('compares health-check secrets exactly', () => {
    expect(_private.secretsMatch('same-secret', 'same-secret')).toBe(true);
    expect(_private.secretsMatch('same-secretx', 'same-secret')).toBe(false);
    expect(_private.secretsMatch('', 'same-secret')).toBe(false);
  });
});
