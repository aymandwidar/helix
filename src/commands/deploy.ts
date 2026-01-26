/**
 * Helix Command: deploy
 * One-command deployment to Vercel, Firebase, or other platforms
 */

import chalk from "chalk";
import * as fs from "fs-extra";
import * as path from "path";
import execa = require("execa");
import ora from "ora";
import { DeploymentConfig, DeploymentPlatform } from "../core/types";

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
        fs.existsSync(path.join(cwd, "next.config.ts"))) {
        return "nextjs";
    }

    // Check package.json for next dependency
    const pkgPath = path.join(cwd, "package.json");
    if (fs.existsSync(pkgPath)) {
        try {
            const pkg = fs.readJSONSync(pkgPath);
            if (pkg.dependencies?.next || pkg.devDependencies?.next) {
                return "nextjs";
            }
        } catch { }
    }

    return "unknown";
}

/**
 * Get deployment configuration for a platform
 */
function getDeployConfig(platform: DeploymentPlatform, projectType: "flutter" | "nextjs"): DeploymentConfig {
    const configs: Record<DeploymentPlatform, Record<string, DeploymentConfig>> = {
        vercel: {
            nextjs: {
                platform: "vercel",
                projectType: "nextjs",
                buildCommand: "npm run build",
                outputDir: ".next",
            },
            flutter: {
                platform: "vercel",
                projectType: "flutter",
                buildCommand: "flutter build web",
                outputDir: "build/web",
            },
        },
        firebase: {
            nextjs: {
                platform: "firebase",
                projectType: "nextjs",
                buildCommand: "npm run build",
                outputDir: ".next",
            },
            flutter: {
                platform: "firebase",
                projectType: "flutter",
                buildCommand: "flutter build web",
                outputDir: "build/web",
            },
        },
        netlify: {
            nextjs: {
                platform: "netlify",
                projectType: "nextjs",
                buildCommand: "npm run build",
                outputDir: ".next",
            },
            flutter: {
                platform: "netlify",
                projectType: "flutter",
                buildCommand: "flutter build web",
                outputDir: "build/web",
            },
        },
        codemagic: {
            flutter: {
                platform: "codemagic",
                projectType: "flutter",
                buildCommand: "flutter build apk --release",
                outputDir: "build/app/outputs/flutter-apk",
            },
            nextjs: {
                platform: "codemagic",
                projectType: "nextjs",
                buildCommand: "npm run build",
                outputDir: ".next",
            },
        },
    };

    return configs[platform][projectType];
}

/**
 * Deploy project to Vercel
 */
async function deployToVercel(config: DeploymentConfig): Promise<boolean> {
    const spinner = ora("Deploying to Vercel...").start();

    try {
        // Check if Vercel CLI is installed
        try {
            await execa("vercel", ["--version"], { stdio: "pipe" });
        } catch {
            spinner.fail("Vercel CLI not found");
            console.log(chalk.yellow("\nInstall Vercel CLI:"));
            console.log(chalk.white("  npm install -g vercel"));
            return false;
        }

        // For Flutter, build first
        if (config.projectType === "flutter") {
            spinner.text = "Building Flutter web...";
            await execa("flutter", ["build", "web"], { stdio: "pipe" });
        }

        // Deploy
        spinner.text = "Deploying to Vercel...";

        const args = config.projectType === "flutter"
            ? ["deploy", "--prod", config.outputDir]
            : ["deploy", "--prod"];

        const result = await execa("vercel", args, { stdio: "pipe" });

        spinner.succeed("Deployed to Vercel!");

        // Extract URL from output
        const urlMatch = result.stdout.match(/https:\/\/[\w-]+\.vercel\.app/);
        if (urlMatch) {
            console.log(chalk.green(`\n🔗 Live URL: ${urlMatch[0]}\n`));
        }

        return true;
    } catch (error: any) {
        spinner.fail(`Deployment failed: ${error.message}`);
        return false;
    }
}

/**
 * Deploy project to Firebase
 */
