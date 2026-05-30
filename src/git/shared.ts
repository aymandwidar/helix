import { GitRunner, AiClient } from "./types";

export const defaultRunner: GitRunner = async (command, args, opts) => {
    const execa = (await import("execa")).default;
    try {
        const r = await execa(command, args, { cwd: opts?.cwd, reject: false });
        return { stdout: r.stdout || "", stderr: r.stderr || "", exitCode: r.exitCode ?? 0 };
    } catch (e: any) {
        return { stdout: "", stderr: e?.message || String(e), exitCode: 1 };
    }
};

export const defaultAi: AiClient = async (sys, user, opts) => {
    const { createCompletion } = await import("../openrouter");
    return createCompletion(sys, user, opts);
};

export async function isCommandAvailable(command: string, runner: GitRunner): Promise<boolean> {
    try {
        const r = await runner(command, ["--version"], {});
        return r.exitCode === 0;
    } catch {
        return false;
    }
}

export async function currentBranch(runner: GitRunner, cwd: string): Promise<string | null> {
    const r = await runner("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd });
    if (r.exitCode !== 0) return null;
    return r.stdout.trim() || null;
}

export async function defaultBaseBranch(runner: GitRunner, cwd: string): Promise<string> {
    // Try `gh` first, then fall back to "main"
    try {
        const r = await runner("gh", ["repo", "view", "--json", "defaultBranchRef", "-q", ".defaultBranchRef.name"], { cwd });
        if (r.exitCode === 0 && r.stdout.trim()) return r.stdout.trim();
    } catch { /* ignore */ }
    return "main";
}

export async function getDiffAgainst(base: string, runner: GitRunner, cwd: string): Promise<string> {
    const r = await runner("git", ["diff", `${base}...HEAD`], { cwd });
    if (r.exitCode === 0) return r.stdout || "";
    // Fallback to plain diff
    const fallback = await runner("git", ["diff"], { cwd });
    return fallback.stdout || "";
}
