/**
 * Project scanner — produces a `ProjectSnapshot` describing an existing
 * codebase in enough detail that an AI planner can propose targeted edits.
 *
 * The snapshot is deliberately small: we don't dump every file, we summarize
 * structure (routes, models, components) and keep raw text only for files the
 * planner usually needs to reason about (package.json, prisma schema,
 * tailwind, next.config, env keys).
 */

import * as fs from "fs";
import * as path from "path";

export type ProjectKind = "next" | "node" | "flutter" | "helix" | "unknown";

export interface RouteEntry {
    /** Relative path inside the project, e.g. "app/blog/[slug]/page.tsx" */
    file: string;
    /** Derived URL pattern, e.g. "/blog/[slug]" */
    route: string;
    /** "page" | "layout" | "route" (API) */
    kind: "page" | "layout" | "route" | "loading" | "error" | "not-found";
}

export interface PrismaModel {
    name: string;
    fields: string[];
}

export interface ProjectSnapshot {
    cwd: string;
    name: string;
    kind: ProjectKind;
    framework: string | null;

    /** Raw package.json contents, parsed (or null if missing/broken) */
    packageJson: any;
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    scripts: Record<string, string>;

    /** Prisma schema text and parsed model summaries */
    prismaSchema: string | null;
    prismaModels: PrismaModel[];

    /** App-Router routes (Next.js). Empty for non-Next projects. */
    routes: RouteEntry[];
    /** Top-level component files (relative paths). */
    components: string[];

    /** Optional configuration files captured verbatim */
    tailwindConfig: string | null;
    nextConfig: string | null;
    tsconfig: string | null;
    helixConfig: any | null;

    /** Names of environment variables referenced (.env / .env.example) */
    envKeys: string[];

    /** Stripped file tree (no node_modules/.next/dist). */
    fileTree: string[];
}

const SKIP = new Set(["node_modules", ".git", ".next", "dist", "build", ".helix", "coverage", ".turbo"]);

export function scanProject(cwd: string = process.cwd()): ProjectSnapshot {
    const snapshot: ProjectSnapshot = {
        cwd,
        name: path.basename(cwd),
        kind: "unknown",
        framework: null,
        packageJson: null,
        dependencies: {},
        devDependencies: {},
        scripts: {},
        prismaSchema: null,
        prismaModels: [],
        routes: [],
        components: [],
        tailwindConfig: null,
        nextConfig: null,
        tsconfig: null,
        helixConfig: null,
        envKeys: [],
        fileTree: [],
    };

    // package.json
    const pkgPath = path.join(cwd, "package.json");
    if (fs.existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
            snapshot.packageJson = pkg;
            snapshot.name = pkg.name || snapshot.name;
            snapshot.dependencies = pkg.dependencies || {};
            snapshot.devDependencies = pkg.devDependencies || {};
            snapshot.scripts = pkg.scripts || {};
            const all = { ...snapshot.dependencies, ...snapshot.devDependencies };
            if (all.next) {
                snapshot.kind = "next";
                snapshot.framework = `Next.js ${all.next}`;
            } else if (all.flutter) {
                snapshot.kind = "flutter";
                snapshot.framework = "Flutter";
            } else {
                snapshot.kind = "node";
                snapshot.framework = "Node.js";
            }
        } catch {
            // ignore broken package.json
        }
    } else if (fs.existsSync(path.join(cwd, "pubspec.yaml"))) {
        snapshot.kind = "flutter";
        snapshot.framework = "Flutter";
    }

    // Prisma
    const prismaPath = path.join(cwd, "prisma", "schema.prisma");
    if (fs.existsSync(prismaPath)) {
        try {
            const text = fs.readFileSync(prismaPath, "utf-8");
            snapshot.prismaSchema = text;
            snapshot.prismaModels = parsePrismaModels(text);
        } catch {
            // ignore
        }
    }

    // Configs (best-effort, capped sizes)
    snapshot.tailwindConfig = readIfExists([
        path.join(cwd, "tailwind.config.ts"),
        path.join(cwd, "tailwind.config.js"),
        path.join(cwd, "tailwind.config.mjs"),
    ]);
    snapshot.nextConfig = readIfExists([
        path.join(cwd, "next.config.ts"),
        path.join(cwd, "next.config.js"),
        path.join(cwd, "next.config.mjs"),
    ]);
    snapshot.tsconfig = readIfExists([path.join(cwd, "tsconfig.json")]);

    const helixCfg = path.join(cwd, "helix.config.json");
    if (fs.existsSync(helixCfg)) {
        try { snapshot.helixConfig = JSON.parse(fs.readFileSync(helixCfg, "utf-8")); } catch { /* ignore */ }
        if (snapshot.kind === "unknown") snapshot.kind = "helix";
    }

    // Env keys (.env.example, .env)
    snapshot.envKeys = collectEnvKeys(cwd);

    // Routes (Next App Router)
    if (snapshot.kind === "next") {
        snapshot.routes = collectAppRoutes(cwd);
    }

    // Components (top-level only)
    snapshot.components = collectComponents(cwd);

    // File tree
    snapshot.fileTree = listFiles(cwd, 4);

    return snapshot;
}

