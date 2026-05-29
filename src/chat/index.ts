/**
 * Chat mode entry points.
 *
 * - chat(): launch interactive REPL
 * - ask(): one-shot headless query
 */

import { startRepl, ReplOptions } from "./repl";
import { ChatContext } from "./context";
import { CheckpointManager } from "./checkpoints";
import { buildDefaultRegistry } from "./tools";
import { runAgentTurn } from "./agent";
import { display as defaultDisplay } from "./display";

export interface AskOptions {
    cwd?: string;
    extraDirs?: string[];
    model?: string;
    outputFormat?: "text" | "json";
    autoApprove?: boolean;
}

export async function chat(options: ReplOptions = {}): Promise<void> {
    await startRepl(options);
}

export async function ask(prompt: string, options: AskOptions = {}): Promise<{ text: string; iterations: number; toolCalls: number }> {
    const cwd = options.cwd || process.cwd();
    const context = new ChatContext({ cwd, extraDirs: options.extraDirs });
    const registry = buildDefaultRegistry();
    const checkpoints = new CheckpointManager({ cwd });

    // In headless mode, use a silent display unless emitting text.
    const json = options.outputFormat === "json";
    const baseDisplay = json ? silentDisplay() : defaultDisplay;

    const result = await runAgentTurn(prompt, {
        registry,
        context,
        checkpoints,
        display: baseDisplay,
        model: options.model,
        autoApprove: options.autoApprove ?? !!json,
    });

    if (json) {
        process.stdout.write(JSON.stringify({
            prompt,
            response: result.finalText,
            iterations: result.iterations,
            toolCalls: result.toolCallCount,
        }, null, 2) + "\n");
    }

    return { text: result.finalText, iterations: result.iterations, toolCalls: result.toolCallCount };
}

function silentDisplay(): import("./display").Display {
    const noop = () => {};
    return {
        info: noop, warn: noop, error: noop,
        assistant: noop, user: noop,
        toolCall: noop, toolResult: noop, diff: noop,
        spinner: () => ({ stop: noop, succeed: noop, fail: noop, update: noop }),
        confirm: async () => true,
        raw: noop,
    };
}
