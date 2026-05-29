/**
 * History compaction for long chat sessions.
 *
 * Strategy: keep the system prompt + the most recent N turns verbatim, then
 * collapse everything older into a single "summary" assistant message. The
 * summary is produced by the model so it captures intent and decisions, not
 * just tool outputs.
 */

import { OpenRouterMessage, createCompletion, DEFAULT_MODEL } from "../openrouter";

const SUMMARY_SYSTEM = `Compress an older slice of a developer chat into a concise summary.
- Preserve user intent, decisions, file paths, and outcomes.
- Drop verbose tool output unless it explains a decision.
- Output 6-12 short bullets, no preamble.`;

export interface CompressOptions {
    /** Number of most-recent messages to keep verbatim. Default 8. */
    keepLastN?: number;
    /** Model to use for the summary. */
    model?: string;
    /** Limit the older slice's character count fed to the summarizer. */
    maxChars?: number;
}

export interface CompressResult {
    /** New compressed messages array (system + summary placeholder + recent). */
    messages: OpenRouterMessage[];
    /** Number of older messages folded into the summary. */
    summarized: number;
    /** The generated summary text. */
    summary: string;
}

const DEFAULT_KEEP = 8;
const DEFAULT_MAX_CHARS = 60_000;

export async function compressHistory(
    messages: OpenRouterMessage[],
    options: CompressOptions = {}
): Promise<CompressResult> {
    const keep = options.keepLastN ?? DEFAULT_KEEP;
    const system = messages.find(m => m.role === "system");
    const nonSystem = messages.filter(m => m.role !== "system");

    if (nonSystem.length <= keep) {
        return {
            messages: [...messages],
            summarized: 0,
            summary: "",
        };
    }

    const older = nonSystem.slice(0, nonSystem.length - keep);
    const recent = nonSystem.slice(-keep);

    const olderText = serializeForSummary(older, options.maxChars ?? DEFAULT_MAX_CHARS);
    const summary = await createCompletion(SUMMARY_SYSTEM, olderText, {
        model: options.model || DEFAULT_MODEL,
        temperature: 0.2,
        maxTokens: 800,
    });

    const compressedMessages: OpenRouterMessage[] = [];
    if (system) compressedMessages.push(system);
    compressedMessages.push({
        role: "assistant",
        content: `Conversation summary (compressed ${older.length} earlier messages):\n${summary.trim()}`,
    });
    compressedMessages.push(...recent);

    return {
        messages: compressedMessages,
        summarized: older.length,
        summary: summary.trim(),
    };
}

function serializeForSummary(messages: OpenRouterMessage[], maxChars: number): string {
    const lines: string[] = [];
    for (const m of messages) {
        const role = m.role.toUpperCase();
        const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
        lines.push(`${role}: ${content}`);
    }
    const joined = lines.join("\n\n");
    return joined.length > maxChars ? joined.slice(-maxChars) : joined;
}
