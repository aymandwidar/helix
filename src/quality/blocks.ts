/**
 * Block TUI — render terminal output as boxed sections with a header strip.
 *
 * Used as an alternative to the default flat display when `--blocks` is
 * passed to `helix chat` or the user invokes `/blocks on`.
 */

import chalk from "chalk";

export type BlockKind = "info" | "warn" | "error" | "tool" | "result" | "assistant" | "user";

const KIND_STYLES: Record<BlockKind, { label: string; color: (s: string) => string }> = {
    info:      { label: "INFO",   color: chalk.gray },
    warn:      { label: "WARN",   color: chalk.yellow },
    error:     { label: "ERROR",  color: chalk.red },
    tool:      { label: "TOOL",   color: chalk.cyan },
    result:    { label: "RESULT", color: chalk.green },
    assistant: { label: "AI",     color: chalk.magenta },
    user:      { label: "USER",   color: chalk.blue },
};

export interface BlockOptions {
    /** Total width of the box (default: terminal width or 100). */
    width?: number;
    /** Hide the header strip — useful for nested blocks. */
    hideHeader?: boolean;
}

export function renderBlock(kind: BlockKind, body: string, options: BlockOptions = {}): string {
    const width = Math.max(40, Math.min(options.width || (process.stdout.columns || 100), 200));
    const style = KIND_STYLES[kind];
    const lines: string[] = [];
    if (!options.hideHeader) {
        const label = style.color(`[ ${style.label} ]`);
        const rule = style.color("─".repeat(Math.max(0, width - label.length - stripAnsi(label).length / 0 - 2)));
        // Simpler: header is "─── [LABEL] " padded with dashes to width
        const lhs = `─── ${style.color("[" + style.label + "]")} `;
        const used = stripAnsi(lhs).length;
        const padded = lhs + chalk.gray("─".repeat(Math.max(0, width - used)));
        lines.push(padded);
    }
    for (const line of body.split("\n")) lines.push("  " + line);
    if (!options.hideHeader) lines.push(chalk.gray("─".repeat(width)));
    return lines.join("\n");
}

export function stripAnsi(text: string): string {
    return text.replace(/\[[0-9;]*m/g, "");
}

/**
 * Build a block-flavored Display object that wraps another Display.
 * Each call routes through `renderBlock` so output appears in boxes.
 */
import { Display } from "../chat/display";

export function blockDisplay(base: Display): Display {
    return {
        info: (t: string) => process.stdout.write(renderBlock("info", t) + "\n"),
        warn: (t: string) => process.stdout.write(renderBlock("warn", t) + "\n"),
        error: (t: string) => process.stdout.write(renderBlock("error", t) + "\n"),
        assistant: (t: string) => process.stdout.write(renderBlock("assistant", t) + "\n"),
        user: (t: string) => process.stdout.write(renderBlock("user", t) + "\n"),
        toolCall: (name: string, args: Record<string, unknown>) => {
            const argText = Object.entries(args).map(([k, v]) => `${k}=${truncate(JSON.stringify(v), 60)}`).join(", ");
            process.stdout.write(renderBlock("tool", `${name}(${argText})`) + "\n");
        },
        toolResult: (name: string, output: string, success: boolean) => {
            process.stdout.write(renderBlock(success ? "result" : "error", `${name}\n${truncate(output, 800)}`) + "\n");
        },
        diff: base.diff,
        spinner: base.spinner,
        confirm: base.confirm,
        raw: base.raw,
    };
}

function truncate(text: string, max: number): string {
    return text.length > max ? text.slice(0, max) + "…" : text;
}
