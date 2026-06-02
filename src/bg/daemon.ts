/**
 * Daemon — parent-side launcher (`forkBackgroundTask`) and the child-side
 * worker entry point (`runWorker`) used when the binary is re-invoked with
 * the HELIX_BG_WORKER env var set.
 *
 * The same Node binary works for both roles so we don't need a separate
 * worker script in `dist/`.
 */

import * as path from "path";
import * as fs from "fs";
import { fork, ChildProcess } from "child_process";
import {
    bgTaskDir,
    writeMeta,
    updateMeta,
    appendOutput,
    writeResult,
    generateBgId,
    countByState,
} from "./store";
import { onIpc, formatIpcLine } from "./ipc";
import { BgIpcMessage, BgMeta, BgResult, MAX_BG_TASKS } from "./types";

export const BG_WORKER_ENV = "HELIX_BG_WORKER";

export interface ForkOptions {
    prompt: string;
    cwd: string;
    /** Permission mode (default "trusted" — never "yolo" without explicit opt-in). */
    permissionMode?: "trusted" | "yolo";
    model?: string;
    /** Override the script entry point (used by tests to run a fake worker). */
    entryScript?: string;
    /** Override the fork function (used by tests to inject a fake child). */
    forkFn?: (script: string, env: NodeJS.ProcessEnv) => ChildProcess;
    /** Override id (tests). */
    id?: string;
    /** Optional human label. */
    label?: string;
}

export interface ForkResult {
    meta: BgMeta;
    /** Reason the fork was rejected (e.g. cap reached). null on success. */
    rejected: string | null;
}

export function getDefaultEntryScript(): string {
    // dedicated worker entry point — does NOT load commander / CLI banner.
    return path.resolve(__dirname, "..", "bin", "helix-worker.js");
}

export function forkBackgroundTask(options: ForkOptions): ForkResult {
    const running = countByState("running");
    if (running >= MAX_BG_TASKS) {
        const meta: BgMeta = {
            id: options.id || generateBgId(),
            prompt: options.prompt,
            cwd: options.cwd,
            pid: null,
            state: "failed",
            startedAt: new Date().toISOString(),
            label: options.label,
            permissionMode: options.permissionMode || "trusted",
            model: options.model,
        };
        return { meta, rejected: `Max ${MAX_BG_TASKS} concurrent background tasks reached` };
    }

    const id = options.id || generateBgId();
    const meta: BgMeta = {
        id,
        prompt: options.prompt,
        cwd: options.cwd,
        pid: null,
        state: "running",
        startedAt: new Date().toISOString(),
        label: options.label,
        permissionMode: options.permissionMode || "trusted",
        model: options.model,
    };
    fs.mkdirSync(bgTaskDir(id), { recursive: true });
    writeMeta(meta);

    const script = options.entryScript || getDefaultEntryScript();
    const env: NodeJS.ProcessEnv = {
        ...process.env,
        [BG_WORKER_ENV]: "1",
        HELIX_BG_ID: id,
        HELIX_BG_PROMPT: options.prompt,
        HELIX_BG_CWD: options.cwd,
        HELIX_BG_MODE: meta.permissionMode || "trusted",
    };
    if (options.model) env.HELIX_BG_MODEL = options.model;

    const forkFn = options.forkFn || ((s: string, e: NodeJS.ProcessEnv) =>
        fork(s, [], { env: e, cwd: options.cwd, detached: true, stdio: ["ignore", "ignore", "ignore", "ipc"] }));

    const child = forkFn(script, env);
    meta.pid = child.pid ?? null;
    writeMeta(meta);

    // The child writes its own state to disk (output.log, result.json,
    // meta.json). The parent only listens for IPC messages while it's still
    // alive — but since the parent exits early to give the user their shell
    // back, the IPC handler is best-effort progress logging only. Final state
    // is always authoritative from the child's own writes.
    onIpc(child, (msg: BgIpcMessage) => {
        try { appendOutput(id, formatIpcLine(msg)); } catch { /* ignore */ }
    });

    // Detach so the parent can exit without killing the child.
    if (typeof child.unref === "function") child.unref();

    return { meta, rejected: null };
}

