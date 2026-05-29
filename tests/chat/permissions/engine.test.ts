import { describe, it, expect } from "vitest";
import { PermissionEngine, globMatch } from "../../../src/chat/permissions";

describe("PermissionEngine", () => {
    it("normal mode auto-approves non-destructive tools", () => {
        const engine = new PermissionEngine({ mode: "normal" });
        expect(engine.evaluate("file_read", {}, false).action).toBe("allow");
    });

    it("normal mode prompts for destructive tools", () => {
        const engine = new PermissionEngine({ mode: "normal" });
        expect(engine.evaluate("file_write", {}, true).action).toBe("ask");
    });

    it("trusted mode auto-allows safe tools but asks for shell_exec/deploy_app/MCP", () => {
        const engine = new PermissionEngine({ mode: "trusted" });
        expect(engine.evaluate("file_write", {}, true).action).toBe("allow");
        expect(engine.evaluate("shell_exec", {}, true).action).toBe("ask");
        expect(engine.evaluate("deploy_app", {}, true).action).toBe("ask");
        expect(engine.evaluate("mcp__memory__search_memory", {}, false).action).toBe("ask");
    });

    it("yolo mode auto-allows everything", () => {
        const engine = new PermissionEngine({ mode: "yolo" });
        expect(engine.evaluate("shell_exec", {}, true).action).toBe("allow");
        expect(engine.evaluate("deploy_app", {}, true).action).toBe("allow");
    });

    it("manual mode asks for everything", () => {
        const engine = new PermissionEngine({ mode: "manual" });
        expect(engine.evaluate("file_read", {}, false).action).toBe("ask");
    });

    it("deny rule overrides everything else", () => {
        const engine = new PermissionEngine({
            mode: "yolo",
            rules: [{ tool: "shell_exec", action: "deny", note: "no shell" }],
        });
        const decision = engine.evaluate("shell_exec", {}, true);
        expect(decision.action).toBe("deny");
        expect(decision.matchedRule?.note).toBe("no shell");
    });

    it("allow rule beats default ask", () => {
        const engine = new PermissionEngine({
            mode: "normal",
            rules: [{ tool: "file_*", action: "allow" }],
        });
        expect(engine.evaluate("file_write", {}, true).action).toBe("allow");
    });

    it("argMatch narrows rule matches", () => {
        const engine = new PermissionEngine({
            mode: "manual",
            rules: [{ tool: "shell_exec", action: "allow", argMatch: { command: "npm " } }],
        });
        expect(engine.evaluate("shell_exec", { command: "npm test" }, true).action).toBe("allow");
        expect(engine.evaluate("shell_exec", { command: "rm -rf ." }, true).action).toBe("ask");
    });

    it("addRule + removeRule work as expected", () => {
        const engine = new PermissionEngine();
        engine.addRule({ tool: "x", action: "deny" });
        expect(engine.listRules()).toHaveLength(1);
        const removed = engine.removeRule({ tool: "x" });
        expect(removed).toBe(true);
        expect(engine.listRules()).toHaveLength(0);
    });

    it("globMatch handles * and ?", () => {
        expect(globMatch("file_*", "file_read")).toBe(true);
        expect(globMatch("file_*", "shell_exec")).toBe(false);
        expect(globMatch("mcp__*__search_*", "mcp__memory__search_memory")).toBe(true);
        expect(globMatch("a?c", "abc")).toBe(true);
        expect(globMatch("a?c", "abbc")).toBe(false);
    });
});
