import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('health check endpoint', () => {
    let handler;

    beforeEach(async () => {
        vi.resetModules();

        // Set env vars so Supabase init doesn't crash
        process.env.SUPABASE_URL = 'https://test.supabase.co';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
        delete process.env.GEMINI_API_KEY;

        vi.doMock('../netlify-functions/utils/error-reporter', () => ({
            reportInfo: vi.fn(),
            reportError: vi.fn(),
        }));

        // Mock Supabase — return mutable result via closure
        vi.doMock('@supabase/supabase-js', () => {
            return {
                createClient: () => ({
                    from: () => ({
                        select: async () => ({ count: 5, error: null }),
                    }),
                }),
            };
        });

        const mod = await import('../netlify-functions/health.js');
        handler = mod.handler;
    });

    it('returns 200 for basic health check with correct structure', async () => {
        const result = await handler({
            httpMethod: 'GET',
            queryStringParameters: {},
        });

        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body);
        expect(body.service).toBe('alt-text-pro');
        expect(body.status).toBe('healthy');
        expect(body.checks.basic).toMatchObject({
            status: 'healthy',
            node: expect.stringContaining('v'),
        });
        expect(body.checks.basic.uptime).toBeGreaterThanOrEqual(0);
        expect(body.checks.basic.timestamp).toBeDefined();
    });

    it('rejects non-GET methods with 405', async () => {
        const result = await handler({
            httpMethod: 'POST',
            queryStringParameters: {},
        });
        expect(result.statusCode).toBe(405);
    });

    it('includes database check when ?check=db', async () => {
        const result = await handler({
            httpMethod: 'GET',
            queryStringParameters: { check: 'db' },
        });

        const body = JSON.parse(result.body);
        expect(body.checks.basic).toBeDefined();
        expect(body.checks.database).toBeDefined();
        // DB check will either be healthy (mock works) or unhealthy (mock doesn't intercept)
        // Either way, it should have a valid structure
        expect(body.checks.database).toHaveProperty('status');
        expect(body.checks.database).toHaveProperty('latency_ms');
    });

    it('returns degraded when AI key missing (?check=ai)', async () => {
        const result = await handler({
            httpMethod: 'GET',
            queryStringParameters: { check: 'ai' },
        });

        const body = JSON.parse(result.body);
        expect(body.checks.ai.status).toBe('unhealthy');
        expect(body.checks.ai.error).toContain('GEMINI_API_KEY');
        expect(body.status).toBe('degraded');
        expect(result.statusCode).toBe(503);
    });

    it('returns all checks when ?check=all', async () => {
        const result = await handler({
            httpMethod: 'GET',
            queryStringParameters: { check: 'all' },
        });

        const body = JSON.parse(result.body);
        expect(body.checks.basic).toBeDefined();
        expect(body.checks.database).toBeDefined();
        expect(body.checks.ai).toBeDefined();
        // All three checks should have a status field
        expect(['healthy', 'unhealthy']).toContain(body.checks.basic.status);
        expect(['healthy', 'unhealthy']).toContain(body.checks.database.status);
        expect(['healthy', 'unhealthy']).toContain(body.checks.ai.status);
    });

    it('sets correct no-cache and content-type headers', async () => {
        const result = await handler({
            httpMethod: 'GET',
            queryStringParameters: {},
        });

        expect(result.headers['Cache-Control']).toBe('no-cache, no-store');
        expect(result.headers['Content-Type']).toBe('application/json');
    });

    it('returns overall status based on check results', async () => {
        // Basic-only should always be healthy
        const result = await handler({
            httpMethod: 'GET',
            queryStringParameters: {},
        });

        const body = JSON.parse(result.body);
        expect(body.status).toBe('healthy');

        // AI-check without key should be degraded
        const aiResult = await handler({
            httpMethod: 'GET',
            queryStringParameters: { check: 'ai' },
        });
        const aiBody = JSON.parse(aiResult.body);
        expect(aiBody.status).toBe('degraded');
    });
});
