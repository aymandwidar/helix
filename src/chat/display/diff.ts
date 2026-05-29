/**
 * Colored unified diff display for file edits/writes.
 */

import chalk from "chalk";

export function renderDiff(oldText: string, newText: string, filename = "file"): string {
    let createPatch: ((file: string, a: string, b: string) => string) | null = null;
    try {
        ({ createPatch } = require("diff"));
    } catch {
        createPatch = null;
    }

    if (!createPatch) {
        return `--- ${filename}\n+++ ${filename}\n(diff library unavailable)`;
    }

    const patch = createPatch(filename, oldText, newText);
    return colorizeUnifiedDiff(patch);
}

export function colorizeUnifiedDiff(patch: string): string {
    return patch
        .split("\n")
        .map(line => {
            if (line.startsWith("+++") || line.startsWith("---")) return chalk.bold(line);
            if (line.startsWith("@@")) return chalk.cyan(line);
            if (line.startsWith("+")) return chalk.green(line);
            if (line.startsWith("-")) return chalk.red(line);
            return chalk.gray(line);
        })
        .join("\n");
}

export function summarizeDiff(oldText: string, newText: string): { added: number; removed: number } {
    let createPatch: ((file: string, a: string, b: string) => string) | null = null;
    try {
        ({ createPatch } = require("diff"));
    } catch {
        return { added: 0, removed: 0 };
    }
    if (!createPatch) return { added: 0, removed: 0 };

    const patch = createPatch("f", oldText, newText);
    let added = 0;
    let removed = 0;
    for (const line of patch.split("\n")) {
        if (line.startsWith("+") && !line.startsWith("+++")) added++;
        else if (line.startsWith("-") && !line.startsWith("---")) removed++;
    }
    return { added, removed };
}
