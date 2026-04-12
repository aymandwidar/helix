import chalk from "chalk";
import execa = require("execa");
import ora from "ora";
import * as fs from "fs-extra";
import { DeploymentPlatform } from "../core/types";

/**
 * Main deploy entry point
 */
export async function deploy(platform: DeploymentPlatform, token?: string): Promise<void> {
    console.log(chalk.cyan(`\n🚀 HELIX ORBIT - Deploying to ${platform.toUpperCase()}\n`));

    const projectPath = process.cwd();

    switch (platform) {
        case "vercel":
            await deployToVercel(projectPath, token);
            break;
        default:
            console.error(chalk.red(`❌ Platform ${platform} not supported yet.`));
            process.exit(1);
    }
}

/**
 * Deploys a Helix project to Vercel
 */
async function deployToVercel(projectPath: string, token?: string): Promise<void> {
    const spinner = ora("Initializing Vercel connection...").start();

    try {
        spinner.text = "Deploying to Vercel (this may take a minute)...";

        // Construct command
        const args = ["vercel", "--prod", "--yes", "--no-clipboard"];

        // If token provided, add it
        if (token) {
            args.push("--token", token);
        }

        // Capture output to find URL
        const { stdout } = await execa("npx", args, {
            cwd: projectPath,
            stdio: "pipe",
        });

        spinner.succeed("Deployment successful!");

        // Extract URL (usually the last line is the Production URL)
        console.log(chalk.green(`\n✅ Live URL: ${stdout.trim()}\n`));

    } catch (error: any) {
        spinner.fail("Deployment failed");
        console.error(chalk.red(`\n❌ Error details:`));
        console.error(chalk.red(error.stderr || error.message));

        if (error.stderr?.includes("Not authorized") || error.message?.includes("token")) {
            console.error(chalk.yellow("-> Check your Vercel Token."));
        }
    }
}
