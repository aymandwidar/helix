import { describe, it, expect } from "vitest";
import { McpRegistry } from "../../src/mcp/registry";
import { runPreGenerateCheck } from "../../src/mcp/pre_generate";
import { FakeMcpClient } from "./_fake_client";

describe("runPreGenerateCheck", () => {
    it("returns empty result when no memory server is configured", async () => {
        const reg = new McpRegistry({}, () => { throw new Error("not used"); });
        const result = await runPreGenerateCheck("anything", reg);
        expect(result.findings).toEqual([]);
        expect(result.contextBlock).toBe("");
    });

    it("queries pitfalls and search_memory when both are exposed", async () => {
        const fake = new FakeMcpClient("memory", {
            tools: [
                { name: "get_pitfalls", inputSchema: { type: "object" } },
                { name: "search_memory", inputSchema: { type: "object" } },
            ],
            handlers: {
                get_pitfalls: () => ({ content: [{ type: "text", text: "Don't use X with Y" }] }),
                search_memory: () => ({ content: [{ type: "text", text: "Past attempt failed because Z" }] }),
            },
        });
        const reg = new McpRegistry({ memory: { command: "x" } }, () => fake);
        const result = await runPreGenerateCheck("a habit tracker app", reg);

        expect(result.findings.length).toBe(2);
        expect(result.contextBlock).toContain("Don't use X with Y");
        expect(result.contextBlock).toContain("Past attempt failed because Z");

        expect(fake.callLog.find(c => c.tool === "get_pitfalls")).toBeTruthy();
        expect(fake.callLog.find(c => c.tool === "search_memory")).toBeTruthy();
    });

    it("fails open if a tool call throws", async () => {
        const fake = new FakeMcpClient("memory", {
            tools: [{ name: "search_memory", inputSchema: { type: "object" } }],
            handlers: { search_memory: () => { throw new Error("boom"); } },
        });
        const reg = new McpRegistry({ memory: { command: "x" } }, () => fake);
        const result = await runPreGenerateCheck("anything", reg);
        expect(result.findings).toEqual([]);
    });

    it("ignores servers whose name does not look like memory/cmm", async () => {
        const fake = new FakeMcpClient("council", {
            tools: [{ name: "search_memory", inputSchema: { type: "object" } }],
        });
        const reg = new McpRegistry({ council: { command: "x" } }, () => fake);
        const result = await runPreGenerateCheck("anything", reg);
        expect(result.findings).toEqual([]);
    });
});
