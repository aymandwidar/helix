/**
 * Audit engine — runs file-pattern rules across a project and produces an
 * AuditReport. Pure-function rules (no AI calls) so results are deterministic
 * and CI-friendly.
 */

import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import { AuditCategory, AuditFinding, AuditReport, Severity } from "./types";
import { ALL_RULES, AuditRule } from "./rules";

const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build", ".helix", "coverage", ".turbo"]);
const MAX_FILE_SIZE = 1_000_000;
const SUPPORTED_EXTENSIONS = /\.(tsx?|jsx?|html?)$/;

const SEVERITY_WEIGHT: Record<Severity, number> = {
    low: 1,
    medium: 4,
    high: 10,
    critical: 25,
};

export interface AuditOptions {
    cwd?: string;
    /** Only run rules in these categories (default: all). */
    categories?: AuditCategory[];
    /** Override the rule list (used by tests / extensions). */
    rules?: AuditRule[];
}

export function auditProject(options: AuditOptions = {}): AuditReport {
    const cwd = options.cwd || process.cwd();
    const categories = new Set(options.categories || ["a11y", "performance", "seo", "security"]);
    const rules = options.rules || ALL_RULES;
    const findings: AuditFinding[] = [];

    for (const file of walkFiles(cwd)) {
        let content: string;
        try {
            const stat = fs.statSync(file);
            if (stat.size > MAX_FILE_SIZE) continue;
            content = fs.readFileSync(file, "utf-8");
        } catch {
            continue;
        }
        const rel = path.relative(cwd, file);
        for (const rule of rules) {
            try {
                const found = rule({ file: rel, content });
                for (const f of found) {
                    if (categories.has(f.category)) findings.push(f);
                }
            } catch {
                // Bad rule — skip, don't fail the audit
            }
        }
    }

    return buildReport(findings);
}

function walkFiles(root: string): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const entry of entries) {
            if (SKIP_DIRS.has(entry.name)) continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
                continue;
            }
            if (SUPPORTED_EXTENSIONS.test(entry.name)) out.push(full);
        }
    };
    walk(root);
    return out;
}

function buildReport(findings: AuditFinding[]): AuditReport {
    const byCategory: Record<AuditCategory, number> = { a11y: 0, performance: 0, seo: 0, security: 0 };
    const bySeverity: Record<Severity, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    let weight = 0;
    for (const f of findings) {
        byCategory[f.category]++;
        bySeverity[f.severity]++;
        weight += SEVERITY_WEIGHT[f.severity];
    }
    const score = Math.max(0, Math.min(100, 100 - weight));
    return {
        findings,
        summary: { total: findings.length, byCategory, bySeverity },
        score,
    };
}

export function formatAuditReport(report: AuditReport): string {
    const lines: string[] = [];
    const grade = scoreGrade(report.score);
    lines.push(chalk.bold.cyan(`\n🔬 Quality audit — score ${report.score}/100 (${grade})`));
    lines.push("");
    lines.push(`  By category: a11y=${report.summary.byCategory.a11y} perf=${report.summary.byCategory.performance} seo=${report.summary.byCategory.seo} security=${report.summary.byCategory.security}`);
    lines.push(`  By severity: low=${report.summary.bySeverity.low} medium=${report.summary.bySeverity.medium} high=${report.summary.bySeverity.high} critical=${report.summary.bySeverity.critical}`);

    if (report.findings.length === 0) {
        lines.push(chalk.green("\n  ✓ No issues found."));
        return lines.join("\n");
    }

    const grouped = groupBy(report.findings, f => f.category);
    for (const [category, items] of grouped.entries()) {
        lines.push(chalk.bold(`\n  ${categoryLabel(category)}  (${items.length})`));
        for (const f of items.slice(0, 12)) {
            const sev = severityColor(f.severity);
            const where = f.line ? `${f.file}:${f.line}` : f.file;
            lines.push(`    ${sev(f.severity.padEnd(8))} ${chalk.bold(f.title)}  ${chalk.gray(where)}`);
            lines.push(chalk.gray(`             ${f.suggestion}`));
        }
        if (items.length > 12) lines.push(chalk.gray(`    …(+${items.length - 12} more)`));
    }
    return lines.join("\n");
}

function scoreGrade(score: number): string {
    if (score >= 90) return chalk.green("excellent");
    if (score >= 75) return chalk.green("good");
    if (score >= 60) return chalk.yellow("fair");
    if (score >= 40) return chalk.yellow("poor");
    return chalk.red("critical");
}

function categoryLabel(c: AuditCategory): string {
    switch (c) {
        case "a11y": return "Accessibility";
        case "performance": return "Performance";
        case "seo": return "SEO";
        case "security": return "Security";
    }
}

function severityColor(s: Severity): (text: string) => string {
    if (s === "critical") return chalk.red.bold;
    if (s === "high") return chalk.red;
    if (s === "medium") return chalk.yellow;
    return chalk.gray;
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
    const out = new Map<K, T[]>();
    for (const item of items) {
        const k = key(item);
        const list = out.get(k);
        if (list) list.push(item);
        else out.set(k, [item]);
    }
    return out;
}

export type { AuditFinding, AuditReport, AuditCategory, Severity } from "./types";