function readIfExists(candidates: string[], maxBytes = 16_000): string | null {
    for (const c of candidates) {
        if (fs.existsSync(c)) {
            try {
                const text = fs.readFileSync(c, "utf-8");
                return text.length > maxBytes ? text.slice(0, maxBytes) + "\n…(truncated)" : text;
            } catch {
                continue;
            }
        }
    }
    return null;
}

function parsePrismaModels(schema: string): PrismaModel[] {
    const models: PrismaModel[] = [];
    const re = /model\s+(\w+)\s*\{([^}]*)\}/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(schema)) !== null) {
        const [, name, body] = match;
        const fields = body
            .split("\n")
            .map(line => line.trim())
            .filter(line => line && !line.startsWith("//") && !line.startsWith("@@"))
            .map(line => line.split(/\s+/).slice(0, 2).join(" "));
        models.push({ name, fields });
    }
    return models;
}

function collectEnvKeys(cwd: string): string[] {
    const candidates = [".env.example", ".env"];
    const seen = new Set<string>();
    for (const c of candidates) {
        const p = path.join(cwd, c);
        if (!fs.existsSync(p)) continue;
        try {
            const text = fs.readFileSync(p, "utf-8");
            for (const line of text.split("\n")) {
                const m = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=/);
                if (m) seen.add(m[1]);
            }
        } catch { /* ignore */ }
    }
    return [...seen].sort();
}

function collectAppRoutes(cwd: string): RouteEntry[] {
    const appDir = path.join(cwd, "app");
    const srcAppDir = path.join(cwd, "src", "app");
    const root = fs.existsSync(appDir) ? appDir : (fs.existsSync(srcAppDir) ? srcAppDir : null);
    if (!root) return [];

    const entries: RouteEntry[] = [];
    const walk = (dir: string, urlSegments: string[]): void => {
        let items: fs.Dirent[];
        try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const item of items) {
            if (SKIP.has(item.name)) continue;
            const full = path.join(dir, item.name);
            if (item.isDirectory()) {
                // Route groups in parens don't add a URL segment.
                const next = item.name.startsWith("(") && item.name.endsWith(")")
                    ? urlSegments
                    : [...urlSegments, item.name];
                walk(full, next);
                continue;
            }
            const kind = classifyAppFile(item.name);
            if (!kind) continue;
            const route = "/" + urlSegments.join("/");
            entries.push({
                file: path.relative(cwd, full),
                route: route === "/" ? "/" : route.replace(/\/$/, ""),
                kind,
            });
        }
    };
    walk(root, []);
    return entries;
}

