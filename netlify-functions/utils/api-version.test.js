import { describe, it, expect } from 'vitest';
const {
    API_VERSION,
    VERSIONS,
    detectVersion,
    addVersionHeaders,
    withApiVersion,
} = require('./api-version.js');

describe('api-version', () => {
    // ─────────────────────────────────────────────────────────
    // detectVersion
    // ─────────────────────────────────────────────────────────
    describe('detectVersion', () => {
        it('detects version from path prefix', () => {
            const event = { path: '/api/v1/generate-alt-text', headers: {} };
            expect(detectVersion(event)).toBe('v1');
        });

        it('detects version from X-API-Version header', () => {
            const event = { path: '/api/something', headers: { 'x-api-version': 'v1' } };
            expect(detectVersion(event)).toBe('v1');
        });

        it('defaults to current version when none specified', () => {
            const event = { path: '/.netlify/functions/health', headers: {} };
            expect(detectVersion(event)).toBe(API_VERSION);
        });

        it('ignores unknown versions in path', () => {
            const event = { path: '/api/v99/something', headers: {} };
            expect(detectVersion(event)).toBe(API_VERSION);
        });

        it('prefers path version over header', () => {
            const event = {
                path: '/api/v1/test',
                headers: { 'x-api-version': 'v1' },
            };
            expect(detectVersion(event)).toBe('v1');
        });
    });

    // ─────────────────────────────────────────────────────────
    // addVersionHeaders
    // ─────────────────────────────────────────────────────────
    describe('addVersionHeaders', () => {
        it('adds X-API-Version header', () => {
            const response = { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: '{}' };
            const result = addVersionHeaders(response);
            expect(result.headers['X-API-Version']).toBe(API_VERSION);
            expect(result.headers['Content-Type']).toBe('application/json'); // preserves existing
        });

        it('does not set Deprecation header for current version', () => {
            const result = addVersionHeaders({ statusCode: 200, headers: {} });
            expect(result.headers['Deprecation']).toBeUndefined();
        });
    });

    // ─────────────────────────────────────────────────────────
    // withApiVersion wrapper
    // ─────────────────────────────────────────────────────────
    describe('withApiVersion', () => {
        it('wraps a handler and adds version headers', async () => {
            const inner = async (event) => ({
                statusCode: 200,
                headers: {},
                body: JSON.stringify({ version: event.apiVersion }),
            });

            const wrapped = withApiVersion(inner);
            const result = await wrapped(
                { path: '/api/v1/test', headers: {} },
                {}
            );

            expect(result.statusCode).toBe(200);
            expect(result.headers['X-API-Version']).toBe('v1');
            const body = JSON.parse(result.body);
            expect(body.version).toBe('v1');
        });

        it('injects apiVersion into event object', async () => {
            let captured;
            const inner = async (event) => {
                captured = event.apiVersion;
                return { statusCode: 200, headers: {} };
            };

            const wrapped = withApiVersion(inner);
            await wrapped({ path: '/.netlify/functions/test', headers: {} }, {});

            expect(captured).toBe(API_VERSION);
        });
    });

    // ─────────────────────────────────────────────────────────
    // VERSIONS config
    // ─────────────────────────────────────────────────────────
    describe('VERSIONS config', () => {
        it('has v1 as current and not deprecated', () => {
            expect(VERSIONS.v1.current).toBe(true);
            expect(VERSIONS.v1.deprecated).toBe(false);
        });
    });
});
