import { describe, it, expect } from "vitest";
import { describeBranchProtection } from "../../src/git/branch";

function runner(plan: Array<{ match: (c: string, a: string[]) => boolean; stdout?: string; exitCode?: number }>) {
    return async (command: string, args: string[]) => {
        for (const step of plan) {
            if (step.match(command, args)) return { stdout: step.stdout || "", stderr: "", exitCode: step.exitCode ?? 0 };
        }
        return { stdout: "", stderr: "", exitCode: 0 };
    };
}

describe("describeBranchProtection", () => {
    it("uses sensible defaults", async () => {
        const r = runner([
            { match: (c, a) => c === "gh" && a[0] === "repo", stdout: "foo/bar", exitCode: 0 },
        ]);
        const result = await describeBranchProtection({ cwd: "/tmp", runner: r });
        expect(result.branch).toBe("main");
        expect(result.payload.required_status_checks?.contexts).toEqual(["build", "test"]);
        expect(result.payload.required_pull_request_reviews.required_approving_review_count).toBe(1);
        expect(result.command).toContain("foo/bar");
    });

    it("falls back to OWNER/REPO when gh is missing", async () => {
        const r = runner([
            { match: (c, a) => c === "gh", exitCode: 1 },
        ]);
        const result = await describeBranchProtection({ cwd: "/tmp", runner: r });
        expect(result.command).toContain("OWNER/REPO");
        expect(result.repo).toBeNull();
    });

    it("respects custom checks and reviews", async () => {
        const r = runner([
            { match: (c, a) => c === "gh", stdout: "x/y", exitCode: 0 },
        ]);
        const result = await describeBranchProtection({
            cwd: "/tmp",
            runner: r,
            checks: ["lint", "build", "test"],
            requiredReviews: 2,
            branch: "release",
        });
        expect(result.branch).toBe("release");
        expect(result.payload.required_status_checks?.contexts).toEqual(["lint", "build", "test"]);
        expect(result.payload.required_pull_request_reviews.required_approving_review_count).toBe(2);
    });
});
