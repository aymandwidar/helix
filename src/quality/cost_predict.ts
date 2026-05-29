/**
 * Cost predictor — estimate the token usage and dollar cost of an upcoming
 * agent turn based on the current message history and configured model.
 *
 * The estimate uses a simple ~4-chars-per-token heuristic for prompt tokens
 * and assumes a small, model-aware completion budget. Actual costs after a
 * real call always supersede this prediction.
 */

import { OpenRouterMessage, AVAILABLE_MODELS, DEFAULT_MODEL } from "../openrouter";

/** Pricing per million tokens: [input, output] — keep in sync with openrouter.ts */
const MODEL_PRICING: Record<string, [number, number]> = {
    "deepseek/deepseek-chat":             [0.14,  0.28],
    "meta-llama/llama-3.3-70b-instruct":  [0,     0],
    "minimax/minimax-01":                 [0.50,  1.50],
    "anthropic/claude-3.5-sonnet":        [3.00,  15.00],
    "google/gemini-pro-1.5":              [3.50,  10.50],
    "openai/gpt-4o":                      [2.50,  10.00],
};

export interface CostPrediction {
    model: string;
    estimatedPromptTokens: number;
    estimatedCompletionTokens: number;
    estimatedTotalTokens: number;
    estimatedCostUsd: number;
    notes: string[];
}

export interface PredictOptions {
    messages: OpenRouterMessage[];
    model?: string;
    /** Expected completion length in tokens (default 1500). */
    completionTokens?: number;
}

const CHARS_PER_TOKEN = 4;

export function predictTurnCost(opts: PredictOptions): CostPrediction {
    const model = opts.model || DEFAULT_MODEL;
    const promptChars = opts.messages.reduce((sum, m) => sum + (typeof m.content === "string" ? m.content.length : 0), 0);
    const promptTokens = Math.ceil(promptChars / CHARS_PER_TOKEN);
    const completionTokens = opts.completionTokens ?? 1500;

    const pricing = MODEL_PRICING[model];
    const notes: string[] = [];
    if (!pricing) notes.push(`No pricing info for model '${model}'; assumed $0.`);
    const [inputRate, outputRate] = pricing || [0, 0];
    const cost = (promptTokens / 1_000_000) * inputRate + (completionTokens / 1_000_000) * outputRate;

    return {
        model,
        estimatedPromptTokens: promptTokens,
        estimatedCompletionTokens: completionTokens,
        estimatedTotalTokens: promptTokens + completionTokens,
        estimatedCostUsd: Number(cost.toFixed(6)),
        notes,
    };
}

export function formatPrediction(p: CostPrediction): string {
    const lines = [
        `Cost prediction (${p.model}):`,
        `  prompt:     ~${p.estimatedPromptTokens} tokens`,
        `  completion: ~${p.estimatedCompletionTokens} tokens`,
        `  total:      ~${p.estimatedTotalTokens} tokens`,
        `  est. cost:  $${p.estimatedCostUsd.toFixed(6)}`,
    ];
    if (p.notes.length) lines.push("  notes:");
    for (const n of p.notes) lines.push("    - " + n);
    return lines.join("\n");
}

export function listKnownModels(): string[] {
    return [...AVAILABLE_MODELS];
}
