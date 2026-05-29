/**
 * Diff helpers — drive AI to explain or review a git diff.
 *
 * Both helpers accept either a precomputed diff string or shell out to
 * `git diff`. They delegate prompting to `createCompletion` so the same
 * model defaults apply. Tests inject a custom `diffProvider` so they don't
 * need a real git working tree.
 */

import { createCompletion, DEFAULT_MODEL } from "../openrouter";

export interface DiffOptions {
    /** Override the diff source (used by tests). */
    diff?: string;
    /** Git revision range, e.g. "HEAD~1..HEAD" or "main...feature". */
    range?: string;
    /** Working directory for the git command. */
    cwd?: string;
    /** Override the AI model. */
    model?: string;
    /** Limit the diff length (chars) sent to the model. */
    maxChars?: number;
}

const DEFAULT_MAX_CHARS = 80_000;

export async function getDiff(options: DiffOptions = {}): Promise<string> {
    if (options.diff !== undefined) return options.diff;
    const execa = (await import("execa")).default;
    const args = options.range ? ["diff", options.range] : ["diff", "--cached", "HEAD"];
    try {
        const result = await execa("git", args, { cwd: options.cwd || process.cwd(), reject: false });
        if ((result.exitCode ?? 0) !== 0) {
            const fallback = await execa("git", ["diff"], { cwd: options.cwd || process.cwd(), reject: false });
            return fallback.stdout || "";
        }
        return result.stdout || "";
    } catch {
        return "";
    }
}

const EXPLAIN_SYSTEM = `You are an experienced code reviewer asked to explain what a diff does.
Output:
- ## Summary (one short paragraph: what changed at a high level)
- ## Notable changes (bullet list grouped by file)
- ## Risks (any code smell, edge case, or test gap worth flagging — empty section if none)
Keep it terse. No fluff.`;

const REVIEW_SYSTEM = `You are doing a focused code review on a diff. Be candid but constructive. Output:
- ## Verdict: ship / ship-with-fixes / hold
- ## Must-fix (concrete issues that should block merge — empty if none)
- ## Nice-to-have (style/cleanup suggestions)
- ## Tests (gaps you noticed)
Reference files and line numbers from the diff hunks where useful.`;

export async function explainDiff(options: DiffOptions = {}): Promise<string> {
    const diff = await getDiff(options);
    if (!diff.trim()) return "(no changes detected)";
    const max = options.maxChars ?? DEFAULT_MAX_CHARS;
    const truncated = diff.length > max ? diff.slice(0, max) + `\n\n…(+${diff.length - max} chars truncated)` : diff;
    return createCompletion(EXPLAIN_SYSTEM, "Explain this diff:\n\n```diff\n" + truncated + "\n```", {
        model: options.model || DEFAULT_MODEL,
        temperature: 0.2,
        maxTokens: 1500,
    });
}

export async function reviewDiff(options: DiffOptions = {}): Promise<string> {
    const diff = await getDiff(options);
    if (!diff.trim()) return "(no changes detected)";
    const max = options.maxChars ?? DEFAULT_MAX_CHARS;
    const truncated = diff.length > max ? diff.slice(0, max) + `\n\n…(+${diff.length - max} chars truncated)` : diff;
    return createCompletion(REVIEW_SYSTEM, "Review this diff:\n\n```diff\n" + truncated + "\n```", {
        model: options.model || DEFAULT_MODEL,
        temperature: 0.2,
        maxTokens: 1500,
    });
}
