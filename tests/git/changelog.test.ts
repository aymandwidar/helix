import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { generateChangelog } from "../../src/git/changelog";

function runner(plan: Array<{ match: (c: string, a: string[]) => boolean; stdout?: string; stderr?: string; exitCode?: number }>) {
    return async (command: string, args: string[]) => {
        for (const step of plan) {
            if (step.match(command, args)) return { stdout: step.stdout || "", stderr: step.stderr || "", exitCode: step.exitCode ?? 0 };
        }
        return { stdout: "", stderr: "", exitCode: 0 };
    };
}

describe("generateChangelog", () => {
    let tmp: string;
    beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "helix-cl-")); });
    afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

    it("returns 'no commits' message when log is empty", async () => {
        const r = runner([
            { match: (c, a) => c === "git" && a[0] === "describe", stdout: "v1.0.0" },
            { match: (c, a) => c === "git" && a[0] === "log", stdout: "" },
        ]);
        const result = await generateChangelog({ cwd: tmp, runner: r, ai: async () => "" });
        expect(result.commits).toBe(0);
        expect(result.section).toContain("no commits");
    });

    it("writes a new CHANGELOG.md when none exists", async () => {
        const r = runner([
            { match: (c, a) => c === "git" && a[0] === "describe", exitCode: 1 },
            { match: (c, a) => c === "git" && a[0] === "log", stdout: "abc Add login\ndef Fix bug" },
        ]);
        const result = await generateChangelog({
            cwd: tmp,
            runner: r,
            ai: async () => "## [Unreleased] - 2026-05-29\n### Added\n- Login\n### Fixed\n- a bug",
        });
        expect(result.commits).toBe(2);
        expect(result.merged).toBe(false);
        const file = fs.readFileSync(path.join(tmp, "CHANGELOG.md"), "utf-8");
        expect(file).toContain("# Changelog");
        expect(file).toContain("Login");
    });

    it("merges into an existing CHANGELOG.md without losing prior content", async () => {
        fs.writeFileSync(path.join(tmp, "CHANGELOG.md"), "# Changelog\n\n## [0.9.0] - 2026-04-01\n### Added\n- Old thing\n");
        const r = runner([
            { match: (c, a) => c === "git" && a[0] === "describe", exitCode: 1 },
            { match: (c, a) => c === "git" && a[0] === "log", stdout: "abc New thing" },
        ]);
        const result = await generateChangelog({
            cwd: tmp,
            runner: r,
            ai: async () => "## [Unreleased] - 2026-05-29\n### Added\n- New thing",
        });
        expect(result.merged).toBe(true);
        const file = fs.readFileSync(path.join(tmp, "CHANGELOG.md"), "utf-8");
        expect(file).toContain("Old thing");
        expect(file).toContain("New thing");
    });

    it("dryRun returns section without writing", async () => {
        const r = runner([
            { match: (c, a) => c === "git" && a[0] === "describe", exitCode: 1 },
            { match: (c, a) => c === "git" && a[0] === "log", stdout: "abc x" },
        ]);
        await generateChangelog({
            cwd: tmp,
            runner: r,
            ai: async () => "## [Unreleased]\n### Added\n- x",
            dryRun: true,
        });
        expect(fs.existsSync(path.join(tmp, "CHANGELOG.md"))).toBe(false);
    });
});
