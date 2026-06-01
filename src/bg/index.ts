/**
 * Public API for `helix bg` CLI commands.
 *
 * All command handlers return data shapes (or print to stdout) so they're
 * easy to test independently.
 */

import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import { listTasks, readMeta, readOutput, readResult, updateMeta, outputPath } from "./store";
import { forkBackgroundTask, ForkOptions } from "./daemon";
import { BgMeta, MAX_BG_TASKS } from "./types";

export interface StartResult {
    meta: BgMeta;
    rejected: string | null;
}

export function startBackgroundTask(options: ForkOptions): StartResult {
    return forkBackgroundTask(options);
}

export function statusReport(): { tasks: BgMeta[]; runningCount: number; cap: number } {
    const tasks = listTasks();
    return {
        tasks,
        runningCount: tasks.filter(t => t.state === "running").length,
        cap: MAX_BG_TASKS,
    };
}

export function formatStatus(report: { tasks: BgMeta[]; runningCount: number; cap: number }): string {
    if (report.tasks.length === 0) return "(no background tasks)";
    const lines = [`Background tasks (${report.runningCount}/${report.cap} running):`];
    for (const task of report.tasks) {
        const icon = task.state === "running" ? chalk.yellow("●")
            : task.state === "completed" ? chalk.green("✓")
            : task.state === "killed" ? chalk.gray("·")
            : chalk.red("✗");
        const dur = task.finishedAt
            ? `${task.startedAt} → ${task.finishedAt}`
            : `${task.startedAt} (running)`;
        lines.push(`  ${icon} ${chalk.bold(task.id)}  ${chalk.gray(dur)}`);
        lines.push(`     ${chalk.gray(task.prompt.slice(0, 80))}${task.prompt.length > 80 ? "…" : ""}`);
    }
    return lines.join("\n");
}

export interface AttachOptions {
    id: string;
    /** Stop streaming once the task transitions out of "running". */
    follow?: boolean;
    /** Override the polling interval ms (tests). */
    pollMs?: number;
    /** Receive each new line. */
    onLine?: (line: string) => void;
    /** Total time to watch before giving up (tests). null = wait until done. */
    timeoutMs?: number | null;
}

export interface AttachResult {
    finalState: BgMeta["state"] | "missing";
    linesEmitted: number;
}

export async function attachBackgroundTask(options: AttachOptions): Promise<AttachResult> {
    const meta = readMeta(options.id);
    if (!meta) return { finalState: "missing", linesEmitted: 0 };
    const file = outputPath(options.id);
    let offset = 0;
    let linesEmitted = 0;
    const start = Date.now();
    const pollMs = options.pollMs ?? 250;

    while (true) {
        if (fs.existsSync(file)) {
            const stat = fs.statSync(file);
            if (stat.size > offset) {
                const fd = fs.openSync(file, "r");
                const buf = Buffer.alloc(stat.size - offset);
                fs.readSync(fd, buf, 0, buf.length, offset);
                fs.closeSync(fd);
                offset = stat.size;
                for (const line of buf.toString("utf-8").split("\n")) {
                    if (!line) continue;
                    options.onLine?.(line);
                    linesEmitted++;
                }
            }
        }
        const current = readMeta(options.id);
        if (!current) break;
        if (options.follow === false || current.state !== "running") {
            return { finalState: current.state, linesEmitted };
        }
        if (options.timeoutMs != null && Date.now() - start >= options.timeoutMs) {
            return { finalState: current.state, linesEmitted };
        }
        await new Promise<void>(r => setTimeout(r, pollMs));
    }
    return { finalState: "missing", linesEmitted };
}

export interface KillResult {
    found: boolean;
    /** True when SIGTERM was actually delivered. */
    signaled: boolean;
    finalState: BgMeta["state"] | "missing";
}

export interface KillOptions {
    id: string;
    /** Override process.kill (tests). */
    killer?: (pid: number, signal: string) => void;
}

export function killBackgroundTask(options: KillOptions): KillResult {
    const meta = readMeta(options.id);
    if (!meta) return { found: false, signaled: false, finalState: "missing" };
    if (meta.state !== "running" || meta.pid == null) {
        return { found: true, signaled: false, finalState: meta.state };
    }
    let signaled = false;
    try {
        const killer = options.killer || ((pid: number, sig: string) => process.kill(pid, sig as any));
        killer(meta.pid, "SIGTERM");
        signaled = true;
    } catch {
        // process is gone — not an error, just no signal.
    }
    const updated = updateMeta(options.id, { state: "killed", finishedAt: new Date().toISOString() }) || meta;
    return { found: true, signaled, finalState: updated.state };
}

export function logsFor(id: string): { meta: BgMeta | null; output: string; result: ReturnType<typeof readResult> } {
    return { meta: readMeta(id), output: readOutput(id), result: readResult(id) };
}

export type { BgMeta, BgResult } from "./types";
export { MAX_BG_TASKS } from "./types";
