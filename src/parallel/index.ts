/**
 * Parallel orchestrator — fan tasks out across worktrees, collect results,
 * detect conflicts, optionally merge, and clean up.
 *
 * The orchestrator is split into pure pieces so the same code path drives
 * `helix spawn --parallel`, `helix evolve --parallel`, and the `/parallel`
 * slash command — they only differ in the per-worker prompt template.
 *
 * Design notes:
 * - Workers run via Promise.allSettled — one failure doesn't block others.
 * - `runWorker` is injectable so unit tests can replace the subagent with a stub.
 * - We persist a status file under `.helix-workers/state.json` so
 *   `helix parallel status` can report progress from another shell.
 */

import * as fs from "fs";
import * as path from "path";
import {
    MAX_PARALLEL_WORKERS,
    MergeOutcome,
    ParallelRunOptions,
    ParallelRunResult,
    ParallelTask,
    WorkerOutcome,
    Worktree,
    WorktreeRunner,
} from "./types";
import {
    createWorktree,
    defaultRunner,
    detectBaseBranch,
    listChangedFiles,
    commitWorktree,
    removeWorktree,
    getWorktreesDir,
} from "./worktree";
import { detectConflicts } from "./conflicts";
import { mergeWorkers } from "./merge";

const STATE_FILE = "state.json";

interface PersistedWorkerState {
    id: string;
    label: string;
    prompt: string;
    state: "pending" | "running" | "succeeded" | "failed";
    branch?: string;
    worktreePath?: string;
    iterations?: number;
    toolCalls?: number;
    changedFiles?: string[];
    error?: string;
    startedAt?: string;
    finishedAt?: string;
}

export interface ParallelStatus {
    repoRoot: string;
    startedAt: string;
    workers: PersistedWorkerState[];
}

export async function runParallel(options: ParallelRunOptions): Promise<ParallelRunResult> {
    const start = Date.now();
    const runner: WorktreeRunner = options.runner || defaultRunner;
    const tasks = options.tasks.slice(0, MAX_PARALLEL_WORKERS);
    if (tasks.length === 0) {
        return {
            workers: [],
            conflicts: { overlappingFiles: [], clean: true },
            durationMs: Date.now() - start,
        };
    }

    const baseBranch = await detectBaseBranch(options.cwd, runner);
    const workersDir = getWorktreesDir(options.cwd);
    fs.mkdirSync(workersDir, { recursive: true });

    // Each worker gets an even share of the budget.
    const perWorkerBudget = options.totalBudget != null && options.totalBudget > 0
        ? Math.floor(options.totalBudget / tasks.length)
        : null;

    const persisted: PersistedWorkerState[] = tasks.map(task => ({
        id: "pending",
        label: labelOf(task),
        prompt: task.prompt,
        state: "pending",
    }));
    const status: ParallelStatus = {
        repoRoot: options.cwd,
        startedAt: new Date().toISOString(),
        workers: persisted,
    };
    writeStatus(workersDir, status);

    const settled = await Promise.allSettled(
        tasks.map((task, idx) => runOneWorker(task, idx, options, runner, baseBranch, perWorkerBudget, workersDir, status))
    );

    const workers: WorkerOutcome[] = settled.map((s, i) => {
        if (s.status === "fulfilled") return s.value;
        return {
            task: tasks[i],
            worktree: null,
            finalText: "",
            iterations: 0,
            toolCalls: 0,
            changedFiles: [],
            success: false,
            error: s.reason?.message || String(s.reason),
            cleanedUp: false,
        };
    });

    const conflicts = detectConflicts(workers);

    let merge: MergeOutcome | undefined;
    if (options.autoMerge !== false && conflicts.clean) {
        merge = await mergeWorkers({
            repoRoot: options.cwd,
            base: baseBranch,
            workers: workers.filter(w => w.success && w.changedFiles.length > 0),
            runner,
        });
    }

    if (options.autoClean !== false) {
        for (const w of workers) {
            if (!w.worktree || w.cleanedUp) continue;
            try {
                await removeWorktree({ repoRoot: options.cwd, worktree: w.worktree, force: true, deleteBranch: !merge?.merged.includes(labelOf(w.task)), runner });
                w.cleanedUp = true;
            } catch {
                // Leave the dir for manual cleanup; don't fail the run.
            }
        }
    }

    return {
        workers,
        conflicts,
        merge,
        durationMs: Date.now() - start,
    };
}

