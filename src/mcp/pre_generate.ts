/**
 * Pre-generate hook: query Cognitive Memory (CMM) for pitfalls and prior dead
 * ends relevant to the user's prompt before we generate a new app. The
 * findings are returned as a string suitable for inlining at the top of the
 * blueprint generation prompt.
 *
 * This module fails open: if no `memory`/`cmm` server is configured or it is
 * offline, we return an empty string and never throw. The goal is to enrich
 * generation when memory is available, never to block it.
 */

import { McpRegistry } from "./registry";
import { McpToolDescriptor } from "./client";

export interface PreGenerateFinding {
    server: string;
    tool: string;
    text: string;
}

export interface PreGenerateResult {
    findings: PreGenerateFinding[];
    contextBlock: string;
}

const MEMORY_NAME_PATTERNS = [/^memory$/i, /^cmm$/i, /memory/i, /cogn/i];

const PITFALL_TOOL_PATTERNS = [/^get_pitfalls$/i, /pitfall/i];
const SEARCH_TOOL_PATTERNS = [/^search_memory$/i, /^search$/i, /search.*memor/i];

export async function runPreGenerateCheck(prompt: string, registry?: McpRegistry): Promise<PreGenerateResult> {
    const empty: PreGenerateResult = { findings: [], contextBlock: "" };
    let mcp: McpRegistry;
    try {
        mcp = registry || McpRegistry.fromSettings();
    } catch {
        return empty;
    }

    const memoryServer = pickMemoryServer(mcp);
    if (!memoryServer) return empty;

    let tools: McpToolDescriptor[];
    try {
        await mcp.connect(memoryServer);
        tools = await mcp.listTools(memoryServer);
    } catch {
        return empty;
    }

    const pitfallTool = tools.find(t => PITFALL_TOOL_PATTERNS.some(p => p.test(t.name)));
    const searchTool = tools.find(t => SEARCH_TOOL_PATTERNS.some(p => p.test(t.name)));

    const findings: PreGenerateFinding[] = [];

    if (pitfallTool) {
        const text = await safeCall(mcp, memoryServer, pitfallTool.name, { topic: prompt, query: prompt });
        if (text) findings.push({ server: memoryServer, tool: pitfallTool.name, text });
    }
    if (searchTool) {
        const text = await safeCall(mcp, memoryServer, searchTool.name, { query: prompt });
        if (text) findings.push({ server: memoryServer, tool: searchTool.name, text });
    }

    return { findings, contextBlock: buildContextBlock(findings) };
}

function pickMemoryServer(mcp: McpRegistry): string | undefined {
    const names = mcp.listServerNames();
    for (const pattern of MEMORY_NAME_PATTERNS) {
        const match = names.find(n => pattern.test(n));
        if (match) return match;
    }
    return undefined;
}

async function safeCall(
    mcp: McpRegistry,
    server: string,
    tool: string,
    args: Record<string, unknown>
): Promise<string | null> {
    try {
        const result = await mcp.callTool(server, tool, args);
        if (result.isError) return null;
        const parts: string[] = [];
        for (const piece of result.content || []) {
            if (piece.type === "text" && typeof piece.text === "string") parts.push(piece.text);
        }
        const text = parts.join("\n").trim();
        return text || null;
    } catch {
        return null;
    }
}

function buildContextBlock(findings: PreGenerateFinding[]): string {
    if (findings.length === 0) return "";
    const blocks: string[] = ["## Cognitive memory — relevant prior knowledge"];
    for (const f of findings) {
        blocks.push(`### From ${f.server}.${f.tool}\n${f.text}`);
    }
    blocks.push("Use this context to avoid repeating known dead-ends and to apply known pitfalls.");
    return blocks.join("\n\n");
}
