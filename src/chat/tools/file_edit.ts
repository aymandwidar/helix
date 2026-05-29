import * as fs from "fs";
import * as path from "path";
import { ToolDefinition } from "./index";

export const fileEditTool: ToolDefinition = {
    name: "file_edit",
    description: "Replace the first occurrence of `old_string` with `new_string` in a file. The match must be unique unless replace_all is true.",
    parameters: {
        path: { type: "string", description: "Path to the file." },
        old_string: { type: "string", description: "Exact text to replace." },
        new_string: { type: "string", description: "Replacement text." },
        replace_all: { type: "boolean", description: "If true, replace all occurrences.", default: false },
    },
    required: ["path", "old_string", "new_string"],
    requiresApproval: true,
    mutatesFiles: (args) => {
        const p = String((args as any).path || "");
        return p ? [p] : [];
    },
    async execute(args, ctx) {
        const rel = String(args.path);
        const oldStr = String(args.old_string ?? "");
        const newStr = String(args.new_string ?? "");
        const replaceAll = Boolean(args.replace_all);
        const abs = path.isAbsolute(rel) ? rel : path.join(ctx.cwd, rel);

        if (!fs.existsSync(abs)) {
            return { success: false, output: "", error: `File not found: ${rel}` };
        }
        const oldText = fs.readFileSync(abs, "utf-8");

        let newText: string;
        if (replaceAll) {
            if (!oldText.includes(oldStr)) {
                return { success: false, output: "", error: "old_string not found in file" };
            }
            newText = oldText.split(oldStr).join(newStr);
        } else {
            const occurrences = oldText.split(oldStr).length - 1;
            if (occurrences === 0) {
                return { success: false, output: "", error: "old_string not found in file" };
            }
            if (occurrences > 1) {
                return {
                    success: false,
                    output: "",
                    error: `old_string matches ${occurrences} times — provide more context or pass replace_all=true`,
                };
            }
            newText = oldText.replace(oldStr, newStr);
        }

        fs.writeFileSync(abs, newText);
        return {
            success: true,
            output: `Edited ${rel}`,
            diff: { oldText, newText, filename: rel },
        };
    },
};
