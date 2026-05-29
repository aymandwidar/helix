/**
 * Council deliberation client.
 *
 * Wraps the Council MCP server (configured under `~/.helix/settings.json` as
 * an `mcpServers` entry). Falls back gracefully — if Council isn't
 * configured or fails to connect, callers get a structured `available: false`
 * answer rather than a crash.
 */

import { McpRegistry } from "../mcp/registry";
import { McpToolDescriptor } from "../mcp/client";
import { CouncilVerdict, CouncilPreset, DeliberateOptions } from "./types";

export interface CouncilAvailability {
    available: boolean;
    server?: string;
    reason?: string;
    tools?: string[];
}

export interface CouncilClientOptions {
    /** Provide an existing registry (for tests). */
    registry?: McpRegistry;
    /** Override server name detection (e.g. "council-prod"). */
    serverName?: string;
}

/**
 * Patterns the client uses to identify which configured MCP server is the
 * Council. Falls through if none matches.
 */
const COUNCIL_NAME_PATTERNS = [/^council$/i, /council/i];

const TOOL_DELIBERATE = ["deliberate", "council_deliberate", "ask_council"];
const TOOL_LIST_MODELS = ["list_models", "council_list_models", "models"];
const TOOL_GET_HISTORY = ["get_history", "council_history", "history"];
const TOOL_GET_PRESETS = ["get_presets", "council_presets", "presets"];
const TOOL_GET_GUIDE = ["get_guide", "council_guide", "guide"];

export class CouncilClient {
    constructor(private options: CouncilClientOptions = {}) {}

    private getRegistry(): McpRegistry {
        if (this.options.registry) return this.options.registry;
        return McpRegistry.fromSettings();
    }

    pickServer(registry: McpRegistry): string | undefined {
        if (this.options.serverName) {
            return registry.listServerNames().includes(this.options.serverName)
                ? this.options.serverName
                : undefined;
        }
        const names = registry.listServerNames();
        for (const pattern of COUNCIL_NAME_PATTERNS) {
            const match = names.find(n => pattern.test(n));
            if (match) return match;
        }
        return undefined;
    }

    /** Probe whether Council is reachable and which tools it exposes. */
    async availability(): Promise<CouncilAvailability> {
        let registry: McpRegistry;
        try {
            registry = this.getRegistry();
        } catch (e: any) {
            return { available: false, reason: e?.message || String(e) };
        }
        const server = this.pickServer(registry);
        if (!server) {
            return { available: false, reason: "No Council MCP server configured. Add one with: helix mcp add council --command ..." };
        }
        try {
            await registry.connect(server);
            const tools = await registry.listTools(server);
            return { available: true, server, tools: tools.map(t => t.name) };
        } catch (e: any) {
            return { available: false, server, reason: e?.message || String(e) };
        }
    }

    async deliberate(question: string, opts: DeliberateOptions = {}): Promise<CouncilVerdict> {
        const { server, registry, tool } = await this.requireTool(TOOL_DELIBERATE, "deliberate");
        const args: Record<string, unknown> = { question };
        if (opts.preset) args.preset = opts.preset;
        if (opts.models) args.models = opts.models;
        if (opts.maxTokens) args.max_tokens = opts.maxTokens;

        const result = await registry.callTool(server, tool, args);
        if (result.isError) {
            const text = (result.content || []).map(p => p.text || "").join("\n");
            throw new Error(`Council deliberation failed: ${text || "unknown error"}`);
        }
        return parseVerdict(result.content || []);
    }

    async listModels(): Promise<string[]> {
        const { server, registry, tool } = await this.requireTool(TOOL_LIST_MODELS, "list_models");
        const result = await registry.callTool(server, tool, {});
        return parseStringList(result.content || []);
    }

    async getPresets(): Promise<CouncilPreset[]> {
        const { server, registry, tool } = await this.requireTool(TOOL_GET_PRESETS, "get_presets");
        const result = await registry.callTool(server, tool, {});
        return parsePresets(result.content || []);
    }

    async getHistory(limit = 10): Promise<Array<{ question: string; verdict: string; at?: string }>> {
        const { server, registry, tool } = await this.requireTool(TOOL_GET_HISTORY, "get_history");
        const result = await registry.callTool(server, tool, { limit });
        return parseHistory(result.content || []);
    }

