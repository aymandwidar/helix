import { describe, it, expect, vi, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { runLoop } from "../../src/quality/loop";
import { ChatContext } from "../../src/chat/context";
import { CheckpointManager } from "../../src/chat/checkpoints";
import { buildDefaultRegistry } from "../../src/chat/tools";
import * as openrouter from "../../src/openrouter";

afterEach(() => { vi.restoreAllMocks(); });

function silent(): any {
    const noop = () => {};
    return { info: noop, warn: noop, error: noop, assistant: noop, user: noop, toolCall: noop, toolResult: noop, diff: noop, spinner: () => ({ stop: noop, succeed: noop, fail: noop, update: noop }), confirm: async () => false, raw: noop };
}

describe("runLoop", () => {
    it("runs N iterations and returns each result", async () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "helix-loop-"));
        try {
            let n = 0;
            vi.spyOn(openrouter, "chatWithTools").mockImplementation(async () => {
                n++;
                return { content: `iter-${n}`, toolCalls: [], finishReason: "stop" } as any;
            });

            const result = await runLoop({
                iterations: 3,
                prompt: "do thing",
                registry: buildDefaultRegistry(),
                context: new ChatContext({ cwd: tmp }),
                checkpoints: new CheckpointManager({ cwd: tmp }),
                display: silent(),
            });

            expect(result.iterations).toHaveLength(3);
            expect(result.iterations.map(i => i.finalText)).toEqual(["iter-1", "iter-2", "iter-3"]);
            expect(result.stoppedEarly).toBe(false);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it("stops early when stopWhen returns true", async () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "helix-loop-"));
        try {
            let n = 0;
            vi.spyOn(openrouter, "chatWithTools").mockImplementation(async () => {
                n++;
                return { content: `iter-${n}`, toolCalls: [], finishReason: "stop" } as any;
            });

            const result = await runLoop({
                iterations: 10,
                prompt: "x",
                stopWhen: (_r, n) => n >= 2,
                registry: buildDefaultRegistry(),
                context: new ChatContext({ cwd: tmp }),
                checkpoints: new CheckpointManager({ cwd: tmp }),
                display: silent(),
            });

            expect(result.stoppedEarly).toBe(true);
            expect(result.iterations).toHaveLength(2);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it("hard caps at 50 iterations", async () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "helix-loop-"));
        try {
            vi.spyOn(openrouter, "chatWithTools").mockResolvedValue({ content: "x", toolCalls: [], finishReason: "stop" } as any);
            const result = await runLoop({
                iterations: 999,
                prompt: "x",
                registry: buildDefaultRegistry(),
                context: new ChatContext({ cwd: tmp }),
                checkpoints: new CheckpointManager({ cwd: tmp }),
                display: silent(),
            });
            expect(result.iterations.length).toBe(50);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
});
