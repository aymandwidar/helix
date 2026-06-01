import { describe, it, expect } from "vitest";
import { detectConflicts, formatConflictReport } from "../../src/parallel/conflicts";
import { WorkerOutcome } from "../../src/parallel/types";

function worker(label: string, files: string[], success = true): WorkerOutcome {
    return {
        task: { prompt: label, label },
        worktree: { id: label, path: "/wt", branch: `helix/${label}`, baseBranch: "main" },
        finalText: "",
        iterations: 0,
        toolCalls: 0,
        changedFiles: files,
        success,
        cleanedUp: false,
    };
}

describe("detectConflicts", () => {
    it("returns clean when no files overlap", () => {
        const report = detectConflicts([
            worker("a", ["src/a.ts"]),
            worker("b", ["src/b.ts"]),
        ]);
        expect(report.clean).toBe(true);
        expect(report.overlappingFiles).toEqual([]);
    });

    it("flags files touched by 2+ workers", () => {
        const report = detectConflicts([
            worker("a", ["src/shared.ts", "src/a.ts"]),
            worker("b", ["src/shared.ts"]),
            worker("c", ["src/c.ts"]),
        ]);
        expect(report.clean).toBe(false);
        expect(report.overlappingFiles).toEqual([
            { file: "src/shared.ts", workers: ["a", "b"] },
        ]);
    });

    it("ignores failed workers", () => {
        const report = detectConflicts([
            worker("a", ["src/x.ts"]),
            worker("b", ["src/x.ts"], false),
        ]);
        expect(report.clean).toBe(true);
    });

    it("formatConflictReport reads cleanly", () => {
        const report = detectConflicts([
            worker("a", ["src/x.ts"]),
            worker("b", ["src/x.ts"]),
        ]);
        const text = formatConflictReport(report);
        expect(text).toContain("overlapping");
        expect(text).toContain("src/x.ts");
    });
});
