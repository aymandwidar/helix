/**
 * OpenRouter Service Module v11.0
 * OpenClaw-Aligned Routing + Ollama Local GPU fallback
 * + Exponential backoff retry, cost tracking, request timeouts
 *
 * Model Strategy (synced with OpenClaw):
 *   - Code generation: DeepSeek Chat (best coder, $0.14/M input)
 *   - Research/light:   Llama 3.3 70B (free tier)
 *   - Local fallback:   Ollama on Omen PC (GPU, free)
 */

import chalk from "chalk";

// ── Cost Tracking ──────────────────────────────────────────────────────

/** Pricing per million tokens: [input, output] */
const MODEL_PRICING: Record<string, [number, number]> = {
    "deepseek/deepseek-chat":             [0.14,  0.28],
    "meta-llama/llama-3.3-70b-instruct":  [0,     0],
    "minimax/minimax-01":                 [0.50,  1.50],
    "anthropic/claude-3.5-sonnet":        [3.00,  15.00],
    "google/gemini-pro-1.5":              [3.50,  10.50],
    "openai/gpt-4o":                      [2.50,  10.00],
};

interface CostEntry {
    model: string;
    promptTokens: number;
    completionTokens: number;
    cost: number;
    timestamp: Date;
}

let sessionCostTotal = 0;
const costLog: CostEntry[] = [];

function trackCost(model: string, usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }): void {
    if (!usage) return;

    const pricing = MODEL_PRICING[model];
    if (!pricing) {
        // Unknown model — log zero cost
        costLog.push({ model, promptTokens: usage.prompt_tokens, completionTokens: usage.completion_tokens, cost: 0, timestamp: new Date() });
        return;
    }

    const [inputRate, outputRate] = pricing;
    const cost = (usage.prompt_tokens / 1_000_000) * inputRate + (usage.completion_tokens / 1_000_000) * outputRate;
    sessionCostTotal += cost;
    costLog.push({ model, promptTokens: usage.prompt_tokens, completionTokens: usage.completion_tokens, cost, timestamp: new Date() });

    if (cost > 0) {
        console.log(chalk.gray(`💰 Cost: $${cost.toFixed(6)} | Session total: $${sessionCostTotal.toFixed(6)}`));
    }
}

/** Get a summary of session costs */
export function getCostSummary(): { totalCost: number; callCount: number; entries: CostEntry[] } {
    return { totalCost: sessionCostTotal, callCount: costLog.length, entries: [...costLog] };
}

/** Reset the cost tracker (e.g. between sessions) */
export function resetCostTracker(): void {
    sessionCostTotal = 0;
    costLog.length = 0;
}

// ── Retry Logic ────────────────────────────────────────────────────────

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1000, 3000, 9000];

const API_TIMEOUT_MS = 60_000;

// OpenRouter API Configuration
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

// Ollama (local) Configuration
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5-coder:7b";

// Model defaults from environment - OpenClaw-aligned stack
export const DEFAULT_MODEL = process.env.HELIX_DEFAULT_MODEL || "deepseek/deepseek-chat";
export const RESEARCH_MODEL = process.env.HELIX_RESEARCH_MODEL || "meta-llama/llama-3.3-70b-instruct";
/** Use local Ollama for lightweight tasks (SCOPE, repairs) */
export const LOCAL_MODEL = "ollama/local";

export interface OpenRouterMessage {
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
    name?: string;
}

export interface ToolCall {
    id: string;
    type: "function";
    function: {
        name: string;
        arguments: string;
    };
}

export interface ToolSchema {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: {
            type: "object";
            properties: Record<string, any>;
            required?: string[];
        };
    };
}

export interface ChatTurnResult {
    content: string;
    toolCalls: ToolCall[];
    finishReason: string;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export interface OpenRouterResponse {
    id: string;
    choices: Array<{
        message: {
            role: string;
            content: string;
        };
        finish_reason: string;
    }>;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export interface CompletionOptions {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    /** Enable Qwen Thinking Mode for self-healing retries */
    thinking?: boolean;
}

/**
 * Check if Ollama is running on the Omen PC
 */
async function isOllamaAvailable(): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const resp = await fetch(`${OLLAMA_URL}/api/tags`, { signal: controller.signal });
        clearTimeout(timeout);
        return resp.ok;
    } catch {
        return false;
    }
}

