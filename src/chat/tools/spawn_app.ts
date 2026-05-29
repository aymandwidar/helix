import { ToolDefinition } from "./index";

export const spawnAppTool: ToolDefinition = {
    name: "spawn_app",
    description: "Generate a new full-stack application from a natural-language prompt (wraps `helix spawn`). Use only when the user clearly asks to scaffold a new app.",
    parameters: {
        prompt: { type: "string", description: "Natural language description of the app to generate." },
        target: { type: "string", description: "Target platform.", enum: ["web", "flutter"], default: "web" },
        theme: { type: "string", description: "UI theme.", default: "glassmorphism" },
        db: { type: "string", description: "Database (postgres, sqlite, supabase, etc.).", default: "" },
        dry_run: { type: "boolean", description: "Show plan without generating.", default: true },
    },
    required: ["prompt"],
    requiresApproval: true,
    mutatesFiles: true,
    async execute(args) {
        const prompt = String(args.prompt || "");
        const target = String(args.target || "web");
        const theme = String(args.theme || "glassmorphism");
        const db = String(args.db || "");
        const dryRun = args.dry_run !== false; // default true for safety

        if (!prompt) {
            return { success: false, output: "", error: "prompt is required" };
        }

        try {
            if (target === "flutter") {
                if (dryRun) {
                    return {
                        success: true,
                        output: `[dry-run] Would call helix spawn (flutter) with prompt: "${prompt.slice(0, 120)}"\n  theme=${theme} db=${db || "(default)"}`,
                    };
                }
                const { generateFlutterApp } = await import("../../generators/flutter");
                await generateFlutterApp(prompt, undefined, db || undefined, "openrouter");
                return { success: true, output: `Generated Flutter app from prompt.` };
            }

            if (dryRun) {
                return {
                    success: true,
                    output: `[dry-run] Would call helix spawn (web) with prompt: "${prompt.slice(0, 120)}"\n  theme=${theme} db=${db || "sqlite"}`,
                };
            }

            const { spawnApp } = await import("../../commands/spawn");
            await spawnApp(prompt, {
                target: "web",
                db: db || undefined,
                theme,
                aiContext: false,
                cache: false,
                noConstitution: false,
                components: [],
                dryRun: false,
            } as any);
            return { success: true, output: `Generated web app from prompt.` };
        } catch (err: any) {
            return { success: false, output: "", error: err?.message || String(err) };
        }
    },
};
