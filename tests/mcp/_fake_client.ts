import { McpClientLike, McpToolDescriptor, CallToolResult } from "../../src/mcp/client";

export interface FakeBehavior {
    tools: McpToolDescriptor[];
    /** Map of toolName -> handler returning content. */
    handlers?: Record<string, (args: Record<string, unknown>) => Promise<CallToolResult> | CallToolResult>;
    /** Force connect() to throw with this message. */
    failOnConnect?: string;
}

export class FakeMcpClient implements McpClientLike {
    public connected = false;
    public callLog: Array<{ tool: string; args: Record<string, unknown> }> = [];

    constructor(public readonly name: string, public behavior: FakeBehavior) {}

    async connect(): Promise<void> {
        if (this.behavior.failOnConnect) {
            throw new Error(this.behavior.failOnConnect);
        }
        this.connected = true;
    }

    async listTools(): Promise<McpToolDescriptor[]> {
        return this.behavior.tools;
    }

    async callTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
        this.callLog.push({ tool: name, args });
        const handler = this.behavior.handlers?.[name];
        if (!handler) {
            return { content: [{ type: "text", text: `(no handler for ${name})` }] };
        }
        return handler(args);
    }

    async close(): Promise<void> {
        this.connected = false;
    }
}
