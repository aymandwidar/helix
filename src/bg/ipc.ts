/**
 * IPC helpers — small typed wrappers around child_process IPC channels.
 */

import { ChildProcess } from "child_process";
import { BgIpcMessage } from "./types";

export function sendIpc(target: NodeJS.Process | ChildProcess, message: BgIpcMessage): void {
    if (typeof (target as any).send === "function") {
        (target as any).send(message);
    }
}

export function onIpc(child: ChildProcess, handler: (msg: BgIpcMessage) => void): void {
    child.on("message", (raw: any) => {
        if (raw && typeof raw === "object" && "type" in raw) handler(raw as BgIpcMessage);
    });
}

/** Stringify an IPC message for the output log. */
export function formatIpcLine(message: BgIpcMessage): string {
    const ts = new Date().toISOString();
    if (message.type === "progress") {
        return `[${ts}] turn=${message.turn} tool=${message.lastTool || "-"}`;
    }
    if (message.type === "done") {
        return `[${ts}] done iterations=${message.result.iterations} toolCalls=${message.result.toolCalls}${message.result.error ? " error=" + message.result.error : ""}`;
    }
    return `[${ts}] error ${message.error}`;
}
