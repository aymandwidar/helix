import * as fs from "fs";
import * as path from "path";
import { ToolDefinition } from "./index";

const MAX_BYTES = 200_000;

export const fileReadTool: ToolDefinition = {
    name: "file_read",
    description: "Read the contents of a file relative to the working directory. Returns text contents (truncated if very large).",
    parameters: {
        path: { type: "string", description: "Path to the file (absolute or relative to cwd)." },
    },
    required: ["path"],
    async execute(args, ctx) {
        const rel = String(args.path);
        const abs = path.isAbsolute(rel) ? rel : path.join(ctx.cwd, rel);

        if (!fs.existsSync(abs)) {
            return { success: false, output: "", error: `File not found: ${rel}` };
        }
        const stat = fs.statSync(abs);
        if (stat.isDirectory()) {
            return { success: false, output: "", error: `Path is a directory, not a file: ${rel}` };
        }
        const buf = fs.readFileSync(abs);
        const text = buf.toString("utf-8");
        if (buf.length > MAX_BYTES) {
            return {
                success: true,
                output: text.slice(0, MAX_BYTES) + `\n\n…(truncated, ${buf.length - MAX_BYTES} bytes omitted)`,
            };
        }
        return { success: true, output: text };
    },
};
