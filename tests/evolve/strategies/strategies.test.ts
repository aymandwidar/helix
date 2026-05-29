import { describe, it, expect } from "vitest";
import { getStrategyNotes, SUPPORTED_ACTIONS } from "../../../src/evolve/strategies";

describe("strategies", () => {
    it("provides notes for every supported action", () => {
        for (const action of SUPPORTED_ACTIONS) {
            const notes = getStrategyNotes(action);
            expect(notes.length).toBeGreaterThan(20);
            expect(notes.toLowerCase()).toContain("checklist");
        }
    });

    it("each strategy emphasizes its own concern", () => {
        expect(getStrategyNotes("add-feature").toLowerCase()).toContain("add");
        expect(getStrategyNotes("refactor").toLowerCase()).toMatch(/preserve|move|rename/);
        expect(getStrategyNotes("fix").toLowerCase()).toContain("root cause");
        expect(getStrategyNotes("migrate").toLowerCase()).toMatch(/version|breaking/);
        expect(getStrategyNotes("optimize").toLowerCase()).toMatch(/perf|a11y|seo|metric/);
    });
});
