import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { autoCompressLines, readAutoCompressThreshold } from "../../../src/chat/context/auto_compress";

function buildOutput(n: number): string {
    return Array.from({ length: n }, (_, i) => `line ${i + 1}`).join("\n");
}

describe("autoCompressLines", () => {
    it("does not compress when below threshold", () => {
        const text = buildOutput(50);
        const r = autoCompressLines(text);
        expect(r.compressed).toBe(false);
        expect(r.text).toBe(text);
        expect(r.originalLineCount).toBe(50);
    });

    it("compresses keeping first 20 + last 20 by default", () => {
        const text = buildOutput(150);
        const r = autoCompressLines(text);
        expect(r.compressed).toBe(true);
        expect(r.truncatedLineCount).toBe(150 - 40);
        const lines = r.text.split("\n");
        // Head 20 + 1 marker + tail 20
        expect(lines.length).toBe(41);
        expect(lines[0]).toBe("line 1");
        expect(lines[20]).toMatch(/lines truncated/);
        expect(lines[21]).toBe(`line ${150 - 19}`);
        expect(lines[lines.length - 1]).toBe("line 150");
    });

    it("respects custom threshold + head/tail", () => {
        const text = buildOutput(40);
        const r = autoCompressLines(text, { threshold: 30, head: 5, tail: 3 });
        expect(r.compressed).toBe(true);
        const lines = r.text.split("\n");
        expect(lines.length).toBe(5 + 1 + 3);
        expect(lines[0]).toBe("line 1");
        expect(lines[4]).toBe("line 5");
        expect(lines[5]).toMatch(/lines truncated/);
        expect(lines[lines.length - 1]).toBe("line 40");
    });

    it("compresses massive output without OOM", () => {
        const text = buildOutput(10_000);
        const r = autoCompressLines(text);
        expect(r.compressed).toBe(true);
        expect(r.text.length).toBeLessThan(text.length);
    });
});

describe("readAutoCompressThreshold", () => {
    let helixDir: string;
    let oldEnv: string | undefined;

    beforeEach(() => {
        helixDir = fs.mkdtempSync(path.join(os.tmpdir(), "helix-ac-"));
        oldEnv = process.env.HELIX_SETTINGS_DIR;
        process.env.HELIX_SETTINGS_DIR = helixDir;
    });

    afterEach(() => {
        fs.rmSync(helixDir, { recursive: true, force: true });
        if (oldEnv) process.env.HELIX_SETTINGS_DIR = oldEnv; else delete process.env.HELIX_SETTINGS_DIR;
    });

    it("defaults to 100 when no setting is present", () => {
        expect(readAutoCompressThreshold()).toBe(100);
    });

    it("respects autoCompressThreshold from settings.json", () => {
        fs.writeFileSync(path.join(helixDir, "settings.json"), JSON.stringify({ autoCompressThreshold: 250 }));
        expect(readAutoCompressThreshold()).toBe(250);
    });

    it("falls back to default for invalid values", () => {
        fs.writeFileSync(path.join(helixDir, "settings.json"), JSON.stringify({ autoCompressThreshold: "lots" }));
        expect(readAutoCompressThreshold()).toBe(100);
    });
});
