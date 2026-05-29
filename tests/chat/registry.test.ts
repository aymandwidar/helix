import { describe, it, expect } from "vitest";
import { buildDefaultRegistry, ToolRegistry } from "../../src/chat/tools";

describe("ToolRegistry", () => {
    it("registers default tools", () => {
        const reg = buildDefaultRegistry();
        const names = reg.list().map(t => t.name).sort();
        expect(names).toContain("file_read");
        expect(names).toContain("file_write");
        expect(names).toContain("file_edit");
        expect(names).toContain("shell_exec");
        expect(names).toContain("web_fetch");
        expect(names).toContain("list_dir");
        expect(names).toContain("search_files");
        expect(names).toContain("spawn_app");
        expect(names).toContain("evolve_app");
        expect(names).toContain("deploy_app");
    });

    it("returns OpenAI-compatible tool schemas", () => {
        const reg = buildDefaultRegistry();
        const schemas = reg.getToolSchemas();
        for (const schema of schemas) {
            expect(schema.type).toBe("function");
            expect(typeof schema.function.name).toBe("string");
            expect(schema.function.parameters.type).toBe("object");
            expect(typeof schema.function.parameters.properties).toBe("object");
        }
    });

    it("flags destructive tools as requiring approval", () => {
        const reg = buildDefaultRegistry();
        expect(reg.get("file_write")?.requiresApproval).toBe(true);
        expect(reg.get("file_edit")?.requiresApproval).toBe(true);
        expect(reg.get("shell_exec")?.requiresApproval).toBe(true);
        expect(reg.get("file_read")?.requiresApproval).toBeFalsy();
    });

    it("rejects duplicate registrations", () => {
        const reg = new ToolRegistry();
        const tool = { ...buildDefaultRegistry().get("file_read")! };
        reg.register(tool);
        expect(() => reg.register(tool)).toThrow(/already registered/);
    });
});
