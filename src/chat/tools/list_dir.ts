import * as fs from "fs";
import * as path from "path";
import { ToolDefinition } from "./index";

const SKIP = new Set(["node_modules", ".git", ".next", "dist", "build", ".helix"]);

export const listDirTool: ToolDefinition = {
    name: "list_dir",
    description: "List files and subdirectories in a directory. Returns a relative listing.",
    parameters: {
        path: { type: "string", description: "Directory path (absolute or relative to cwd).", default: "." },
        depth: { type: "number", description: "Recursion depth (1 = only this directory).", default: 1 },
    },
    async execute(args, ctx) {
        const rel = String(args.path || ".");
        const depth = Math.max(1, Math.min(Number(args.depth) || 1, 4));
        const abs = path.isAbsolute(rel) ? rel : path.join(ctx.cwd, rel);

        if (!fs.existsSync(abs)) {
            return { success: false, output: "", error: `Directory not found: ${rel}` };
        }
        const stat = fs.statSync(abs);
        if (!stat.isDirectory()) {
            return { success: false, output: "", error: `Not a directory: ${rel}` };
        }

        const lines: string[] = [];
        const walk = (dir: string, currentDepth: number, prefix: string): void => {
            let entries: fs.Dirent[];
            try {
                entries = fs.readdirSync(dir, { withFileTypes: true });
            } catch {
                return;
            }
            entries.sort((a, b) => a.name.localeCompare(b.name));
            for (const entry of entries) {
                if (SKIP.has(entry.name)) continue;
                const marker = entry.isDirectory() ? "/" : "";
                lines.push(`${prefix}${entry.name}${marker}`);
                if (entry.isDirectory() && currentDepth < depth) {
                    walk(path.join(dir, entry.name), currentDepth + 1, prefix + "  ");
                }
                if (lines.length > 500) return;
            }
        };
        walk(abs, 1, "");
        return { success: true, output: lines.join("\n") || "(empty)" };
    },
};
