import { describe, it, expect } from "vitest";
import { McpRegistry } from "../../src/mcp/registry";
import { CouncilClient } from "../../src/council";
import { FakeMcpClient } from "../mcp/_fake_client";

describe("CouncilClient", () => {
    it("availability returns false when no Council server is configured", async () => {
        const reg = new McpRegistry({});
        const client = new CouncilClient({ registry: reg });
        const a = await client.availability();
        expect(a.available).toBe(false);
    });

    it("availability lists tools when Council is up", async () => {
        const fake = new FakeMcpClient("council", {
            tools: [
                { name: "deliberate", inputSchema: { type: "object" } },
                { name: "list_models", inputSchema: { type: "object" } },
            ],
        });
        const reg = new McpRegistry({ council: { command: "x" } }, () => fake);
        const client = new CouncilClient({ registry: reg });
        const a = await client.availability();
        expect(a.available).toBe(true);
        expect(a.tools).toContain("deliberate");
    });

    it("deliberate parses a JSON verdict response", async () => {
        const fake = new FakeMcpClient("council", {
            tools: [{ name: "deliberate", inputSchema: { type: "object" } }],
            handlers: {
                deliberate: () => ({
                    content: [{ type: "text", text: JSON.stringify({
                        verdict: "Use Postgres",
                        consensus: 0.9,
                        models: ["claude", "gpt"],
                        opinions: [{ model: "claude", response: "yes", confidence: 0.9 }],
                    }) }],
                }),
            },
        });
        const reg = new McpRegistry({ council: { command: "x" } }, () => fake);
        const client = new CouncilClient({ registry: reg });
        const v = await client.deliberate("Postgres or MongoDB?");
        expect(v.verdict).toBe("Use Postgres");
        expect(v.consensus).toBe(0.9);
        expect(v.opinions).toHaveLength(1);
    });

    it("deliberate falls back to plain-text wrapping when response is not JSON", async () => {
        const fake = new FakeMcpClient("council", {
            tools: [{ name: "deliberate", inputSchema: { type: "object" } }],
            handlers: { deliberate: () => ({ content: [{ type: "text", text: "Pick Postgres." }] }) },
        });
        const reg = new McpRegistry({ council: { command: "x" } }, () => fake);
        const client = new CouncilClient({ registry: reg });
        const v = await client.deliberate("?");
        expect(v.verdict).toBe("Pick Postgres.");
        expect(v.opinions).toEqual([]);
    });

    it("deliberate throws when the server returns isError", async () => {
        const fake = new FakeMcpClient("council", {
            tools: [{ name: "deliberate", inputSchema: { type: "object" } }],
            handlers: { deliberate: () => ({ content: [{ type: "text", text: "rate limit" }], isError: true }) },
        });
        const reg = new McpRegistry({ council: { command: "x" } }, () => fake);
        const client = new CouncilClient({ registry: reg });
        await expect(client.deliberate("?")).rejects.toThrow(/rate limit/);
    });

    it("listModels parses both array and object forms", async () => {
        const fake = new FakeMcpClient("council", {
            tools: [{ name: "list_models", inputSchema: { type: "object" } }],
            handlers: { list_models: () => ({ content: [{ type: "text", text: JSON.stringify(["a", "b", "c"]) }] }) },
        });
        const reg = new McpRegistry({ council: { command: "x" } }, () => fake);
        const client = new CouncilClient({ registry: reg });
        expect(await client.listModels()).toEqual(["a", "b", "c"]);
    });
});
