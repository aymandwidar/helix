/**
 * Lightweight wrapper around @modelcontextprotocol/sdk's Client + StdioClientTransport.
 *
 * Each instance manages a single stdio MCP server (e.g. CMM, Council). The
 * SDK is loaded lazily so the rest of Helix doesn't pay the import cost when
 * MCP isn't being used.
 */

import { McpServerConfig } from "./config";

export interface McpToolDescriptor {
    name: string;
    description?: string;
    inputSchema: {
        type: "object";
        properties?: Record<string, any>;
        required?: string[];
    };
}

export interface CallToolResult {
    content: Array<{ type: string; text?: string; [k: string]: any }>;
    isError?: boolean;
}

export interface McpClientLike {
    connect(): Promise<void>;
    listTools(): Promise<McpToolDescriptor[]>;
    callTool(name: string, args: Record<string, unknown>): Promise<CallToolResult>;
    close(): Promise<void>;
    readonly connected: boolean;
}

export class StdioMcpClient implements McpClientLike {
    public connected = false;
    private client: any = null;
    private transport: any = null;

    constructor(public readonly name: string, public readonly config: McpServerConfig) {}

    async connect(): Promise<void> {
        if (this.connected) return;
        const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
        const { StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js");

        this.transport = new StdioClientTransport({
            command: this.config.command,
            args: this.config.args || [],
            env: { ...process.env, ...(this.config.env || {}) } as Record<string, string>,
            cwd: this.config.cwd,
        });

        this.client = new Client(
            { name: "helix-cli", version: "14.1.0" },
            { capabilities: {} }
        );
        await this.client.connect(this.transport);
        this.connected = true;
    }

    async listTools(): Promise<McpToolDescriptor[]> {
        if (!this.connected) throw new Error(`MCP server '${this.name}' is not connected`);
        const result = await this.client.listTools();
        return (result.tools || []) as McpToolDescriptor[];
    }

    async callTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
        if (!this.connected) throw new Error(`MCP server '${this.name}' is not connected`);
        const result = await this.client.callTool({ name, arguments: args });
        return result as CallToolResult;
    }

    async close(): Promise<void> {
        if (!this.connected) return;
        try {
            await this.client.close();
        } catch {
            // ignore close errors
        }
        this.connected = false;
        this.client = null;
        this.transport = null;
    }
}
