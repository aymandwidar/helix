/**
 * /verify-visual — capture a screenshot of the running app and diff against a
 * baseline. Optional dependency model:
 *   - puppeteer or playwright provides the screenshot capability
 *   - pixelmatch + pngjs provide the diff
 *
 * If either side is unavailable, we report it cleanly instead of failing.
 *
 * The module is structured for testability: the capture and diff providers
 * are injectable so unit tests can run without browsers or PNG libs.
 */

import * as fs from "fs";
import * as path from "path";

export interface CaptureProvider {
    available: boolean;
    capture?(url: string, opts?: { viewport?: { width: number; height: number } }): Promise<Buffer>;
    /** Hint shown when unavailable (e.g. "npm i puppeteer"). */
    installHint?: string;
}

export interface DiffProvider {
    available: boolean;
    diff?(baseline: Buffer, current: Buffer, opts?: { threshold?: number }): { mismatchedPixels: number; totalPixels: number; diffImage?: Buffer };
    installHint?: string;
}

export interface VerifyVisualOptions {
    cwd: string;
    /** URL to capture; default reads helix.config.json or http://localhost:3000. */
    url?: string;
    /** Threshold 0-1; default 0.1. */
    threshold?: number;
    /** Override providers (used by tests). */
    captureProvider?: CaptureProvider;
    diffProvider?: DiffProvider;
    /** Path to the baseline PNG (default: .helix/visual-baseline.png). */
    baselinePath?: string;
}

export interface VerifyVisualResult {
    status: "no-deps" | "baseline-created" | "match" | "mismatch" | "error";
    url?: string;
    baselinePath: string;
    /** When status=mismatch. */
    mismatchedPixels?: number;
    totalPixels?: number;
    diffPath?: string;
    /** Hints shown on no-deps / error. */
    message?: string;
}

const DEFAULT_BASELINE = ".helix/visual-baseline.png";
const DEFAULT_DIFF = ".helix/visual-diff.png";

export async function verifyVisual(options: VerifyVisualOptions): Promise<VerifyVisualResult> {
    const cwd = options.cwd;
    const url = options.url || readDefaultUrl(cwd);
    const baselinePath = path.join(cwd, options.baselinePath || DEFAULT_BASELINE);

    const capture = options.captureProvider || await loadCaptureProvider();
    const diff = options.diffProvider || await loadDiffProvider();

    if (!capture.available) {
        return {
            status: "no-deps",
            url,
            baselinePath,
            message: capture.installHint || "Install puppeteer to enable screenshots: npm i -D puppeteer",
        };
    }

    let current: Buffer;
    try {
        current = await capture.capture!(url);
    } catch (e: any) {
        return { status: "error", url, baselinePath, message: e?.message || String(e) };
    }

    if (!fs.existsSync(baselinePath)) {
        fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
        fs.writeFileSync(baselinePath, current);
        return { status: "baseline-created", url, baselinePath };
    }

    if (!diff.available) {
        return {
            status: "no-deps",
            url,
            baselinePath,
            message: diff.installHint || "Install pixelmatch + pngjs to enable diffing: npm i -D pixelmatch pngjs",
        };
    }

    const baseline = fs.readFileSync(baselinePath);
    const result = diff.diff!(baseline, current, { threshold: options.threshold ?? 0.1 });

    if (result.mismatchedPixels === 0) {
        return {
            status: "match",
            url,
            baselinePath,
            mismatchedPixels: 0,
            totalPixels: result.totalPixels,
        };
    }

    let diffPath: string | undefined;
    if (result.diffImage) {
        diffPath = path.join(cwd, DEFAULT_DIFF);
        fs.mkdirSync(path.dirname(diffPath), { recursive: true });
        fs.writeFileSync(diffPath, result.diffImage);
    }

    return {
        status: "mismatch",
        url,
        baselinePath,
        mismatchedPixels: result.mismatchedPixels,
        totalPixels: result.totalPixels,
        diffPath,
    };
}

function readDefaultUrl(cwd: string): string {
    const cfg = path.join(cwd, "helix.config.json");
    if (fs.existsSync(cfg)) {
        try {
            const parsed = JSON.parse(fs.readFileSync(cfg, "utf-8"));
            if (typeof parsed.previewUrl === "string") return parsed.previewUrl;
        } catch { /* ignore */ }
    }
    return "http://localhost:3000";
}

async function loadCaptureProvider(): Promise<CaptureProvider> {
    try {
        // Dynamic require so TypeScript doesn't demand puppeteer's types at compile time.
        const puppeteer = require("puppeteer");
        return {
            available: true,
            async capture(url: string, opts) {
                const browser = await (puppeteer as any).launch({ headless: "new" });
                try {
                    const page = await browser.newPage();
                    if (opts?.viewport) await page.setViewport(opts.viewport);
                    await page.goto(url, { waitUntil: "networkidle0", timeout: 30_000 });
                    const buffer = await page.screenshot({ fullPage: true });
                    return buffer as Buffer;
                } finally {
                    await browser.close();
                }
            },
        };
    } catch {
        return { available: false, installHint: "Install puppeteer to enable screenshots: npm i -D puppeteer" };
    }
}

async function loadDiffProvider(): Promise<DiffProvider> {
    try {
        const pixelmatchMod = require("pixelmatch");
        const pixelmatch = pixelmatchMod.default || pixelmatchMod;
        const { PNG } = require("pngjs");
        return {
            available: true,
            diff(baseline, current, opts) {
                const a = (PNG as any).sync.read(baseline);
                const b = (PNG as any).sync.read(current);
                const { width, height } = a;
                const diff = new (PNG as any)({ width, height });
                const mismatched = pixelmatch(a.data, b.data, diff.data, width, height, { threshold: opts?.threshold ?? 0.1 });
                return {
                    mismatchedPixels: mismatched,
                    totalPixels: width * height,
                    diffImage: (PNG as any).sync.write(diff),
                };
            },
        };
    } catch {
        return { available: false, installHint: "Install pixelmatch + pngjs: npm i -D pixelmatch pngjs" };
    }
}
