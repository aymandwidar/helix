/**
 * Helix Command: run
 * Wraps npm run dev and opens the browser automatically
 */

import chalk from "chalk";
import * as fs from "fs-extra";
import * as path from "path";
import execa = require("execa");
import ora from "ora";

export async function runDevServer(): Promise<void> {
    const configPath = path.join(process.cwd(), "helix.config.json");

    // Check if we're in a Helix project
    if (!fs.existsSync(configPath)) {
        console.error(chalk.red("❌ Not a Helix project. Run 'helix new <name>' first."));
        process.exit(1);
    }

    console.log(chalk.cyan("\n🚀 Starting Helix Dev Server...\n"));

    // Check for package.json
    const packagePath = path.join(process.cwd(), "package.json");
    if (!fs.existsSync(packagePath)) {
        console.error(chalk.red("❌ No package.json found"));
        process.exit(1);
    }

    // Open browser after a delay
    setTimeout(async () => {
        try {
            const url = "http://localhost:3000";
            console.log(chalk.green(`\n🌐 Opening ${url}\n`));

            // Cross-platform browser open
            const platform = process.platform;
            if (platform === "win32") {
                await execa("cmd", ["/c", "start", url], { stdio: "ignore" });
            } else if (platform === "darwin") {
                await execa("open", [url], { stdio: "ignore" });
            } else {
                await execa("xdg-open", [url], { stdio: "ignore" });
            }
        } catch {
            console.log(chalk.yellow("⚠️ Could not open browser automatically"));
            console.log(chalk.gray("  Open http://localhost:3000 manually"));
        }
    }, 3000);

    // Run the dev server
    try {
        await execa("npm", ["run", "dev"], {
            cwd: process.cwd(),
            stdio: "inherit", // Stream output to terminal
        });
    } catch (error) {
        // User likely pressed Ctrl+C
        console.log(chalk.gray("\n👋 Server stopped\n"));
    }
}
