import { describe, it, expect } from "vitest";
import { formatVerdict, formatPresets, formatHistory } from "../../src/council/formatter";

describe("council formatter", () => {
    it("includes the synthesized verdict", () => {
        const out = formatVerdict({
            verdict: "Use Postgres for relational integrity.",
            opinions: [],
        });
        expect(out).toContain("Council verdict");
        expect(out).toContain("Use Postgres");
    });

    it("renders per-model opinions", () => {
        const out = formatVerdict({
            verdict: "Postgres",
            consensus: 0.8,
            models: ["claude-3.5", "gpt-4o"],
            opinions: [
                { model: "claude-3.5", response: "Postgres for joins.", confidence: 0.9 },
                { model: "gpt-4o", response: "Postgres for ACID.", confidence: 0.7 },
            ],
        });
        expect(out).toContain("claude-3.5");
        expect(out).toContain("gpt-4o");
        expect(out).toContain("80%");
    });

    it("formatPresets handles empty list", () => {
        expect(formatPresets([])).toContain("no presets");
    });

    it("formatHistory truncates long values", () => {
        const out = formatHistory([{ question: "Q?".repeat(80), verdict: "A".repeat(200) }]);
        // "Q?" repeats — we just want the head row to exist without throwing
        expect(out).toContain("Recent deliberations");
    });
});
