/**
 * Git worktree lifecycle helpers.
 *
 * The runner is injectable so unit tests can model `git worktree` without a
 * real repo. The default runner shells out via execa.
 */

import * as path from "path";
import * as crypto from "crypto";
import { Worktree, WorktreeRunner } from "./types";

const WORKTREES_SUBDIR = ".helix-workers";

export const defaultRunner: WorktreeRunner = async (command, args, opts) => {
    const execa = (await import("execa")).default;
    try {
        const r = await execa(command, args, { cwd: opts?.cwd, reject: false });
        return { stdout: r.stdout || "", stderr: r.stderr || "", exitCode: r.exitCode ?? 0 };
    } catch (e: any) {
        return { stdout: "", stderr: e?.message || String(e), exitCode: 1 };
    }
};

export async function detectBaseBranch(repoRoot: string, runner: WorktreeRunner = defaultRunner): Promise<string> {
    // 1. Whatever HEAD resolves to currently
    const headRef = await runner("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: repoRoot });
    if (headRef.exitCode === 0 && headRef.stdout.trim() && headRef.stdout.trim() !== "HEAD") {
        return headRef.stdout.trim();
    }
    // 2. Detect default branch from origin
    const remote = await runner("git", ["symbolic-ref", "refs/remotes/origin/HEAD"], { cwd: repoRoot });
    if (remote.exitCode === 0 && remote.stdout.trim()) {
        const m = remote.stdout.trim().match(/refs\/remotes\/origin\/(.+)$/);
        if (m) return m[1];
    }
    return "main";
}

export function generateWorkerId(): string {
    return crypto.randomBytes(4).toString("hex");
}

export interface CreateWorktreeOptions {
    repoRoot: string;
    /** Branch to fork from (default: detected). */
    base?: string;
    /** Override runner (for tests). */
    runner?: WorktreeRunner;
    /** Override id (for tests). */
    id?: string;
}

export async function createWorktree(options: CreateWorktreeOptions): Promise<Worktree> {
    const runner = options.runner || defaultRunner;
    const id = options.id || generateWorkerId();
    const base = options.base || (await detectBaseBranch(options.repoRoot, runner));
    const wtPath = path.join(options.repoRoot, WORKTREES_SUBDIR, id);
    const branch = `helix/${id}`;

    const create = await runner("git", ["worktree", "add", wtPath, "-b", branch, base], { cwd: options.repoRoot });
    if (create.exitCode !== 0) {
        throw new Error(`git worktree add failed: ${create.stderr || create.stdout}`);
    }
    return { id, path: wtPath, branch, baseBranch: base };
}

export interface RemoveWorktreeOptions {
    repoRoot: string;
    worktree: Worktree;
    /** Pass --force when removing (e.g. to drop dirty worktrees). */
    force?: boolean;
    /** Also delete the branch after the worktree is removed. */
    deleteBranch?: boolean;
    runner?: WorktreeRunner;
}

export async function removeWorktree(options: RemoveWorktreeOptions): Promise<void> {
    const runner = options.runner || defaultRunner;
    const args = ["worktree", "remove"];
    if (options.force) args.push("--force");
    args.push(options.worktree.path);
    await runner("git", args, { cwd: options.repoRoot });
    if (options.deleteBranch) {
        await runner("git", ["branch", "-D", options.worktree.branch], { cwd: options.repoRoot });
    }
}

export async function listChangedFiles(worktree: Worktree, runner: WorktreeRunner = defaultRunner): Promise<string[]> {
    // Files changed in this worktree relative to its base branch.
    const r = await runner("git", ["diff", "--name-only", `${worktree.baseBranch}...${worktree.branch}`], { cwd: worktree.path });
    if (r.exitCode !== 0 || !r.stdout.trim()) return [];
    return r.stdout.split("\n").map(l => l.trim()).filter(Boolean);
}

export async function commitWorktree(
    worktree: Worktree,
    message: string,
    runner: WorktreeRunner = defaultRunner
): Promise<boolean> {
    // Stage everything and create a commit. Returns false when there's nothing to commit.
    const status = await runner("git", ["status", "--porcelain"], { cwd: worktree.path });
    if (status.exitCode !== 0 || !status.stdout.trim()) return false;
    await runner("git", ["add", "-A"], { cwd: worktree.path });
    const commit = await runner("git", ["commit", "-m", message], { cwd: worktree.path });
    return commit.exitCode === 0;
}

export function getWorktreesDir(repoRoot: string): string {
    return path.join(repoRoot, WORKTREES_SUBDIR);
}
