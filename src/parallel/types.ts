/**
 * Sprint 13 — types for parallel worktree execution.
 */

export interface WorktreeRunner {
    (command: string, args: string[], opts?: { cwd?: string }): Promise<{
        stdout: string;
        stderr: string;
        exitCode: number;
    }>;
}

export interface Worktree {
    /** Short id used in path / branch name (e.g. "a1b2c3d4"). */
    id: string;
    /** Absolute path to the worktree directory. */
    path: string;
    /** Branch name created for this worktree (e.g. "helix/a1b2c3d4"). */
    branch: string;
    /** Base branch the worktree was forked from. */
    baseBranch: string;
}

export interface ParallelTask {
    /** Free-form prompt the subagent should execute. */
    prompt: string;
    /** Optional human label (defaults to first 40 chars of prompt). */
    label?: string;
}

export interface WorkerOutcome {
    task: ParallelTask;
    worktree: Worktree | null;
    /** Final assistant text from the subagent. */
    finalText: string;
    /** Number of agent loop iterations the subagent ran. */
    iterations: number;
    /** Number of tool calls the subagent made. */
    toolCalls: number;
    /** Files the subagent modified inside its worktree (relative to worktree root). */
    changedFiles: string[];
    /** True when the subagent finished without throwing. */
    success: boolean;
    /** Error message captured if success=false. */
    error?: string;
    /** Cleaned up automatically? (false when caller must handle remnants) */
    cleanedUp: boolean;
}

export interface ConflictReport {
    /** Files touched by 2+ workers. */
    overlappingFiles: Array<{ file: string; workers: string[] }>;
    /** True when no overlapping files were found. */
    clean: boolean;
}

export interface MergeOutcome {
    merged: string[];
    skipped: Array<{ worker: string; reason: string }>;
    /** True when every successful worker was merged. */
    success: boolean;
}

export interface ParallelRunOptions {
    /** Tasks to fan out (capped at 8). */
    tasks: ParallelTask[];
    /** Repository root to base worktrees from. */
    cwd: string;
    /** Total token budget for all workers combined (split evenly). null = unlimited. */
    totalBudget?: number | null;
    /** Override the runner (used by tests). */
    runner?: WorktreeRunner;
    /** Override the per-task subagent runner — receives a worktree and returns its outcome. */
    runWorker?: (task: ParallelTask, worktree: Worktree) => Promise<{ finalText: string; iterations: number; toolCalls: number; changedFiles: string[] }>;
    /** Auto-merge after success when no conflicts (default: true). */
    autoMerge?: boolean;
    /** Auto-clean worktrees on completion (default: true). */
    autoClean?: boolean;
}

export interface ParallelRunResult {
    workers: WorkerOutcome[];
    conflicts: ConflictReport;
    merge?: MergeOutcome;
    /** Total wall time the orchestrator took (ms). */
    durationMs: number;
}

/** Hard cap on concurrent workers — see Sprint 13 spec. */
export const MAX_PARALLEL_WORKERS = 8;
