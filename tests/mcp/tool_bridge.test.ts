import { describe, it, expect } from "vitest";
import { McpRegistry } from "../../src/mcp/registry";
import { ToolRegistry } from "../../src/chat/tools";
import { bridgeMcpTool, bridgeAllAutoServers } from "../../src/mcp/tool_bridge";
import { FakeMcpClient } from "./_fake_client";

describe("bridgeMcpTool", () => {
    it("creates a Helix tool with the mcp__server__name prefix", async () => {
        const fake = new FakeMcpClient("memory", {
            tools: [{ name: "search_memory", description: "Search", inputSchema: { type: "object", properties: { query: { type: "string", description: "q" } }, required: ["query"] } }],
            handlers: { search_memory: () => ({ content: [{ type: "text", text: "found 3 entries" }] }) },
        });
        const reg = new McpRegistry({ memory: { command: "x", autoConnect: true } }, () => fake);
        await reg.connect("memory");

        const descriptors = await reg.listTools("memory");
        const helixTool = bridgeMcpTool("memory", descriptors[0], reg);

        expect(helixTool.name).toBe("mcp__memory__search_memory");
        expect(helixTool.description).toContain("[memory]");
        expect(helixTool.parameters.query.type).toBe("string");
        expect(helixTool.required).toEqual(["query"]);
        // search_memory matches the read-only pattern → no approval required.
        expect(helixTool.requiresApproval).toBe(false);

        const result = await helixTool.execute({ query: "x" }, { cwd: process.cwd() });
        expect(result.success).toBe(true);
        expect(result.output).toContain("found 3 entries");
    });

    it("write-style tools require approval by default", async () => {
        const fake = new FakeMcpClient("memory", {
            tools: [{ name: "store_memory", inputSchema: { type: "object" } }],
        });
        const reg = new McpRegistry({ memory: { command: "x" } }, () => fake);
        await reg.connect("memory");
        const helixTool = bridgeMcpTool("memory", (await reg.listTools("memory"))[0], reg);
        expect(helixTool.requiresApproval).toBe(true);
    });

    it("bridgeAllAutoServers registers tools in the chat registry", async () => {
        const fake = new FakeMcpClient("memory", {
            tools: [{ name: "search_memory", inputSchema: { type: "object" } }],
        });
        const mcp = new McpRegistry({ memory: { command: "x", autoConnect: true } }, () => fake);
        const tools = new ToolRegistry();
        const result = await bridgeAllAutoServers(mcp, tools);
        expect(result.added).toEqual(["mcp__memory__search_memory"]);
        expect(tools.get("mcp__memory__search_memory")).toBeDefined();
    });

    it("formats isError responses as failures", async () => {
        const fake = new FakeMcpClient("memory", {
            tools: [{ name: "search_memory", inputSchema: { type: "object" } }],
            handlers: { search_memory: () => ({ content: [{ type: "text", text: "oops" }], isError: true }) },
        });
        const reg = new McpRegistry({ memory: { command: "x" } }, () => fake);
        await reg.connect("memory");
        const tool = bridgeMcpTool("memory", (await reg.listTools("memory"))[0], reg);
        const result = await tool.execute({}, { cwd: process.cwd() });
        expect(result.success).toBe(false);
        expect(result.error).toContain("oops");
    });
});