async function deployToFirebase(config: DeploymentConfig): Promise<boolean> {
    const spinner = ora("Deploying to Firebase...").start();

    try {
        // Check if Firebase CLI is installed
        try {
            await execa("firebase", ["--version"], { stdio: "pipe" });
        } catch {
            spinner.fail("Firebase CLI not found");
            console.log(chalk.yellow("\nInstall Firebase CLI:"));
            console.log(chalk.white("  npm install -g firebase-tools"));
            return false;
        }

        // Check for firebase.json
        if (!fs.existsSync("firebase.json")) {
            spinner.text = "Initializing Firebase...";

            // Create firebase.json for hosting
            const publicDir = config.projectType === "flutter" ? "build/web" : "out";
            await fs.writeJSON("firebase.json", {
                hosting: {
                    public: publicDir,
                    ignore: ["firebase.json", "**/.*", "**/node_modules/**"],
                    rewrites: [{ source: "**", destination: "/index.html" }],
                },
            }, { spaces: 2 });
        }

        // Build first
        spinner.text = `Building ${config.projectType}...`;
        if (config.projectType === "flutter") {
            await execa("flutter", ["build", "web"], { stdio: "pipe" });
        } else {
            await execa("npm", ["run", "build"], { stdio: "pipe" });
            // Next.js needs export for static
            try {
                await execa("npx", ["next", "export"], { stdio: "pipe" });
            } catch {
                // next export might not be needed for newer versions
            }
        }

        // Deploy
        spinner.text = "Deploying to Firebase...";
        const result = await execa("firebase", ["deploy", "--only", "hosting"], { stdio: "pipe" });

        spinner.succeed("Deployed to Firebase!");

        // Extract URL from output
        const urlMatch = result.stdout.match(/https:\/\/[\w-]+\.web\.app/);
        if (urlMatch) {
            console.log(chalk.green(`\n🔗 Live URL: ${urlMatch[0]}\n`));
        }

        return true;
    } catch (error: any) {
        spinner.fail(`Deployment failed: ${error.message}`);
        return false;
    }
}

/**
 * Main deploy function
 */
export async function deploy(platform: DeploymentPlatform): Promise<void> {
    console.log(chalk.cyan("\n🚀 HELIX DEPLOY - One-Command Shipping\n"));

    // Detect project type
    const projectType = detectProjectType();

    if (projectType === "unknown") {
        console.error(chalk.red("❌ Could not detect project type"));
        console.log(chalk.gray("Make sure you're in a Flutter or Next.js project directory"));
        process.exit(1);
    }

    console.log(chalk.white(`📦 Project Type: ${projectType}`));
    console.log(chalk.white(`🎯 Platform: ${platform}\n`));

    // Get config
    const config = getDeployConfig(platform, projectType);

    // Deploy based on platform
    let success = false;
    switch (platform) {
        case "vercel":
            success = await deployToVercel(config);
            break;
        case "firebase":
            success = await deployToFirebase(config);
            break;
        case "netlify":
            console.log(chalk.yellow("⚠️  Netlify deployment coming soon"));
            console.log(chalk.gray("For now, use: npx netlify deploy --prod"));
            break;
        case "codemagic":
            console.log(chalk.yellow("⚠️  Codemagic deployment requires dashboard setup"));
            console.log(chalk.gray("Visit: https://codemagic.io"));
            break;
    }

    if (success) {
        console.log(chalk.green("✅ Deployment complete!\n"));
    }
}

/**
 * List all generated CI/CD files
 */
export function generateCICD(platform: DeploymentPlatform, projectType: "flutter" | "nextjs"): string {
    if (platform === "vercel" && projectType === "nextjs") {
        return `{
  "version": 2,
  "builds": [{ "src": "package.json", "use": "@vercel/next" }]
}`;
    }

    if (platform === "firebase") {
        const publicDir = projectType === "flutter" ? "build/web" : "out";
        return JSON.stringify({
            hosting: {
                public: publicDir,
                ignore: ["firebase.json", "**/.*", "**/node_modules/**"],
                rewrites: [{ source: "**", destination: "/index.html" }],
            },
        }, null, 2);
    }

    return "";
}
