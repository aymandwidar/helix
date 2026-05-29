import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { auditProject, formatAuditReport } from "../../src/audit";

describe("audit engine", () => {
    let tmp: string;
    beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "helix-audit-")); });
    afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

    function write(rel: string, content: string): void {
        const abs = path.join(tmp, rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, content);
    }

    it("returns score 100 with no findings", () => {
        write("page.tsx", `export default function P() { return <div>Hi</div>; }`);
        const report = auditProject({ cwd: tmp });
        expect(report.findings).toEqual([]);
        expect(report.score).toBe(100);
    });

    it("flags <img> without alt as a11y issue", () => {
        write("Component.tsx", `export default function C() { return <img src="/x.png" />; }`);
        const report = auditProject({ cwd: tmp });
        const f = report.findings.find(f => f.ruleId === "a11y/img-alt");
        expect(f).toBeDefined();
        expect(f?.category).toBe("a11y");
        expect(f?.severity).toBe("medium");
    });

    it("flags eval() as critical security issue", () => {
        write("util.ts", `export function run(s: string) { return eval(s); }`);
        const report = auditProject({ cwd: tmp });
        const f = report.findings.find(f => f.ruleId === "sec/eval");
        expect(f).toBeDefined();
        expect(f?.severity).toBe("critical");
    });

    it("flags dangerouslySetInnerHTML as high security issue", () => {
        write("c.tsx", `export default function C({html}: {html: string}) { return <div dangerouslySetInnerHTML={{__html: html}} />; }`);
        const report = auditProject({ cwd: tmp });
        const f = report.findings.find(f => f.ruleId === "sec/dangerouslySetInnerHTML");
        expect(f).toBeDefined();
        expect(f?.severity).toBe("high");
    });

    it("flags hardcoded secrets", () => {
        write("config.ts", `export const API_KEY = "sk-1234567890abcdefABCDEF";`);
        const report = auditProject({ cwd: tmp });
        const f = report.findings.find(f => f.ruleId === "sec/hardcoded-secret");
        expect(f).toBeDefined();
    });

    it("flags App Router pages without exported metadata", () => {
        write("app/about/page.tsx", `export default function P() { return <div>About</div>; }`);
        const report = auditProject({ cwd: tmp });
        const f = report.findings.find(f => f.ruleId === "seo/page-metadata");
        expect(f).toBeDefined();
    });

    it("does not flag pages that DO export metadata", () => {
        write("app/about/page.tsx", `export const metadata = { title: 'About' };\nexport default function P() { return <div/>; }`);
        const report = auditProject({ cwd: tmp });
        expect(report.findings.some(f => f.ruleId === "seo/page-metadata")).toBe(false);
    });

    it("filters by category", () => {
        write("Component.tsx", `export default function C() { return <img src="/x.png" />; }`);
        write("util.ts", `export function run(s: string) { return eval(s); }`);
        const report = auditProject({ cwd: tmp, categories: ["security"] });
        expect(report.findings.every(f => f.category === "security")).toBe(true);
        expect(report.findings.length).toBeGreaterThan(0);
    });

    it("score drops with severity weight", () => {
        write("util.ts", `export function r(s: string) { return eval(s); }`); // critical (-25)
        const report = auditProject({ cwd: tmp });
        expect(report.score).toBeLessThanOrEqual(75);
    });

    it("formatAuditReport shows score grade and category breakdown", () => {
        write("Component.tsx", `export default function C() { return <img src="/x.png" />; }`);
        const report = auditProject({ cwd: tmp });
        const text = formatAuditReport(report);
        expect(text).toContain("Quality audit");
        expect(text).toContain("Accessibility");
    });

    it("ignores files in node_modules and .next", () => {
        write("node_modules/lib/index.tsx", `export default () => <img src="/x" />;`);
        write(".next/cache.tsx", `eval("evil");`);
        const report = auditProject({ cwd: tmp });
        expect(report.findings).toEqual([]);
    });
});