async function runOneWorker(
    task: ParallelTask,
    index: number,
    options: ParallelRunOptions,
    runner: WorktreeRunner,
    baseBranch: string,
    perWorkerBudget: number | null,
    workersDir: string,
    status: ParallelStatus
): Promise<WorkerOutcome> {
    const persisted = status.workers[index];
    persisted.state = "running";
    persisted.startedAt = new Date().toISOString();
    writeStatus(workersDir, status);

    let worktree: Worktree | null = null;
    try {
        worktree = await createWorktree({ repoRoot: options.cwd, base: baseBranch, runner });
        persisted.id = worktree.id;
        persisted.branch = worktree.branch;
        persisted.worktreePath = worktree.path;
        writeStatus(workersDir, status);

        let finalText = "";
        let iterations = 0;
        let toolCalls = 0;

        if (options.runWorker) {
            const r = await options.runWorker(task, worktree);
            finalText = r.finalText;
            iterations = r.iterations;
            toolCalls = r.toolCalls;
        } else {
            const { runSubagent } = await import("../chat/subagent");
            const r = await runSubagent({
                label: labelOf(task),
                prompt: task.prompt,
                systemSuffix: perWorkerBudget != null
                    ? `Per-worker token budget: ${perWorkerBudget}. Aim to finish well below this — other workers run in parallel.`
                    : undefined,
            }, { cwd: worktree.path });
            finalText = r.finalText;
            iterations = r.iterations;
            toolCalls = r.toolCalls;
        }

        // Commit whatever the subagent changed so we can list/merge it.
        await commitWorktree(worktree, `Helix worker ${worktree.id}: ${labelOf(task)}`, runner);
        const changedFiles = await listChangedFiles(worktree, runner);

        persisted.state = "succeeded";
        persisted.iterations = iterations;
        persisted.toolCalls = toolCalls;
        persisted.changedFiles = changedFiles;
        persisted.finishedAt = new Date().toISOString();
        writeStatus(workersDir, status);

        return {
            task,
            worktree,
            finalText,
            iterations,
            toolCalls,
            changedFiles,
            success: true,
            cleanedUp: false,
        };
    } catch (err: any) {
        persisted.state = "failed";
        persisted.error = err?.message || String(err);
        persisted.finishedAt = new Date().toISOString();
        writeStatus(workersDir, status);
        return {
            task,
            worktree,
            finalText: "",
            iterations: 0,
            toolCalls: 0,
            changedFiles: [],
            success: false,
            error: err?.message || String(err),
            cleanedUp: false,
        };
    }
}

function labelOf(task: ParallelTask): string {
    return task.label || task.prompt.slice(0, 40);
}

function writeStatus(workersDir: string, status: ParallelStatus): void {
    try {
        fs.mkdirSync(workersDir, { recursive: true });
        fs.writeFileSync(path.join(workersDir, STATE_FILE), JSON.stringify(status, null, 2) + "\n");
    } catch {
        // Best-effort — never fail the run because we couldn't update status.
    }
}

export function readStatus(repoRoot: string): ParallelStatus | null {
    const file = path.join(getWorktreesDir(repoRoot), STATE_FILE);
    if (!fs.existsSync(file)) return null;
    try {
        return JSON.parse(fs.readFileSync(file, "utf-8"));
    } catch {
        return null;
    }
}

export function formatStatus(status: ParallelStatus | null): string {
    if (!status) return "(no parallel run recorded — run `helix spawn --parallel` or `helix evolve --parallel` first)";
    const lines = [`Parallel run started ${status.startedAt}`];
    for (const w of status.workers) {
        const icon = w.state === "succeeded" ? "✓"
            : w.state === "failed" ? "✗"
            : w.state === "running" ? "…"
            : "·";
        const meta = [
            w.iterations !== undefined ? `${w.iterations} iter` : null,
            w.toolCalls !== undefined ? `${w.toolCalls} tool calls` : null,
            w.changedFiles ? `${w.changedFiles.length} files changed` : null,
            w.error ? `error: ${w.error}` : null,
        ].filter(Boolean).join(", ");
        lines.push(`  ${icon} ${w.label}${meta ? "  (" + meta + ")" : ""}`);
    }
    return lines.join("\n");
}

export type { Worktree, ParallelTask, WorkerOutcome, ParallelRunResult, ParallelRunOptions, ConflictReport, MergeOutcome } from "./types";
export { detectConflicts, formatConflictReport } from "./conflicts";
export { mergeWorkers } from "./merge";
export { createWorktree, removeWorktree, listChangedFiles } from "./worktree";
export { MAX_PARALLEL_WORKERS } from "./types";
