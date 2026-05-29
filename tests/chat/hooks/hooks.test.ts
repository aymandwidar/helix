import { describe, it, expect } from "vitest";
import { HookManager, HookConfig } from "../../../src/chat/hooks";

describe("HookManager", () => {
    it("matches by event and tool name regex", () => {
        const hooks: HookConfig[] = [
            { event: "pre_tool", match: "^file_", command: "true" },
            { event: "pre_tool", command: "true" },
            { event: "post_tool", command: "true" },
        ];
        const mgr = new HookManager(hooks);
        expect(mgr.matchingHooks("pre_tool", "file_write")).toHaveLength(2);
        expect(mgr.matchingHooks("pre_tool", "shell_exec")).toHaveLength(1);
        expect(mgr.matchingHooks("post_tool", "anything")).toHaveLength(1);
    });

    it("blocks when a hook command exits non-zero", async () => {
        const mgr = new HookManager([
            { event: "pre_tool", command: "exit 1" },
        ]);
        const out = await mgr.run("pre_tool", { event: "pre_tool", tool: "shell_exec", args: {}, cwd: process.cwd() }, "shell_exec");
        expect(out[0].block).toBe(true);
    });

    it("allows when a hook command exits zero with empty stdout", async () => {
        const mgr = new HookManager([
            { event: "pre_tool", command: "true" },
        ]);
        const out = await mgr.run("pre_tool", { event: "pre_tool", tool: "x", args: {}, cwd: process.cwd() }, "x");
        expect(out[0].block).toBeFalsy();
    });

    it("parses a JSON outcome from hook stdout", async () => {
        const mgr = new HookManager([
            { event: "pre_tool", command: "echo '{\"block\":true,\"reason\":\"nope\"}'" },
        ]);
        const out = await mgr.run("pre_tool", { event: "pre_tool", tool: "x", args: {}, cwd: process.cwd() }, "x");
        expect(out[0].block).toBe(true);
        expect(out[0].reason).toBe("nope");
    });

    it("treats non-JSON stdout as a message", async () => {
        const mgr = new HookManager([
            { event: "post_tool", command: "echo hello" },
        ]);
        const out = await mgr.run("post_tool", { event: "post_tool", tool: "x", args: {}, success: true, output: "", cwd: process.cwd() }, "x");
        expect(out[0].message).toBe("hello");
    });

    it("short-circuits remaining hooks after a block", async () => {
        const mgr = new HookManager([
            { event: "pre_tool", command: "echo '{\"block\":true,\"reason\":\"first\"}'" },
            { event: "pre_tool", command: "echo '{\"block\":true,\"reason\":\"second\"}'" },
        ]);
        const out = await mgr.run("pre_tool", { event: "pre_tool", tool: "x", args: {}, cwd: process.cwd() }, "x");
        expect(out).toHaveLength(1);
        expect(out[0].reason).toBe("first");
    });
});
