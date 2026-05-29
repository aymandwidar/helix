/**
 * Multi-server MCP registry.
 *
 * Reads server configs from settings.json and manages their lifecycle. Each
 * server is connected lazily on first use unless `autoConnect` is set.
 *
 * The registry is testable: pass `clientFactory` to swap in a fake transport.
 */

import { loadSettings, McpServerConfig } from "./config";
import { McpClientLike, StdioMcpClient, McpToolDescriptor, CallToolResult } from "./client";

export type McpClientFactory = (name: string, config: McpServerConfig) => McpClientLike;

export interface ServerStatus {
    name: string;
    connected: boolean;
    autoConnect: boolean;
    description?: string;
    error?: string;
    toolCount?: number;
}

export class McpRegistry {
    private clients = new Map<string, McpClientLike>();
    private errors = new Map<string, string>();

    constructor(
        private servers: Record<string, McpServerConfig>,
        private clientFactory: McpClientFactory = (name, config) => new StdioMcpClient(name, config)
    ) {}

    static fromSettings(settingsPath?: string, factory?: McpClientFactory): McpRegistry {
        const settings = loadSettings(settingsPath);
        return new McpRegistry(settings.mcpServers, factory);
    }

    listServerNames(): string[] {
        return Object.keys(this.servers);
    }

    getConfig(name: string): McpServerConfig | undefined {
        return this.servers[name];
    }

    /** Connect a server (idempotent). Throws if the server is unknown or fails. */
    async connect(name: string): Promise<McpClientLike> {
        const existing = this.clients.get(name);
        if (existing && existing.connected) return existing;

        const config = this.servers[name];
        if (!config) throw new Error(`Unknown MCP server: ${name}`);

        const client = existing ?? this.clientFactory(name, config);
        try {
            await client.connect();
            this.clients.set(name, client);
            this.errors.delete(name);
            return client;
        } catch (e: any) {
            this.errors.set(name, e?.message || String(e));
            throw e;
        }
    }

    /** Connect all servers marked autoConnect. Errors are stored, not thrown. */
    async connectAutoServers(): Promise<{ connected: string[]; failed: Array<{ name: string; error: string }> }> {
        const connected: string[] = [];
        const failed: Array<{ name: string; error: string }> = [];
        for (const [name, config] of Object.entries(this.servers)) {
            if (!config.autoConnect) continue;
            try {
                await this.connect(name);
                connected.push(name);
            } catch (e: any) {
                failed.push({ name, error: e?.message || String(e) });
            }
        }
        return { connected, failed };
    }

    async listTools(name: string): Promise<McpToolDescriptor[]> {
        const client = await this.connect(name);
        return client.listTools();
    }

    async callTool(name: string, toolName: string, args: Record<string, unknown>): Promise<CallToolResult> {
        const client = await this.connect(name);
        return client.callTool(toolName, args);
    }

    async status(): Promise<ServerStatus[]> {
        const out: ServerStatus[] = [];
        for (const [name, config] of Object.entries(this.servers)) {
            const client = this.clients.get(name);
            const status: ServerStatus = {
                name,
                connected: !!client?.connected,
                autoConnect: !!config.autoConnect,
                description: config.description,
                error: this.errors.get(name),
            };
            if (client?.connected) {
                try {
                    const tools = await client.listTools();
                    status.toolCount = tools.length;
                } catch (e: any) {
                    status.error = e?.message || String(e);
                }
            }
            out.push(status);
        }
        return out;
    }

    async closeAll(): Promise<void> {
        for (const client of this.clients.values()) {
            try { await client.close(); } catch { /* ignore */ }
        }
        this.clients.clear();
    }

    /** For tests: get the underlying client (connected or not). */
    getClient(name: string): McpClientLike | undefined {
        return this.clients.get(name);
    }
}
