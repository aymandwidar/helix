import { describe, it, expect, vi, afterEach } from "vitest";
import { compressHistory } from "../../src/quality/compress";
import * as openrouter from "../../src/openrouter";
import { OpenRouterMessage } from "../../src/openrouter";

afterEach(() => {
    vi.restoreAllMocks();
});

describe("compressHistory", () => {
    it("returns identical messages when history is short", async () => {
        const msgs: OpenRouterMessage[] = [
            { role: "system", content: "sys" },
            { role: "user", content: "hi" },
        ];
        const result = await compressHistory(msgs, { keepLastN: 8 });
        expect(result.summarized).toBe(0);
        expect(result.messages).toEqual(msgs);
    });

    it("summarizes older messages and keeps last N", async () => {
        vi.spyOn(openrouter, "createCompletion").mockResolvedValue("- summary point one\n- summary point two");
        const messages: OpenRouterMessage[] = [
            { role: "system", content: "sys" },
            ...Array.from({ length: 12 }, (_, i) => ({ role: "user" as const, content: `msg ${i}` })),
        ];
        const result = await compressHistory(messages, { keepLastN: 4 });
        expect(result.summarized).toBe(8);
        // System + summary + 4 recent
        expect(result.messages.length).toBe(6);
        expect(result.messages[0].role).toBe("system");
        expect(result.messages[1].role).toBe("assistant");
        expect(result.messages[1].content).toContain("summary point one");
    });
});
