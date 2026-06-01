/**
 * Sprint 14 — types for background/daemon mode.
 */

export type BgState = "running" | "completed" | "failed" | "killed";

export interface BgMeta {
    id: string;
    prompt: string;
    cwd: string;
    pid: number | null;
    state: BgState;
    startedAt: string;
    finishedAt?: string;
    /** Filename suffix shown by `helix bg status`. Same as id by default. */
    label?: string;
    /** Permission mode the daemon ran in (always "trusted" unless --trust). */
    permissionMode?: "trusted" | "yolo";
    /** Optional model override. */
    model?: string;
}

export interface BgResult {
    finalText: string;
    iterations: number;
    toolCalls: number;
    error?: string;
}

export interface BgIpcProgress {
    type: "progress";
    turn: number;
    lastTool?: string;
}

export interface BgIpcDone {
    type: "done";
    result: BgResult;
}

export interface BgIpcError {
    type: "error";
    error: string;
}

export type BgIpcMessage = BgIpcProgress | BgIpcDone | BgIpcError;

/** Hard cap on concurrent background tasks. */
export const MAX_BG_TASKS = 4;
