import { describe, it, expect, vi, afterEach } from "vitest";
import { chatWithToolsStream } from "../../src/openrouter";

afterEach(() => {
    vi.restoreAllMocks();
});

function sseStream(events: string[]): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    return new ReadableStream({
        start(controller) {
            for (const evt of events) controller.enqueue(encoder.encode(evt));
            controller.close();
        },
    });
}

describe("chatWithToolsStream", () => {
    it("invokes onChunk for each delta and assembles content", async () => {
        process.env.OPENROUTER_API_KEY = "test-key";
        const events = [
            `data: ${JSON.stringify({ choices: [{ delta: { content: "Hel" } }] })}\n`,
            `data: ${JSON.stringify({ choices: [{ delta: { content: "lo " } }] })}\n`,
            `data: ${JSON.stringify({ choices: [{ delta: { content: "world." }, finish_reason: "stop" }] })}\n`,
            `data: [DONE]\n`,
        ];
        vi.spyOn(globalThis, "fetch" as any).mockResolvedValue({
            ok: true,
            body: sseStream(events),
        } as any);

        const chunks: string[] = [];
        const result = await chatWithToolsStream(
            [{ role: "user", content: "hi" }],
            [],
            (c) => chunks.push(c),
        );
        expect(chunks.join("")).toBe("Hello world.");
        expect(result.content).toBe("Hello world.");
        expect(result.finishReason).toBe("stop");
        expect(result.toolCalls).toEqual([]);
    });

    it("accumulates streamed tool calls", async () => {
        process.env.OPENROUTER_API_KEY = "test-key";
        const events = [
            `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1", function: { name: "file_read", arguments: '{"path":' } }] } }] })}\n`,
            `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"a.txt"}' } }] } }] })}\n`,
            `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "tool_calls" }] })}\n`,
            `data: [DONE]\n`,
        ];
        vi.spyOn(globalThis, "fetch" as any).mockResolvedValue({
            ok: true,
            body: sseStream(events),
        } as any);

        const result = await chatWithToolsStream(
            [{ role: "user", content: "read it" }],
            [],
            () => {},
        );
        expect(result.toolCalls.length).toBe(1);
        expect(result.toolCalls[0].function.name).toBe("file_read");
        expect(result.toolCalls[0].function.arguments).toBe('{"path":"a.txt"}');
    });
});
