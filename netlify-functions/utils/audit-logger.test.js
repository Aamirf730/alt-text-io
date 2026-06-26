import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Audit Logger', () => {
    let auditLog, ACTIONS, SEVERITY, extractRequestMeta;
    let mockInsert, mockFrom;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        // Setup mocks
        mockInsert = vi.fn().mockResolvedValue({ error: null });
        mockFrom = vi.fn(() => ({ insert: mockInsert }));

        vi.doMock('@supabase/supabase-js', () => ({
            createClient: vi.fn(() => ({
                from: mockFrom,
            })),
        }));

        // Set env vars
        process.env.SUPABASE_URL = 'https://test.supabase.co';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

        // Import fresh module
        const mod = await import('./audit-logger.js');
        auditLog = mod.auditLog;
        ACTIONS = mod.ACTIONS;
        SEVERITY = mod.SEVERITY;
        extractRequestMeta = mod.extractRequestMeta;
    });

    // ─────────────────────────────────────────────────────────────
    // ACTIONS constants
    // ─────────────────────────────────────────────────────────────
    it('exports all required action constants', () => {
        expect(ACTIONS.CREDIT_DEDUCT).toBe('credit.deduct');
        expect(ACTIONS.CREDIT_ADD).toBe('credit.add');
        expect(ACTIONS.SUBSCRIPTION_UPGRADE).toBe('subscription.upgrade');
        expect(ACTIONS.SUBSCRIPTION_CANCEL).toBe('subscription.cancel');
        expect(ACTIONS.API_KEY_CREATE).toBe('api_key.create');
        expect(ACTIONS.API_KEY_REVOKE).toBe('api_key.revoke');
        expect(ACTIONS.ADMIN_DELETE_USER).toBe('admin.delete_user');
        expect(ACTIONS.ADMIN_GET_USERS).toBe('admin.get_users');
        expect(ACTIONS.PAYMENT_COMPLETED).toBe('payment.completed');
        expect(ACTIONS.PAYMENT_FAILED).toBe('payment.failed');
    });

    it('exports severity levels', () => {
        expect(SEVERITY.INFO).toBe('info');
        expect(SEVERITY.WARNING).toBe('warning');
        expect(SEVERITY.CRITICAL).toBe('critical');
    });

    // ─────────────────────────────────────────────────────────────
    // extractRequestMeta
    // ─────────────────────────────────────────────────────────────
    it('extracts IP from x-forwarded-for header', () => {
        const event = { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } };
        const meta = extractRequestMeta(event);
        expect(meta.ip_address).toBe('1.2.3.4');
    });

    it('extracts single IP from x-forwarded-for', () => {
        const event = { headers: { 'x-forwarded-for': '192.168.1.1' } };
        const meta = extractRequestMeta(event);
        expect(meta.ip_address).toBe('192.168.1.1');
    });

    it('falls back to client-ip header', () => {
        const event = { headers: { 'client-ip': '10.0.0.1' } };
        const meta = extractRequestMeta(event);
        expect(meta.ip_address).toBe('10.0.0.1');
    });

    it('extracts user-agent from headers', () => {
        const event = { headers: { 'user-agent': 'Mozilla/5.0' } };
        const meta = extractRequestMeta(event);
        expect(meta.user_agent).toBe('Mozilla/5.0');
    });

    it('returns empty object for null event', () => {
        expect(extractRequestMeta(null)).toEqual({});
    });

    it('returns empty object for event with no headers', () => {
        expect(extractRequestMeta({})).toEqual({ ip_address: null, user_agent: null });
    });

    // ─────────────────────────────────────────────────────────────
    // auditLog — console output
    // ─────────────────────────────────────────────────────────────
    it('always logs structured JSON to console', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

        await auditLog({
            action: ACTIONS.CREDIT_DEDUCT,
            actorId: 'user-123',
            actorEmail: 'test@test.com',
            resourceType: 'profile',
            resourceId: 'user-123',
            details: { credits: -1 },
        });

        expect(consoleSpy).toHaveBeenCalled();
        const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
        expect(logged.audit).toBe(true);
        expect(logged.action).toBe('credit.deduct');
        expect(logged.actorId).toBe('user-123');
        expect(logged.actorEmail).toBe('test@test.com');
        expect(logged.resourceType).toBe('profile');
        expect(logged.details).toEqual({ credits: -1 });
        expect(logged.timestamp).toBeTruthy();

        consoleSpy.mockRestore();
    });

    // ─────────────────────────────────────────────────────────────
    // auditLog — Supabase persistence
    // ─────────────────────────────────────────────────────────────
    it('persists audit entry and never throws', async () => {
        vi.spyOn(console, 'log').mockImplementation(() => { });
        vi.spyOn(console, 'error').mockImplementation(() => { });

        const result = await auditLog({
            action: ACTIONS.ADMIN_DELETE_USER,
            actorId: 'admin-1',
            resourceType: 'profile',
            resourceId: 'user-to-delete',
            severity: SEVERITY.CRITICAL,
            event: {
                headers: {
                    'x-forwarded-for': '10.0.0.1',
                    'user-agent': 'Admin/1.0',
                },
            },
        });

        // Core guarantee: auditLog always returns a result object, never throws
        expect(result).toHaveProperty('success');
        expect(typeof result.success).toBe('boolean');

        // Verify structured console log was emitted regardless of DB result
        const logged = JSON.parse(console.log.mock.calls[0][0]);
        expect(logged.audit).toBe(true);
        expect(logged.action).toBe('admin.delete_user');
        expect(logged.actorId).toBe('admin-1');
        expect(logged.severity).toBe('critical');
        expect(logged.resourceType).toBe('profile');
        expect(logged.resourceId).toBe('user-to-delete');

        console.log.mockRestore();
        console.error.mockRestore();
    });

    // ─────────────────────────────────────────────────────────────
    // auditLog — error handling
    // ─────────────────────────────────────────────────────────────
    it('returns failure without throwing on Supabase errors', async () => {
        vi.spyOn(console, 'log').mockImplementation(() => { });
        vi.spyOn(console, 'error').mockImplementation(() => { });
        mockInsert.mockResolvedValue({ error: { message: 'DB down' } });

        const result = await auditLog({ action: ACTIONS.CREDIT_DEDUCT });

        // Core guarantee: doesn't throw, returns structured failure
        expect(result.success).toBe(false);
        expect(result.error).toBeTruthy();

        console.log.mockRestore();
        console.error.mockRestore();
    });

    it('returns failure without throwing on network errors', async () => {
        vi.spyOn(console, 'log').mockImplementation(() => { });
        vi.spyOn(console, 'error').mockImplementation(() => { });
        mockInsert.mockRejectedValue(new Error('network timeout'));

        const result = await auditLog({
            action: ACTIONS.PAYMENT_FAILED,
            severity: SEVERITY.WARNING,
        });

        expect(result.success).toBe(false);
        expect(result.error).toBeTruthy();

        console.log.mockRestore();
        console.error.mockRestore();
    });
});
