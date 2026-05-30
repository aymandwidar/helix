/**
 * Usage tracker — counts agent activity for /usage and the helix usage CLI.
 *
 * The active tracker is a module-level instance (`activeTracker`) because the
 * agent loop and slash commands need a shared place to record events. Tests
 * can construct their own UsageTracker directly to avoid the global.
 */

import * as fs from "fs";
import * as path from "path";
import { getSettingsDir } from "../../mcp/config";

export interface UsageSnapshot {
    startedAt: string;
    durationMs: number;
    toolCalls: Record<string, number>;
    mcpCalls: Record<string, number>;
    tokensByModel: Record<string, { prompt: number; completion: number }>;
    costUsd: number;
    checkpoints: { count: number; bytes: number };
    messages: { user: number; assistant: number; tool: number; system: number };
}

export class UsageTracker {
    public readonly startedAt: Date;
    public readonly toolCalls: Record<string, number> = {};
    public readonly mcpCalls: Record<string, number> = {};
    public readonly tokensByModel: Record<string, { prompt: number; completion: number }> = {};
    public costUsd = 0;
    public checkpoints = { count: 0, bytes: 0 };
    public messages = { user: 0, assistant: 0, tool: 0, system: 0 };

    constructor(startedAt: Date = new Date()) {
        this.startedAt = startedAt;
    }

    recordTool(name: string): void {
        if (name.startsWith("mcp__")) {
            const server = name.split("__")[1] || "unknown";
            this.mcpCalls[server] = (this.mcpCalls[server] || 0) + 1;
        }
        this.toolCalls[name] = (this.toolCalls[name] || 0) + 1;
    }

    recordModelUsage(model: string, promptTokens: number, completionTokens: number, costUsd = 0): void {
        const entry = this.tokensByModel[model] || { prompt: 0, completion: 0 };
        entry.prompt += promptTokens;
        entry.completion += completionTokens;
        this.tokensByModel[model] = entry;
        this.costUsd += costUsd;
    }

    recordCheckpoint(bytes: number): void {
        this.checkpoints.count++;
        this.checkpoints.bytes += bytes;
    }

    recordMessage(role: "user" | "assistant" | "tool" | "system"): void {
        this.messages[role]++;
    }

    snapshot(now: Date = new Date()): UsageSnapshot {
        return {
            startedAt: this.startedAt.toISOString(),
            durationMs: now.getTime() - this.startedAt.getTime(),
            toolCalls: { ...this.toolCalls },
            mcpCalls: { ...this.mcpCalls },
            tokensByModel: { ...this.tokensByModel },
            costUsd: this.costUsd,
            checkpoints: { ...this.checkpoints },
            messages: { ...this.messages },
        };
    }
}

let activeTracker: UsageTracker = new UsageTracker();

export function getActiveTracker(): UsageTracker {
    return activeTracker;
}

export function resetActiveTracker(): UsageTracker {
    activeTracker = new UsageTracker();
    return activeTracker;
}

// ─── Session log persistence ─────────────────────────────────────────────

export interface SessionLogEntry {
    finishedAt: string;
    snapshot: UsageSnapshot;
    note?: string;
}

export function getSessionsDir(): string {
    return path.join(getSettingsDir(), "sessions");
}

export function writeSessionLog(snapshot: UsageSnapshot, note?: string, dir: string = getSessionsDir()): string {
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = path.join(dir, `${stamp}.json`);
    const entry: SessionLogEntry = {
        finishedAt: new Date().toISOString(),
        snapshot,
        note,
    };
    fs.writeFileSync(file, JSON.stringify(entry, null, 2) + "\n");
    return file;
}

export function listSessionLogs(dir: string = getSessionsDir()): SessionLogEntry[] {
    if (!fs.existsSync(dir)) return [];
    const files = fs.readdirSync(dir).filter(f => f.endsWith(".json")).sort().reverse();
    const out: SessionLogEntry[] = [];
    for (const file of files) {
        try {
            out.push(JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8")));
        } catch {
            continue;
        }
    }
    return out;
}

export function readMostRecentSession(dir?: string): SessionLogEntry | undefined {
    return listSessionLogs(dir)[0];
}

// ─── Pretty printer ──────────────────────────────────────────────────────

export function formatUsage(snapshot: UsageSnapshot): string {
    const lines: string[] = [];
    const dur = humanDuration(snapshot.durationMs);
    lines.push(`Session usage — started ${snapshot.startedAt}, duration ${dur}`);
    lines.push(`  Cost so far: $${snapshot.costUsd.toFixed(6)}`);
    lines.push(`  Messages:    user=${snapshot.messages.user} assistant=${snapshot.messages.assistant} tool=${snapshot.messages.tool}`);
    lines.push(`  Checkpoints: ${snapshot.checkpoints.count} (${(snapshot.checkpoints.bytes / 1024).toFixed(1)} KiB)`);

    const toolEntries = Object.entries(snapshot.toolCalls).sort((a, b) => b[1] - a[1]);
    if (toolEntries.length) {
        lines.push("");
        lines.push("Tool calls:");
        for (const [name, count] of toolEntries.slice(0, 12)) {
            lines.push(`  ${count.toString().padStart(4)}  ${name}`);
        }
        if (toolEntries.length > 12) lines.push(`        …(+${toolEntries.length - 12} more)`);
    }
    const mcpEntries = Object.entries(snapshot.mcpCalls).sort((a, b) => b[1] - a[1]);
    if (mcpEntries.length) {
        lines.push("");
        lines.push("MCP server calls:");
        for (const [server, count] of mcpEntries) {
            lines.push(`  ${count.toString().padStart(4)}  ${server}`);
        }
    }
    const modelEntries = Object.entries(snapshot.tokensByModel);
    if (modelEntries.length) {
        lines.push("");
        lines.push("Token usage by model:");
        for (const [model, t] of modelEntries) {
            lines.push(`  ${model}: prompt=${t.prompt} completion=${t.completion} total=${t.prompt + t.completion}`);
        }
    }
    return lines.join("\n");
}

function humanDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const rs = s % 60;
    if (m < 60) return `${m}m ${rs}s`;
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h}h ${rm}m`;
}
