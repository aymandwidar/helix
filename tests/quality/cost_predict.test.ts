import { describe, it, expect } from "vitest";
import { predictTurnCost, formatPrediction } from "../../src/quality/cost_predict";

describe("predictTurnCost", () => {
    it("estimates token counts roughly proportionate to message length", () => {
        const short = predictTurnCost({ messages: [{ role: "user", content: "hi" }], model: "deepseek/deepseek-chat" });
        const long = predictTurnCost({ messages: [{ role: "user", content: "hi".repeat(10000) }], model: "deepseek/deepseek-chat" });
        expect(long.estimatedPromptTokens).toBeGreaterThan(short.estimatedPromptTokens);
    });

    it("returns a numeric cost for a known model", () => {
        const p = predictTurnCost({
            messages: [{ role: "user", content: "x".repeat(40000) }],
            model: "deepseek/deepseek-chat",
            completionTokens: 1000,
        });
        expect(p.estimatedCostUsd).toBeGreaterThan(0);
    });

    it("falls back to $0 with a note for unknown models", () => {
        const p = predictTurnCost({ messages: [], model: "unknown/model" });
        expect(p.estimatedCostUsd).toBe(0);
        expect(p.notes.some(n => n.includes("unknown/model"))).toBe(true);
    });

    it("formatPrediction is multi-line and includes a cost line", () => {
        const p = predictTurnCost({ messages: [{ role: "user", content: "test" }] });
        const text = formatPrediction(p);
        expect(text).toContain("Cost prediction");
        expect(text).toContain("est. cost:");
    });
});
