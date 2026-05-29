import { describe, it, expect } from "vitest";
import { McpRegistry } from "../../src/mcp/registry";
import { FakeMcpClient } from "./_fake_client";

describe("McpRegistry", () => {
    it("connect() instantiates and connects via the factory", async () => {
        const fake = new FakeMcpClient("memory", { tools: [{ name: "search_memory", inputSchema: { type: "object" } }] });
        const reg = new McpRegistry({ memory: { command: "x", autoConnect: true } }, () => fake);
        await reg.connect("memory");
        expect(fake.connected).toBe(true);
    });

    it("unknown server throws", async () => {
        const reg = new McpRegistry({});
        await expect(reg.connect("nope")).rejects.toThrow(/Unknown/);
    });

    it("connectAutoServers connects only autoConnect=true entries", async () => {
        const a = new FakeMcpClient("a", { tools: [] });
        const b = new FakeMcpClient("b", { tools: [] });
        const factory = (name: string) => name === "a" ? a : b;
        const reg = new McpRegistry({
            a: { command: "x", autoConnect: true },
            b: { command: "x", autoConnect: false },
        }, factory);
        const result = await reg.connectAutoServers();
        expect(result.connected).toEqual(["a"]);
        expect(a.connected).toBe(true);
        expect(b.connected).toBe(false);
    });

    it("connectAutoServers records failures without throwing", async () => {
        const fake = new FakeMcpClient("memory", { tools: [], failOnConnect: "boom" });
        const reg = new McpRegistry({ memory: { command: "x", autoConnect: true } }, () => fake);
        const result = await reg.connectAutoServers();
        expect(result.connected).toEqual([]);
        expect(result.failed).toEqual([{ name: "memory", error: "boom" }]);
    });

    it("status reports tool count for connected servers", async () => {
        const fake = new FakeMcpClient("memory", {
            tools: [
                { name: "search_memory", inputSchema: { type: "object" } },
                { name: "store_memory", inputSchema: { type: "object" } },
            ],
        });
        const reg = new McpRegistry({ memory: { command: "x" } }, () => fake);
        await reg.connect("memory");
        const status = await reg.status();
        expect(status[0].connected).toBe(true);
        expect(status[0].toolCount).toBe(2);
    });

    it("callTool routes to the right server", async () => {
        const fake = new FakeMcpClient("memory", {
            tools: [{ name: "echo", inputSchema: { type: "object" } }],
            handlers: { echo: (args) => ({ content: [{ type: "text", text: JSON.stringify(args) }] }) },
        });
        const reg = new McpRegistry({ memory: { command: "x" } }, () => fake);
        const result = await reg.callTool("memory", "echo", { hi: 1 });
        expect((result.content[0] as any).text).toContain('"hi":1');
    });
});
