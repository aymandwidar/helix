import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { validateProject, summarizeValidation } from "../../src/evolve/validator";

describe("validateProject", () => {
    let tmp: string;
    beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "helix-val-")); });
    afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

    it("skips both steps when no scripts and no tsconfig exist", async () => {
        fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "demo", scripts: {} }));
        const result = await validateProject({ cwd: tmp });
        expect(result.passed).toBe(true);
        expect(result.steps.every(s => s.skipped)).toBe(true);
    });

    it("runs the build script and reports pass", async () => {
        fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({
            name: "demo",
            scripts: { build: "echo built", test: "echo tested" },
        }));
        const result = await validateProject({ cwd: tmp, timeoutMs: 30_000 });
        expect(result.passed).toBe(true);
        expect(result.steps.find(s => s.label === "build")?.passed).toBe(true);
    });

    it("captures failed build with non-zero exit", async () => {
        fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({
            name: "demo",
            scripts: { build: "exit 7" },
        }));
        const result = await validateProject({ cwd: tmp, skipTests: true, timeoutMs: 30_000 });
        expect(result.passed).toBe(false);
        const build = result.steps.find(s => s.label === "build");
        expect(build?.passed).toBe(false);
        expect(build?.exitCode).toBe(7);
    });

    it("summarizeValidation returns one line per step", async () => {
        fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({
            name: "demo", scripts: { build: "true", test: "true" },
        }));
        const result = await validateProject({ cwd: tmp });
        const summary = summarizeValidation(result);
        expect(summary.split("\n").length).toBe(2);
    });
});
