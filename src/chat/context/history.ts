/**
 * Conversation history container shared between REPL and agent loop.
 */

import { OpenRouterMessage } from "../../openrouter";

export class ConversationHistory {
    private messages: OpenRouterMessage[] = [];

    constructor(initial: OpenRouterMessage[] = []) {
        this.messages = [...initial];
    }

    push(message: OpenRouterMessage): void {
        this.messages.push(message);
    }

    getAll(): OpenRouterMessage[] {
        return [...this.messages];
    }

    setSystem(system: string): void {
        const existing = this.messages.findIndex(m => m.role === "system");
        if (existing >= 0) {
            this.messages[existing] = { role: "system", content: system };
        } else {
            this.messages.unshift({ role: "system", content: system });
        }
    }

    /** Clear all messages except the system prompt. */
    clear(): void {
        this.messages = this.messages.filter(m => m.role === "system");
    }

    size(): number {
        return this.messages.length;
    }
}
