/**
 * Helix Plugin Registry v10.0
 * Dynamic discovery and loading of generator plugins
 */

import * as fs from "fs-extra";
import * as path from "path";
import chalk from "chalk";
import { PluginRegistryEntry, GeneratorPlugin } from "./types";

// Built-in generators
const BUILT_IN_GENERATORS: PluginRegistryEntry[] = [
    {
        name: "helix-gen-flutter",
        target: "flutter",
        version: "10.0.0",
        modulePath: "../generators/flutter",
        isBuiltIn: true,
    },
    {
        name: "helix-gen-nextjs",
        target: "web",
        version: "10.0.0",
        modulePath: "../commands/spawn",
        isBuiltIn: true,
    },
];

/**
 * Plugin Registry - Discovers and loads generator plugins
 */
export class PluginRegistry {
    private static instance: PluginRegistry;
    private plugins: Map<string, PluginRegistryEntry> = new Map();
    private loadedPlugins: Map<string, GeneratorPlugin> = new Map();

    private constructor() {
        // Register built-in generators
        for (const plugin of BUILT_IN_GENERATORS) {
            this.plugins.set(plugin.target, plugin);
        }
    }

    /**
     * Get singleton instance
     */
    static getInstance(): PluginRegistry {
        if (!PluginRegistry.instance) {
            PluginRegistry.instance = new PluginRegistry();
        }
        return PluginRegistry.instance;
    }

    /**
     * Scan for helix-gen-* packages in node_modules
     * @param projectPath - Path to scan for plugins
     */
    async scanForPlugins(projectPath: string = process.cwd()): Promise<void> {
        const packageJsonPath = path.join(projectPath, "package.json");

        if (!fs.existsSync(packageJsonPath)) {
            return;
        }

        try {
            const packageJson = await fs.readJSON(packageJsonPath);
            const allDeps = {
                ...packageJson.dependencies,
                ...packageJson.devDependencies,
            };

            // Find helix-gen-* packages
            for (const [name, version] of Object.entries(allDeps)) {
                if (name.startsWith("helix-gen-") && !this.isBuiltIn(name)) {
                    await this.registerExternalPlugin(name, String(version), projectPath);
                }
            }
        } catch (error) {
            console.log(chalk.yellow(`⚠️  Could not scan for plugins: ${error}`));
        }
    }

    /**
     * Check if a plugin is built-in
     */
    private isBuiltIn(name: string): boolean {
        return BUILT_IN_GENERATORS.some(p => p.name === name);
    }

    /**
     * Register an external plugin
     */
    private async registerExternalPlugin(
        name: string,
        version: string,
        projectPath: string
    ): Promise<void> {
        const modulePath = path.join(projectPath, "node_modules", name);

        if (!fs.existsSync(modulePath)) {
            console.log(chalk.yellow(`⚠️  Plugin ${name} not found in node_modules`));
            return;
        }

        try {
            // Read plugin's package.json to get target
            const pluginPkgPath = path.join(modulePath, "package.json");
            const pluginPkg = await fs.readJSON(pluginPkgPath);
            const target = pluginPkg.helix?.target || name.replace("helix-gen-", "");

            this.plugins.set(target, {
                name,
                target,
                version,
                modulePath,
                isBuiltIn: false,
            });

            console.log(chalk.green(`✓ Plugin loaded: ${name} (target: ${target})`));
        } catch (error) {
            console.log(chalk.yellow(`⚠️  Could not load plugin ${name}: ${error}`));
        }
    }

    /**
     * Get all registered plugins
     */
    getPlugins(): PluginRegistryEntry[] {
        return Array.from(this.plugins.values());
    }

    /**
     * Get available targets
     */
    getAvailableTargets(): string[] {
        return Array.from(this.plugins.keys());
    }

    /**
     * Check if a target is supported
     */
    hasTarget(target: string): boolean {
        return this.plugins.has(target);
    }

    /**
     * Get plugin entry for a target
     */
    getPlugin(target: string): PluginRegistryEntry | undefined {
        return this.plugins.get(target);
    }

    /**
     * Load and return a generator plugin
     */
    async loadGenerator(target: string): Promise<GeneratorPlugin | null> {
        // Check cache
        if (this.loadedPlugins.has(target)) {
            return this.loadedPlugins.get(target)!;
        }

        const entry = this.plugins.get(target);
        if (!entry) {
            console.log(chalk.red(`❌ No generator found for target: ${target}`));
            return null;
        }

        try {
            // Dynamic import
            const module = await import(entry.modulePath);

            // Look for a default export or a named 'plugin' export
            const plugin: GeneratorPlugin = module.default || module.plugin;

            if (plugin && typeof plugin.generate === "function") {
                this.loadedPlugins.set(target, plugin);
                return plugin;
            }

            // For built-in generators, they might not follow plugin interface yet
            return null;
        } catch (error) {
            console.log(chalk.red(`❌ Failed to load generator for ${target}: ${error}`));
            return null;
        }
    }

    /**
     * List all plugins with their status
     */
    listPlugins(): void {
        console.log(chalk.cyan("\n📦 Helix Plugin Registry\n"));

        const plugins = this.getPlugins();
        if (plugins.length === 0) {
            console.log(chalk.gray("  No plugins registered"));
            return;
        }

        for (const plugin of plugins) {
            const status = plugin.isBuiltIn
                ? chalk.blue("[built-in]")
                : chalk.green("[external]");
            console.log(`  ${chalk.white(plugin.target)} → ${plugin.name} ${status}`);
        }
        console.log("");
    }
}

// Export singleton accessor
export const getRegistry = () => PluginRegistry.getInstance();
