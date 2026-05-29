/**
 * Hooks: pre/post tool execution and prompt/response lifecycle.
 *
 * Inspired by Claude Code's hooks system. Hooks are configured in
 * ~/.helix/settings.json and run as shell commands. The hook receives a JSON
 * payload on stdin and may emit JSON on stdout to influence the agent:
 *
 *   { "block": true, "reason": "..." }      // pre_tool: refuse this call
 *   { "args": { ...overrides } }            // pre_tool: replace tool args
 *   { "message": "..." }                    // post_tool: surface a note
 *
 * Non-zero exit codes are treated as a block. Hooks must complete within
 * `timeout_ms` (default 5s) or they are skipped with a warning.
 */

import * as fs from "fs";
import { loadSettings } from "../../mcp/config";

export type HookEvent = "pre_tool" | "post_tool" | "pre_prompt" | "post_response";

export interface HookConfig {
    /** Event this hook listens for */
    event: HookEvent;
    /** Optional regex matched against tool name (pre_tool / post_tool) */
    match?: string;
    /** Shell command to execute */
    command: string;
    /** Timeout in milliseconds (default 5000) */
    timeoutMs?: number;
    /** Description for diagnostics */
    description?: string;
}

export interface PreToolPayload {
    event: "pre_tool";
    tool: string;
    args: Record<string, unknown>;
    cwd: string;
}
export interface PostToolPayload {
    event: "post_tool";
    tool: string;
    args: Record<string, unknown>;
    success: boolean;
    output: string;
    error?: string;
    cwd: string;
}
export interface PrePromptPayload { event: "pre_prompt"; prompt: string; cwd: string }
export interface PostResponsePayload { event: "post_response"; response: string; cwd: string }
export type HookPayload = PreToolPayload | PostToolPayload | PrePromptPayload | PostResponsePayload;

export interface HookOutcome {
    block?: boolean;
    reason?: string;
    args?: Record<string, unknown>;
    message?: string;
}

export class HookManager {
    constructor(private hooks: HookConfig[]) {}

    static fromSettings(settingsPath?: string): HookManager {
        try {
            const settings = loadSettings(settingsPath);
            const raw = (settings as any).hooks;
            if (!Array.isArray(raw)) return new HookManager([]);
            const valid: HookConfig[] = raw.filter(
                (h: any) => h && typeof h.event === "string" && typeof h.command === "string"
            );
            return new HookManager(valid);
        } catch {
            return new HookManager([]);
        }
    }

    /** Hooks matching the event (and optionally tool name). */
    matchingHooks(event: HookEvent, toolName?: string): HookConfig[] {
        return this.hooks.filter(h => {
            if (h.event !== event) return false;
            if (h.match && toolName) {
                try {
                    return new RegExp(h.match).test(toolName);
                } catch {
                    return false;
                }
            }
            return true;
        });
    }

    async run(event: HookEvent, payload: HookPayload, toolName?: string): Promise<HookOutcome[]> {
        const matching = this.matchingHooks(event, toolName);
        if (matching.length === 0) return [];
        const outcomes: HookOutcome[] = [];
        for (const hook of matching) {
            try {
                const outcome = await this.runHook(hook, payload);
                outcomes.push(outcome);
                // Short-circuit on block
                if (outcome.block) return outcomes;
            } catch (e: any) {
                outcomes.push({ message: `hook error: ${e?.message || e}` });
            }
        }
        return outcomes;
    }

    private async runHook(hook: HookConfig, payload: HookPayload): Promise<HookOutcome> {
        const execa = (await import("execa")).default;
        const timeout = hook.timeoutMs ?? 5000;
        const child = execa(hook.command, {
            shell: true,
            timeout,
            input: JSON.stringify(payload),
            reject: false,
            all: true,
        });

        const result = await child;
        if ((result.exitCode ?? 0) !== 0) {
            return { block: true, reason: `hook '${hook.command}' exited ${result.exitCode}: ${(result.all || "").slice(0, 200)}` };
        }

        const stdout = (result.stdout || "").trim();
        if (!stdout) return {};
        try {
            const parsed = JSON.parse(stdout);
            return parsed as HookOutcome;
        } catch {
            return { message: stdout };
        }
    }

    /** For tests: read current hook list. */
    list(): HookConfig[] {
        return [...this.hooks];
    }
}

/** No-op manager used when hooks are disabled. */
export const NoopHooks = new HookManager([]);
