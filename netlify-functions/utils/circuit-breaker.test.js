import { describe, it, expect, vi, beforeEach } from 'vitest';
const { CircuitBreaker, STATES, getBreaker, getAllBreakerStatuses } = require('./circuit-breaker.js');

describe('CircuitBreaker', () => {
    let breaker;

    beforeEach(() => {
        breaker = new CircuitBreaker('test-service', {
            failureThreshold: 3,
            resetTimeout: 1000,
            successThreshold: 2,
        });
    });

    // ─────────────────────────────────────────────────────────────
    // CLOSED state
    // ─────────────────────────────────────────────────────────────
    it('starts in CLOSED state', () => {
        expect(breaker.state).toBe(STATES.CLOSED);
    });

    it('passes calls through in CLOSED state', async () => {
        const result = await breaker.call(async () => 'ok');
        expect(result).toBe('ok');
    });

    it('remains CLOSED after failures below threshold', async () => {
        for (let i = 0; i < 2; i++) {
            await breaker.call(async () => { throw new Error('fail'); }).catch(() => { });
        }
        expect(breaker.state).toBe(STATES.CLOSED);
        expect(breaker.failureCount).toBe(2);
    });

    // ─────────────────────────────────────────────────────────────
    // OPEN state
    // ─────────────────────────────────────────────────────────────
    it('opens after reaching failure threshold', async () => {
        for (let i = 0; i < 3; i++) {
            await breaker.call(async () => { throw new Error('fail'); }).catch(() => { });
        }
        expect(breaker.state).toBe(STATES.OPEN);
    });

    it('fails fast when OPEN (no function call)', async () => {
        // Open the breaker
        for (let i = 0; i < 3; i++) {
            await breaker.call(async () => { throw new Error('fail'); }).catch(() => { });
        }

        const fn = vi.fn();
        try {
            await breaker.call(fn);
        } catch (err) {
            expect(err.code).toBe('CIRCUIT_OPEN');
            expect(err.service).toBe('test-service');
        }
        expect(fn).not.toHaveBeenCalled(); // Function was never invoked
    });

    // ─────────────────────────────────────────────────────────────
    // HALF_OPEN state
    // ─────────────────────────────────────────────────────────────
    it('transitions to HALF_OPEN after reset timeout', async () => {
        breaker = new CircuitBreaker('test', {
            failureThreshold: 2,
            resetTimeout: 50, // 50ms for fast test
            successThreshold: 1,
        });

        // Open the breaker
        await breaker.call(async () => { throw new Error('fail'); }).catch(() => { });
        await breaker.call(async () => { throw new Error('fail'); }).catch(() => { });
        expect(breaker.state).toBe(STATES.OPEN);

        // Wait for reset timeout
        await new Promise((r) => setTimeout(r, 60));

        // Next call should transition to HALF_OPEN and pass through
        const result = await breaker.call(async () => 'recovered');
        expect(result).toBe('recovered');
        expect(breaker.state).toBe(STATES.CLOSED); // successThreshold=1, so 1 success closes
    });

    it('goes back to OPEN on failure in HALF_OPEN', async () => {
        breaker = new CircuitBreaker('test', {
            failureThreshold: 2,
            resetTimeout: 50,
            successThreshold: 2,
        });

        // Open
        await breaker.call(async () => { throw new Error('fail'); }).catch(() => { });
        await breaker.call(async () => { throw new Error('fail'); }).catch(() => { });

        // Wait for timeout
        await new Promise((r) => setTimeout(r, 60));

        // Fail in half-open → back to OPEN
        await breaker.call(async () => { throw new Error('still down'); }).catch(() => { });
        expect(breaker.state).toBe(STATES.OPEN);
    });

    // ─────────────────────────────────────────────────────────────
    // Success resets failure count
    // ─────────────────────────────────────────────────────────────
    it('resets failure count on success', async () => {
        await breaker.call(async () => { throw new Error('fail'); }).catch(() => { });
        await breaker.call(async () => { throw new Error('fail'); }).catch(() => { });
        expect(breaker.failureCount).toBe(2);

        await breaker.call(async () => 'ok');
        expect(breaker.failureCount).toBe(0);
    });

    // ─────────────────────────────────────────────────────────────
    // getStatus
    // ─────────────────────────────────────────────────────────────
    it('returns correct status object', () => {
        const status = breaker.getStatus();
        expect(status.name).toBe('test-service');
        expect(status.state).toBe(STATES.CLOSED);
        expect(status.failureCount).toBe(0);
        expect(status.lastError).toBeNull();
    });

    // ─────────────────────────────────────────────────────────────
    // reset
    // ─────────────────────────────────────────────────────────────
    it('can be manually reset', async () => {
        for (let i = 0; i < 3; i++) {
            await breaker.call(async () => { throw new Error('fail'); }).catch(() => { });
        }
        expect(breaker.state).toBe(STATES.OPEN);

        breaker.reset();
        expect(breaker.state).toBe(STATES.CLOSED);
        expect(breaker.failureCount).toBe(0);
    });

    // ─────────────────────────────────────────────────────────────
    // onStateChange callback
    // ─────────────────────────────────────────────────────────────
    it('calls onStateChange on transitions', async () => {
        const changes = [];
        breaker = new CircuitBreaker('cb', {
            failureThreshold: 2,
            onStateChange: (name, from, to) => changes.push({ name, from, to }),
        });

        await breaker.call(async () => { throw new Error('a'); }).catch(() => { });
        await breaker.call(async () => { throw new Error('b'); }).catch(() => { });

        expect(changes).toEqual([
            { name: 'cb', from: STATES.CLOSED, to: STATES.OPEN },
        ]);
    });
});

describe('getBreaker / getAllBreakerStatuses', () => {
    it('returns same instance for same name', () => {
        const a = getBreaker('gemini');
        const b = getBreaker('gemini');
        expect(a).toBe(b);
    });

    it('getAllBreakerStatuses includes registered breakers', () => {
        getBreaker('polar');
        const statuses = getAllBreakerStatuses();
        const names = statuses.map((s) => s.name);
        expect(names).toContain('polar');
    });
});
