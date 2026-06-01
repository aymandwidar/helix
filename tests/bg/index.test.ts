import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { writeMeta, appendOutput, writeResult, outputPath } from "../../src/bg/store";
import { statusReport, formatStatus, attachBackgroundTask, killBackgroundTask, logsFor } from "../../src/bg";

describe("bg public API", () => {
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
        vi.restoreAllMocks();
    });

    it("statusReport counts running tasks", () => {
        writeMeta({ id: "bg-a", prompt: "x", cwd: "/x", pid: 1, state: "running", startedAt: "1" });
        writeMeta({ id: "bg-b", prompt: "y", cwd: "/x", pid: 2, state: "completed", startedAt: "2", finishedAt: "3" });
        const report = statusReport();
        expect(report.runningCount).toBe(1);
        expect(report.cap).toBe(4);
        expect(report.tasks.length).toBe(2);
    });

    it("formatStatus shows tasks", () => {
        writeMeta({ id: "bg-x", prompt: "do thing", cwd: "/x", pid: 1, state: "running", startedAt: "now" });
        const text = formatStatus(statusReport());
        expect(text).toContain("bg-x");
        expect(text).toContain("do thing");
    });

    it("formatStatus handles empty list", () => {
        expect(formatStatus(statusReport())).toContain("no background");
    });

    it("attachBackgroundTask streams existing output and stops when state flips", async () => {
        writeMeta({ id: "bg-att", prompt: "x", cwd: "/x", pid: 1, state: "running", startedAt: "1" });
        appendOutput("bg-att", "line 1");
        appendOutput("bg-att", "line 2");

        const lines: string[] = [];
        // Flip state to completed shortly after attach starts.
        setTimeout(() => {
            writeMeta({ id: "bg-att", prompt: "x", cwd: "/x", pid: 1, state: "completed", startedAt: "1", finishedAt: "2" });
        }, 50);

        const result = await attachBackgroundTask({
            id: "bg-att",
            follow: true,
            pollMs: 30,
            timeoutMs: 1500,
            onLine: line => lines.push(line),
        });

        expect(lines).toContain("line 1");
        expect(lines).toContain("line 2");
        expect(result.finalState).toBe("completed");
    });

    it("attachBackgroundTask returns 'missing' for unknown id", async () => {
        const result = await attachBackgroundTask({ id: "bg-nope", follow: false });
        expect(result.finalState).toBe("missing");
    });

    it("killBackgroundTask SIGTERMs running task and marks killed", () => {
        writeMeta({ id: "bg-kill", prompt: "x", cwd: "/x", pid: 4242, state: "running", startedAt: "1" });
        const killer = vi.fn();
        const result = killBackgroundTask({ id: "bg-kill", killer });
        expect(killer).toHaveBeenCalledWith(4242, "SIGTERM");
        expect(result.signaled).toBe(true);
        expect(result.finalState).toBe("killed");
    });

    it("killBackgroundTask is a no-op for already-finished tasks", () => {
        writeMeta({ id: "bg-done", prompt: "x", cwd: "/x", pid: 1, state: "completed", startedAt: "1", finishedAt: "2" });
        const killer = vi.fn();
        const result = killBackgroundTask({ id: "bg-done", killer });
        expect(killer).not.toHaveBeenCalled();
        expect(result.signaled).toBe(false);
        expect(result.finalState).toBe("completed");
    });

    it("logsFor returns meta + output + result", () => {
        writeMeta({ id: "bg-log", prompt: "x", cwd: "/x", pid: 1, state: "completed", startedAt: "1", finishedAt: "2" });
        appendOutput("bg-log", "step 1");
        writeResult("bg-log", { finalText: "all done", iterations: 1, toolCalls: 0 });
        const r = logsFor("bg-log");
        expect(r.meta?.state).toBe("completed");
        expect(r.output).toContain("step 1");
        expect(r.result?.finalText).toBe("all done");
    });
});
