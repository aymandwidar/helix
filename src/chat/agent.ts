/**
 * Agent loop: think → act → observe.
 *
 * Drives a single user message to completion: calls the model, dispatches any
 * tool calls (with approval, hooks, and checkpointing for destructive tools),
 * feeds results back, and stops when the model emits a final text response or
 * hits the iteration cap.
 */

import { chatWithTools, OpenRouterMessage, ToolCall, CompletionOptions, DEFAULT_MODEL } from "../openrouter";
import { ToolRegistry, ToolResult } from "./tools";
import { ChatContext } from "./context";
import { CheckpointManager } from "./checkpoints";
import { Display } from "./display";
import { HookManager, NoopHooks } from "./hooks";
import { PermissionEngine } from "./permissions";
import { BudgetManager, predictCallCost, formatBudgetTag } from "../cost";
import { IterationLimiter } from "../cost/limiter";
import { autoCompressLines, readAutoCompressThreshold } from "./context/auto_compress";

export interface AgentOptions {
    registry: ToolRegistry;
    context: ChatContext;
    checkpoints: CheckpointManager;
    display: Display;
    model?: string;
    maxIterations?: number;
    /** Legacy auto-approve flag — equivalent to mode=yolo when set. */
    autoApprove?: boolean;
    hooks?: HookManager;
    /** Permission engine (defaults to fromSettings()). */
    permissions?: PermissionEngine;
    /** Optional per-turn streaming callback for partial assistant text. */
    onStream?: (chunk: string) => void;
    /** Use streaming mode for chatWithTools. Falls back to non-streaming on error. */
    stream?: boolean;
    /** Sprint 15: hard cap on total spend across this run. */
    budget?: BudgetManager;
    /** Sprint 15: external iteration limiter (overrides maxIterations when set). */
    iterationLimiter?: IterationLimiter;
}

export interface AgentRunResult {
    finalText: string;
    iterations: number;
    toolCallCount: number;
}

export async function runAgentTurn(userMessage: string, opts: AgentOptions): Promise<AgentRunResult> {
    const { registry, context, display } = opts;
    const hooks = opts.hooks || NoopHooks;
    const maxIterations = opts.maxIterations ?? 8;
    const completionOpts: CompletionOptions = { model: opts.model };
    const limiter = opts.iterationLimiter || (opts.maxIterations != null ? new IterationLimiter(opts.maxIterations) : null);
    const budget = opts.budget;
    const compressThreshold = readAutoCompressThreshold();

    // pre_prompt hook — may block the entire turn
    const prePrompt = await hooks.run("pre_prompt", {
        event: "pre_prompt",
        prompt: userMessage,
        cwd: context.cwd,
    });
    for (const o of prePrompt) {
        if (o.message) display.info("hook: " + o.message);
        if (o.block) {
            display.warn(o.reason || "Prompt blocked by hook.");
            return { finalText: "", iterations: 0, toolCallCount: 0 };
        }
    }

    context.pushUser(userMessage);
    const tools = registry.getToolSchemas();

    let toolCallCount = 0;
    let finalText = "";

    for (let iter = 0; iter < maxIterations; iter++) {
        // Sprint 15: iteration cap (only when limiter is supplied or maxIterations was passed).
        if (limiter) {
            const check = limiter.next();
            if (!check.allowed) {
                display.warn(check.reason || `Iteration limit reached (${limiter.max}).`);
                return { finalText, iterations: iter, toolCallCount };
            }
        }

        const messages: OpenRouterMessage[] = context.messages();

        // Sprint 15: budget gate — stop before the next call would exceed the cap.
        if (budget) {
            const promptText = messages.map(m => typeof m.content === "string" ? m.content : "").join("\n");
            const predicted = predictCallCost({ promptText, model: opts.model || DEFAULT_MODEL });
            const check = budget.canSpend(predicted);
            if (!check.allowed) {
                display.warn(`⚠️  Budget limit reached ($${budget.totalUsd.toFixed(2)}). ${check.reason}.`);
                return { finalText, iterations: iter, toolCallCount };
            }
            display.info(`${formatBudgetTag(check.snapshot)}  predicted next: $${predicted.toFixed(6)}`);
        }

        let turn;
        try {
            if (opts.stream && opts.onStream) {
                const { chatWithToolsStream } = await import("../openrouter");
                turn = await chatWithToolsStream(messages, tools, opts.onStream, completionOpts);
            } else {
                turn = await chatWithTools(messages, tools, completionOpts);
            }
        } catch (err: any) {
            display.error(`Model call failed: ${err?.message || err}`);
            return { finalText, iterations: iter, toolCallCount };
        }

        // Sprint 15: record actual spend after the call returns.
        if (budget && turn.usage) {
            const pricing = (await import("../cost")).predictCallCost({
                promptText: "",
                model: opts.model || DEFAULT_MODEL,
                completionTokens: 0,
            });
            // Recompute from real token counts using the same heuristic as cost-predict.
            const realCost = predictCallCost({
                promptText: "x".repeat((turn.usage.prompt_tokens || 0) * 4),
                model: opts.model || DEFAULT_MODEL,
                completionTokens: turn.usage.completion_tokens || 0,
            });
            void pricing; // pricing import is only kept for symmetry; not used directly
            budget.record(realCost);
        }

        context.history.push({
            role: "assistant",
            content: turn.content || "",
            tool_calls: turn.toolCalls.length > 0 ? turn.toolCalls : undefined,
        });

        if (turn.content) {
            // If we streamed, the chunks were already shown; otherwise render now.
            if (!opts.stream) display.assistant(turn.content);
            finalText = turn.content;
        }

        if (turn.toolCalls.length === 0) {
            // post_response hook (informational only)
            await hooks.run("post_response", { event: "post_response", response: finalText, cwd: context.cwd });
            return { finalText, iterations: iter + 1, toolCallCount };
        }

        for (const call of turn.toolCalls) {
            toolCallCount++;
            await dispatchToolCall(call, opts, hooks);
        }
    }

    display.warn(`Reached max iterations (${maxIterations}); stopping.`);
    return { finalText, iterations: maxIterations, toolCallCount };
}

