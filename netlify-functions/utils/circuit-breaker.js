/**
 * Circuit Breaker Pattern for External API Calls
 * File: netlify-functions/utils/circuit-breaker.js
 *
 * Prevents cascading failures when external services (Gemini, Polar, etc.)
 * are unavailable. After a threshold of failures, the circuit "opens" and
 * subsequent calls fail fast without hitting the external API, then
 * periodically retries to see if the service has recovered.
 *
 * States:
 *   CLOSED   → Normal operation. Calls pass through.
 *   OPEN     → Service is down. Calls fail immediately.
 *   HALF_OPEN → Testing if service recovered. One call passes through.
 *
 * Usage:
 *   const { CircuitBreaker } = require('./utils/circuit-breaker');
 *
 *   const geminiBreaker = new CircuitBreaker('gemini', {
 *     failureThreshold: 5,
 *     resetTimeout: 30000,
 *   });
 *
 *   const result = await geminiBreaker.call(async () => {
 *     return await fetch('https://generativelanguage.googleapis.com/...');
 *   });
 */

const STATES = {
    CLOSED: 'CLOSED',
    OPEN: 'OPEN',
    HALF_OPEN: 'HALF_OPEN',
};

class CircuitBreaker {
    /**
     * @param {string} name - Identifier for the service (for logging)
     * @param {Object} options
     * @param {number} [options.failureThreshold=5]  - Failures before opening
     * @param {number} [options.resetTimeout=30000]  - Ms before trying again (30s)
     * @param {number} [options.successThreshold=2]  - Successes in half-open to close
     * @param {Function} [options.onStateChange]     - Callback(name, from, to)
     */
    constructor(name, options = {}) {
        this.name = name;
        this.failureThreshold = options.failureThreshold ?? 5;
        this.resetTimeout = options.resetTimeout ?? 30000;
        this.successThreshold = options.successThreshold ?? 2;
        this.onStateChange = options.onStateChange ?? null;

        this.state = STATES.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
        this.lastError = null;
    }

    /**
     * Execute a function through the circuit breaker.
     *
     * @param {Function} fn - Async function to execute
     * @returns {Promise<*>} Result of fn
     * @throws {Error} If circuit is open or fn throws
     */
    async call(fn) {
        // ── OPEN STATE ──────────────────────────────────────────────
        if (this.state === STATES.OPEN) {
            const elapsed = Date.now() - this.lastFailureTime;

            if (elapsed < this.resetTimeout) {
                const error = new Error(
                    `Circuit breaker OPEN for ${this.name}: ${this.lastError?.message || 'service unavailable'}. ` +
                    `Retry in ${Math.ceil((this.resetTimeout - elapsed) / 1000)}s.`
                );
                error.code = 'CIRCUIT_OPEN';
                error.service = this.name;
                throw error;
            }

            // Timeout elapsed → try half-open
            this._transition(STATES.HALF_OPEN);
        }

        // ── CLOSED or HALF_OPEN ────────────────────────────────────
        try {
            const result = await fn();
            this._onSuccess();
            return result;
        } catch (error) {
            this._onFailure(error);
            throw error;
        }
    }

    /** Record a successful call */
    _onSuccess() {
        if (this.state === STATES.HALF_OPEN) {
            this.successCount++;
            if (this.successCount >= this.successThreshold) {
                this._transition(STATES.CLOSED);
            }
        }
        // In CLOSED state, reset failure count on success
        this.failureCount = 0;
    }

    /** Record a failed call */
    _onFailure(error) {
        this.failureCount++;
        this.lastError = error;
        this.lastFailureTime = Date.now();

        if (this.state === STATES.HALF_OPEN) {
            // Any failure in half-open → back to open
            this._transition(STATES.OPEN);
        } else if (this.failureCount >= this.failureThreshold) {
            this._transition(STATES.OPEN);
        }
    }

    /** Transition to a new state */
    _transition(newState) {
        const oldState = this.state;
        if (oldState === newState) return;

        this.state = newState;

        if (newState === STATES.CLOSED) {
            this.failureCount = 0;
            this.successCount = 0;
        } else if (newState === STATES.HALF_OPEN) {
            this.successCount = 0;
        }

        if (this.onStateChange) {
            this.onStateChange(this.name, oldState, newState);
        }
    }

    /** Get current breaker status (for health checks / diagnostics) */
    getStatus() {
        return {
            name: this.name,
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            lastFailureTime: this.lastFailureTime
                ? new Date(this.lastFailureTime).toISOString()
                : null,
            lastError: this.lastError?.message || null,
        };
    }

    /** Manually reset the circuit breaker */
    reset() {
        this._transition(STATES.CLOSED);
        this.lastError = null;
        this.lastFailureTime = null;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED INSTANCES
// ─────────────────────────────────────────────────────────────────────────────
// Pre-configured breakers for known services.
// Because Netlify Functions are ephemeral, these reset on cold starts,
// which is acceptable — each container independently tracks failures.

const breakers = {};

/**
 * Get or create a circuit breaker for a named service.
 *
 * @param {string} name - Service identifier (e.g., 'gemini', 'polar')
 * @param {Object} [options] - CircuitBreaker options
 * @returns {CircuitBreaker}
 */
function getBreaker(name, options = {}) {
    if (!breakers[name]) {
        breakers[name] = new CircuitBreaker(name, {
            onStateChange: (svc, from, to) => {
                console.log(
                    JSON.stringify({
                        level: 'warn',
                        message: `Circuit breaker ${svc}: ${from} → ${to}`,
                        service: svc,
                        from,
                        to,
                        timestamp: new Date().toISOString(),
                    })
                );
            },
            ...options,
        });
    }
    return breakers[name];
}

/** Get status of all breakers (for /health endpoint) */
function getAllBreakerStatuses() {
    return Object.values(breakers).map((b) => b.getStatus());
}

module.exports = {
    CircuitBreaker,
    STATES,
    getBreaker,
    getAllBreakerStatuses,
};