    async getGuide(): Promise<string> {
        const { server, registry, tool } = await this.requireTool(TOOL_GET_GUIDE, "get_guide");
        const result = await registry.callTool(server, tool, {});
        return (result.content || []).map(p => (p as any).text || "").join("\n").trim();
    }

    private async requireTool(
        candidates: string[],
        label: string
    ): Promise<{ server: string; registry: McpRegistry; tool: string }> {
        const registry = this.getRegistry();
        const server = this.pickServer(registry);
        if (!server) throw new Error("No Council server configured.");
        await registry.connect(server);
        const tools = await registry.listTools(server);
        const match = tools.find(t => candidates.includes(t.name))
            || tools.find(t => candidates.some(c => t.name.toLowerCase().includes(c.split("_")[0])));
        if (!match) {
            const available = tools.map((t: McpToolDescriptor) => t.name).join(", ");
            throw new Error(`Council server '${server}' does not expose a '${label}' tool. Available: ${available || "(none)"}`);
        }
        return { server, registry, tool: match.name };
    }
}

// ─── Parsers ──────────────────────────────────────────────────────────────

function parseVerdict(content: Array<any>): CouncilVerdict {
    const text = content.map(p => p.text || "").join("\n").trim();
    const json = tryExtractJson(text);
    if (json && typeof json === "object" && !Array.isArray(json)) {
        return normalizeVerdict(json);
    }
    // Plain-text fallback — wrap as a single-opinion verdict
    return {
        verdict: text || "(empty response)",
        opinions: [],
    };
}

function normalizeVerdict(parsed: any): CouncilVerdict {
    const opinions = Array.isArray(parsed.opinions)
        ? parsed.opinions.filter((o: any) => o && (o.model || o.response)).map((o: any) => ({
            model: String(o.model || "unknown"),
            response: String(o.response || o.answer || ""),
            confidence: typeof o.confidence === "number" ? o.confidence : undefined,
            reasoning: typeof o.reasoning === "string" ? o.reasoning : undefined,
        }))
        : [];
    return {
        verdict: typeof parsed.verdict === "string" ? parsed.verdict
            : typeof parsed.synthesis === "string" ? parsed.synthesis
            : "",
        consensus: typeof parsed.consensus === "number" ? parsed.consensus : undefined,
        opinions,
        models: Array.isArray(parsed.models) ? parsed.models.map(String) : undefined,
        preset: typeof parsed.preset === "string" ? parsed.preset : undefined,
        synthesis: typeof parsed.synthesis === "string" ? parsed.synthesis : undefined,
    };
}

function parseStringList(content: Array<any>): string[] {
    const text = content.map(p => p.text || "").join("\n").trim();
    const json = tryExtractJson(text);
    if (Array.isArray(json)) return json.map(String);
    if (json && Array.isArray((json as any).models)) return (json as any).models.map(String);
    return text.split("\n").map(l => l.trim()).filter(Boolean);
}

function parsePresets(content: Array<any>): CouncilPreset[] {
    const text = content.map(p => p.text || "").join("\n").trim();
    const json = tryExtractJson(text);
    const list = Array.isArray(json) ? json : Array.isArray((json as any)?.presets) ? (json as any).presets : [];
    return list
        .filter((p: any) => p && p.name)
        .map((p: any) => ({ name: String(p.name), description: p.description, models: p.models }));
}

function parseHistory(content: Array<any>): Array<{ question: string; verdict: string; at?: string }> {
    const text = content.map(p => p.text || "").join("\n").trim();
    const json = tryExtractJson(text);
    const list = Array.isArray(json) ? json : Array.isArray((json as any)?.history) ? (json as any).history : [];
    return list.map((h: any) => ({
        question: String(h.question || h.q || ""),
        verdict: String(h.verdict || h.answer || ""),
        at: h.at || h.timestamp,
    }));
}

function tryExtractJson(text: string): unknown {
    if (!text) return null;
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const candidate = fenced ? fenced[1].trim() : text;
    const open = candidate.indexOf("{");
    const close = candidate.lastIndexOf("}");
    const arrOpen = candidate.indexOf("[");
    const arrClose = candidate.lastIndexOf("]");
    let slice = candidate;
    if (open !== -1 && close > open) slice = candidate.slice(open, close + 1);
    else if (arrOpen !== -1 && arrClose > arrOpen) slice = candidate.slice(arrOpen, arrClose + 1);
    try { return JSON.parse(slice); } catch { return null; }
}

export { parseVerdict, normalizeVerdict, parseStringList, parsePresets, parseHistory };
