/**
 * Budget manager — tracks running spend and stops the agent before the next
 * call would push it over the user's --budget cap.
 *
 * Pricing matches MODEL_PRICING in src/openrouter.ts.
 */

import { BudgetCheck, BudgetSnapshot } from "./types";

/** Pricing per million tokens: [input, output] — keep in sync with openrouter.ts */
const MODEL_PRICING: Record<string, [number, number]> = {
    "deepseek/deepseek-chat":             [0.14,  0.28],
    "meta-llama/llama-3.3-70b-instruct":  [0,     0],
    "minimax/minimax-01":                 [0.50,  1.50],
    "anthropic/claude-3.5-sonnet":        [3.00,  15.00],
    "google/gemini-pro-1.5":              [3.50,  10.50],
    "openai/gpt-4o":                      [2.50,  10.00],
};

const CHARS_PER_TOKEN = 4;
const DEFAULT_COMPLETION_TOKENS = 1500;

export interface BudgetOptions {
    totalUsd: number;
    /** Pre-existing spend to start from (default 0). */
    initialSpentUsd?: number;
}

export class BudgetManager {
    public readonly totalUsd: number;
    public spentUsd: number;

    constructor(options: BudgetOptions) {
        if (!Number.isFinite(options.totalUsd) || options.totalUsd <= 0) {
            throw new Error("BudgetManager: totalUsd must be a positive finite number");
        }
        this.totalUsd = options.totalUsd;
        this.spentUsd = options.initialSpentUsd || 0;
    }

    snapshot(): BudgetSnapshot {
        const remaining = Math.max(0, this.totalUsd - this.spentUsd);
        return {
            totalUsd: this.totalUsd,
            spentUsd: this.spentUsd,
            remainingUsd: remaining,
            percent: this.totalUsd === 0 ? 0 : Math.min(100, (this.spentUsd / this.totalUsd) * 100),
            exhausted: remaining <= 0,
        };
    }

    /**
     * Check whether the next agent turn — given its predicted cost — would
     * push us over the cap. The check is conservative: if predicted_next +
     * spent > total, we deny.
     */
    canSpend(predictedUsd: number): BudgetCheck {
        const snapshot = this.snapshot();
        if (snapshot.exhausted) {
            return {
                allowed: false,
                reason: "budget exhausted",
                snapshot,
            };
        }
        if (this.spentUsd + predictedUsd > this.totalUsd) {
            return {
                allowed: false,
                reason: `predicted spend ($${predictedUsd.toFixed(6)}) would exceed remaining budget ($${snapshot.remainingUsd.toFixed(6)})`,
                snapshot,
            };
        }
        return { allowed: true, snapshot };
    }

    /** Record actual spend after a real call. */
    record(actualUsd: number): BudgetSnapshot {
        if (Number.isFinite(actualUsd) && actualUsd > 0) {
            this.spentUsd += actualUsd;
        }
        return this.snapshot();
    }
}

export interface PredictOptions {
    promptText: string;
    model: string;
    completionTokens?: number;
}

/** Estimate the dollar cost of an upcoming turn using the same heuristic as cost-predict. */
export function predictCallCost(options: PredictOptions): number {
    const promptTokens = Math.ceil((options.promptText || "").length / CHARS_PER_TOKEN);
    const completionTokens = options.completionTokens ?? DEFAULT_COMPLETION_TOKENS;
    const pricing = MODEL_PRICING[options.model];
    if (!pricing) return 0;
    const [inputRate, outputRate] = pricing;
    return (promptTokens / 1_000_000) * inputRate + (completionTokens / 1_000_000) * outputRate;
}

export function formatBudgetTag(snapshot: BudgetSnapshot): string {
    // Use 4-decimal precision for sub-dollar budgets so tiny totals don't
    // render as "$0.00 / $0.00".
    const decimals = snapshot.totalUsd < 1 ? 4 : 2;
    return `[$${snapshot.spentUsd.toFixed(decimals)} / $${snapshot.totalUsd.toFixed(decimals)}]`;
}

export type { BudgetSnapshot, BudgetCheck } from "./types";
export { IterationLimiter } from "./limiter";
