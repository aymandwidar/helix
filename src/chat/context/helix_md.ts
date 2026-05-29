/**
 * HELIX.md loader — provides persistent project context (like GEMINI.md / CLAUDE.md).
 */

import * as fs from "fs";
import * as path from "path";

export interface HelixMd {
    path: string;
    content: string;
}

export function loadHelixMd(cwd: string = process.cwd()): HelixMd | null {
    const candidates = ["HELIX.md", "helix.md", ".helix/HELIX.md"];
    for (const candidate of candidates) {
        const p = path.join(cwd, candidate);
        if (fs.existsSync(p)) {
            try {
                return { path: p, content: fs.readFileSync(p, "utf-8") };
            } catch {
                continue;
            }
        }
    }
    return null;
}
