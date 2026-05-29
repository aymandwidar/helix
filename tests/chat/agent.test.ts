import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

import { ChatContext } from "../../src/chat/context";
import { CheckpointManager } from "../../src/chat/checkpoints";
import { buildDefaultRegistry } from "../../src/chat/tools";
import { runAgentTurn } from "../../src/chat/agent";
import * as openrouter from "../../src/openrouter";

describe("agent loop", () => {
    let tmp: string;
    beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "helix-agent-")); });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
        vi.restoreAllMocks();
    });

    function silentDisplay(): any {
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

    it("returns the model's final text when no tool calls are made", async () => {
        vi.spyOn(openrouter, "chatWithTools").mockResolvedValue({
            content: "Hello there.",
            toolCalls: [],
            finishReason: "stop",
        } as any);

        const result = await runAgentTurn("hi", {
            registry: buildDefaultRegistry(),
            context: new ChatContext({ cwd: tmp }),
            checkpoints: new CheckpointManager({ cwd: tmp }),
            display: silentDisplay(),
        });

        expect(result.finalText).toBe("Hello there.");
        expect(result.toolCallCount).toBe(0);
        expect(result.iterations).toBe(1);
    });

    it("dispatches a tool call and then returns the follow-up text", async () => {
        fs.writeFileSync(path.join(tmp, "a.txt"), "contents");

        const calls: any[] = [];
        vi.spyOn(openrouter, "chatWithTools").mockImplementation(async (messages: any) => {
            calls.push(messages);
            if (calls.length === 1) {
                return {
                    content: "",
                    toolCalls: [{
                        id: "call_1",
                        type: "function",
                        function: { name: "file_read", arguments: JSON.stringify({ path: "a.txt" }) },
                    }],
                    finishReason: "tool_calls",
                } as any;
            }
            return { content: "Done.", toolCalls: [], finishReason: "stop" } as any;
        });

        const ctx = new ChatContext({ cwd: tmp });
        const result = await runAgentTurn("read a.txt", {
            registry: buildDefaultRegistry(),
            context: ctx,
            checkpoints: new CheckpointManager({ cwd: tmp }),
            display: silentDisplay(),
        });

        expect(result.toolCallCount).toBe(1);
        expect(result.finalText).toBe("Done.");
        const second = calls[1];
        const toolMsg = second[second.length - 1];
        expect(toolMsg.role).toBe("tool");
        expect(toolMsg.name).toBe("file_read");
        expect(toolMsg.content).toContain("contents");
    });

    it("respects approval refusal for destructive tools", async () => {
        vi.spyOn(openrouter, "chatWithTools").mockImplementationOnce(async () => ({
            content: "",
            toolCalls: [{
                id: "call_1",
                type: "function",
                function: { name: "file_write", arguments: JSON.stringify({ path: "out.txt", content: "x" }) },
            }],
            finishReason: "tool_calls",
        } as any)).mockImplementationOnce(async (messages: any) => {
            const last = messages[messages.length - 1];
            expect(last.role).toBe("tool");
            expect(last.content).toContain("declined");
            return { content: "Okay.", toolCalls: [], finishReason: "stop" } as any;
        });

        const display = silentDisplay();
        display.confirm = async () => false;

        const result = await runAgentTurn("write file", {
            registry: buildDefaultRegistry(),
            context: new ChatContext({ cwd: tmp }),
            checkpoints: new CheckpointManager({ cwd: tmp }),
            display,
        });

        expect(result.finalText).toBe("Okay.");
        expect(fs.existsSync(path.join(tmp, "out.txt"))).toBe(false);
    });

    it("creates a checkpoint before mutating tools", async () => {
        fs.writeFileSync(path.join(tmp, "a.txt"), "before");

        vi.spyOn(openrouter, "chatWithTools").mockImplementationOnce(async () => ({
            content: "",
            toolCalls: [{
                id: "call_1",
                type: "function",
                function: { name: "file_write", arguments: JSON.stringify({ path: "a.txt", content: "after" }) },
            }],
            finishReason: "tool_calls",
        } as any)).mockImplementationOnce(async () => ({ content: "ok", toolCalls: [], finishReason: "stop" } as any));

        const cm = new CheckpointManager({ cwd: tmp });
        const display = silentDisplay();
        await runAgentTurn("change a.txt", {
            registry: buildDefaultRegistry(),
            context: new ChatContext({ cwd: tmp }),
            checkpoints: cm,
            display,
            autoApprove: true,
        });

        expect(fs.readFileSync(path.join(tmp, "a.txt"), "utf-8")).toBe("after");
        const list = cm.list();
        expect(list.length).toBe(1);
        cm.restore(list[0].id);
        expect(fs.readFileSync(path.join(tmp, "a.txt"), "utf-8")).toBe("before");
    });
});