/**
 * Call Ollama locally on Omen PC (GPU-accelerated, free)
 */
async function callOllama(
    systemPrompt: string,
    userMessage: string,
    maxTokens: number
): Promise<string> {
    const prompt = `${systemPrompt}\n\n${userMessage}`;

    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: OLLAMA_MODEL,
            prompt,
            stream: false,
            options: { num_predict: maxTokens },
        }),
    });

    if (!response.ok) {
        throw new Error(`Ollama error: ${response.status}`);
    }

    const data = await response.json() as { response: string; eval_count?: number; eval_duration?: number };

    // Log performance
    if (data.eval_count && data.eval_duration) {
        const tokPerSec = (data.eval_count / (data.eval_duration / 1e9)).toFixed(1);
        console.log(chalk.gray(`📊 Ollama: ${data.eval_count} tokens @ ${tokPerSec} tok/sec (GPU)`));
    }

    return data.response;
}

/**
 * Creates a chat completion — routes to Ollama or OpenRouter
 *
 * If model is LOCAL_MODEL ("ollama/local"), tries Ollama first and falls back to OpenRouter.
 * Otherwise, goes straight to OpenRouter.
 */
export async function createCompletion(
    systemPrompt: string,
    userMessage: string,
    options: CompletionOptions = {}
): Promise<string> {
    const model = options.model || DEFAULT_MODEL;
    const maxTokens = options.maxTokens || 4096;
    const temperature = options.temperature || 0.7;
    const useLocal = model === LOCAL_MODEL;

    // Try Ollama first for local model requests
    if (useLocal) {
        const ollamaUp = await isOllamaAvailable();
        if (ollamaUp) {
            console.log(chalk.gray(`🤖 Model: ${OLLAMA_MODEL} [Omen GPU]`));
            try {
                return await callOllama(systemPrompt, userMessage, maxTokens);
            } catch (err: any) {
                console.log(chalk.yellow(`⚠️  Ollama failed (${err.message}), falling back to OpenRouter`));
            }
        } else {
            console.log(chalk.gray(`🤖 Ollama offline — using OpenRouter fallback`));
        }
        // Fall through to OpenRouter with RESEARCH_MODEL as fallback
        options.model = RESEARCH_MODEL;
    }

    // OpenRouter path
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
        throw new Error("OPENROUTER_API_KEY not found in environment");
    }

    const finalModel = useLocal ? RESEARCH_MODEL : model;
    console.log(chalk.gray(`🤖 Model: ${finalModel}${options.thinking ? ' [Thinking Mode]' : ''}${useLocal ? ' [fallback]' : ''}`));

    const messages: OpenRouterMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
    ];

    // Build request body
    const body: Record<string, any> = {
        model: finalModel,
        messages,
        max_tokens: maxTokens,
        temperature,
    };

    // Enable thinking/reasoning mode if requested (DeepSeek supports this)
    if (options.thinking) {
        body.reasoning = { effort: "high" };
    }

    // Retry loop with exponential backoff
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        if (attempt > 0) {
            const delay = RETRY_DELAYS_MS[attempt - 1];
            console.log(chalk.yellow(`⏳ Retry ${attempt}/${MAX_RETRIES - 1} after ${delay}ms...`));
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

        try {
            const response = await fetch(OPENROUTER_BASE_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                    "HTTP-Referer": "https://helix-lang.dev",
                    "X-Title": "Helix CLI",
                },
                body: JSON.stringify(body),
                signal: controller.signal,
            });

            clearTimeout(timeout);

            if (!response.ok) {
                const errorText = await response.text();
                lastError = new Error(`OpenRouter API error: ${response.status} - ${errorText}`);

                // Don't retry on client errors (except 429)
                if (!RETRYABLE_STATUS_CODES.has(response.status)) {
                    throw lastError;
                }
                continue;
            }

            const data = (await response.json()) as OpenRouterResponse;

            if (!data.choices || data.choices.length === 0) {
                throw new Error("No response from OpenRouter API");
            }

            const content = data.choices[0].message.content;

            // Log token usage if available
            if (data.usage) {
                console.log(
                    chalk.gray(
                        `📊 Tokens: ${data.usage.prompt_tokens} prompt + ${data.usage.completion_tokens} completion = ${data.usage.total_tokens} total`
                    )
                );
            }

            // Track cost
            trackCost(finalModel, data.usage);

            return content;
        } catch (err: any) {
            clearTimeout(timeout);
            if (err.name === "AbortError") {
                lastError = new Error(`OpenRouter API request timed out after ${API_TIMEOUT_MS}ms`);
                continue;
            }
            // Re-throw non-retryable errors
            if (lastError && !RETRYABLE_STATUS_CODES.has(parseInt(lastError.message.match(/error: (\d+)/)?.[1] || "0"))) {
                throw err;
            }
            lastError = err;
        }
    }

    throw lastError || new Error("OpenRouter API request failed after all retries");
}

