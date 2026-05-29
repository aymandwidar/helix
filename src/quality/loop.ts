/**
 * Count-bounded loop helper. Runs a prompt N times against the agent loop,
 * each iteration optionally seeded with the previous turn's final text.
 *
 * Used by the `/loop` slash command. The caller is responsible for the
 * AgentOptions; this helper just orchestrates the iteration.
 */

import { runAgentTurn, AgentOptions, AgentRunResult } from "../chat/agent";

export interface LoopOptions extends AgentOptions {
    /** How many iterations to run. Capped at 50 for safety. */
    iterations: number;
    /** Initial user prompt. Used as-is on iteration 1; later iterations get
     *  the previous result appended via `iterationPrompt`. */
    prompt: string;
    /** Build the prompt for iterations > 1. Defaults to: prompt + "\nPrevious result:\n" + previous. */
    iterationPrompt?: (previous: AgentRunResult, n: number, basePrompt: string) => string;
    /** Stop early when this returns true. */
    stopWhen?: (result: AgentRunResult, n: number) => boolean;
}

export interface LoopRunResult {
    iterations: AgentRunResult[];
    stoppedEarly: boolean;
}

const HARD_CAP = 50;

export async function runLoop(options: LoopOptions): Promise<LoopRunResult> {
    const cap = Math.min(Math.max(1, options.iterations), HARD_CAP);
    const results: AgentRunResult[] = [];

    for (let n = 1; n <= cap; n++) {
        const prompt = n === 1
            ? options.prompt
            : (options.iterationPrompt
                ? options.iterationPrompt(results[results.length - 1], n, options.prompt)
                : `${options.prompt}\n\nPrevious result:\n${results[results.length - 1].finalText || "(no output)"}`);

        const result = await runAgentTurn(prompt, options);
        results.push(result);

        if (options.stopWhen && options.stopWhen(result, n)) {
            return { iterations: results, stoppedEarly: true };
        }
    }

    return { iterations: results, stoppedEarly: false };
}
