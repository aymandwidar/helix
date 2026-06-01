/**
 * CMM savings banner — shown after a generation/evolve that pulled relevant
 * findings from the cognitive memory server. Only renders when CMM returned
 * non-empty results (no banner on empty queries).
 *
 * Inputs come from `runPreGenerateCheck()` in src/mcp/pre_generate.ts.
 */

import chalk from "chalk";
import { PreGenerateFinding, PreGenerateResult } from "../../mcp/pre_generate";

const AVERAGE_DEAD_END_COST_USD = 0.15;
const AVERAGE_DEAD_END_MINUTES = 4;

export interface BannerInputs {
    findings: PreGenerateFinding[];
    /** Optional: pre-counted classifications. When omitted, we infer from tool names. */
    classification?: BannerClassification;
}

export interface BannerClassification {
    /** Past sessions queried (typically the count of search_memory hits + others). */
    sessionsQueried: number;
    /** Dead-end findings (avoided pitfalls). */
    avoidedDeadEnds: number;
    /** Pattern findings (proven approaches applied). */
    appliedPatterns: number;
    /** Optional human descriptions to include in the body. */
    avoidedDescriptions?: string[];
    appliedDescriptions?: string[];
}

export interface BannerOutput {
    /** True when the banner has anything worth showing. */
    nonEmpty: boolean;
    text: string;
    estimatedSavingsUsd: number;
    estimatedSavingsMinutes: number;
}

export function classifyFindings(findings: PreGenerateFinding[]): BannerClassification {
    let sessionsQueried = 0;
    let avoidedDeadEnds = 0;
    let appliedPatterns = 0;
    const avoidedDescriptions: string[] = [];
    const appliedDescriptions: string[] = [];
    for (const f of findings) {
        sessionsQueried++;
        const lowerTool = f.tool.toLowerCase();
        const lowerText = f.text.toLowerCase();
        // get_pitfalls / dead_end / failure → avoided
        if (lowerTool.includes("pitfall") || lowerText.includes("dead end") || lowerText.includes("dead_end") || lowerText.includes("failed because")) {
            avoidedDeadEnds++;
            avoidedDescriptions.push(firstHeadline(f.text));
        } else if (lowerTool.includes("pattern") || lowerTool.includes("strategy") || lowerText.includes("pattern")) {
            appliedPatterns++;
            appliedDescriptions.push(firstHeadline(f.text));
        } else {
            // generic memory hit — count as a session queried only.
        }
    }
    return {
        sessionsQueried,
        avoidedDeadEnds,
        appliedPatterns,
        avoidedDescriptions,
        appliedDescriptions,
    };
}

export function renderCmmBanner(inputs: BannerInputs | PreGenerateResult): BannerOutput {
    const findings = "findings" in inputs ? inputs.findings : (inputs as BannerInputs).findings;
    if (!findings || findings.length === 0) {
        return { nonEmpty: false, text: "", estimatedSavingsUsd: 0, estimatedSavingsMinutes: 0 };
    }
    const classification = (inputs as BannerInputs).classification || classifyFindings(findings);
    const estimatedSavingsUsd = classification.avoidedDeadEnds * AVERAGE_DEAD_END_COST_USD;
    const estimatedSavingsMinutes = classification.avoidedDeadEnds * AVERAGE_DEAD_END_MINUTES;

    const lines: string[] = [];
    const head = chalk.cyan("┌─ 🧠 CMM Memory ─────────────────────────────────────────┐");
    const tail = chalk.cyan("└──────────────────────────────────────────────────────────┘");
    const inner = (text: string) => chalk.cyan("│ ") + text;

    lines.push(head);
    lines.push(inner(`Queried: ${classification.sessionsQueried} past session${classification.sessionsQueried === 1 ? "" : "s"} for this project`));
    if (classification.avoidedDeadEnds > 0) {
        const detail = classification.avoidedDescriptions && classification.avoidedDescriptions.length
            ? ` (${classification.avoidedDescriptions.slice(0, 2).join(", ")}${classification.avoidedDescriptions.length > 2 ? ", …" : ""})`
            : "";
        lines.push(inner(`Avoided: ${classification.avoidedDeadEnds} known dead end${classification.avoidedDeadEnds === 1 ? "" : "s"}${detail}`));
    }
    if (classification.appliedPatterns > 0) {
        const detail = classification.appliedDescriptions && classification.appliedDescriptions.length
            ? ` (${classification.appliedDescriptions.slice(0, 2).join(", ")}${classification.appliedDescriptions.length > 2 ? ", …" : ""})`
            : "";
        lines.push(inner(`Applied: ${classification.appliedPatterns} proven pattern${classification.appliedPatterns === 1 ? "" : "s"}${detail}`));
    }
    if (estimatedSavingsUsd > 0) {
        lines.push(inner(`Estimated savings: ~$${estimatedSavingsUsd.toFixed(2)} / ~${estimatedSavingsMinutes} minutes`));
    }
    lines.push(tail);

    return {
        nonEmpty: true,
        text: lines.join("\n"),
        estimatedSavingsUsd,
        estimatedSavingsMinutes,
    };
}

function firstHeadline(text: string): string {
    const line = (text.split("\n").find(l => l.trim().length > 0) || "").trim();
    return line.length > 60 ? line.slice(0, 60) + "…" : line;
}