/**
 * Multi-turn chat with tool-use support.
 *
 * Used by the interactive agent loop in `helix chat`. Unlike createCompletion(),
 * this preserves a full message history (including assistant tool_calls and tool
 * results) and exposes the model's tool_calls so the caller can dispatch them.
 */
export async function chatWithTools(
    messages: OpenRouterMessage[],
    tools: ToolSchema[],
    options: CompletionOptions = {}
): Promise<ChatTurnResult> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        throw new Error("OPENROUTER_API_KEY not found in environment");
    }

    const model = options.model || DEFAULT_MODEL;
    const maxTokens = options.maxTokens || 4096;
    const temperature = options.temperature ?? 0.7;

    const body: Record<string, any> = {
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
    };
    if (tools.length > 0) {
        body.tools = tools;
        body.tool_choice = "auto";
    }
    if (options.thinking) {
        body.reasoning = { effort: "high" };
    }

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        if (attempt > 0) {
            const delay = RETRY_DELAYS_MS[attempt - 1];
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

        try {
            const response = await fetch(OPENROUTER_BASE_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                    "HTTP-Referer": "https://helix-lang.dev",
                    "X-Title": "Helix CLI",
                },
                body: JSON.stringify(body),
                signal: controller.signal,
            });
            clearTimeout(timeout);

            if (!response.ok) {
                const errorText = await response.text();
                lastError = new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
                if (!RETRYABLE_STATUS_CODES.has(response.status)) {
                    throw lastError;
                }
                continue;
            }

            const data = (await response.json()) as any;
            if (!data.choices || data.choices.length === 0) {
                throw new Error("No response from OpenRouter API");
            }

            const choice = data.choices[0];
            const message = choice.message || {};
            const result: ChatTurnResult = {
                content: typeof message.content === "string" ? message.content : "",
                toolCalls: Array.isArray(message.tool_calls) ? message.tool_calls : [],
                finishReason: choice.finish_reason || "stop",
                usage: data.usage,
            };

            if (data.usage) {
                trackCost(model, data.usage);
            }

            return result;
        } catch (err: any) {
            clearTimeout(timeout);
            if (err.name === "AbortError") {
                lastError = new Error(`OpenRouter API request timed out after ${API_TIMEOUT_MS}ms`);
                continue;
            }
            if (lastError && !RETRYABLE_STATUS_CODES.has(parseInt(lastError.message.match(/error: (\d+)/)?.[1] || "0"))) {
                throw err;
            }
            lastError = err;
        }
    }

    throw lastError || new Error("OpenRouter API request failed after all retries");
}

/**
 * Streaming variant of chatWithTools.
 *
 * Streams Server-Sent Events from OpenRouter, invoking `onChunk` for every
 * incremental piece of assistant text. Tool calls are accumulated by index
 * and returned at the end alongside the full content. Falls back to
 * non-streaming on any transport error.
 */
