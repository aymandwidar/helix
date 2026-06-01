/**
 * Auto-compression for long shell output.
 *
 * When `shell_exec` produces a large stdout block, the model only needs the
 * first/last slice to understand the result. The full output is still shown
 * to the user in their terminal — this only affects what we feed back to
 * the model for the next turn.
 *
 * Threshold is configurable via ~/.helix/settings.json → autoCompressThreshold.
 */

const DEFAULT_HEAD = 20;
const DEFAULT_TAIL = 20;
const DEFAULT_THRESHOLD = 100;

export interface CompressOptions {
    /** Lines threshold above which we compress (default 100). */
    threshold?: number;
    /** Lines kept from the head (default 20). */
    head?: number;
    /** Lines kept from the tail (default 20). */
    tail?: number;
}

export interface CompressResult {
    text: string;
    originalLineCount: number;
    finalLineCount: number;
    compressed: boolean;
    truncatedLineCount: number;
}

export function autoCompressLines(input: string, options: CompressOptions = {}): CompressResult {
    const threshold = options.threshold ?? DEFAULT_THRESHOLD;
    const head = options.head ?? DEFAULT_HEAD;
    const tail = options.tail ?? DEFAULT_TAIL;

    const lines = input.split("\n");
    if (lines.length <= threshold) {
        return {
            text: input,
            originalLineCount: lines.length,
            finalLineCount: lines.length,
            compressed: false,
            truncatedLineCount: 0,
        };
    }

    const headSlice = lines.slice(0, head);
    const tailSlice = lines.slice(-tail);
    const truncated = lines.length - head - tail;
    const compressedLines = [
        ...headSlice,
        `... (${truncated} lines truncated by Helix auto-compress) ...`,
        ...tailSlice,
    ];

    return {
        text: compressedLines.join("\n"),
        originalLineCount: lines.length,
        finalLineCount: compressedLines.length,
        compressed: true,
        truncatedLineCount: truncated,
    };
}

import { loadSettings } from "../../mcp/config";

export function readAutoCompressThreshold(): number {
    try {
        const settings = loadSettings();
        const value = (settings as any).autoCompressThreshold;
        if (typeof value === "number" && value > 0) return value;
    } catch {
        // ignore — fall through to default
    }
    return DEFAULT_THRESHOLD;
}
