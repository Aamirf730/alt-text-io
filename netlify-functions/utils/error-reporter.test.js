import { describe, it, expect, vi, beforeEach } from 'vitest';

// Reset modules before each test to get fresh state
beforeEach(() => {
    vi.resetModules();
    delete process.env.SENTRY_DSN;
});

describe('error-reporter', () => {
    it('reportError logs structured JSON to console.error', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => { });
        const { reportError } = await import('./error-reporter.js');

        reportError(new Error('test failure for person@example.com with alt_secret_key_123456'), {
            functionName: 'generate-alt-text',
            ip: '1.2.3.4',
            userId: 'usr_123',
            extra: { duration: 42, customer_email: 'person@example.com' },
        });

        expect(spy).toHaveBeenCalledOnce();
        const loggedString = spy.mock.calls[0][1];
        const parsed = JSON.parse(loggedString);

        expect(parsed.severity).toBe('error');
        expect(parsed.message).toContain('test failure for [redacted-email]');
        expect(parsed.message).toContain('[redacted-api-key]');
        expect(parsed.function).toBe('generate-alt-text');
        expect(parsed.ip).toBeUndefined();
        expect(parsed.userId).toBeUndefined();
        expect(parsed.extra.duration).toBe(42);
        expect(parsed.extra.customer_email).toBeUndefined();
        expect(parsed.stack).not.toContain('person@example.com');
        expect(parsed.timestamp).toBeDefined();

        spy.mockRestore();
    });

    it('reportWarning logs structured JSON to console.warn', async () => {
        const spy = vi.spyOn(console, 'warn').mockImplementation(() => { });
        const { reportWarning } = await import('./error-reporter.js');

        reportWarning('Slow request detected', {
            functionName: 'get-usage',
            extra: { duration: 6000 },
        });

        expect(spy).toHaveBeenCalledOnce();
        const parsed = JSON.parse(spy.mock.calls[0][1]);
        expect(parsed.severity).toBe('warning');
        expect(parsed.message).toBe('Slow request detected');
        expect(parsed.extra.duration).toBe(6000);

        spy.mockRestore();
    });

    it('reportInfo logs structured JSON to console.log', async () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => { });
        const { reportInfo } = await import('./error-reporter.js');

        reportInfo('Function started', { functionName: 'health' });

        expect(spy).toHaveBeenCalledOnce();
        const parsed = JSON.parse(spy.mock.calls[0][1]);
        expect(parsed.severity).toBe('info');
        expect(parsed.message).toBe('Function started');

        spy.mockRestore();
    });

    it('withErrorReporting catches unhandled errors and returns 500', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => { });
        const { withErrorReporting } = await import('./error-reporter.js');

        const failingHandler = async () => {
            throw new Error('unhandled crash');
        };

        const wrapped = withErrorReporting('test-fn', failingHandler);
        const result = await wrapped(
            { headers: {}, httpMethod: 'GET', path: '/test' },
            {}
        );

        expect(result.statusCode).toBe(500);
        const body = JSON.parse(result.body);
        expect(body.error).toBe('Internal server error');
        expect(body.requestId).toBeDefined();

        console.error.mockRestore();
    });

    it('withErrorReporting passes through successful responses', async () => {
        const { withErrorReporting } = await import('./error-reporter.js');

        const successHandler = async () => ({
            statusCode: 200,
            body: JSON.stringify({ ok: true }),
        });

        const wrapped = withErrorReporting('test-fn', successHandler);
        const result = await wrapped(
            { headers: {}, httpMethod: 'GET', path: '/test' },
            {}
        );

        expect(result.statusCode).toBe(200);
    });

    it('handles string errors gracefully', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => { });
        const { reportError } = await import('./error-reporter.js');

        reportError('plain string error', { functionName: 'test' });

        const parsed = JSON.parse(console.error.mock.calls[0][1]);
        expect(parsed.message).toBe('plain string error');
        expect(parsed.stack).toBeUndefined();

        console.error.mockRestore();
    });

    it('sanitizes request IDs and object values nested inside arrays', async () => {
        const spy = vi.spyOn(console, 'warn').mockImplementation(() => { });
        const { reportWarning } = await import('./error-reporter.js');

        reportWarning('Nested context', {
            functionName: 'test',
            requestId: `request-person@example.com-${'x'.repeat(200)}`,
            extra: {
                events: [{
                    label: 'safe',
                    customer_email: 'person@example.com',
                    nested: [{ api_key: 'alt_secret_key_123456', count: 2 }],
                }],
            },
        });

        const parsed = JSON.parse(spy.mock.calls[0][1]);
        expect(parsed.requestId).not.toContain('person@example.com');
        expect(parsed.requestId.length).toBeLessThanOrEqual(128);
        expect(parsed.extra.events[0]).toEqual({ label: 'safe', nested: [{ count: 2 }] });

        spy.mockRestore();
    });
});
