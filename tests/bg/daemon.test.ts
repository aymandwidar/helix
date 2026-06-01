import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { EventEmitter } from "events";
import { forkBackgroundTask } from "../../src/bg/daemon";
import { listTasks, readMeta, readResult, readOutput, writeMeta } from "../../src/bg/store";
import { MAX_BG_TASKS } from "../../src/bg/types";

function fakeChild() {
    const ee: any = new EventEmitter();
    ee.send = vi.fn();
    ee.unref = vi.fn();
    ee.disconnect = vi.fn();
    ee.connected = true;
    ee.pid = 99999;
    return ee;
}

describe("forkBackgroundTask", () => {
    let helixDir: string;
    let cwd: string;
    let oldEnv: string | undefined;

    beforeEach(() => {
        helixDir = fs.mkdtempSync(path.join(os.tmpdir(), "helix-bg-"));
        cwd = fs.mkdtempSync(path.join(os.tmpdir(), "helix-bg-cwd-"));
        oldEnv = process.env.HELIX_SETTINGS_DIR;
        process.env.HELIX_SETTINGS_DIR = helixDir;
    });

    afterEach(() => {
        fs.rmSync(helixDir, { recursive: true, force: true });
        fs.rmSync(cwd, { recursive: true, force: true });
        if (oldEnv) process.env.HELIX_SETTINGS_DIR = oldEnv; else delete process.env.HELIX_SETTINGS_DIR;
        vi.restoreAllMocks();
    });

    it("forks the worker and writes a meta record", () => {
        const child = fakeChild();
        const result = forkBackgroundTask({
            prompt: "do thing",
            cwd,
            forkFn: () => child,
            id: "bg-test1",
        });
        expect(result.rejected).toBeNull();
        expect(result.meta.id).toBe("bg-test1");
        expect(result.meta.state).toBe("running");
        expect(readMeta("bg-test1")?.pid).toBe(99999);
    });

    it("transitions to completed on done message + writes result", () => {
        const child = fakeChild();
        forkBackgroundTask({ prompt: "x", cwd, forkFn: () => child, id: "bg-done" });
        child.emit("message", { type: "done", result: { finalText: "ok", iterations: 2, toolCalls: 1 } });
        const meta = readMeta("bg-done");
        expect(meta?.state).toBe("completed");
        expect(meta?.finishedAt).toBeDefined();
        expect(readResult("bg-done")?.finalText).toBe("ok");
    });

    it("transitions to failed on error message", () => {
        const child = fakeChild();
        forkBackgroundTask({ prompt: "x", cwd, forkFn: () => child, id: "bg-err" });
        child.emit("message", { type: "error", error: "boom" });
        expect(readMeta("bg-err")?.state).toBe("failed");
        expect(readResult("bg-err")?.error).toBe("boom");
    });

    it("appends progress messages to output.log", () => {
        const child = fakeChild();
        forkBackgroundTask({ prompt: "x", cwd, forkFn: () => child, id: "bg-prog" });
        child.emit("message", { type: "progress", turn: 1, lastTool: "file_read" });
        child.emit("message", { type: "progress", turn: 2, lastTool: "shell_exec" });
        const out = readOutput("bg-prog");
        expect(out).toMatch(/turn=1/);
        expect(out).toMatch(/turn=2/);
        expect(out).toMatch(/file_read/);
    });

    it("rejects when the running cap is reached", () => {
        // Pre-populate MAX_BG_TASKS running tasks directly.
        for (let i = 0; i < MAX_BG_TASKS; i++) {
            writeMeta({ id: `bg-cap-${i}`, prompt: "x", cwd, pid: 1, state: "running", startedAt: "x" });
        }
        const result = forkBackgroundTask({
            prompt: "extra",
            cwd,
            forkFn: () => fakeChild(),
            id: "bg-overflow",
        });
        expect(result.rejected).toMatch(/Max/);
        expect(listTasks().some(t => t.id === "bg-overflow" && t.state === "running")).toBe(false);
    });

    it("falls back to running→failed if the child exits non-zero without a done message", () => {
        const child = fakeChild();
        forkBackgroundTask({ prompt: "x", cwd, forkFn: () => child, id: "bg-crash" });
        child.emit("exit", 1);
        expect(readMeta("bg-crash")?.state).toBe("failed");
    });

    it("permissionMode defaults to trusted; --yolo opts up", () => {
        forkBackgroundTask({ prompt: "x", cwd, forkFn: () => fakeChild(), id: "bg-trust" });
        forkBackgroundTask({ prompt: "x", cwd, forkFn: () => fakeChild(), id: "bg-yolo", permissionMode: "yolo" });
        expect(readMeta("bg-trust")?.permissionMode).toBe("trusted");
        expect(readMeta("bg-yolo")?.permissionMode).toBe("yolo");
    });
});
