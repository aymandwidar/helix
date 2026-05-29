/**
 * Pretty-print tool calls and results in chat mode.
 */

import chalk from "chalk";

export function formatToolCall(name: string, args: Record<string, unknown>): string {
    const argSummary = summarizeArgs(args);
    return `${chalk.cyan("⚙  " + name)}${argSummary ? chalk.gray("(" + argSummary + ")") : ""}`;
}

export function formatToolResult(name: string, output: string, success: boolean, truncate = 600): string {
    const icon = success ? chalk.green("✓") : chalk.red("✗");
    const trimmed = output.length > truncate ? output.slice(0, truncate) + chalk.gray(`\n  …(+${output.length - truncate} chars)`) : output;
    return `${icon} ${chalk.gray(name)}\n${indent(trimmed, "    ")}`;
}

function summarizeArgs(args: Record<string, unknown>): string {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(args)) {
        let display: string;
        if (typeof value === "string") {
            display = value.length > 60 ? `"${value.slice(0, 60)}…"` : `"${value}"`;
        } else if (Array.isArray(value)) {
            display = `[${value.length}]`;
        } else if (typeof value === "object" && value) {
            display = "{…}";
        } else {
            display = String(value);
        }
        parts.push(`${key}=${display}`);
    }
    return parts.join(", ");
}

function indent(text: string, prefix: string): string {
    return text.split("\n").map(l => prefix + l).join("\n");
}
