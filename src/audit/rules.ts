/**
 * File-pattern rules used by the audit engine.
 *
 * Each rule is a pure function over a single file's path + contents. Rules
 * may emit zero or more findings. Severity reflects how confident we are
 * that the issue is real — `critical` for "almost certainly a bug",
 * `low` for "stylistic suggestion".
 */

import { AuditFinding } from "./types";

export interface RuleContext {
    file: string;
    content: string;
}

export type AuditRule = (ctx: RuleContext) => AuditFinding[];

const TS_EXT = /\.(t|j)sx?$/;
const JSX_EXT = /\.(t|j)sx$/;
const HTML_EXT = /\.(html|htm)$/;

// ── A11y rules ──────────────────────────────────────────────────────────

const imgWithoutAlt: AuditRule = ({ file, content }) => {
    if (!JSX_EXT.test(file) && !HTML_EXT.test(file)) return [];
    const findings: AuditFinding[] = [];
    const re = /<img\b(?![^>]*\balt\s*=)[^>]*\/?>/gi;
    let match;
    while ((match = re.exec(content)) !== null) {
        findings.push({
            category: "a11y",
            severity: "medium",
            ruleId: "a11y/img-alt",
            title: "<img> without alt attribute",
            file,
            line: lineOf(content, match.index),
            suggestion: "Add an `alt` attribute to every <img>. Use `alt=\"\"` for decorative images so screen readers skip them.",
        });
    }
    return findings;
};

const buttonWithoutLabel: AuditRule = ({ file, content }) => {
    if (!JSX_EXT.test(file) && !HTML_EXT.test(file)) return [];
    const findings: AuditFinding[] = [];
    const re = /<button\b([^>]*?)(?:\/>|>\s*<\/button>)/gi;
    let match;
    while ((match = re.exec(content)) !== null) {
        const attrs = match[1] || "";
        if (/aria-label\s*=/i.test(attrs) || /aria-labelledby\s*=/i.test(attrs)) continue;
        findings.push({
            category: "a11y",
            severity: "medium",
            ruleId: "a11y/button-label",
            title: "Empty <button> without aria-label",
            file,
            line: lineOf(content, match.index),
            suggestion: "Buttons with no visible text need `aria-label` (or `aria-labelledby`) so assistive tech can announce them.",
        });
    }
    return findings;
};

// ── Performance rules ────────────────────────────────────────────────────

const nextImgInsteadOfImg: AuditRule = ({ file, content }) => {
    if (!JSX_EXT.test(file)) return [];
    const findings: AuditFinding[] = [];
    if (/<img\b/i.test(content) && !/from\s+["']next\/image["']/.test(content)) {
        const idx = content.search(/<img\b/i);
        findings.push({
            category: "performance",
            severity: "low",
            ruleId: "perf/next-image",
            title: "Plain <img> in a Next.js component",
            file,
            line: idx >= 0 ? lineOf(content, idx) : undefined,
            suggestion: "Use `next/image` (Image component) for automatic resizing, lazy-loading, and CLS prevention.",
        });
    }
    return findings;
};

const useEffectMissingDeps: AuditRule = ({ file, content }) => {
    if (!TS_EXT.test(file)) return [];
    const findings: AuditFinding[] = [];
    const re = /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[\s\S]*?\}\s*\)/g;
    let match;
    while ((match = re.exec(content)) !== null) {
        // No `,` followed by an array argument — likely missing deps array
        findings.push({
            category: "performance",
            severity: "low",
            ruleId: "perf/useEffect-deps",
            title: "useEffect without a dependency array",
            file,
            line: lineOf(content, match.index),
            suggestion: "Provide a dependency array as the second argument to `useEffect` to avoid re-running the effect on every render.",
        });
    }
    return findings;
};

// ── SEO rules ────────────────────────────────────────────────────────────

const missingMetadata: AuditRule = ({ file, content }) => {
    if (!/app\/.*page\.(t|j)sx?$/.test(file)) return [];
    const findings: AuditFinding[] = [];
    const hasMetadata = /export\s+(?:const|let)\s+metadata\b/.test(content)
        || /export\s+async\s+function\s+generateMetadata\b/.test(content);
    if (!hasMetadata) {
        findings.push({
            category: "seo",
            severity: "medium",
            ruleId: "seo/page-metadata",
            title: "App Router page missing exported metadata",
            file,
            suggestion: "Export `metadata` (or `generateMetadata`) from this page so search engines and social platforms get a proper title and description.",
        });
    }
    return findings;
};

// ── Security rules ───────────────────────────────────────────────────────

const dangerouslySetInnerHTML: AuditRule = ({ file, content }) => {
    if (!JSX_EXT.test(file)) return [];
    const findings: AuditFinding[] = [];
    const re = /dangerouslySetInnerHTML\s*=/g;
    let match;
    while ((match = re.exec(content)) !== null) {
        findings.push({
            category: "security",
            severity: "high",
            ruleId: "sec/dangerouslySetInnerHTML",
            title: "dangerouslySetInnerHTML usage",
            file,
            line: lineOf(content, match.index),
            suggestion: "Avoid `dangerouslySetInnerHTML` unless you control the input. If unavoidable, sanitize with a vetted library (DOMPurify, sanitize-html).",
        });
    }
    return findings;
};

const evalUsage: AuditRule = ({ file, content }) => {
    if (!TS_EXT.test(file)) return [];
    const findings: AuditFinding[] = [];
    const re = /\beval\s*\(/g;
    let match;
    while ((match = re.exec(content)) !== null) {
        findings.push({
            category: "security",
            severity: "critical",
            ruleId: "sec/eval",
            title: "Use of eval()",
            file,
            line: lineOf(content, match.index),
            suggestion: "`eval` enables arbitrary code execution. Replace with explicit parsing (JSON.parse) or a small interpreter.",
        });
    }
    return findings;
};

const apiKeyInSource: AuditRule = ({ file, content }) => {
    if (!TS_EXT.test(file)) return [];
    const findings: AuditFinding[] = [];
    // Look for high-entropy assignments to *_KEY / *_SECRET / *_TOKEN identifiers
    const re = /\b(API_KEY|SECRET|TOKEN|PASSWORD)\s*[:=]\s*["']([^"']{16,})["']/g;
    let match;
    while ((match = re.exec(content)) !== null) {
        if (match[2].includes("process.env") || match[2].includes("${")) continue;
        findings.push({
            category: "security",
            severity: "critical",
            ruleId: "sec/hardcoded-secret",
            title: `Hardcoded ${match[1].toLowerCase()} in source`,
            file,
            line: lineOf(content, match.index),
            suggestion: "Move the secret to an environment variable and load it via `process.env`. Never commit secrets.",
        });
    }
    return findings;
};

// ── Helpers + export ─────────────────────────────────────────────────────

function lineOf(content: string, index: number): number {
    return content.slice(0, index).split("\n").length;
}

export const ALL_RULES: AuditRule[] = [
    imgWithoutAlt,
    buttonWithoutLabel,
    nextImgInsteadOfImg,
    useEffectMissingDeps,
    missingMetadata,
    dangerouslySetInnerHTML,
    evalUsage,
    apiKeyInSource,
];
