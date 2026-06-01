/**
 * Sprint 15 — types for the cost manager and iteration limiter.
 */

export interface BudgetSnapshot {
    totalUsd: number;
    spentUsd: number;
    remainingUsd: number;
    percent: number;
    /** True when the budget has been exhausted. */
    exhausted: boolean;
}

export interface BudgetCheck {
    allowed: boolean;
    /** Human-readable reason when allowed=false. */
    reason?: string;
    snapshot: BudgetSnapshot;
}

export interface IterationCheck {
    allowed: boolean;
    iteration: number;
    max: number | null;
    /** Reason when allowed=false. */
    reason?: string;
}
