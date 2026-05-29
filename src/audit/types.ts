/**
 * Audit types — used by the quality audit engine.
 */

export type AuditCategory = "a11y" | "performance" | "seo" | "security";
export type Severity = "low" | "medium" | "high" | "critical";

export interface AuditFinding {
    category: AuditCategory;
    severity: Severity;
    title: string;
    file: string;
    line?: number;
    /** Why this matters and how to fix it (single short paragraph). */
    suggestion: string;
    /** Optional rule id for grouping/dedup. */
    ruleId?: string;
}

export interface AuditReport {
    findings: AuditFinding[];
    summary: {
        total: number;
        byCategory: Record<AuditCategory, number>;
        bySeverity: Record<Severity, number>;
    };
    /** Deterministic 0-100 quality score derived from severities. */
    score: number;
}
