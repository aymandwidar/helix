/**
 * Display facade for chat mode.
 */

import chalk from "chalk";
import * as readline from "readline";
import { renderMarkdown, printMarkdown } from "./markdown";
import { renderDiff, summarizeDiff } from "./diff";
import { startSpinner, SpinnerHandle } from "./spinner";
import { formatToolCall, formatToolResult } from "./tool_output";

export interface Display {
    info(text: string): void;
    warn(text: string): void;
    error(text: string): void;
    assistant(text: string): void;
    user(text: string): void;
    toolCall(name: string, args: Record<string, unknown>): void;
    toolResult(name: string, output: string, success: boolean): void;
    diff(oldText: string, newText: string, filename?: string): void;
    spinner(text: string): SpinnerHandle;
    confirm(question: string): Promise<boolean>;
    raw(text: string): void;
}

export const display: Display = {
    info: (t: string) => console.log(chalk.gray(t)),
    warn: (t: string) => console.log(chalk.yellow("⚠  " + t)),
    error: (t: string) => console.log(chalk.red("✗ " + t)),
    assistant: (t: string) => printMarkdown(t),
    user: (t: string) => console.log(chalk.bold.blue("you ▸ ") + t),
    toolCall: (name: string, args: Record<string, unknown>) => console.log(formatToolCall(name, args)),
    toolResult: (name: string, output: string, success: boolean) =>
        console.log(formatToolResult(name, output, success)),
    diff: (oldText: string, newText: string, filename?: string) => {
        const summary = summarizeDiff(oldText, newText);
        console.log(chalk.gray(`(+${summary.added} -${summary.removed})`));
        console.log(renderDiff(oldText, newText, filename || "file"));
    },
    spinner: (t: string) => startSpinner(t),
    confirm: async (question: string) => {
        if (!process.stdin.isTTY) return true;
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        return new Promise<boolean>(resolve => {
            rl.question(chalk.yellow(question + " [y/N] "), answer => {
                rl.close();
                resolve(/^y(es)?$/i.test(answer.trim()));
            });
        });
    },
    raw: (t: string) => process.stdout.write(t),
};

export { renderMarkdown, renderDiff };
