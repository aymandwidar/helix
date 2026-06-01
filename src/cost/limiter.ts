/**
 * Iteration limiter — counts agent loop iterations and enforces a max.
 *
 * One iteration = one full prompt → tool calls → response cycle. The limiter
 * is a no-op when `max` is null/undefined.
 */

import { IterationCheck } from "./types";

export class IterationLimiter {
    private count = 0;
    public readonly max: number | null;

    constructor(max?: number | null) {
        this.max = max != null && max > 0 ? max : null;
    }

    /**
     * Call once at the start of every agent loop turn. Returns whether the
     * turn is allowed to run.
     */
    next(): IterationCheck {
        const iteration = this.count + 1;
        if (this.max != null && this.count >= this.max) {
            return {
                allowed: false,
                iteration: this.count,
                max: this.max,
                reason: `iteration limit reached (${this.max})`,
            };
        }
        this.count = iteration;
        return { allowed: true, iteration, max: this.max };
    }

    current(): number {
        return this.count;
    }

    reset(): void {
        this.count = 0;
    }
}
