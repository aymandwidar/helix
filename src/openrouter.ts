/**
 * OpenRouter Service Module
 * Provides a unified interface for AI completions via OpenRouter
 */

import chalk from "chalk";

// OpenRouter API Configuration
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

// Model defaults from environment
export const DEFAULT_MODEL = process.env.HELIX_DEFAULT_MODEL || "anthropic/claude-3.5-sonnet";
export const RESEARCH_MODEL = process.env.HELIX_RESEARCH_MODEL || "google/gemini-flash-1.5";

export interface OpenRouterMessage {
    role: "system" | "user" | "assistant";
    content: string;
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
}

/**
 * Creates a chat completion using OpenRouter API
 */
export async function createCompletion(
    systemPrompt: string,
    userMessage: string,
    options: CompletionOptions = {}
): Promise<string> {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
        throw new Error("OPENROUTER_API_KEY not found in environment");
    }

    const model = options.model || DEFAULT_MODEL;
    const maxTokens = options.maxTokens || 4096;
    const temperature = options.temperature || 0.7;

    console.log(chalk.gray(`🤖 Model: ${model}`));

    const messages: OpenRouterMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
    ];

    const response = await fetch(OPENROUTER_BASE_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": "https://helix-lang.dev",
            "X-Title": "Helix CLI",
        },
        body: JSON.stringify({
            model,
            messages,
            max_tokens: maxTokens,
            temperature,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
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

    return content;
}

/**
 * List of popular models available on OpenRouter
 */
export const AVAILABLE_MODELS = [
    "anthropic/claude-3.5-sonnet",
    "anthropic/claude-3-opus",
    "anthropic/claude-3-sonnet",
    "anthropic/claude-3-haiku",
    "google/gemini-pro-1.5",
    "google/gemini-flash-1.5",
    "openai/gpt-4-turbo",
    "openai/gpt-4o",
    "meta-llama/llama-3.1-405b-instruct",
    "mistral/mistral-large",
];
