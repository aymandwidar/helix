import { describe, it, expect, vi } from "vitest";
import { createPr, reviewPr, parseAiPrOutput } from "../../src/git/pr";

function runner(plan: Array<{ match: (c: string, a: string[]) => boolean; stdout?: string; stderr?: string; exitCode?: number }>) {
    return async (command: string, args: string[]) => {
        for (const step of plan) {
            if (step.match(command, args)) return { stdout: step.stdout || "", stderr: step.stderr || "", exitCode: step.exitCode ?? 0 };
        }
        return { stdout: "", stderr: "", exitCode: 0 };
    };
}

describe("parseAiPrOutput", () => {
    it("extracts TITLE: line and uses the rest as body", () => {
        const text = `TITLE: Add login endpoint\n\n## Summary\n- New POST /login route\n\n## Test plan\n- run vitest`;
        const r = parseAiPrOutput(text);
        expect(r.title).toBe("Add login endpoint");
        expect(r.body).toContain("## Summary");
    });

    it("falls back to a default title when missing", () => {
        const r = parseAiPrOutput("garbage with no header");
        expect(r.title).toBe("Update");
    });
});

describe("createPr", () => {
    it("opens a PR via gh when available", async () => {
        const r = runner([
            { match: (c, a) => c === "git" && a[0] === "rev-parse", stdout: "feature/x" },
            { match: (c, a) => c === "gh" && a[0] === "repo" && a[1] === "view", stdout: "main" },
            { match: (c, a) => c === "git" && a[0] === "diff", stdout: "diff --git a/x b/x\n+++ b/x\n+hi" },
            { match: (c, a) => c === "gh" && a[0] === "--version", stdout: "gh 2.40", exitCode: 0 },
            { match: (c, a) => c === "gh" && a[0] === "pr" && a[1] === "create", stdout: "https://github.com/foo/bar/pull/123" },
        ]);
        const result = await createPr({
            cwd: "/tmp",
            runner: r,
            ai: async () => "TITLE: Add x\n\n## Summary\n- did x",
        });
        expect(result.title).toBe("Add x");
        expect(result.method).toBe("gh");
        expect(result.prUrl).toBe("https://github.com/foo/bar/pull/123");
    });

    it("falls back to print-only when gh is missing", async () => {
        const r = runner([
            { match: (c, a) => c === "git" && a[0] === "rev-parse", stdout: "feature/x" },
            { match: (c, a) => c === "gh" && a[0] === "repo" && a[1] === "view", exitCode: 1 },
            { match: (c, a) => c === "git" && a[0] === "diff", stdout: "diff --git a/x b/x\n+hi" },
            { match: (c, a) => c === "gh" && a[0] === "--version", exitCode: 1 },
        ]);
        const result = await createPr({
            cwd: "/tmp",
            runner: r,
            ai: async () => "TITLE: Add x\n\n## Summary\n- did x",
        });
        expect(result.method).toBe("no-gh");
        expect(result.prUrl).toBeUndefined();
        expect(result.title).toBe("Add x");
    });

    it("returns no-changes message when diff is empty", async () => {
        const r = runner([
            { match: (c, a) => c === "git" && a[0] === "rev-parse", stdout: "feature/x" },
            { match: (c, a) => c === "gh" && a[0] === "repo", exitCode: 1 },
            { match: (c, a) => c === "git" && a[0] === "diff", stdout: "" },
            { match: (c, a) => c === "gh" && a[0] === "--version", exitCode: 1 },
        ]);
        const result = await createPr({ cwd: "/tmp", runner: r, ai: async () => "" });
        expect(result.body).toContain("no changes");
    });
});

describe("reviewPr", () => {
    it("calls AI with the diff text", async () => {
        const ai = vi.fn(async () => "## Verdict\nship");
        const r = runner([
            { match: (c, a) => c === "gh" && a[0] === "repo", exitCode: 1 },
            { match: (c, a) => c === "git" && a[0] === "diff", stdout: "diff --git a/x b/x\n+hi" },
        ]);
        const text = await reviewPr({ cwd: "/tmp", runner: r, ai });
        expect(text).toContain("ship");
        expect(ai).toHaveBeenCalledOnce();
    });

    it("short-circuits on empty diff", async () => {
        const r = runner([
            { match: (c, a) => c === "gh" && a[0] === "repo", exitCode: 1 },
            { match: (c, a) => c === "git" && a[0] === "diff", stdout: "" },
        ]);
        const ai = vi.fn();
        const text = await reviewPr({ cwd: "/tmp", runner: r, ai });
        expect(text).toContain("no changes");
        expect(ai).not.toHaveBeenCalled();
    });
});
