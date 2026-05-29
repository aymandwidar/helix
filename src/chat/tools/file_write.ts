import * as fs from "fs";
import * as path from "path";
import { ToolDefinition } from "./index";

export const fileWriteTool: ToolDefinition = {
    name: "file_write",
    description: "Create or overwrite a file with the given contents. Use file_edit for targeted edits.",
    parameters: {
        path: { type: "string", description: "Path to the file (absolute or relative to cwd)." },
        content: { type: "string", description: "Full file contents." },
    },
    required: ["path", "content"],
    requiresApproval: true,
    mutatesFiles: (args) => {
        const p = String((args as any).path || "");
        return p ? [p] : [];
    },
    async execute(args, ctx) {
        const rel = String(args.path);
        const content = String(args.content ?? "");
        const abs = path.isAbsolute(rel) ? rel : path.join(ctx.cwd, rel);

        let oldText = "";
        const existed = fs.existsSync(abs);
        if (existed) {
            try { oldText = fs.readFileSync(abs, "utf-8"); } catch { oldText = ""; }
        }

        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, content);

        return {
            success: true,
            output: existed ? `Overwrote ${rel} (${content.length} bytes)` : `Created ${rel} (${content.length} bytes)`,
            diff: { oldText, newText: content, filename: rel },
        };
    },
};
