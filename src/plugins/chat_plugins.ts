/**
 * Loader for v2 chat tool plugins.
 *
 * Discovery rules (in order):
 *   1. Explicit list under `chatPlugins` in `~/.helix/settings.json` (array of
 *      module specifiers — package names or absolute paths).
 *   2. Any `helix-tool-*` dependency in the project's package.json.
 *   3. Any subdirectory in `~/.helix/plugins/` that has a package.json.
 *
 * The loader is fault-tolerant — a single broken plugin reports an error and
 * doesn't stop the others from loading.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { ToolRegistry, ToolDefinition } from "../chat/tools";
import { loadSettings, getSettingsDir } from "../mcp/config";
import { ChatPlugin, LoadedChatPlugin } from "./types";

export interface LoadOutcome {
    plugins: LoadedChatPlugin[];
    added: string[];
    errors: Array<{ source: string; error: string }>;
}

export async function loadChatPlugins(registry: ToolRegistry, cwd: string = process.cwd()): Promise<LoadOutcome> {
    const outcome: LoadOutcome = { plugins: [], added: [], errors: [] };
    const sources = collectSources(cwd);
    for (const source of sources) {
        try {
            const loaded = await loadOne(source, cwd, registry);
            if (loaded) {
                outcome.plugins.push(loaded);
                outcome.added.push(...loaded.registered);
            }
        } catch (e: any) {
            outcome.errors.push({ source, error: e?.message || String(e) });
        }
    }
    return outcome;
}

interface PluginSource {
    /** Module specifier passed to `require.resolve` / `import`. */
    spec: string;
    /** Optional explicit base directory for resolution. */
    basePath?: string;
    /** Where the source came from (for error reporting). */
    origin: "settings" | "dependency" | "userdir";
}

function collectSources(cwd: string): string[] {
    const sources = new Map<string, PluginSource>();

    // 1. Settings list
    try {
        const settings = loadSettings();
        const configured = (settings as any).chatPlugins;
        if (Array.isArray(configured)) {
            for (const spec of configured) {
                if (typeof spec === "string" && spec) {
                    sources.set(spec, { spec, origin: "settings" });
                }
            }
        }
    } catch {
        // ignore
    }

    // 2. helix-tool-* deps in project package.json
    const pkgPath = path.join(cwd, "package.json");
    if (fs.existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
            const all = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
            for (const name of Object.keys(all)) {
                if (name.startsWith("helix-tool-") && !sources.has(name)) {
                    sources.set(name, { spec: name, basePath: cwd, origin: "dependency" });
                }
            }
        } catch {
            // ignore
        }
    }

    // 3. ~/.helix/plugins/<dir>
    const userPluginsDir = path.join(getSettingsDir(), "plugins");
    if (fs.existsSync(userPluginsDir)) {
        try {
            for (const entry of fs.readdirSync(userPluginsDir, { withFileTypes: true })) {
                if (!entry.isDirectory()) continue;
                const candidate = path.join(userPluginsDir, entry.name);
                if (fs.existsSync(path.join(candidate, "package.json"))) {
                    if (!sources.has(candidate)) sources.set(candidate, { spec: candidate, origin: "userdir" });
                }
            }
        } catch {
            // ignore
        }
    }

    return [...sources.keys()];
}

async function loadOne(spec: string, cwd: string, registry: ToolRegistry): Promise<LoadedChatPlugin | null> {
    const modulePath = resolveSpec(spec, cwd);
    let module: any;
    try {
        module = await import(modulePath);
    } catch (e: any) {
        throw new Error(`failed to import ${spec}: ${e?.message || e}`);
    }
    const plugin = pickPluginExport(module);
    if (!isChatPlugin(plugin)) {
        throw new Error(`module ${spec} did not export a valid ChatPlugin`);
    }

    if (typeof plugin.setup === "function") {
        try { await plugin.setup(); } catch (e: any) { throw new Error(`${spec} setup failed: ${e.message}`); }
    }

    const registered: string[] = [];
    for (const tool of plugin.tools) {
        if (registry.get(tool.name)) {
            // Skip duplicates silently — first registration wins
            continue;
        }
        registry.register(tool);
        registered.push(tool.name);
    }
    return { plugin, modulePath, registered };
}

function resolveSpec(spec: string, cwd: string): string {
    // Absolute / relative path — resolve to the package main if it's a directory
    if (path.isAbsolute(spec) || spec.startsWith(".")) {
        const abs = path.isAbsolute(spec) ? spec : path.resolve(cwd, spec);
        try {
            const stat = fs.statSync(abs);
            if (stat.isDirectory()) {
                const pkgPath = path.join(abs, "package.json");
                if (fs.existsSync(pkgPath)) {
                    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
                    const main = pkg.main || "index.js";
                    return path.join(abs, main);
                }
                return path.join(abs, "index.js");
            }
        } catch {
            // not a real path — fall through to spec
        }
        return abs;
    }
    // Bare specifier — resolve via project node_modules first
    try {
        return require.resolve(spec, { paths: [cwd] });
    } catch {
        return spec;
    }
}

/**
 * Unwrap a plugin export across the various module shapes Node may produce:
 *   - ESM:  { default: plugin }
 *   - CJS via dynamic import: { default: { default: plugin } } (Node wraps module.exports)
 *   - CJS module.exports = plugin: { default: plugin }
 *   - module.exports = { plugin: plugin }
 *   - module-shaped plugin itself
 */
function pickPluginExport(module: any): unknown {
    const candidates: any[] = [
        module?.default?.default,
        module?.default,
        module?.plugin,
        module,
    ];
    for (const c of candidates) {
        if (isChatPlugin(c)) return c;
    }
    return undefined;
}

function isChatPlugin(value: unknown): value is ChatPlugin {
    if (!value || typeof value !== "object") return false;
    const v = value as ChatPlugin;
    return typeof v.name === "string"
        && typeof v.version === "string"
        && Array.isArray(v.tools)
        && v.tools.every(isToolDefinition);
}

function isToolDefinition(value: unknown): value is ToolDefinition {
    if (!value || typeof value !== "object") return false;
    const v = value as ToolDefinition;
    return typeof v.name === "string"
        && typeof v.description === "string"
        && typeof v.parameters === "object"
        && typeof v.execute === "function";
}
