/**
 * Helix Command: preview
 * Interactive hot-reload preview with file watching
 */

import chalk from "chalk";
import * as fs from "fs-extra";
import * as path from "path";
import execa = require("execa");
import ora from "ora";
import { PreviewConfig } from "../core/types";

// We'll use a simple polling mechanism for file watching
// to avoid adding chokidar as a dependency initially

/**
 * Detect project type from the current directory
 */
function detectProjectType(): "flutter" | "nextjs" | "unknown" {
    const cwd = process.cwd();

    if (fs.existsSync(path.join(cwd, "pubspec.yaml"))) {
        return "flutter";
    }

    if (fs.existsSync(path.join(cwd, "next.config.js")) ||
        fs.existsSync(path.join(cwd, "next.config.mjs")) ||
        fs.existsSync(path.join(cwd, "package.json"))) {
        const pkgPath = path.join(cwd, "package.json");
        if (fs.existsSync(pkgPath)) {
            try {
                const pkg = fs.readJSONSync(pkgPath);
                if (pkg.dependencies?.next || pkg.devDependencies?.next) {
                    return "nextjs";
                }
            } catch { }
        }
    }

    return "unknown";
}

/**
 * Get preview configuration for a project type
 */
function getPreviewConfig(projectType: "flutter" | "nextjs"): PreviewConfig {
    if (projectType === "flutter") {
        return {
            projectType: "flutter",
            command: "flutter",
            args: ["run", "-d", "chrome", "--web-port", "3000"],
            watchPatterns: ["lib/**/*.dart", "*.helix"],
            port: 3000,
        };
    }

    return {
        projectType: "nextjs",
        command: "npm",
        args: ["run", "dev"],
        watchPatterns: ["src/**/*", "app/**/*", "pages/**/*", "*.helix"],
        port: 3000,
    };
}

/**
 * Find .helix files in the current directory
 */
async function findHelixFiles(): Promise<string[]> {
    const cwd = process.cwd();
    const files: string[] = [];

    try {
        const entries = await fs.readdir(cwd);
        for (const entry of entries) {
            if (entry.endsWith(".helix")) {
                files.push(entry);
            }
        }
    } catch { }

    return files;
}

/**
 * Watch a file for changes using polling
 */
class FileWatcher {
    private lastMtime: Map<string, number> = new Map();
    private interval: NodeJS.Timeout | null = null;
    private callback: (file: string) => void;

    constructor(callback: (file: string) => void) {
        this.callback = callback;
    }

    watch(files: string[], intervalMs: number = 1000): void {
        // Initialize mtimes
        for (const file of files) {
            try {
                const stat = fs.statSync(file);
                this.lastMtime.set(file, stat.mtimeMs);
            } catch {
                this.lastMtime.set(file, 0);
            }
        }

        // Start polling
        this.interval = setInterval(() => {
            for (const file of files) {
                try {
                    const stat = fs.statSync(file);
                    const lastMtime = this.lastMtime.get(file) || 0;

                    if (stat.mtimeMs > lastMtime) {
                        this.lastMtime.set(file, stat.mtimeMs);
                        this.callback(file);
                    }
                } catch { }
            }
        }, intervalMs);
    }

    stop(): void {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
}

/**
 * Main preview function
 */
export async function preview(): Promise<void> {
    console.log(chalk.cyan("\n👁️  HELIX PREVIEW - Interactive Development\n"));

    // Detect project type
    const projectType = detectProjectType();

    if (projectType === "unknown") {
        console.error(chalk.red("❌ Could not detect project type"));
        console.log(chalk.gray("Make sure you're in a Flutter or Next.js project directory"));
        process.exit(1);
    }

    const config = getPreviewConfig(projectType);
    console.log(chalk.white(`📦 Project Type: ${projectType}`));
    console.log(chalk.white(`🌐 Server: http://localhost:${config.port}\n`));

    // Find .helix files to watch
    const helixFiles = await findHelixFiles();
    if (helixFiles.length > 0) {
        console.log(chalk.yellow(`📝 Watching ${helixFiles.length} .helix file(s) for changes:`));
        for (const file of helixFiles) {
            console.log(chalk.gray(`   • ${file}`));
        }
        console.log("");
    }

    // Start file watcher for .helix files
    const watcher = new FileWatcher(async (file) => {
        console.log(chalk.yellow(`\n🔄 Change detected in ${file}`));
        console.log(chalk.gray("   Regenerating code..."));

        // Trigger regeneration
        try {
            // Import and run generate command
            const { generateStack } = await import("./generate");
            await generateStack(file);
            console.log(chalk.green("   ✅ Regeneration complete!\n"));
        } catch (error: any) {
            console.log(chalk.red(`   ❌ Regeneration failed: ${error.message}\n`));
        }
    });

    if (helixFiles.length > 0) {
        watcher.watch(helixFiles, 1500);
    }

    // Start the development server
    const spinner = ora(`Starting ${projectType} development server...`).start();

    try {
        spinner.succeed(`${projectType} server starting...`);
        console.log(chalk.gray("─".repeat(50)));
        console.log(chalk.cyan(`\n🚀 Preview available at http://localhost:${config.port}\n`));
        console.log(chalk.gray("Press Ctrl+C to stop\n"));
        console.log(chalk.gray("─".repeat(50)));

        // Open browser after a delay
        setTimeout(async () => {
            try {
                const url = `http://localhost:${config.port}`;
                const platform = process.platform;

                if (platform === "win32") {
                    await execa("cmd", ["/c", "start", url], { stdio: "ignore" });
                } else if (platform === "darwin") {
                    await execa("open", [url], { stdio: "ignore" });
                } else {
                    await execa("xdg-open", [url], { stdio: "ignore" });
                }
            } catch {
                // Ignore browser open errors
            }
        }, 3000);

        // Run the development server
        await execa(config.command, config.args, {
            stdio: "inherit",
            cwd: process.cwd(),
        });

    } catch (error: any) {
        spinner.fail(`Server failed: ${error.message}`);
        watcher.stop();
        process.exit(1);
    }

    // Cleanup on exit
    process.on("SIGINT", () => {
        watcher.stop();
        console.log(chalk.yellow("\n\n👋 Preview stopped\n"));
        process.exit(0);
    });
}

/**
 * Quick preview - just launch the server without watching
 */
export async function quickPreview(): Promise<void> {
    const projectType = detectProjectType();

    if (projectType === "unknown") {
        console.error(chalk.red("❌ Could not detect project type"));
        process.exit(1);
    }

    const config = getPreviewConfig(projectType);

    console.log(chalk.cyan(`\n🚀 Launching ${projectType} preview...\n`));

    await execa(config.command, config.args, {
        stdio: "inherit",
        cwd: process.cwd(),
    });
}
