import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { runPostGenerateAudit, PRODUCTION_GRADE_PROMPT_SUFFIX } from "../../src/quality/production_grade";

describe("production-grade policy", () => {
    let tmp: string;
    beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "helix-pg-")); });
    afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

    it("PRODUCTION_GRADE_PROMPT_SUFFIX mentions all four pillars", () => {
        expect(PRODUCTION_GRADE_PROMPT_SUFFIX).toMatch(/Accessibility/);
        expect(PRODUCTION_GRADE_PROMPT_SUFFIX).toMatch(/Performance/);
        expect(PRODUCTION_GRADE_PROMPT_SUFFIX).toMatch(/SEO/);
        expect(PRODUCTION_GRADE_PROMPT_SUFFIX).toMatch(/Security/);
    });

    it("passes when no blocking findings exist", () => {
        fs.writeFileSync(path.join(tmp, "ok.tsx"), `export default function P() { return <div>Hi</div>; }`);
        const result = runPostGenerateAudit({ cwd: tmp, failSeverity: "high" });
        expect(result.passed).toBe(true);
    });

    it("fails when a critical finding exists", () => {
        fs.writeFileSync(path.join(tmp, "util.ts"), `export const r = (s: string) => eval(s);`);
        const result = runPostGenerateAudit({ cwd: tmp, failSeverity: "high" });
        expect(result.passed).toBe(false);
        expect(result.blockingFindings).toBeGreaterThan(0);
    });

    it("respects failSeverity threshold", () => {
        // medium-only finding: img without alt
        fs.writeFileSync(path.join(tmp, "C.tsx"), `export default function C() { return <img src="/x" />; }`);
        const strict = runPostGenerateAudit({ cwd: tmp, failSeverity: "medium" });
        const lax = runPostGenerateAudit({ cwd: tmp, failSeverity: "high" });
        expect(strict.passed).toBe(false);
        expect(lax.passed).toBe(true);
    });
});
