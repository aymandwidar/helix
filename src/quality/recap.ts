/**
 * Session recap — produce a short bulleted summary of recent work.
 *
 * Used by `/recap` and the end-of-session prompt in repl.ts.
 */

import * as fs from "fs";
import * as path from "path";
import { OpenRouterMessage } from "../openrouter";

export interface RecapAi {
    (systemPrompt: string, userMessage: string, opts?: { model?: string; temperature?: number; maxTokens?: number }): Promise<string>;
}

export interface RecapOptions {
    messages: OpenRouterMessage[];
    /** Number of most-recent messages to consider. Default 30. */
    lastN?: number;
    /** Max characters of message text fed to the model. */
    maxChars?: number;
    model?: string;
    /** Inject a fake AI for tests. */
    ai?: RecapAi;
}

const RECAP_SYSTEM = `You are summarizing a developer chat session into a short status update.

Output strictly:

## Decisions
- <decisions made this session — empty if none>

## Files changed
- <list of files touched and a one-line note for each>

## Open questions
- <unresolved threads>

## Next steps
- <2-4 concrete next actions the user could take>

Keep bullets terse, one line each. No preamble or sign-off.`;

const DEFAULT_LAST_N = 30;
const DEFAULT_MAX_CHARS = 40_000;

export async function generateRecap(options: RecapOptions): Promise<string> {
    const { messages } = options;
    const lastN = options.lastN ?? DEFAULT_LAST_N;
    const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
    const sliced = messages
        .filter(m => m.role !== "system")
        .slice(-lastN);

    if (sliced.length === 0) return "(no conversation to recap yet)";

    const ai = options.ai || (async (sys, user, opts) => {
        const { createCompletion } = await import("../openrouter");
        return createCompletion(sys, user, opts);
    });

    const text = serialize(sliced, maxChars);
    return (await ai(RECAP_SYSTEM, text, {
        model: options.model,
        temperature: 0.2,
        maxTokens: 800,
    })).trim();
}

export interface SaveRecapOptions {
    cwd: string;
    recap: string;
    /** Override destination dir (default: cwd/.helix/recaps). */
    dir?: string;
}

export function saveRecap(options: SaveRecapOptions): string {
    const dir = options.dir || path.join(options.cwd, ".helix", "recaps");
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = path.join(dir, `${stamp}.md`);
    fs.writeFileSync(file, options.recap + "\n");
    return file;
}

function serialize(messages: OpenRouterMessage[], maxChars: number): string {
    const lines = messages.map(m => {
        const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
        return `${m.role.toUpperCase()}: ${content}`;
    });
    const joined = lines.join("\n\n");
    return joined.length > maxChars ? joined.slice(-maxChars) : joined;
}
