import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { runDeploy } from "../../src/deploy";

function makeRunner(plan: Array<{ match?: (cmd: string, args: string[]) => boolean; stdout?: string; stderr?: string; exitCode?: number }>) {
    return async (command: string, args: string[]) => {
        for (const step of plan) {
            if (!step.match || step.match(command, args)) {
                return { stdout: step.stdout || "", stderr: step.stderr || "", exitCode: step.exitCode ?? 0 };
            }
        }
        return { stdout: "", stderr: "", exitCode: 0 };
    };
}

describe("runDeploy(vercel)", () => {
    let tmp: string;
    beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "helix-deploy-")); });
    afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

    it("returns skipped when vercel CLI is missing", async () => {
        const runner = makeRunner([
            { match: (c, a) => c === "vercel" && a[0] === "--version", exitCode: 1 },
        ]);
        const result = await runDeploy("vercel", { cwd: tmp, runner });
        expect(result.success).toBe(false);
        expect(result.skippedReason).toMatch(/vercel CLI not installed/);
    });

    it("returns the production URL on success", async () => {
        const runner = makeRunner([
            { match: (c, a) => c === "vercel" && a[0] === "--version", stdout: "44.0.0", exitCode: 0 },
            { match: (c, a) => c === "vercel" && a.includes("--prod"), stdout: "Deployed: https://demo.vercel.app", exitCode: 0 },
        ]);
        const result = await runDeploy("vercel", {
            cwd: tmp,
            runner,
            skipEnvSync: true,
        });
        expect(result.success).toBe(true);
        expect(result.url).toBe("https://demo.vercel.app");
    });

    it("syncs .env when present and confirm() returns true", async () => {
        fs.writeFileSync(path.join(tmp, ".env"), "API_KEY=sk-x\nFOO=bar");
        const calls: string[][] = [];
        const runner = vi.fn(async (command: string, args: string[]) => {
            calls.push([command, ...args]);
            if (command === "vercel" && args[0] === "--version") return { stdout: "44.0.0", stderr: "", exitCode: 0 };
            if (command === "vercel" && args.includes("--prod")) return { stdout: "https://x.vercel.app", stderr: "", exitCode: 0 };
            // env upload
            return { stdout: "ok", stderr: "", exitCode: 0 };
        });
        const result = await runDeploy("vercel", {
            cwd: tmp,
            runner,
            confirm: async () => true,
        });
        expect(result.success).toBe(true);
        expect(result.envPushed).toBe(2);
        const envCalls = calls.filter(c => c[0] === "vercel" && c[1] === "env" && c[2] === "add");
        expect(envCalls.length).toBe(2);
    });

    it("does not push env when confirm() returns false", async () => {
        fs.writeFileSync(path.join(tmp, ".env"), "API_KEY=sk-x");
        const calls: string[][] = [];
        const runner = vi.fn(async (command: string, args: string[]) => {
            calls.push([command, ...args]);
            if (args[0] === "--version") return { stdout: "v", stderr: "", exitCode: 0 };
            if (args.includes("--prod")) return { stdout: "https://x.vercel.app", stderr: "", exitCode: 0 };
            return { stdout: "ok", stderr: "", exitCode: 0 };
        });
        const result = await runDeploy("vercel", {
            cwd: tmp,
            runner,
            confirm: async () => false,
        });
        expect(result.success).toBe(true);
        expect(result.envPushed).toBe(0);
        expect(calls.find(c => c[1] === "env")).toBeUndefined();
    });

    it("dry-run does not call vercel deploy", async () => {
        const runner = vi.fn(async (command: string, args: string[]) => {
            if (args[0] === "--version") return { stdout: "v", stderr: "", exitCode: 0 };
            return { stdout: "", stderr: "", exitCode: 0 };
        });
        const result = await runDeploy("vercel", { cwd: tmp, runner, dryRun: true });
        expect(result.success).toBe(true);
        expect(result.skippedReason).toBe("dry-run");
        // Only the --version probe should have run
        expect(runner).toHaveBeenCalledTimes(1);
    });
});

describe("runDeploy(netlify)", () => {
    let tmp: string;
    beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "helix-deploy-")); });
    afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

    it("parses --json output for deploy_url", async () => {
        const runner = makeRunner([
            { match: (c, a) => c === "netlify" && a[0] === "--version", stdout: "17.0", exitCode: 0 },
            { match: (c, a) => c === "netlify" && a[0] === "deploy", stdout: JSON.stringify({ deploy_url: "https://demo.netlify.app" }), exitCode: 0 },
        ]);
        const result = await runDeploy("netlify", { cwd: tmp, runner, skipEnvSync: true });
        expect(result.success).toBe(true);
        expect(result.url).toBe("https://demo.netlify.app");
    });

    it("hint shown when CLI missing", async () => {
        const runner = makeRunner([
            { match: (c, a) => c === "netlify" && a[0] === "--version", exitCode: 1 },
        ]);
        const result = await runDeploy("netlify", { cwd: tmp, runner });
        expect(result.skippedReason).toMatch(/netlify-cli/);
    });
});

describe("runDeploy(railway)", () => {
    let tmp: string;
    beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "helix-deploy-")); });
    afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

    it("happy path returns URL extracted from stdout", async () => {
        const runner = makeRunner([
            { match: (c, a) => c === "railway" && a[0] === "version", stdout: "1.2.3", exitCode: 0 },
            { match: (c, a) => c === "railway" && a[0] === "up", stdout: "Build OK\nLive at https://demo.up.railway.app", exitCode: 0 },
        ]);
        const result = await runDeploy("railway", { cwd: tmp, runner, skipEnvSync: true });
        expect(result.success).toBe(true);
        expect(result.url).toBe("https://demo.up.railway.app");
    });

    it("missing CLI hint", async () => {
        const runner = makeRunner([
            { match: (c, a) => c === "railway" && a[0] === "version", exitCode: 1 },
        ]);
        const result = await runDeploy("railway", { cwd: tmp, runner });
        expect(result.skippedReason).toMatch(/@railway\/cli/);
    });
});