async function dispatchToolCall(call: ToolCall, opts: AgentOptions, hooks: HookManager): Promise<void> {
    const { registry, context, checkpoints, display, autoApprove } = opts;
    const permissions = opts.permissions || PermissionEngine.fromSettings(undefined, autoApprove ? "yolo" : undefined);
    const tool = registry.get(call.function.name);

    if (!tool) {
        const msg = `Unknown tool: ${call.function.name}`;
        display.error(msg);
        context.history.push({
            role: "tool",
            tool_call_id: call.id,
            name: call.function.name,
            content: JSON.stringify({ success: false, error: msg }),
        });
        return;
    }

    let args: Record<string, unknown> = {};
    try {
        args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
    } catch (e: any) {
        const msg = `Invalid tool arguments: ${e.message}`;
        display.error(msg);
        context.history.push({
            role: "tool",
            tool_call_id: call.id,
            name: tool.name,
            content: JSON.stringify({ success: false, error: msg }),
        });
        return;
    }

    // pre_tool hooks — may block or rewrite args
    const preOutcomes = await hooks.run("pre_tool", {
        event: "pre_tool",
        tool: tool.name,
        args,
        cwd: context.cwd,
    }, tool.name);
    for (const o of preOutcomes) {
        if (o.message) display.info("hook: " + o.message);
        if (o.args) args = { ...args, ...o.args };
        if (o.block) {
            const msg = o.reason || `Hook blocked tool ${tool.name}`;
            display.warn(msg);
            context.history.push({
                role: "tool",
                tool_call_id: call.id,
                name: tool.name,
                content: JSON.stringify({ success: false, error: msg }),
            });
            return;
        }
    }

    display.toolCall(tool.name, args);

    // Sprint 12: track tool usage for /usage dashboard
    try {
        const { getActiveTracker } = await import("./usage");
        getActiveTracker().recordTool(tool.name);
    } catch { /* ignore */ }

    const decision = permissions.evaluate(tool.name, args, !!tool.requiresApproval);
    if (decision.action === "deny") {
        const msg = `Permission denied: ${decision.reason}`;
        display.warn(msg);
        context.history.push({
            role: "tool",
            tool_call_id: call.id,
            name: tool.name,
            content: JSON.stringify({ success: false, error: msg }),
        });
        return;
    }
    if (decision.action === "ask") {
        const approved = await display.confirm(`Run ${tool.name}?`);
        if (!approved) {
            const msg = "User declined to run this tool.";
            display.warn(msg);
            context.history.push({
                role: "tool",
                tool_call_id: call.id,
                name: tool.name,
                content: JSON.stringify({ success: false, error: msg }),
            });
            return;
        }
    }

    const affected = registry.affectedFiles(tool, args);
    if (affected.length > 0) {
        try {
            const entry = checkpoints.create(`pre-${tool.name}`, affected);
            display.info(`checkpoint ${entry.id} (${affected.length} file${affected.length === 1 ? "" : "s"})`);
        } catch (e: any) {
            display.warn(`checkpoint failed: ${e.message}`);
        }
    }

    let result: ToolResult;
    try {
        result = await tool.execute(args, { cwd: context.cwd });
    } catch (err: any) {
        result = { success: false, output: "", error: err?.message || String(err) };
    }

    if (result.diff) {
        display.diff(result.diff.oldText, result.diff.newText, result.diff.filename);
    }
    display.toolResult(tool.name, result.success ? result.output : (result.error || result.output), result.success);

    // post_tool hook — observers can record/log; cannot mutate the result
    const postOutcomes = await hooks.run("post_tool", {
        event: "post_tool",
        tool: tool.name,
        args,
        success: result.success,
        output: result.output,
        error: result.error,
        cwd: context.cwd,
    }, tool.name);
    for (const o of postOutcomes) {
        if (o.message) display.info("hook: " + o.message);
    }

    const payload: Record<string, unknown> = { success: result.success };
    if (result.output) {
        // Sprint 15: auto-compress long shell output before feeding it back to the model.
        // The user still saw the full output in the terminal — only the model history is trimmed.
        if (tool.name === "shell_exec") {
            const compressed = autoCompressLines(result.output, { threshold: readAutoCompressThreshold() });
            payload.output = compressed.text;
            if (compressed.compressed) {
                payload.output_truncated_lines = compressed.truncatedLineCount;
            }
        } else {
            payload.output = result.output;
        }
    }
    if (result.error) payload.error = result.error;
    context.history.push({
        role: "tool",
        tool_call_id: call.id,
        name: tool.name,
        content: JSON.stringify(payload),
    });
}
