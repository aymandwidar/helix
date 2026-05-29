/**
 * Bridge MCP tools into the chat agent's ToolRegistry.
 *
 * Each MCP server's tools become Helix tools with the name prefix
 * `mcp__<server>__<tool>` (matching Claude Code / Gemini CLI conventions).
 * Calls are routed through the McpRegistry; results are converted from MCP
 * `content` array form into the plain text shape Helix tools return.
 */

import { ToolDefinition, ToolParam, ToolRegistry } from "../chat/tools";
import { McpRegistry } from "./registry";
import { McpToolDescriptor, CallToolResult } from "./client";

export function bridgeMcpTool(
    serverName: string,
    descriptor: McpToolDescriptor,
    registry: McpRegistry
): ToolDefinition {
    const helixName = `mcp__${sanitizeName(serverName)}__${sanitizeName(descriptor.name)}`;
    const params = mapMcpSchema(descriptor.inputSchema);
    const required = Array.isArray(descriptor.inputSchema?.required)
        ? descriptor.inputSchema.required
        : [];

    return {
        name: helixName,
        description: descriptor.description
            ? `[${serverName}] ${descriptor.description}`
            : `[${serverName}] ${descriptor.name}`,
        parameters: params,
        required,
        // MCP tools may mutate state (write to memory stores, etc). Treat them
        // as approval-required by default; CMM-style read tools commonly used
        // in pre-generation hooks should be added to AUTO_APPROVE_PATTERNS.
        requiresApproval: !isReadOnly(descriptor.name),
        async execute(args, _ctx) {
            try {
                const result = await registry.callTool(serverName, descriptor.name, args);
                return formatMcpResult(result);
            } catch (err: any) {
                return { success: false, output: "", error: err?.message || String(err) };
            }
        },
    };
}

/** Connect each autoConnect server, list its tools, and add bridged copies to the registry. */
export async function bridgeAllAutoServers(
    mcpRegistry: McpRegistry,
    toolRegistry: ToolRegistry
): Promise<{ added: string[]; errors: Array<{ server: string; error: string }> }> {
    const auto = await mcpRegistry.connectAutoServers();
    const added: string[] = [];
    const errors: Array<{ server: string; error: string }> = [...auto.failed.map(f => ({ server: f.name, error: f.error }))];

    for (const serverName of auto.connected) {
        try {
            const tools = await mcpRegistry.listTools(serverName);
            for (const descriptor of tools) {
                const bridged = bridgeMcpTool(serverName, descriptor, mcpRegistry);
                if (toolRegistry.get(bridged.name)) continue; // skip duplicates on re-bridge
                toolRegistry.register(bridged);
                added.push(bridged.name);
            }
        } catch (e: any) {
            errors.push({ server: serverName, error: e?.message || String(e) });
        }
    }
    return { added, errors };
}

function sanitizeName(s: string): string {
    return s.replace(/[^a-zA-Z0-9_]/g, "_");
}

function mapMcpSchema(schema: McpToolDescriptor["inputSchema"]): Record<string, ToolParam> {
    const out: Record<string, ToolParam> = {};
    const props = schema?.properties || {};
    for (const [key, raw] of Object.entries(props)) {
        const def = raw as any;
        out[key] = {
            type: normalizeType(def?.type),
            description: typeof def?.description === "string" ? def.description : "",
            ...(Array.isArray(def?.enum) ? { enum: def.enum } : {}),
            ...(def?.items ? { items: def.items } : {}),
            ...(def?.default !== undefined ? { default: def.default } : {}),
        };
    }
    return out;
}

function normalizeType(t: unknown): ToolParam["type"] {
    if (t === "string" || t === "number" || t === "boolean" || t === "object" || t === "array") return t;
    if (Array.isArray(t)) {
        const filtered = t.find(x => ["string", "number", "boolean", "object", "array"].includes(x));
        if (filtered) return filtered as ToolParam["type"];
    }
    return "string";
}

function formatMcpResult(result: CallToolResult): { success: boolean; output: string; error?: string } {
    const parts: string[] = [];
    for (const piece of result.content || []) {
        if (piece.type === "text" && typeof piece.text === "string") {
            parts.push(piece.text);
        } else if (piece.type === "resource" && piece.text) {
            parts.push(String(piece.text));
        } else {
            parts.push(JSON.stringify(piece));
        }
    }
    const output = parts.join("\n");
    if (result.isError) {
        return { success: false, output: "", error: output || "MCP tool returned an error" };
    }
    return { success: true, output };
}

const READ_ONLY_PATTERNS = [
    /^get_/, /^list_/, /^search_/, /^fetch_/, /^read_/, /^find_/, /^show_/, /^describe_/,
];

function isReadOnly(toolName: string): boolean {
    return READ_ONLY_PATTERNS.some(p => p.test(toolName));
}
