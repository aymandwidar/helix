/**
 * Auto-detect basic project structure to seed agent context.
 */

import * as fs from "fs";
import * as path from "path";

export interface ProjectInfo {
    cwd: string;
    name: string;
    type: "next" | "node" | "flutter" | "helix" | "unknown";
    framework: string | null;
    hasPrisma: boolean;
    hasHelixConfig: boolean;
    helixVersion: string | null;
    keyFiles: string[];
}

export function detectProject(cwd: string = process.cwd()): ProjectInfo {
    const info: ProjectInfo = {
        cwd,
        name: path.basename(cwd),
        type: "unknown",
        framework: null,
        hasPrisma: fs.existsSync(path.join(cwd, "prisma", "schema.prisma")),
        hasHelixConfig: fs.existsSync(path.join(cwd, "helix.config.json")),
        helixVersion: null,
        keyFiles: [],
    };

    const pkgPath = path.join(cwd, "package.json");
    if (fs.existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
            info.name = pkg.name || info.name;
            const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
            if (deps.next) {
                info.type = "next";
                info.framework = `Next.js ${deps.next}`;
            } else if (deps.flutter) {
                info.type = "flutter";
                info.framework = "Flutter";
            } else {
                info.type = "node";
                info.framework = "Node.js";
            }
        } catch {
            // ignore
        }
    } else if (fs.existsSync(path.join(cwd, "pubspec.yaml"))) {
        info.type = "flutter";
        info.framework = "Flutter";
    } else if (info.hasHelixConfig) {
        info.type = "helix";
        info.framework = "Helix";
    }

    if (info.hasHelixConfig) {
        try {
            const cfg = JSON.parse(fs.readFileSync(path.join(cwd, "helix.config.json"), "utf-8"));
            info.helixVersion = cfg.version || null;
        } catch {
            // ignore
        }
    }

    const candidates = [
        "package.json",
        "tsconfig.json",
        "next.config.js",
        "next.config.mjs",
        "next.config.ts",
        "prisma/schema.prisma",
        "helix.config.json",
        "pubspec.yaml",
        "README.md",
    ];
    for (const f of candidates) {
        if (fs.existsSync(path.join(cwd, f))) info.keyFiles.push(f);
    }

    return info;
}

export function summarizeProject(info: ProjectInfo): string {
    const lines = [
        `Working directory: ${info.cwd}`,
        `Project: ${info.name} (${info.type})`,
    ];
    if (info.framework) lines.push(`Framework: ${info.framework}`);
    if (info.hasPrisma) lines.push("Prisma: present");
    if (info.helixVersion) lines.push(`Helix project: v${info.helixVersion}`);
    if (info.keyFiles.length) lines.push(`Key files: ${info.keyFiles.join(", ")}`);
    return lines.join("\n");
}
