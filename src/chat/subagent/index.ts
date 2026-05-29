/**
 * Subagent spawning — run isolated agent loops in parallel.
 *
 * A subagent has its own ChatContext, history, and checkpoint isolation, but
 * shares the parent's tool registry (so it can read files, call MCP servers,
 * etc.). It returns the final assistant text rather than mutating the parent
 * conversation. Useful for parallel research, fan-out audits, etc.
 *
 * Subagents run with a silent display so their tool chatter doesn't pollute
 * the parent REPL output. They auto-approve destructive tools by default
 * because there is no human at the keyboard for them; pass requireApproval=true
 * to opt out (which forces them to skip destructive tools).
 */

import { ChatContext } from "../context";
import { CheckpointManager } from "../checkpoints";
import { ToolRegistry, buildDefaultRegistry } from "../tools";
import { runAgentTurn, AgentRunResult } from "../agent";
import { Display } from "../display";
import { HookManager, NoopHooks } from "../hooks";

export interface SubagentTask {
    /** Distinct label so the parent can match results to tasks. */
    label?: string;
    /** Prompt to run as the subagent's user message. */
    prompt: string;
    /** Optional system prompt suffix (appended to the inherited system prompt). */
    systemSuffix?: string;
    /** Override model for this subagent. */
    model?: string;
    /** Iteration cap for the subagent. Defaults to 6. */
    maxIterations?: number;
}

export interface SubagentResult {
    label: string;
    finalText: string;
    iterations: number;
    toolCalls: number;
    error?: string;
}

export interface RunSubagentOptions {
    cwd: string;
    registry?: ToolRegistry;
    hooks?: HookManager;
    display?: Display;
    requireApproval?: boolean;
}

function silentDisplay(): Display {
    const noop = () => {};
    return {
        info: noop, warn: noop, error: noop,
        assistant: noop, user: noop,
        toolCall: noop, toolResult: noop, diff: noop,
        spinner: () => ({ stop: noop, succeed: noop, fail: noop, update: noop }),
        confirm: async () => false, // approval=false in the silent fallback
        raw: noop,
    };
}

export async function runSubagent(task: SubagentTask, opts: RunSubagentOptions): Promise<SubagentResult> {
    const label = task.label || "subagent";
    const context = new ChatContext({ cwd: opts.cwd });
    if (task.systemSuffix) {
        const current = context.history.getAll().find(m => m.role === "system");
        const system = (current?.content || "") + "\n\n" + task.systemSuffix;
        context.history.setSystem(system);
    }
    const registry = opts.registry || buildDefaultRegistry();
    const checkpoints = new CheckpointManager({ cwd: opts.cwd });
    const display = opts.display || silentDisplay();

    try {
        const result: AgentRunResult = await runAgentTurn(task.prompt, {
            registry,
            context,
            checkpoints,
            display,
            model: task.model,
            maxIterations: task.maxIterations ?? 6,
            autoApprove: !opts.requireApproval,
            hooks: opts.hooks || NoopHooks,
        });
        return {
            label,
            finalText: result.finalText,
            iterations: result.iterations,
            toolCalls: result.toolCallCount,
        };
    } catch (err: any) {
        return {
            label,
            finalText: "",
            iterations: 0,
            toolCalls: 0,
            error: err?.message || String(err),
        };
    }
}

export async function runSubagentsParallel(
    tasks: SubagentTask[],
    opts: RunSubagentOptions
): Promise<SubagentResult[]> {
    return Promise.all(tasks.map(t => runSubagent(t, opts)));
}
