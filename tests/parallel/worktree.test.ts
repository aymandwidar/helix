import { describe, it, expect, vi } from "vitest";
import { createWorktree, removeWorktree, detectBaseBranch, listChangedFiles, commitWorktree } from "../../src/parallel/worktree";

function planRunner(plan: Array<{ match: (c: string, a: string[]) => boolean; stdout?: string; stderr?: string; exitCode?: number }>) {
    const calls: Array<{ command: string; args: string[] }> = [];
    const runner = async (command: string, args: string[]) => {
        calls.push({ command, args });
        for (const step of plan) {
            if (step.match(command, args)) return { stdout: step.stdout || "", stderr: step.stderr || "", exitCode: step.exitCode ?? 0 };
        }
        return { stdout: "", stderr: "", exitCode: 0 };
    };
    return { runner, calls };
}

describe("detectBaseBranch", () => {
    it("returns the current branch from rev-parse", async () => {
        const { runner } = planRunner([
            { match: (c, a) => c === "git" && a[0] === "rev-parse", stdout: "feature/x" },
        ]);
        const base = await detectBaseBranch("/repo", runner);
        expect(base).toBe("feature/x");
    });

    it("falls back to origin/HEAD when on detached HEAD", async () => {
        const { runner } = planRunner([
            { match: (c, a) => c === "git" && a[0] === "rev-parse", stdout: "HEAD" },
            { match: (c, a) => c === "git" && a[0] === "symbolic-ref", stdout: "refs/remotes/origin/main" },
        ]);
        const base = await detectBaseBranch("/repo", runner);
        expect(base).toBe("main");
    });

    it("defaults to main when nothing is detected", async () => {
        const { runner } = planRunner([
            { match: (c, a) => c === "git" && a[0] === "rev-parse", exitCode: 1 },
            { match: (c, a) => c === "git" && a[0] === "symbolic-ref", exitCode: 1 },
        ]);
        const base = await detectBaseBranch("/repo", runner);
        expect(base).toBe("main");
    });
});

describe("createWorktree", () => {
    it("invokes `git worktree add` with the right path and branch", async () => {
        const { runner, calls } = planRunner([
            { match: () => true, exitCode: 0 },
        ]);
        const wt = await createWorktree({ repoRoot: "/repo", base: "main", id: "abc123", runner });
        expect(wt.id).toBe("abc123");
        expect(wt.branch).toBe("helix/abc123");
        expect(wt.path).toMatch(/\.helix-workers\/abc123$/);
        const addCall = calls.find(c => c.command === "git" && c.args[0] === "worktree" && c.args[1] === "add");
        expect(addCall).toBeDefined();
        expect(addCall!.args).toContain("-b");
        expect(addCall!.args).toContain("helix/abc123");
        expect(addCall!.args).toContain("main");
    });

    it("throws when git worktree add fails", async () => {
        const { runner } = planRunner([
            { match: (c, a) => c === "git" && a[0] === "worktree" && a[1] === "add", stderr: "fatal: not a repo", exitCode: 128 },
        ]);
        await expect(createWorktree({ repoRoot: "/repo", base: "main", id: "x", runner })).rejects.toThrow(/worktree add failed/);
    });
});

describe("removeWorktree", () => {
    it("calls remove with --force and optionally deletes branch", async () => {
        const { runner, calls } = planRunner([
            { match: () => true, exitCode: 0 },
        ]);
        await removeWorktree({
            repoRoot: "/repo",
            worktree: { id: "x", path: "/repo/.helix-workers/x", branch: "helix/x", baseBranch: "main" },
            force: true,
            deleteBranch: true,
            runner,
        });
        expect(calls.some(c => c.args.includes("--force"))).toBe(true);
        expect(calls.some(c => c.args[0] === "branch" && c.args.includes("-D"))).toBe(true);
    });
});

describe("listChangedFiles", () => {
    it("parses newline-separated file list", async () => {
        const { runner } = planRunner([
            { match: (c, a) => c === "git" && a[0] === "diff", stdout: "src/a.ts\nsrc/b.ts\n" },
        ]);
        const files = await listChangedFiles({ id: "x", path: "/wt", branch: "helix/x", baseBranch: "main" }, runner);
        expect(files).toEqual(["src/a.ts", "src/b.ts"]);
    });

    it("returns empty when there is no diff", async () => {
        const { runner } = planRunner([
            { match: (c, a) => c === "git" && a[0] === "diff", stdout: "" },
        ]);
        const files = await listChangedFiles({ id: "x", path: "/wt", branch: "helix/x", baseBranch: "main" }, runner);
        expect(files).toEqual([]);
    });
});

describe("commitWorktree", () => {
    it("returns false when status is clean", async () => {
        const { runner } = planRunner([
            { match: (c, a) => c === "git" && a[0] === "status", stdout: "" },
        ]);
        const ok = await commitWorktree({ id: "x", path: "/wt", branch: "helix/x", baseBranch: "main" }, "msg", runner);
        expect(ok).toBe(false);
    });

    it("stages and commits when there are changes", async () => {
        const { runner, calls } = planRunner([
            { match: (c, a) => c === "git" && a[0] === "status", stdout: " M src/a.ts" },
            { match: (c, a) => c === "git" && a[0] === "add", exitCode: 0 },
            { match: (c, a) => c === "git" && a[0] === "commit", exitCode: 0 },
        ]);
        const ok = await commitWorktree({ id: "x", path: "/wt", branch: "helix/x", baseBranch: "main" }, "msg", runner);
        expect(ok).toBe(true);
        expect(calls.some(c => c.args[0] === "add" && c.args[1] === "-A")).toBe(true);
        expect(calls.some(c => c.args[0] === "commit" && c.args.includes("msg"))).toBe(true);
    });
});
