/**
 * Pretty-print Council verdicts for the terminal.
 */

import chalk from "chalk";
import { CouncilVerdict, CouncilModelOpinion, CouncilPreset } from "./types";

export function formatVerdict(verdict: CouncilVerdict): string {
    const lines: string[] = [];
    lines.push(chalk.bold.cyan("⚖  Council verdict"));
    if (verdict.preset) lines.push(chalk.gray(`   preset: ${verdict.preset}`));
    if (verdict.models?.length) lines.push(chalk.gray(`   models: ${verdict.models.join(", ")}`));
    if (verdict.consensus !== undefined) {
        lines.push(chalk.gray(`   consensus: ${(verdict.consensus * 100).toFixed(0)}%`));
    }
    lines.push("");
    lines.push(verdict.verdict || chalk.gray("(no synthesis)"));

    if (verdict.opinions.length > 0) {
        lines.push("");
        lines.push(chalk.bold.cyan(`Per-model reasoning (${verdict.opinions.length}):`));
        for (const op of verdict.opinions) lines.push(formatOpinion(op));
    }

    if (verdict.synthesis && verdict.synthesis !== verdict.verdict) {
        lines.push("");
        lines.push(chalk.gray("Synthesis: " + verdict.synthesis));
    }

    return lines.join("\n");
}

function formatOpinion(op: CouncilModelOpinion): string {
    const head = `${chalk.bold(op.model)}${op.confidence !== undefined ? chalk.gray(` (${(op.confidence * 100).toFixed(0)}%)`) : ""}`;
    const body = (op.response || "").split("\n").map(l => "    " + l).join("\n");
    const reasoning = op.reasoning ? chalk.gray("    reasoning: " + op.reasoning) + "\n" : "";
    return `\n  ${head}\n${reasoning}${body}`;
}

export function formatPresets(presets: CouncilPreset[]): string {
    if (presets.length === 0) return chalk.gray("(no presets)");
    const lines = [chalk.bold.cyan("Council presets:")];
    for (const p of presets) {
        const desc = p.description ? chalk.gray(" — " + p.description) : "";
        const models = p.models?.length ? chalk.gray(`    models: ${p.models.join(", ")}`) : "";
        lines.push(`  ${chalk.bold(p.name)}${desc}`);
        if (models) lines.push(models);
    }
    return lines.join("\n");
}

export function formatHistory(items: Array<{ question: string; verdict: string; at?: string }>): string {
    if (items.length === 0) return chalk.gray("(no deliberations yet)");
    const lines = [chalk.bold.cyan("Recent deliberations:")];
    for (const item of items) {
        const when = item.at ? chalk.gray(` (${item.at})`) : "";
        const q = (item.question || "").slice(0, 80);
        const v = (item.verdict || "").slice(0, 120);
        lines.push(`  ${chalk.bold("Q:")} ${q}${when}`);
        lines.push(`  ${chalk.gray("→")} ${v}`);
    }
    return lines.join("\n");
}