/**
 * Worker entry — call this from src/bin/helix.ts when HELIX_BG_WORKER=1.
 *
 * The worker reads its task spec from environment variables, runs the agent
 * loop in trusted mode, and emits IPC progress messages back to the parent.
 *
 * @param runner Optional override for the agent invocation (used by tests).
 */
export async function runWorker(runner?: (prompt: string, cwd: string, mode: "trusted" | "yolo") => Promise<BgResult>): Promise<void> {
    const id = process.env.HELIX_BG_ID || "unknown";
    const prompt = process.env.HELIX_BG_PROMPT || "";
    const cwd = process.env.HELIX_BG_CWD || process.cwd();
    const mode = (process.env.HELIX_BG_MODE === "yolo" ? "yolo" : "trusted") as "trusted" | "yolo";

    // The worker writes directly to its own state files. We don't rely on the
    // parent's IPC channel because the parent intentionally exits early so the
    // user gets their shell back — once the parent is gone, IPC messages from
    // the child go nowhere. Write to disk so `helix bg status/logs` work
    // regardless of whether the parent is still alive.
    appendOutput(id, formatIpcLine({ type: "progress", turn: 0, lastTool: "starting" }));

    let result: BgResult;
    try {
        if (runner) {
            result = await runner(prompt, cwd, mode);
        } else {
            const { ChatContext } = await import("../chat/context");
            const { CheckpointManager } = await import("../chat/checkpoints");
            const { buildDefaultRegistry } = await import("../chat/tools");
            const { runAgentTurn } = await import("../chat/agent");
            const { PermissionEngine } = await import("../chat/permissions");
            const ctx = new ChatContext({ cwd });
            const registry = buildDefaultRegistry();
            const checkpoints = new CheckpointManager({ cwd });
            const permissions = new PermissionEngine({ overrideMode: mode });

            // Display routes tool-call notifications to the output log so
            // `helix bg attach <id>` can stream progress in real time.
            let turn = 0;
            const fileDisplay: any = {
                info: () => {}, warn: () => {}, error: () => {},
                assistant: (t: string) => { turn++; appendOutput(id, formatIpcLine({ type: "progress", turn, lastTool: "(assistant turn)" })); void t; },
                user: () => {},
                toolCall: (n: string) => { appendOutput(id, formatIpcLine({ type: "progress", turn, lastTool: n })); },
                toolResult: () => {},
                diff: () => {},
                spinner: () => ({ stop: () => {}, succeed: () => {}, fail: () => {}, update: () => {} }),
                confirm: async () => true,
                raw: () => {},
            };

            const agent = await runAgentTurn(prompt, {
                registry,
                context: ctx,
                checkpoints,
                display: fileDisplay,
                permissions,
                model: process.env.HELIX_BG_MODEL,
            });
            result = { finalText: agent.finalText, iterations: agent.iterations, toolCalls: agent.toolCallCount };
        }
    } catch (err: any) {
        result = { finalText: "", iterations: 0, toolCalls: 0, error: err?.message || String(err) };
    }

    // Persist final state — don't rely on the parent receiving an IPC message.
    appendOutput(id, formatIpcLine({ type: "done", result }));
    writeResult(id, result);
    updateMeta(id, {
        state: result.error ? "failed" : "completed",
        finishedAt: new Date().toISOString(),
    });
    // Best-effort desktop notification.
    try {
        const { notify } = require("./notify");
        notify("Helix: Task complete", `${id}: ${result.iterations} iter, ${result.toolCalls} tool calls${result.error ? " (failed)" : ""}`);
    } catch { /* ignore */ }
}