function classifyAppFile(name: string): RouteEntry["kind"] | null {
    if (/^page\.(t|j)sx?$/.test(name)) return "page";
    if (/^layout\.(t|j)sx?$/.test(name)) return "layout";
    if (/^route\.(t|j)sx?$/.test(name)) return "route";
    if (/^loading\.(t|j)sx?$/.test(name)) return "loading";
    if (/^error\.(t|j)sx?$/.test(name)) return "error";
    if (/^not-found\.(t|j)sx?$/.test(name)) return "not-found";
    return null;
}

function collectComponents(cwd: string): string[] {
    const candidates = [
        path.join(cwd, "components"),
        path.join(cwd, "src", "components"),
    ];
    for (const dir of candidates) {
        if (!fs.existsSync(dir)) continue;
        const out: string[] = [];
        const walk = (d: string) => {
            let items: fs.Dirent[];
            try { items = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
            for (const item of items) {
                if (SKIP.has(item.name)) continue;
                const full = path.join(d, item.name);
                if (item.isDirectory()) walk(full);
                else if (/\.(t|j)sx?$/.test(item.name)) out.push(path.relative(cwd, full));
            }
        };
        walk(dir);
        return out.sort();
    }
    return [];
}

function listFiles(cwd: string, maxDepth: number): string[] {
    const out: string[] = [];
    const walk = (dir: string, depth: number): void => {
        if (depth > maxDepth) return;
        let items: fs.Dirent[];
        try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const item of items.sort((a, b) => a.name.localeCompare(b.name))) {
            if (SKIP.has(item.name)) continue;
            const rel = path.relative(cwd, path.join(dir, item.name));
            if (item.isDirectory()) {
                out.push(rel + "/");
                walk(path.join(dir, item.name), depth + 1);
            } else {
                out.push(rel);
            }
            if (out.length > 1000) return;
        }
    };
    walk(cwd, 1);
    return out;
}

/**
 * Render a compact text summary of the snapshot for AI consumption. The
 * planner prompt embeds this as the project context.
 */
export function summarizeSnapshot(s: ProjectSnapshot): string {
    const lines: string[] = [
        `Project: ${s.name}`,
        `Kind: ${s.kind}${s.framework ? " (" + s.framework + ")" : ""}`,
        `CWD: ${s.cwd}`,
    ];
    if (Object.keys(s.dependencies).length > 0) {
        lines.push("");
        lines.push("Dependencies (top 30):");
        const deps = Object.entries(s.dependencies).slice(0, 30);
        for (const [name, version] of deps) lines.push(`  ${name}@${version}`);
    }
    if (Object.keys(s.scripts).length > 0) {
        lines.push("");
        lines.push("Scripts:");
        for (const [name, cmd] of Object.entries(s.scripts)) lines.push(`  ${name}: ${cmd}`);
    }
    if (s.prismaModels.length > 0) {
        lines.push("");
        lines.push(`Prisma models (${s.prismaModels.length}):`);
        for (const m of s.prismaModels) lines.push(`  ${m.name} { ${m.fields.join(", ")} }`);
    }
    if (s.routes.length > 0) {
        lines.push("");
        lines.push(`App Router routes (${s.routes.length}):`);
        for (const r of s.routes.slice(0, 50)) lines.push(`  ${r.kind.padEnd(6)} ${r.route} (${r.file})`);
        if (s.routes.length > 50) lines.push(`  …(+${s.routes.length - 50} more)`);
    }
    if (s.components.length > 0) {
        lines.push("");
        lines.push(`Components (${s.components.length}):`);
        for (const c of s.components.slice(0, 30)) lines.push(`  ${c}`);
        if (s.components.length > 30) lines.push(`  …(+${s.components.length - 30} more)`);
    }
    if (s.envKeys.length > 0) {
        lines.push("");
        lines.push(`Environment keys: ${s.envKeys.join(", ")}`);
    }
    return lines.join("\n");
}
