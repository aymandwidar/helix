/**
 * Tool registry for the chat agent.
 *
 * A `Tool` is a self-describing function the model can invoke. Tools may
 * declare `requiresApproval = true` so the REPL prompts the user before
 * executing destructive operations, and `mutatesFiles` so the agent loop knows
 * to checkpoint before invoking them.
 */

import { ToolSchema } from "../../openrouter";

export interface ToolParam {
    type: "string" | "number" | "boolean" | "object" | "array";
    description: string;
    enum?: string[];
    items?: { type: string };
    default?: unknown;
}

export interface ToolDefinition {
    name: string;
    description: string;
    parameters: Record<string, ToolParam>;
    required?: string[];
    requiresApproval?: boolean;
    mutatesFiles?: boolean | ((args: Record<string, unknown>) => string[]);
    execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}

export interface ToolContext {
    cwd: string;
}

export interface ToolResult {
    success: boolean;
    output: string;
    error?: string;
    /** Optional diff to render after the tool runs. */
    diff?: { oldText: string; newText: string; filename: string };
}

export class ToolRegistry {
    private tools = new Map<string, ToolDefinition>();

    register(tool: ToolDefinition): void {
        if (this.tools.has(tool.name)) {
            throw new Error(`Tool already registered: ${tool.name}`);
        }
        this.tools.set(tool.name, tool);
    }

    get(name: string): ToolDefinition | undefined {
        return this.tools.get(name);
    }

    list(): ToolDefinition[] {
        return [...this.tools.values()];
    }

    /** Convert tool definitions to OpenRouter/OpenAI tool schemas. */
    getToolSchemas(): ToolSchema[] {
        return this.list().map(tool => ({
            type: "function" as const,
            function: {
                name: tool.name,
                description: tool.description,
                parameters: {
                    type: "object" as const,
                    properties: Object.fromEntries(
                        Object.entries(tool.parameters).map(([key, param]) => {
                            const prop: Record<string, unknown> = {
                                type: param.type,
                                description: param.description,
                            };
                            if (param.enum) prop.enum = param.enum;
                            if (param.items) prop.items = param.items;
                            if (param.default !== undefined) prop.default = param.default;
                            return [key, prop];
                        })
                    ),
                    required: tool.required || [],
                },
            },
        }));
    }

    /**
     * Compute which absolute file paths a tool will mutate, given its args.
     * Used for checkpoint creation. Returns an empty array if the tool is
     * non-mutating.
     */
    affectedFiles(tool: ToolDefinition, args: Record<string, unknown>): string[] {
        if (!tool.mutatesFiles) return [];
        if (tool.mutatesFiles === true) return [];
        return tool.mutatesFiles(args);
    }
}

import { fileReadTool } from "./file_read";
import { fileWriteTool } from "./file_write";
import { fileEditTool } from "./file_edit";
import { shellExecTool } from "./shell_exec";
import { webFetchTool } from "./web_fetch";
import { listDirTool } from "./list_dir";
import { searchFilesTool } from "./search_files";
import { spawnAppTool } from "./spawn_app";
import { evolveAppTool } from "./evolve_app";
import { deployAppTool } from "./deploy_app";

export function buildDefaultRegistry(): ToolRegistry {
    const reg = new ToolRegistry();
    reg.register(fileReadTool);
    reg.register(fileWriteTool);
    reg.register(fileEditTool);
    reg.register(shellExecTool);
    reg.register(webFetchTool);
    reg.register(listDirTool);
    reg.register(searchFilesTool);
    reg.register(spawnAppTool);
    reg.register(evolveAppTool);
    reg.register(deployAppTool);
    return reg;
}

export { ToolDefinition as Tool };
