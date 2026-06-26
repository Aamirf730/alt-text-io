import { describe, it, expect } from 'vitest';
const {
    parseJsonBody,
    sanitizeString,
    validateString,
    validateEmail,
    validateEmailArray,
    validateAuthToken,
    badRequest,
    unauthorized,
    LIMITS,
} = require('./input-validator.js');

// ═══════════════════════════════════════════════════════════════════════════════
// parseJsonBody
// ═══════════════════════════════════════════════════════════════════════════════
describe('parseJsonBody', () => {
    it('parses valid JSON', () => {
        const { data, error } = parseJsonBody('{"name":"test"}');
        expect(error).toBeNull();
        expect(data).toEqual({ name: 'test' });
    });

    it('rejects empty body', () => {
        const { data, error } = parseJsonBody(null);
        expect(data).toBeNull();
        expect(error).toBe('Request body is required');
    });

    it('rejects invalid JSON', () => {
        const { data, error } = parseJsonBody('{bad json}');
        expect(data).toBeNull();
        expect(error).toBe('Invalid JSON in request body');
    });

    it('rejects arrays', () => {
        const { data, error } = parseJsonBody('[1,2,3]');
        expect(data).toBeNull();
        expect(error).toBe('Request body must be a JSON object');
    });

    it('rejects oversized body', () => {
        const big = JSON.stringify({ x: 'a'.repeat(100) });
        const { data, error } = parseJsonBody(big, { maxSize: 10 });
        expect(data).toBeNull();
        expect(error).toContain('exceeds maximum size');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// sanitizeString
// ═══════════════════════════════════════════════════════════════════════════════
describe('sanitizeString', () => {
    it('trims whitespace', () => {
        expect(sanitizeString('  hello  ')).toBe('hello');
    });

    it('strips HTML tags by default', () => {
        expect(sanitizeString('<script>alert(1)</script>')).toBe('alert(1)');
        expect(sanitizeString('Hello <b>world</b>')).toBe('Hello world');
    });

    it('preserves HTML when stripHtml is false', () => {
        expect(sanitizeString('<b>bold</b>', { stripHtml: false })).toBe('<b>bold</b>');
    });

    it('handles null/undefined', () => {
        expect(sanitizeString(null)).toBe('');
        expect(sanitizeString(undefined)).toBe('');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// validateString
// ═══════════════════════════════════════════════════════════════════════════════
describe('validateString', () => {
    it('validates required field', () => {
        const { error } = validateString('', 'Name', { required: true });
        expect(error).toBe('Name is required');
    });

    it('passes valid string', () => {
        const { value, error } = validateString('  John  ', 'Name', { required: true, maxLength: 200 });
        expect(error).toBeNull();
        expect(value).toBe('John');
    });

    it('rejects too-long strings', () => {
        const { error } = validateString('a'.repeat(201), 'Name', { maxLength: 200 });
        expect(error).toContain('at most 200');
    });

    it('allows optional empty strings', () => {
        const { value, error } = validateString('', 'Subject');
        expect(error).toBeNull();
        expect(value).toBe('');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// validateEmail
// ═══════════════════════════════════════════════════════════════════════════════
describe('validateEmail', () => {
    it('accepts valid email', () => {
        const { value, error } = validateEmail('user@example.com', { required: true });
        expect(error).toBeNull();
        expect(value).toBe('user@example.com');
    });

    it('rejects missing required email', () => {
        const { error } = validateEmail('', { required: true });
        expect(error).toBe('Email is required');
    });

    it('rejects invalid email', () => {
        const { error } = validateEmail('not-an-email');
        expect(error).toBe('Invalid email format');
    });

    it('rejects too-long email', () => {
        const longEmail = 'a'.repeat(250) + '@b.com';
        const { error } = validateEmail(longEmail);
        expect(error).toContain('at most');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// validateEmailArray
// ═══════════════════════════════════════════════════════════════════════════════
describe('validateEmailArray', () => {
    it('validates valid email array', () => {
        const { value, error } = validateEmailArray(['a@b.com', 'c@d.com']);
        expect(error).toBeNull();
        expect(value).toHaveLength(2);
    });

    it('rejects non-array', () => {
        const { error } = validateEmailArray('not-an-array');
        expect(error).toBe('Expected an array of email addresses');
    });

    it('rejects empty array', () => {
        const { error } = validateEmailArray([]);
        expect(error).toBe('At least one email address is required');
    });

    it('enforces max items', () => {
        const emails = Array(51).fill('a@b.com');
        const { error } = validateEmailArray(emails, { maxItems: 50 });
        expect(error).toContain('Maximum of 50');
    });

    it('rejects array with invalid email', () => {
        const { error } = validateEmailArray(['a@b.com', 'bad-email']);
        expect(error).toContain('Invalid email at position 2');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// validateAuthToken
// ═══════════════════════════════════════════════════════════════════════════════
describe('validateAuthToken', () => {
    it('extracts Bearer token', () => {
        const { token, error } = validateAuthToken({ authorization: 'Bearer abc123' });
        expect(error).toBeNull();
        expect(token).toBe('abc123');
    });

    it('rejects missing header', () => {
        const { error } = validateAuthToken({});
        expect(error).toBe('Authorization header required');
    });

    it('rejects empty token', () => {
        const { error } = validateAuthToken({ authorization: 'Bearer ' });
        expect(error).toBe('Authorization token is empty');
    });

    it('rejects too-long token', () => {
        const longToken = 'Bearer ' + 'x'.repeat(5000);
        const { error } = validateAuthToken({ authorization: longToken });
        expect(error).toBe('Authorization token is too long');
    });

    it('rejects tokens with control characters', () => {
        const { error } = validateAuthToken({ authorization: 'Bearer abc\x00def' });
        expect(error).toBe('Authorization token contains invalid characters');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Response builders
// ═══════════════════════════════════════════════════════════════════════════════
describe('response builders', () => {
    it('badRequest returns 400', () => {
        const res = badRequest({ 'X-Custom': 'test' }, 'Invalid input');
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe('Invalid input');
    });

    it('unauthorized returns 401', () => {
        const res = unauthorized({}, 'Bad token');
        expect(res.statusCode).toBe(401);
        expect(JSON.parse(res.body).error).toBe('Bad token');
    });
});
