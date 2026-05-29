/**
 * Agent loop: think → act → observe.
 *
 * Drives a single user message to completion: calls the model, dispatches any
 * tool calls (with approval, hooks, and checkpointing for destructive tools),
 * feeds results back, and stops when the model emits a final text response or
 * hits the iteration cap.
 */

import { chatWithTools, OpenRouterMessage, ToolCall, CompletionOptions } from "../openrouter";
import { ToolRegistry, ToolResult } from "./tools";
import { ChatContext } from "./context";
import { CheckpointManager } from "./checkpoints";
import { Display } from "./display";
import { HookManager, NoopHooks } from "./hooks";

export interface AgentOptions {
    registry: ToolRegistry;
    context: ChatContext;
    checkpoints: CheckpointManager;
    display: Display;
    model?: string;
    maxIterations?: number;
    autoApprove?: boolean;
    hooks?: HookManager;
    /** Optional per-turn streaming callback for partial assistant text. */
    onStream?: (chunk: string) => void;
    /** Use streaming mode for chatWithTools. Falls back to non-streaming on error. */
    stream?: boolean;
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
        const messages: OpenRouterMessage[] = context.messages();
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

    if (tool.requiresApproval && !autoApprove) {
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
    if (result.output) payload.output = result.output;
    if (result.error) payload.error = result.error;
    context.history.push({
        role: "tool",
        tool_call_id: call.id,
        name: tool.name,
        content: JSON.stringify(payload),
    });
}
