import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { parseEnvFile, syncEnv, summarizeEnv } from "../../src/deploy/env_sync";

describe("parseEnvFile", () => {
    let tmp: string;
    beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "helix-env-")); });
    afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

    it("returns empty when file missing", () => {
        const env = parseEnvFile(path.join(tmp, "missing.env"));
        expect(env.keys).toEqual([]);
    });

    it("parses simple KEY=VALUE pairs", () => {
        const file = path.join(tmp, ".env");
        fs.writeFileSync(file, "DATABASE_URL=postgres://x\nAPI_KEY=sk-1234\n# a comment\nFOO=bar");
        const env = parseEnvFile(file);
        expect(env.keys.sort()).toEqual(["API_KEY", "DATABASE_URL", "FOO"]);
        expect(env.pairs.DATABASE_URL).toBe("postgres://x");
    });

    it("strips surrounding quotes", () => {
        const file = path.join(tmp, ".env");
        fs.writeFileSync(file, `SECRET="hidden value"\nOTHER='single quoted'`);
        const env = parseEnvFile(file);
        expect(env.pairs.SECRET).toBe("hidden value");
        expect(env.pairs.OTHER).toBe("single quoted");
    });

    it("ignores invalid lines", () => {
        const file = path.join(tmp, ".env");
        fs.writeFileSync(file, "lowercase=skip\n=onlyvalue\n123BAD=bad\nVALID=ok");
        const env = parseEnvFile(file);
        expect(env.keys).toEqual(["VALID"]);
    });
});

describe("syncEnv", () => {
    let tmp: string;
    beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "helix-env-")); });
    afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

    it("invokes the upload command per key", async () => {
        fs.writeFileSync(path.join(tmp, ".env"), "API_KEY=sk-x\nDATABASE_URL=postgres://x");
        const calls: Array<{ command: string; args: string[] }> = [];
        const runner = vi.fn(async (command: string, args: string[]) => {
            calls.push({ command, args });
            return { stdout: "ok", stderr: "", exitCode: 0 };
        });

        const result = await syncEnv({
            cwd: tmp,
            runner,
            label: "test",
            buildUploadArgs: (key, value) => ({ command: "fake", args: ["set", key, value] }),
        });

        expect(result.pushed).toBe(2);
        expect(result.failed).toEqual([]);
        expect(calls.length).toBe(2);
        expect(calls.every(c => c.command === "fake")).toBe(true);
    });

    it("records failures with reason", async () => {
        fs.writeFileSync(path.join(tmp, ".env"), "BAD=x");
        const runner = vi.fn(async () => ({ stdout: "", stderr: "denied", exitCode: 1 }));
        const result = await syncEnv({
            cwd: tmp,
            runner,
            label: "test",
            buildUploadArgs: (k, v) => ({ command: "fake", args: ["set", k, v] }),
        });
        expect(result.pushed).toBe(0);
        expect(result.failed[0].reason).toContain("denied");
    });

    it("flags sensitive keys", async () => {
        fs.writeFileSync(path.join(tmp, ".env"), "API_KEY=sk-x\nFOO=bar");
        const runner = vi.fn(async () => ({ stdout: "ok", stderr: "", exitCode: 0 }));
        const result = await syncEnv({
            cwd: tmp,
            runner,
            label: "test",
            buildUploadArgs: () => ({ command: "fake", args: [] }),
        });
        expect(result.sensitiveKeys).toContain("API_KEY");
    });

    it("summarizeEnv handles empty + populated env", () => {
        expect(summarizeEnv({ keys: [], pairs: {} })).toContain("no .env keys");
        expect(summarizeEnv({ keys: ["API_KEY", "FOO"], pairs: { API_KEY: "x", FOO: "y" } })).toContain("sensitive");
    });
});
