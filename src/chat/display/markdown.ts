/**
 * Markdown rendering for the terminal.
 * Falls back to plain text if marked-terminal isn't available.
 */

import chalk from "chalk";

let _renderer: ((md: string) => string) | null | undefined;

function getRenderer(): ((md: string) => string) | null {
    if (_renderer !== undefined) return _renderer;
    try {
        const { marked } = require("marked");
        const TerminalRenderer = require("marked-terminal").default || require("marked-terminal");
        marked.setOptions({ renderer: new TerminalRenderer() });
        _renderer = (md: string) => marked.parse(md) as string;
    } catch {
        _renderer = null;
    }
    return _renderer;
}

export function renderMarkdown(md: string): string {
    if (!md) return "";
    const renderer = getRenderer();
    if (renderer) {
        try {
            return renderer(md).trimEnd();
        } catch {
            // fall through
        }
    }
    return md.trimEnd();
}

export function printMarkdown(md: string): void {
    process.stdout.write(renderMarkdown(md) + "\n");
}

export function header(text: string): string {
    return chalk.bold.cyan(text);
}
