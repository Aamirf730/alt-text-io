import { describe, it, expect } from 'vitest';
import {
    ALLOWED_ORIGINS,
    getValidatedOrigin,
    getCorsHeaders,
    handlePreflight,
    getClientIp,
    rateLimitExceededResponse,
} from './cors.js';

describe('CORS utilities', () => {
    describe('ALLOWED_ORIGINS', () => {
        it('includes the production domain', () => {
            expect(ALLOWED_ORIGINS).toContain('https://www.alt-text.pro');
        });

        it('includes localhost for development', () => {
            expect(ALLOWED_ORIGINS).toContain('http://localhost:3000');
        });
    });

    describe('getValidatedOrigin', () => {
        it('returns null when no origin header is present', () => {
            expect(getValidatedOrigin({})).toBeNull();
        });

        it('accepts allowed origins', () => {
            const result = getValidatedOrigin({ origin: 'https://www.alt-text.pro' });
            expect(result).toBe('https://www.alt-text.pro');
        });

        it('rejects unknown origins', () => {
            const result = getValidatedOrigin({ origin: 'https://evil-site.com' });
            expect(result).toBeNull();
        });
    });

    describe('getCorsHeaders', () => {
        it('returns standard CORS headers', () => {
            const headers = getCorsHeaders({});
            expect(headers['Content-Type']).toBe('application/json');
            expect(headers['Access-Control-Max-Age']).toBe('86400');
            expect(headers['Access-Control-Allow-Methods']).toContain('GET');
        });

        it('sets Access-Control-Allow-Origin for valid origins', () => {
            const headers = getCorsHeaders({ origin: 'https://www.alt-text.pro' });
            expect(headers['Access-Control-Allow-Origin']).toBe('https://www.alt-text.pro');
            expect(headers['Access-Control-Allow-Credentials']).toBe('true');
        });

        it('does not set Access-Control-Allow-Origin for invalid origins', () => {
            const headers = getCorsHeaders({ origin: 'https://evil.com' });
            expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
            expect(headers['Access-Control-Allow-Credentials']).toBeUndefined();
        });
    });

    describe('handlePreflight', () => {
        it('returns 204 for OPTIONS requests', () => {
            const event = { httpMethod: 'OPTIONS', headers: {} };
            const result = handlePreflight(event);
            expect(result).not.toBeNull();
            expect(result.statusCode).toBe(204);
        });

        it('returns null for non-OPTIONS requests', () => {
            const event = { httpMethod: 'GET', headers: {} };
            expect(handlePreflight(event)).toBeNull();
        });
    });

    describe('getClientIp', () => {
        it('extracts IP from x-forwarded-for', () => {
            const event = { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } };
            expect(getClientIp(event)).toBe('1.2.3.4');
        });

        it('falls back to client-ip header', () => {
            const event = { headers: { 'client-ip': '9.8.7.6' } };
            expect(getClientIp(event)).toBe('9.8.7.6');
        });

        it('returns "unknown" when no IP headers present', () => {
            const event = { headers: {} };
            expect(getClientIp(event)).toBe('unknown');
        });
    });

    describe('rateLimitExceededResponse', () => {
        it('returns a 429 response with rate-limit headers', () => {
            const resetAt = new Date(Date.now() + 30_000);
            const response = rateLimitExceededResponse(
                { 'Content-Type': 'application/json' },
                {
                    limit: 12,
                    remaining: 0,
                    resetAt,
                    instanceId: 'test-instance',
                }
            );

            expect(response.statusCode).toBe(429);
            expect(response.headers['X-RateLimit-Limit']).toBe('12');
            expect(response.headers['X-RateLimit-Remaining']).toBe('0');
            expect(response.headers['X-RateLimit-Reset']).toBe(resetAt.toISOString());
            expect(JSON.parse(response.body).error).toBe('Too many requests');
        });
    });
});
