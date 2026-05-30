/**
 * `helix pr create` and `helix pr review` — AI-assisted PR workflows.
 */

import { GitRunner, AiClient } from "./types";
import { defaultRunner, defaultAi, isCommandAvailable, currentBranch, defaultBaseBranch, getDiffAgainst } from "./shared";

export interface PrCreateOptions {
    cwd: string;
    base?: string;
    /** Skip gh CLI invocation; just print the command + body. */
    printOnly?: boolean;
    /** Override runners for tests. */
    runner?: GitRunner;
    ai?: AiClient;
    /** Override the title (skip AI). */
    title?: string;
    model?: string;
}

export interface PrCreateResult {
    branch: string | null;
    base: string;
    title: string;
    body: string;
    prUrl?: string;
    method: "gh" | "print-only" | "no-gh";
    /** Diff stat / preview shown to user. */
    diffPreview: string;
}

const PR_TITLE_BODY_SYSTEM = `You write GitHub PR titles and descriptions from a unified diff. Output strictly:

TITLE: <one-line, ≤72 chars, imperative mood>

## Summary
<1-3 bullets covering what changed and why>

## Test plan
<bulleted checklist of how to verify the change>

No prose before TITLE:. No code fences.`;

export async function createPr(options: PrCreateOptions): Promise<PrCreateResult> {
    const runner = options.runner || defaultRunner;
    const ai = options.ai || defaultAi;
    const cwd = options.cwd;

    const branch = await currentBranch(runner, cwd);
    const base = options.base || await defaultBaseBranch(runner, cwd);
    const diff = await getDiffAgainst(base, runner, cwd);

    if (!diff.trim()) {
        return {
            branch,
            base,
            title: "(no changes)",
            body: "(no changes detected vs base branch)",
            method: options.printOnly ? "print-only" : (await isCommandAvailable("gh", runner)) ? "gh" : "no-gh",
            diffPreview: "",
        };
    }

    const truncated = diff.length > 50_000 ? diff.slice(0, 50_000) + `\n\n…(+${diff.length - 50_000} chars truncated)` : diff;

    let title = options.title || "";
    let body = "";
    if (!title) {
        const aiText = await ai(PR_TITLE_BODY_SYSTEM, "Diff:\n\n```diff\n" + truncated + "\n```", {
            model: options.model,
            temperature: 0.2,
            maxTokens: 1500,
        });
        ({ title, body } = parseAiPrOutput(aiText));
    } else {
        body = `## Summary\n- ${title}\n\n## Test plan\n- [ ] verify locally`;
    }

    const ghAvailable = !options.printOnly && await isCommandAvailable("gh", runner);
    let prUrl: string | undefined;

    if (ghAvailable) {
        const args = ["pr", "create", "--title", title, "--body", body, "--base", base];
        const r = await runner("gh", args, { cwd });
        if (r.exitCode === 0) {
            const match = r.stdout.match(/https?:\/\/\S+/);
            if (match) prUrl = match[0];
        }
        return {
            branch,
            base,
            title,
            body,
            prUrl,
            method: "gh",
            diffPreview: summarizeDiff(diff),
        };
    }

    return {
        branch,
        base,
        title,
        body,
        method: options.printOnly ? "print-only" : "no-gh",
        diffPreview: summarizeDiff(diff),
    };
}

export interface PrReviewOptions {
    cwd: string;
    base?: string;
    runner?: GitRunner;
    ai?: AiClient;
    model?: string;
}

const PR_REVIEW_SYSTEM = `You're doing a focused code review on a pull-request diff. Be candid but constructive. Output:

## Verdict
ship | ship-with-fixes | hold

## Must-fix
<concrete blocking issues — empty if none>

## Nice-to-have
<style/cleanup suggestions>

## Tests
<gaps you noticed in test coverage>

Reference files and line numbers from diff hunks where relevant.`;

export async function reviewPr(options: PrReviewOptions): Promise<string> {
    const runner = options.runner || defaultRunner;
    const ai = options.ai || defaultAi;
    const base = options.base || await defaultBaseBranch(runner, options.cwd);
    const diff = await getDiffAgainst(base, runner, options.cwd);
    if (!diff.trim()) return "(no changes vs base)";
    const truncated = diff.length > 50_000 ? diff.slice(0, 50_000) + `\n\n…(+${diff.length - 50_000} chars truncated)` : diff;
    return ai(PR_REVIEW_SYSTEM, "Review this diff:\n\n```diff\n" + truncated + "\n```", {
        model: options.model,
        temperature: 0.2,
        maxTokens: 1500,
    });
}

export function parseAiPrOutput(text: string): { title: string; body: string } {
    const titleMatch = text.match(/^\s*TITLE:\s*(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : "Update";
    const body = text
        .replace(/^\s*TITLE:.*$/m, "")
        .replace(/^\s*```(?:markdown)?/, "")
        .replace(/```\s*$/, "")
        .trim();
    return { title, body: body || `## Summary\n- ${title}` };
}

function summarizeDiff(diff: string): string {
    const lines = diff.split("\n");
    const files = new Set<string>();
    let added = 0, removed = 0;
    for (const line of lines) {
        if (line.startsWith("+++ b/")) files.add(line.slice(6));
        else if (line.startsWith("+") && !line.startsWith("+++")) added++;
        else if (line.startsWith("-") && !line.startsWith("---")) removed++;
    }
    return `${files.size} file(s), +${added} -${removed}`;
}
