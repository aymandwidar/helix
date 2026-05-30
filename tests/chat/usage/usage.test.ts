import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { UsageTracker, formatUsage, writeSessionLog, listSessionLogs, readMostRecentSession } from "../../../src/chat/usage";

describe("UsageTracker", () => {
    it("counts tool calls", () => {
        const t = new UsageTracker();
        t.recordTool("file_read");
        t.recordTool("file_read");
        t.recordTool("shell_exec");
        const snap = t.snapshot();
        expect(snap.toolCalls.file_read).toBe(2);
        expect(snap.toolCalls.shell_exec).toBe(1);
    });

    it("breaks out MCP calls by server name", () => {
        const t = new UsageTracker();
        t.recordTool("mcp__memory__search_memory");
        t.recordTool("mcp__memory__store_memory");
        t.recordTool("mcp__council__deliberate");
        const snap = t.snapshot();
        expect(snap.mcpCalls.memory).toBe(2);
        expect(snap.mcpCalls.council).toBe(1);
    });

    it("aggregates token usage by model", () => {
        const t = new UsageTracker();
        t.recordModelUsage("deepseek/deepseek-chat", 100, 50, 0.0001);
        t.recordModelUsage("deepseek/deepseek-chat", 200, 80, 0.0002);
        t.recordModelUsage("openai/gpt-4o", 50, 25, 0.001);
        const snap = t.snapshot();
        expect(snap.tokensByModel["deepseek/deepseek-chat"]).toEqual({ prompt: 300, completion: 130 });
        expect(snap.tokensByModel["openai/gpt-4o"]).toEqual({ prompt: 50, completion: 25 });
        expect(snap.costUsd).toBeCloseTo(0.0013, 6);
    });

    it("records checkpoints and messages", () => {
        const t = new UsageTracker();
        t.recordCheckpoint(1024);
        t.recordCheckpoint(2048);
        t.recordMessage("user");
        t.recordMessage("user");
        t.recordMessage("assistant");
        const snap = t.snapshot();
        expect(snap.checkpoints).toEqual({ count: 2, bytes: 3072 });
        expect(snap.messages.user).toBe(2);
        expect(snap.messages.assistant).toBe(1);
    });

    it("formatUsage produces a multi-line report", () => {
        const t = new UsageTracker();
        t.recordTool("file_read");
        const text = formatUsage(t.snapshot());
        expect(text).toContain("Session usage");
        expect(text).toContain("file_read");
    });
});

describe("session log persistence", () => {
    let dir: string;
    beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "helix-sess-")); });
    afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

    it("writes and reads back session logs", () => {
        const t = new UsageTracker();
        t.recordTool("file_read");
        const file = writeSessionLog(t.snapshot(), "test", dir);
        expect(fs.existsSync(file)).toBe(true);
        const list = listSessionLogs(dir);
        expect(list.length).toBe(1);
        expect(list[0].snapshot.toolCalls.file_read).toBe(1);
    });

    it("readMostRecentSession returns the latest", () => {
        const t1 = new UsageTracker();
        t1.recordTool("a");
        writeSessionLog(t1.snapshot(), "first", dir);
        // Force lexicographic ordering by sleeping a tick
        const t2 = new UsageTracker();
        t2.recordTool("b");
        // Manually craft a later filename so the test isn't time-dependent
        fs.writeFileSync(path.join(dir, "z-later.json"), JSON.stringify({
            finishedAt: "2030-01-01",
            snapshot: t2.snapshot(),
            note: "later",
        }));
        const recent = readMostRecentSession(dir);
        expect(recent?.note).toBe("later");
    });
});
