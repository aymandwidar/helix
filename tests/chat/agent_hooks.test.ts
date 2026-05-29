import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

import { ChatContext } from "../../src/chat/context";
import { CheckpointManager } from "../../src/chat/checkpoints";
import { buildDefaultRegistry } from "../../src/chat/tools";
import { runAgentTurn } from "../../src/chat/agent";
import { HookManager } from "../../src/chat/hooks";
import * as openrouter from "../../src/openrouter";

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

describe("agent loop with hooks", () => {
    let tmp: string;
    beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "helix-aghook-")); });
    afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); vi.restoreAllMocks(); });

    it("blocks tool execution when a pre_tool hook says so", async () => {
        fs.writeFileSync(path.join(tmp, "a.txt"), "before");

        vi.spyOn(openrouter, "chatWithTools")
            .mockImplementationOnce(async () => ({
                content: "",
                toolCalls: [{
                    id: "call_1",
                    type: "function",
                    function: { name: "file_write", arguments: JSON.stringify({ path: "a.txt", content: "after" }) },
                }],
                finishReason: "tool_calls",
            } as any))
            .mockImplementationOnce(async (messages: any) => {
                const last = messages[messages.length - 1];
                expect(last.role).toBe("tool");
                expect(last.content).toContain("blocked");
                return { content: "ok", toolCalls: [], finishReason: "stop" } as any;
            });

        const hooks = new HookManager([
            { event: "pre_tool", match: "^file_write$", command: "echo '{\"block\":true,\"reason\":\"blocked by policy\"}'" },
        ]);

        await runAgentTurn("change file", {
            registry: buildDefaultRegistry(),
            context: new ChatContext({ cwd: tmp }),
            checkpoints: new CheckpointManager({ cwd: tmp }),
            display: silentDisplay(),
            hooks,
            autoApprove: true,
        });

        expect(fs.readFileSync(path.join(tmp, "a.txt"), "utf-8")).toBe("before");
    });
});
