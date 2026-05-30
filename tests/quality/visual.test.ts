import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { verifyVisual } from "../../src/quality/visual";

describe("verifyVisual", () => {
    let tmp: string;
    beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "helix-vv-")); });
    afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

    it("reports no-deps when capture provider is unavailable", async () => {
        const result = await verifyVisual({
            cwd: tmp,
            captureProvider: { available: false, installHint: "install puppeteer" },
            diffProvider: { available: false },
        });
        expect(result.status).toBe("no-deps");
        expect(result.message).toContain("puppeteer");
    });

    it("creates a baseline on first run", async () => {
        const buf = Buffer.from("PNG_BYTES_FAKE");
        const result = await verifyVisual({
            cwd: tmp,
            captureProvider: { available: true, capture: async () => buf },
            diffProvider: { available: true, diff: () => ({ mismatchedPixels: 0, totalPixels: 1 }) },
        });
        expect(result.status).toBe("baseline-created");
        expect(fs.existsSync(result.baselinePath)).toBe(true);
        expect(fs.readFileSync(result.baselinePath).toString()).toBe("PNG_BYTES_FAKE");
    });

    it("returns match when pixel diff is zero", async () => {
        // Pre-seed baseline
        fs.mkdirSync(path.join(tmp, ".helix"), { recursive: true });
        fs.writeFileSync(path.join(tmp, ".helix/visual-baseline.png"), Buffer.from("OLD"));

        const result = await verifyVisual({
            cwd: tmp,
            captureProvider: { available: true, capture: async () => Buffer.from("NEW") },
            diffProvider: { available: true, diff: () => ({ mismatchedPixels: 0, totalPixels: 100 }) },
        });
        expect(result.status).toBe("match");
        expect(result.totalPixels).toBe(100);
    });

    it("returns mismatch and writes diff image", async () => {
        fs.mkdirSync(path.join(tmp, ".helix"), { recursive: true });
        fs.writeFileSync(path.join(tmp, ".helix/visual-baseline.png"), Buffer.from("OLD"));

        const result = await verifyVisual({
            cwd: tmp,
            captureProvider: { available: true, capture: async () => Buffer.from("NEW") },
            diffProvider: { available: true, diff: () => ({ mismatchedPixels: 42, totalPixels: 100, diffImage: Buffer.from("DIFF") }) },
        });
        expect(result.status).toBe("mismatch");
        expect(result.mismatchedPixels).toBe(42);
        expect(result.diffPath).toBeDefined();
        expect(fs.readFileSync(result.diffPath!).toString()).toBe("DIFF");
    });

    it("reports no-deps when only diff provider is missing", async () => {
        fs.mkdirSync(path.join(tmp, ".helix"), { recursive: true });
        fs.writeFileSync(path.join(tmp, ".helix/visual-baseline.png"), Buffer.from("OLD"));

        const result = await verifyVisual({
            cwd: tmp,
            captureProvider: { available: true, capture: async () => Buffer.from("NEW") },
            diffProvider: { available: false, installHint: "install pixelmatch" },
        });
        expect(result.status).toBe("no-deps");
        expect(result.message).toContain("pixelmatch");
    });

    it("captures errors from the capture provider", async () => {
        const result = await verifyVisual({
            cwd: tmp,
            captureProvider: { available: true, capture: async () => { throw new Error("nav timeout"); } },
            diffProvider: { available: false },
        });
        expect(result.status).toBe("error");
        expect(result.message).toContain("nav timeout");
    });
});
