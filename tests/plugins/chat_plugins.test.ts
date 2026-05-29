import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { ToolRegistry } from "../../src/chat/tools";
import { loadChatPlugins } from "../../src/plugins/chat_plugins";

describe("loadChatPlugins", () => {
    let cwd: string;
    let helixDir: string;
    let oldHelixDir: string | undefined;

    beforeEach(() => {
        cwd = fs.mkdtempSync(path.join(os.tmpdir(), "helix-plugin-"));
        helixDir = fs.mkdtempSync(path.join(os.tmpdir(), "helix-plugindir-"));
        oldHelixDir = process.env.HELIX_SETTINGS_DIR;
        process.env.HELIX_SETTINGS_DIR = helixDir;
    });

    afterEach(() => {
        fs.rmSync(cwd, { recursive: true, force: true });
        fs.rmSync(helixDir, { recursive: true, force: true });
        if (oldHelixDir) process.env.HELIX_SETTINGS_DIR = oldHelixDir;
        else delete process.env.HELIX_SETTINGS_DIR;
    });

    function makePlugin(rootDir: string, name: string, version: string, toolName: string): string {
        fs.mkdirSync(rootDir, { recursive: true });
        fs.writeFileSync(path.join(rootDir, "package.json"), JSON.stringify({
            name, version, main: "index.js",
        }));
        fs.writeFileSync(path.join(rootDir, "index.js"), `
            const plugin = {
                name: "${name}",
                version: "${version}",
                tools: [{
                    name: "${toolName}",
                    description: "Test tool",
                    parameters: { q: { type: "string", description: "query" } },
                    required: ["q"],
                    execute: async () => ({ success: true, output: "ok" }),
                }],
            };
            module.exports = { default: plugin };
        `);
        return rootDir;
    }

    it("loads a plugin from ~/.helix/plugins/<dir>", async () => {
        makePlugin(path.join(helixDir, "plugins", "demo"), "helix-tool-demo", "1.0.0", "demo_search");
        const registry = new ToolRegistry();
        const result = await loadChatPlugins(registry, cwd);
        expect(result.errors).toEqual([]);
        expect(result.added).toEqual(["demo_search"]);
        expect(registry.get("demo_search")).toBeDefined();
    });

    it("loads a plugin via package.json dependency name (helix-tool-*)", async () => {
        const pluginDir = path.join(cwd, "node_modules", "helix-tool-jira");
        makePlugin(pluginDir, "helix-tool-jira", "0.1.0", "jira_search");
        fs.writeFileSync(path.join(cwd, "package.json"), JSON.stringify({
            name: "host",
            dependencies: { "helix-tool-jira": "0.1.0" },
        }));

        const registry = new ToolRegistry();
        const result = await loadChatPlugins(registry, cwd);
        expect(result.errors).toEqual([]);
        expect(result.added).toContain("jira_search");
    });

    it("reports errors for invalid plugins without halting other loads", async () => {
        // Valid plugin
        makePlugin(path.join(helixDir, "plugins", "good"), "helix-tool-good", "1.0.0", "good_tool");
        // Broken plugin (missing tools array)
        const badDir = path.join(helixDir, "plugins", "bad");
        fs.mkdirSync(badDir, { recursive: true });
        fs.writeFileSync(path.join(badDir, "package.json"), JSON.stringify({ name: "helix-tool-bad", version: "1.0.0", main: "index.js" }));
        fs.writeFileSync(path.join(badDir, "index.js"), `module.exports = { default: { name: "helix-tool-bad", version: "1.0.0" } };`);

        const registry = new ToolRegistry();
        const result = await loadChatPlugins(registry, cwd);
        expect(result.added).toContain("good_tool");
        expect(result.errors.some(e => /bad/.test(e.source))).toBe(true);
    });

    it("does not double-register a tool that already exists", async () => {
        makePlugin(path.join(helixDir, "plugins", "demo"), "helix-tool-demo", "1.0.0", "shared_tool");
        const registry = new ToolRegistry();
        // Register a tool with the same name first
        registry.register({
            name: "shared_tool",
            description: "first wins",
            parameters: {},
            async execute() { return { success: true, output: "first" }; },
        });
        const result = await loadChatPlugins(registry, cwd);
        // The plugin loaded successfully, just didn't override.
        expect(result.errors).toEqual([]);
        expect(registry.get("shared_tool")?.description).toBe("first wins");
    });
});
