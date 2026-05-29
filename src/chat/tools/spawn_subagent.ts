import { ToolDefinition } from "./index";

/**
 * Spawn one or more subagents in parallel to handle independent sub-tasks.
 *
 * Each subagent runs an isolated agent loop with the same tool registry and
 * returns its final text. Use this to fan out research, audits, or
 * cross-cutting analyses without polluting the main conversation.
 */
export const spawnSubagentTool: ToolDefinition = {
    name: "spawn_subagent",
    description: "Run one or more subagents in parallel for independent sub-tasks. Each subagent has an isolated context but shares this conversation's tools. Returns each subagent's final text.",
    parameters: {
        tasks: {
            type: "array",
            description: "List of subagent tasks. Each item: { prompt: string, label?: string, system_suffix?: string, max_iterations?: number }.",
            items: { type: "object" },
        },
        require_approval: {
            type: "boolean",
            description: "If true, subagents must obtain user approval for destructive tools. Default false (subagents auto-approve since no human is in the loop).",
            default: false,
        },
    },
    required: ["tasks"],
    requiresApproval: true,
    async execute(args, ctx) {
        const rawTasks = args.tasks;
        if (!Array.isArray(rawTasks) || rawTasks.length === 0) {
            return { success: false, output: "", error: "tasks must be a non-empty array" };
        }
        if (rawTasks.length > 8) {
            return { success: false, output: "", error: "max 8 subagents per spawn call" };
        }
        const requireApproval = Boolean(args.require_approval);

        const tasks = rawTasks.map((t: any, i: number) => ({
            label: typeof t.label === "string" ? t.label : `task-${i + 1}`,
            prompt: typeof t.prompt === "string" ? t.prompt : String(t),
            systemSuffix: typeof t.system_suffix === "string" ? t.system_suffix : undefined,
            maxIterations: typeof t.max_iterations === "number" ? t.max_iterations : undefined,
            model: typeof t.model === "string" ? t.model : undefined,
        }));

        const { runSubagentsParallel } = await import("../subagent");
        const { buildDefaultRegistry } = await import("./index");

        const registry = buildDefaultRegistry();
        const results = await runSubagentsParallel(tasks, {
            cwd: ctx.cwd,
            registry,
            requireApproval,
        });

        const lines = results.map(r => {
            const head = r.error ? `✗ ${r.label}: ${r.error}` : `✓ ${r.label} (${r.iterations} iter, ${r.toolCalls} tool calls)`;
            return `${head}\n${r.finalText}`;
        });
        return { success: true, output: lines.join("\n\n---\n\n") };
    },
};
