import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { cn, PLUGIN_VERSION, getApiBase } from './utils';

describe('cn (className utility)', () => {
    it('merges class names', () => {
        expect(cn('foo', 'bar')).toBe('foo bar');
    });

    it('handles conditional classes', () => {
        expect(cn('base', false && 'hidden', 'active')).toBe('base active');
    });

    it('merges tailwind classes correctly', () => {
        // tailwind-merge should resolve px conflicts
        expect(cn('px-2', 'px-4')).toBe('px-4');
    });
});

describe('PLUGIN_VERSION', () => {
    it('is a valid semver-like string', () => {
        expect(PLUGIN_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('matches the WordPress plugin header version', () => {
        const pluginPhpPath = path.resolve(__dirname, '../../../wordpress-plugin/alt-text-pro/alt-text-pro.php');
        const pluginPhp = fs.readFileSync(pluginPhpPath, 'utf8');
        const versionMatch = pluginPhp.match(/^\s*\*\s+Version:\s*([0-9]+\.[0-9]+\.[0-9]+)\s*$/m);

        expect(versionMatch?.[1]).toBe(PLUGIN_VERSION);
    });
});

describe('getApiBase', () => {
    beforeEach(() => {
        vi.unstubAllGlobals();
        delete process.env.NEXT_PUBLIC_API_BASE;
    });

    it('returns relative path when window is undefined (SSR)', () => {
        // In SSR, window is undefined
        vi.stubGlobal('window', undefined);
        expect(getApiBase()).toBe('/.netlify/functions');
    });

    it('returns localhost URL for local development', () => {
        vi.stubGlobal('window', { location: { hostname: 'localhost' } });
        expect(getApiBase()).toBe('http://localhost:9999/.netlify/functions');
    });

    it('uses NEXT_PUBLIC_API_BASE on localhost when set', () => {
        process.env.NEXT_PUBLIC_API_BASE = 'http://localhost:8888/.netlify/functions';
        vi.stubGlobal('window', { location: { hostname: 'localhost' } });
        expect(getApiBase()).toBe('http://localhost:8888/.netlify/functions');
    });

    it('returns relative path for production domains', () => {
        vi.stubGlobal('window', { location: { hostname: 'www.alt-text.pro' } });
        expect(getApiBase()).toBe('/.netlify/functions');
    });

    it('ignores localhost env var in production', () => {
        process.env.NEXT_PUBLIC_API_BASE = 'http://localhost:9999/.netlify/functions';
        vi.stubGlobal('window', { location: { hostname: 'www.alt-text.pro' } });

        // Should warn and return relative path
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
        expect(getApiBase()).toBe('/.netlify/functions');
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    it('uses NEXT_PUBLIC_API_BASE in production when valid', () => {
        process.env.NEXT_PUBLIC_API_BASE = '/.netlify/functions';
        vi.stubGlobal('window', { location: { hostname: 'www.alt-text.pro' } });
        expect(getApiBase()).toBe('/.netlify/functions');
    });
});
