/**
 * Merge worker branches sequentially back into the base branch.
 *
 * We do `git merge --no-ff <worker-branch>` for each successful worker. If
 * any merge fails (e.g. the worker still has unmerged conflicts even though
 * `detectConflicts` reported clean), we abort the merge and skip the worker.
 */

import { MergeOutcome, WorkerOutcome, WorktreeRunner } from "./types";
import { defaultRunner } from "./worktree";

export interface MergeOptions {
    repoRoot: string;
    /** Branch to merge into (e.g. "main"). */
    base: string;
    workers: WorkerOutcome[];
    runner?: WorktreeRunner;
    /** Custom commit message prefix (default: "Helix parallel merge"). */
    messagePrefix?: string;
}

export async function mergeWorkers(options: MergeOptions): Promise<MergeOutcome> {
    const runner = options.runner || defaultRunner;
    const merged: string[] = [];
    const skipped: Array<{ worker: string; reason: string }> = [];

    // Make sure we're on the base branch first
    const checkout = await runner("git", ["checkout", options.base], { cwd: options.repoRoot });
    if (checkout.exitCode !== 0) {
        return {
            merged: [],
            skipped: options.workers.map(w => ({
                worker: w.task.label || w.task.prompt.slice(0, 40),
                reason: `failed to checkout ${options.base}: ${checkout.stderr || checkout.stdout}`,
            })),
            success: false,
        };
    }

    for (const worker of options.workers) {
        const label = worker.task.label || worker.task.prompt.slice(0, 40);
        if (!worker.success || !worker.worktree) {
            skipped.push({ worker: label, reason: worker.error || "worker did not succeed" });
            continue;
        }
        if (worker.changedFiles.length === 0) {
            skipped.push({ worker: label, reason: "no changes to merge" });
            continue;
        }
        const message = `${options.messagePrefix || "Helix parallel merge"}: ${label}`;
        const merge = await runner("git", ["merge", "--no-ff", worker.worktree.branch, "-m", message], { cwd: options.repoRoot });
        if (merge.exitCode === 0) {
            merged.push(label);
            continue;
        }
        // Abort the failed merge so the next worker can be attempted cleanly
        await runner("git", ["merge", "--abort"], { cwd: options.repoRoot });
        skipped.push({ worker: label, reason: `merge failed: ${(merge.stderr || merge.stdout).slice(0, 200)}` });
    }

    return {
        merged,
        skipped,
        success: skipped.length === 0,
    };
}