export async function chatWithToolsStream(
    messages: OpenRouterMessage[],
    tools: ToolSchema[],
    onChunk: (chunk: string) => void,
    options: CompletionOptions = {}
): Promise<ChatTurnResult> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY not found in environment");

    const model = options.model || DEFAULT_MODEL;
    const body: Record<string, any> = {
        model,
        messages,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature ?? 0.7,
        stream: true,
    };
    if (tools.length > 0) {
        body.tools = tools;
        body.tool_choice = "auto";
    }
    if (options.thinking) body.reasoning = { effort: "high" };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
        const response = await fetch(OPENROUTER_BASE_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
                "HTTP-Referer": "https://helix-lang.dev",
                "X-Title": "Helix CLI",
                "Accept": "text/event-stream",
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        });

        if (!response.ok || !response.body) {
            clearTimeout(timeout);
            // Fall back to non-streaming
            return await chatWithTools(messages, tools, options);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let content = "";
        const toolCallParts = new Map<number, { id?: string; name?: string; argsBuf: string }>();
        let finishReason = "stop";
        let usage: ChatTurnResult["usage"] | undefined;

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let idx;
            while ((idx = buffer.indexOf("\n")) >= 0) {
                const line = buffer.slice(0, idx).trim();
                buffer = buffer.slice(idx + 1);
                if (!line || line.startsWith(":")) continue;
                if (!line.startsWith("data:")) continue;
                const payload = line.slice(5).trim();
                if (payload === "[DONE]") break;
                let evt: any;
                try { evt = JSON.parse(payload); } catch { continue; }
                if (evt.usage) usage = evt.usage;
                const choice = evt.choices?.[0];
                if (!choice) continue;
                if (choice.finish_reason) finishReason = choice.finish_reason;
                const delta = choice.delta || {};
                if (typeof delta.content === "string" && delta.content) {
                    content += delta.content;
                    onChunk(delta.content);
                }
                if (Array.isArray(delta.tool_calls)) {
                    for (const tc of delta.tool_calls) {
                        const i = typeof tc.index === "number" ? tc.index : 0;
                        const slot = toolCallParts.get(i) || { argsBuf: "" };
                        if (tc.id) slot.id = tc.id;
                        if (tc.function?.name) slot.name = tc.function.name;
                        if (typeof tc.function?.arguments === "string") slot.argsBuf += tc.function.arguments;
                        toolCallParts.set(i, slot);
                    }
                }
            }
        }
        clearTimeout(timeout);

        const toolCalls: ToolCall[] = [];
        for (const [, slot] of [...toolCallParts.entries()].sort((a, b) => a[0] - b[0])) {
            if (!slot.name) continue;
            toolCalls.push({
                id: slot.id || `call_${toolCalls.length + 1}`,
                type: "function",
                function: { name: slot.name, arguments: slot.argsBuf || "{}" },
            });
        }

        if (usage) trackCost(model, usage);
        return { content, toolCalls, finishReason, usage };
    } catch (err: any) {
        clearTimeout(timeout);
        if (err?.name === "AbortError") {
            // fall through to non-streaming retry
        }
        return await chatWithTools(messages, tools, options);
    }
}

/**
 * Available models on OpenRouter - OpenClaw-aligned priority
 */
export const AVAILABLE_MODELS = [
    "deepseek/deepseek-chat",           // Primary: code generation ($0.14/M)
    "meta-llama/llama-3.3-70b-instruct", // Research: free tier
    "minimax/minimax-01",               // Creative: writing/design
    "moonshotai/kimi-k2.5",             // Coding fallback
    "anthropic/claude-3.5-sonnet",       // Premium fallback
    "google/gemini-pro-1.5",
    "google/gemini-flash-1.5",
    "openai/gpt-4o",
    "qwen/qwen3.5-plus-02-15",
    "deepseek/deepseek-chat-v3-0324",
];
