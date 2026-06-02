import { describe, it, expect } from "vitest";
import { BudgetManager, predictCallCost, formatBudgetTag } from "../../src/cost";

describe("BudgetManager", () => {
    it("rejects invalid totals", () => {
        expect(() => new BudgetManager({ totalUsd: 0 })).toThrow();
        expect(() => new BudgetManager({ totalUsd: -1 })).toThrow();
        expect(() => new BudgetManager({ totalUsd: NaN })).toThrow();
    });

    it("snapshot reports remaining and percent", () => {
        const b = new BudgetManager({ totalUsd: 1.0 });
        b.record(0.25);
        const snap = b.snapshot();
        expect(snap.totalUsd).toBe(1.0);
        expect(snap.spentUsd).toBe(0.25);
        expect(snap.remainingUsd).toBe(0.75);
        expect(snap.percent).toBe(25);
        expect(snap.exhausted).toBe(false);
    });

    it("canSpend allows when next call fits", () => {
        const b = new BudgetManager({ totalUsd: 1.0 });
        b.record(0.4);
        const check = b.canSpend(0.2);
        expect(check.allowed).toBe(true);
    });

    it("canSpend denies when next call would exceed", () => {
        const b = new BudgetManager({ totalUsd: 1.0 });
        b.record(0.9);
        const check = b.canSpend(0.5);
        expect(check.allowed).toBe(false);
        expect(check.reason).toMatch(/exceed/);
    });

    it("canSpend denies when already exhausted", () => {
        const b = new BudgetManager({ totalUsd: 0.5 });
        b.record(0.5);
        const check = b.canSpend(0.0001);
        expect(check.allowed).toBe(false);
        expect(check.snapshot.exhausted).toBe(true);
    });

    it("record clamps non-numeric values", () => {
        const b = new BudgetManager({ totalUsd: 1.0 });
        b.record(NaN);
        b.record(-5);
        expect(b.spentUsd).toBe(0);
    });

    it("predictCallCost is non-negative for known models and zero for unknown", () => {
        const known = predictCallCost({ promptText: "x".repeat(4000), model: "deepseek/deepseek-chat" });
        expect(known).toBeGreaterThan(0);
        const unknown = predictCallCost({ promptText: "x".repeat(4000), model: "fake/model" });
        expect(unknown).toBe(0);
    });

    it("formatBudgetTag renders [$spent / $total] with 2 decimals for budgets ≥ $1", () => {
        const b = new BudgetManager({ totalUsd: 5 });
        b.record(1.23);
        expect(formatBudgetTag(b.snapshot())).toBe("[$1.23 / $5.00]");
    });

    it("formatBudgetTag uses 4 decimals for sub-dollar budgets", () => {
        const b = new BudgetManager({ totalUsd: 0.001 });
        const tag = formatBudgetTag(b.snapshot());
        expect(tag).toBe("[$0.0000 / $0.0010]");
    });
});
