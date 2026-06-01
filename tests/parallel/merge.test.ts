import { describe, it, expect, vi } from "vitest";
import { mergeWorkers } from "../../src/parallel/merge";
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

describe("mergeWorkers", () => {
    it("merges every successful worker on the happy path", async () => {
        const calls: string[][] = [];
        const runner = async (command: string, args: string[]) => {
            calls.push([command, ...args]);
            return { stdout: "", stderr: "", exitCode: 0 };
        };
        const result = await mergeWorkers({
            repoRoot: "/repo",
            base: "main",
            workers: [worker("a", ["src/a.ts"]), worker("b", ["src/b.ts"])],
            runner,
        });
        expect(result.success).toBe(true);
        expect(result.merged).toEqual(["a", "b"]);
        // checkout main + 2 merges
        const merges = calls.filter(c => c[0] === "git" && c[1] === "merge" && c[2] === "--no-ff");
        expect(merges.length).toBe(2);
    });

    it("aborts and skips a failing merge but continues with others", async () => {
        let mergeCount = 0;
        const calls: string[][] = [];
        const runner = async (command: string, args: string[]) => {
            calls.push([command, ...args]);
            if (command === "git" && args[0] === "checkout") return { stdout: "", stderr: "", exitCode: 0 };
            if (command === "git" && args[0] === "merge" && args[1] === "--no-ff") {
                mergeCount++;
                if (mergeCount === 1) return { stdout: "", stderr: "merge conflict in x", exitCode: 1 };
                return { stdout: "", stderr: "", exitCode: 0 };
            }
            return { stdout: "", stderr: "", exitCode: 0 };
        };
        const result = await mergeWorkers({
            repoRoot: "/repo",
            base: "main",
            workers: [worker("a", ["src/a.ts"]), worker("b", ["src/b.ts"])],
            runner,
        });
        expect(result.success).toBe(false);
        expect(result.merged).toEqual(["b"]);
        expect(result.skipped[0].worker).toBe("a");
        expect(calls.some(c => c[0] === "git" && c[1] === "merge" && c[2] === "--abort")).toBe(true);
    });

    it("skips failed workers and workers with no changes", async () => {
        const runner = async () => ({ stdout: "", stderr: "", exitCode: 0 });
        const result = await mergeWorkers({
            repoRoot: "/repo",
            base: "main",
            workers: [worker("a", []), worker("b", ["x"], false)],
            runner,
        });
        expect(result.merged).toEqual([]);
        expect(result.skipped.map(s => s.worker)).toEqual(["a", "b"]);
    });

    it("fails fast when checkout to base fails", async () => {
        const runner = async (command: string, args: string[]) => {
            if (command === "git" && args[0] === "checkout") return { stdout: "", stderr: "no such branch", exitCode: 1 };
            return { stdout: "", stderr: "", exitCode: 0 };
        };
        const result = await mergeWorkers({
            repoRoot: "/repo",
            base: "main",
            workers: [worker("a", ["x"])],
            runner,
        });
        expect(result.success).toBe(false);
        expect(result.merged).toEqual([]);
        expect(result.skipped[0].reason).toContain("checkout");
    });
});
