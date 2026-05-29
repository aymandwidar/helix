import { ToolDefinition } from "./index";

export const evolveAppTool: ToolDefinition = {
    name: "evolve_app",
    description: "Run the Helix evolve engine on the current project (scan / suggest / apply / security-audit).",
    parameters: {
        action: { type: "string", description: "Evolve action.", enum: ["scan", "suggest", "apply", "security-audit"], default: "scan" },
        category: { type: "string", description: "Optional category filter.", default: "" },
        path: { type: "string", description: "Project path.", default: "" },
    },
    requiresApproval: true,
    mutatesFiles: (args) => {
        const action = String((args as any).action || "scan");
        // Only `apply` actually mutates files; scan/suggest/audit are read-only.
        return action === "apply" ? [] : [];
    },
    async execute(args, ctx) {
        const action = String(args.action || "scan");
        const category = String(args.category || "") || undefined;
        const projectPath = String(args.path || "") || ctx.cwd;

        try {
            const { evolveCodebase } = await import("../../commands/evolve");
            await evolveCodebase(action, category, projectPath);
            return { success: true, output: `evolve ${action} complete (${projectPath})` };
        } catch (err: any) {
            return { success: false, output: "", error: err?.message || String(err) };
        }
    },
};
