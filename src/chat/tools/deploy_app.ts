import { ToolDefinition } from "./index";

export const deployAppTool: ToolDefinition = {
    name: "deploy_app",
    description: "Deploy the current project (wraps `helix deploy`). Always requires user approval.",
    parameters: {
        platform: { type: "string", description: "Deploy platform.", enum: ["vercel", "firebase", "netlify"], default: "vercel" },
        token: { type: "string", description: "Optional auth token.", default: "" },
    },
    requiresApproval: true,
    async execute(args) {
        const platform = String(args.platform || "vercel") as any;
        const token = String(args.token || "") || undefined;
        try {
            const { deploy } = await import("../../commands/deploy");
            await deploy(platform, token);
            return { success: true, output: `Deployed to ${platform}` };
        } catch (err: any) {
            return { success: false, output: "", error: err?.message || String(err) };
        }
    },
};
