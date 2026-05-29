import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

import { runSubagent, runSubagentsParallel } from "../../../src/chat/subagent";
import * as openrouter from "../../../src/openrouter";

describe("runSubagent", () => {
    let tmp: string;
    beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "helix-subag-")); });
    afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); vi.restoreAllMocks(); });

    it("returns the model's final text", async () => {
        vi.spyOn(openrouter, "chatWithTools").mockResolvedValue({
            content: "subagent says hi",
            toolCalls: [],
            finishReason: "stop",
        } as any);

        const result = await runSubagent({ prompt: "do x", label: "alpha" }, { cwd: tmp });
        expect(result.label).toBe("alpha");
        expect(result.finalText).toBe("subagent says hi");
    });

    it("runs many subagents in parallel and labels them", async () => {
        vi.spyOn(openrouter, "chatWithTools").mockImplementation(async (messages: any) => {
            const userMsg = messages[messages.length - 1];
            return { content: `echo: ${userMsg.content}`, toolCalls: [], finishReason: "stop" } as any;
        });

        const results = await runSubagentsParallel([
            { prompt: "one", label: "a" },
            { prompt: "two", label: "b" },
            { prompt: "three", label: "c" },
        ], { cwd: tmp });

        expect(results.map(r => r.label)).toEqual(["a", "b", "c"]);
        expect(results.map(r => r.finalText)).toEqual(["echo: one", "echo: two", "echo: three"]);
    });
});
