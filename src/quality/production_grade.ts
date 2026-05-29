/**
 * Production-grade quality policy.
 *
 * When a generation/evolve command is run with --production-grade, this
 * module supplies (1) a strict prompt suffix the planner/blueprint authors
 * use, and (2) a post-generation audit pass that fails the run if blocking
 * findings remain.
 */

import { auditProject, AuditReport, formatAuditReport } from "../audit";

export const PRODUCTION_GRADE_PROMPT_SUFFIX = `
# Production-grade quality requirements

When generating or modifying code under this directive, you MUST:

1. **Accessibility**: every interactive element has a label, every <img> has an alt, every form input has an associated <label>.
2. **Performance**: use next/image (or platform-equivalent) for raster images; pass a deps array to every useEffect; avoid unnecessary client components.
3. **SEO**: every App Router page exports \`metadata\` (or \`generateMetadata\`).
4. **Security**: no \`dangerouslySetInnerHTML\` without explicit sanitization; no \`eval\`; no hardcoded secrets — load from process.env.
5. **Tests**: at least one test for every new pure helper; smoke test for every new route handler.
6. **Errors**: API routes return structured error responses (status + error code).
7. **Types**: no \`any\` types, no \`@ts-ignore\` without an inline reason comment.

Treat these as hard constraints, not suggestions. If you have to violate one, call it out explicitly in the rationale.
`.trim();

export interface PostGenerateAuditOptions {
    cwd: string;
    /** Severities at or above this level fail the run. Default "high". */
    failSeverity?: "low" | "medium" | "high" | "critical";
}

const SEVERITY_RANK: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };

export interface PostGenerateAuditResult {
    report: AuditReport;
    formattedReport: string;
    passed: boolean;
    blockingFindings: number;
}

export function runPostGenerateAudit(opts: PostGenerateAuditOptions): PostGenerateAuditResult {
    const report = auditProject({ cwd: opts.cwd });
    const failSeverity = opts.failSeverity || "high";
    const failRank = SEVERITY_RANK[failSeverity];
    const blocking = report.findings.filter(f => SEVERITY_RANK[f.severity] >= failRank);
    return {
        report,
        formattedReport: formatAuditReport(report),
        passed: blocking.length === 0,
        blockingFindings: blocking.length,
    };
}
