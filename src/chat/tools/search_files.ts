import * as fs from "fs";
import * as path from "path";
import { ToolDefinition } from "./index";

const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build", ".helix"]);
const MAX_MATCHES = 100;
const MAX_FILE_SIZE = 1_000_000;

export const searchFilesTool: ToolDefinition = {
    name: "search_files",
    description: "Search for a regex pattern across files in the working directory (ripgrep-style). Returns file:line:match.",
    parameters: {
        pattern: { type: "string", description: "Regex pattern to search for." },
        path: { type: "string", description: "Subdirectory to search in.", default: "." },
        extension: { type: "string", description: "Limit to files with this extension (e.g. 'ts').", default: "" },
    },
    required: ["pattern"],
    async execute(args, ctx) {
        const pattern = String(args.pattern || "");
        if (!pattern) return { success: false, output: "", error: "pattern is required" };
        const subdir = String(args.path || ".");
        const ext = String(args.extension || "").replace(/^\./, "");
        const root = path.isAbsolute(subdir) ? subdir : path.join(ctx.cwd, subdir);

        let regex: RegExp;
        try {
            regex = new RegExp(pattern);
        } catch (e: any) {
            return { success: false, output: "", error: `Invalid regex: ${e.message}` };
        }

        const matches: string[] = [];
        const walk = (dir: string): void => {
            if (matches.length >= MAX_MATCHES) return;
            let entries: fs.Dirent[];
            try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
            for (const entry of entries) {
                if (matches.length >= MAX_MATCHES) return;
                if (SKIP_DIRS.has(entry.name)) continue;
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) { walk(full); continue; }
                if (ext && !entry.name.endsWith("." + ext)) continue;
                let stat: fs.Stats;
                try { stat = fs.statSync(full); } catch { continue; }
                if (stat.size > MAX_FILE_SIZE) continue;
                let text: string;
                try { text = fs.readFileSync(full, "utf-8"); } catch { continue; }
                const lines = text.split("\n");
                for (let i = 0; i < lines.length; i++) {
                    if (regex.test(lines[i])) {
                        const rel = path.relative(ctx.cwd, full);
                        matches.push(`${rel}:${i + 1}: ${lines[i].trim().slice(0, 200)}`);
                        if (matches.length >= MAX_MATCHES) return;
                    }
                }
            }
        };
        if (!fs.existsSync(root)) {
            return { success: false, output: "", error: `Path not found: ${subdir}` };
        }
        walk(root);
        return {
            success: true,
            output: matches.length === 0 ? "(no matches)" : matches.join("\n") + (matches.length === MAX_MATCHES ? "\n…(truncated)" : ""),
        };
    },
};
