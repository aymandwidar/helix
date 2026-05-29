import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { captureBaseline, checkAgainstBaseline, readBaseline, formatRegressionDiff } from "../../src/quality/regression";

describe("regression-guard", () => {
    let tmp: string;
    beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "helix-rg-")); });
    afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

    function write(rel: string, content: string): void {
        const abs = path.join(tmp, rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, content);
    }

    it("captures a baseline with file checksums", async () => {
        write("package.json", JSON.stringify({ name: "demo", scripts: {} }));
        write("src/a.ts", "export const a = 1;");
        const baseline = await captureBaseline({ cwd: tmp, skipValidation: true });
        expect(baseline.files.length).toBeGreaterThan(0);
        const fromDisk = readBaseline(tmp);
        expect(fromDisk?.createdAt).toBe(baseline.createdAt);
    });

    it("detects added/changed/removed files between captures", async () => {
        write("package.json", JSON.stringify({ name: "demo", scripts: {} }));
        write("src/a.ts", "export const a = 1;");
        await captureBaseline({ cwd: tmp, skipValidation: true });

        // Mutate
        write("src/a.ts", "export const a = 2;"); // changed
        write("src/b.ts", "export const b = 1;"); // added
        // Note: nothing removed

        const result = await checkAgainstBaseline(tmp);
        expect(result.diff?.changed).toEqual(["src/a.ts"]);
        expect(result.diff?.added).toEqual(["src/b.ts"]);
        expect(result.diff?.removed).toEqual([]);
    });

    it("returns a 'no baseline' state cleanly when none exists", async () => {
        write("package.json", JSON.stringify({ name: "demo", scripts: {} }));
        const result = await checkAgainstBaseline(tmp);
        expect(result.baseline).toBeNull();
        expect(result.diff).toBeNull();
    });

    it("formatRegressionDiff handles null", () => {
        expect(formatRegressionDiff(null)).toContain("no baseline");
    });

    it("formatRegressionDiff highlights new failures", () => {
        const text = formatRegressionDiff({
            added: [], removed: [], changed: [],
            newFailures: ["build"], fixed: [],
        });
        expect(text).toContain("New validation failures");
    });
});
