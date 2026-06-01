import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
    writeMeta, readMeta, updateMeta,
    appendOutput, readOutput,
    writeResult, readResult,
    listTasks, generateBgId, getBgRoot,
} from "../../src/bg/store";

describe("bg store", () => {
    let helixDir: string;
    let oldEnv: string | undefined;

    beforeEach(() => {
        helixDir = fs.mkdtempSync(path.join(os.tmpdir(), "helix-bg-"));
        oldEnv = process.env.HELIX_SETTINGS_DIR;
        process.env.HELIX_SETTINGS_DIR = helixDir;
    });

    afterEach(() => {
        fs.rmSync(helixDir, { recursive: true, force: true });
        if (oldEnv) process.env.HELIX_SETTINGS_DIR = oldEnv; else delete process.env.HELIX_SETTINGS_DIR;
    });

    it("getBgRoot resolves under ~/.helix", () => {
        expect(getBgRoot()).toBe(path.join(helixDir, "bg"));
    });

    it("write/read/update meta round-trips", () => {
        const id = generateBgId();
        writeMeta({ id, prompt: "hi", cwd: "/x", pid: 1234, state: "running", startedAt: "now" });
        expect(readMeta(id)?.pid).toBe(1234);
        updateMeta(id, { state: "completed", finishedAt: "later" });
        const after = readMeta(id);
        expect(after?.state).toBe("completed");
        expect(after?.finishedAt).toBe("later");
    });

    it("appendOutput / readOutput preserves order across calls", () => {
        const id = generateBgId();
        writeMeta({ id, prompt: "hi", cwd: "/x", pid: 1, state: "running", startedAt: "now" });
        appendOutput(id, "line one");
        appendOutput(id, "line two\n");
        appendOutput(id, "line three");
        const out = readOutput(id);
        expect(out).toBe("line one\nline two\nline three\n");
    });

    it("writeResult + readResult round-trips", () => {
        const id = generateBgId();
        writeMeta({ id, prompt: "hi", cwd: "/x", pid: 1, state: "running", startedAt: "now" });
        writeResult(id, { finalText: "done", iterations: 3, toolCalls: 2 });
        expect(readResult(id)?.finalText).toBe("done");
    });

    it("listTasks returns most-recent first", () => {
        writeMeta({ id: "bg-a", prompt: "a", cwd: "/x", pid: 1, state: "completed", startedAt: "2026-01-01T00:00:00Z" });
        writeMeta({ id: "bg-b", prompt: "b", cwd: "/x", pid: 2, state: "completed", startedAt: "2026-01-02T00:00:00Z" });
        writeMeta({ id: "bg-c", prompt: "c", cwd: "/x", pid: 3, state: "completed", startedAt: "2026-01-03T00:00:00Z" });
        const list = listTasks();
        expect(list.map(t => t.id)).toEqual(["bg-c", "bg-b", "bg-a"]);
    });

    it("readMeta returns null for missing task", () => {
        expect(readMeta("bg-nonexistent")).toBeNull();
    });
});
