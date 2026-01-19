/**
 * Helix Command: new
 * Scaffolds a production-ready Next.js 14 project with Prisma
 */

import chalk from "chalk";
import * as fs from "fs-extra";
import * as path from "path";
import execa = require("execa");
import ora from "ora";

export async function createProject(projectName: string): Promise<void> {
    const projectPath = path.join(process.cwd(), projectName);

    console.log(chalk.cyan(`\n🚀 Creating Helix project: ${projectName}\n`));

    // Check if directory exists
    if (fs.existsSync(projectPath)) {
        console.error(chalk.red(`❌ Directory "${projectName}" already exists`));
        process.exit(1);
    }

    // Step 1: Create Next.js app
    const spinner1 = ora("Scaffolding Next.js 14 (App Router)...").start();
    try {
        await execa("npx", [
            "create-next-app@latest",
            projectName,
            "--typescript",
            "--tailwind",
            "--eslint",
            "--app",
            "--src-dir",
            "--no-import-alias",
            "--use-npm",
        ], { stdio: "pipe" });
        spinner1.succeed("Next.js project created");
    } catch (error) {
        spinner1.fail("Failed to create Next.js project");
        throw error;
    }

    // Step 2: Initialize Prisma
    const spinner2 = ora("Initializing Prisma with SQLite...").start();
    try {
        await execa("npx", ["prisma", "init", "--datasource-provider", "sqlite"], {
            cwd: projectPath,
            stdio: "pipe",
        });
        spinner2.succeed("Prisma initialized");
    } catch (error) {
        spinner2.fail("Failed to initialize Prisma");
        throw error;
    }

    // Step 3: Install additional dependencies
    const spinner3 = ora("Installing Helix core dependencies...").start();
    try {
        await execa("npm", [
            "install",
            "@prisma/client",
            "lucide-react",
            "clsx",
            "tailwind-merge",
        ], {
            cwd: projectPath,
            stdio: "pipe",
        });
        spinner3.succeed("Dependencies installed");
    } catch (error) {
        spinner3.fail("Failed to install dependencies");
        throw error;
    }

    // Step 4: Create lib/prisma.ts
    const spinner4 = ora("Setting up Prisma client...").start();
    try {
        const libDir = path.join(projectPath, "src", "lib");
        await fs.ensureDir(libDir);

        await fs.writeFile(
            path.join(libDir, "prisma.ts"),
            `import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
`
        );
        spinner4.succeed("Prisma client configured");
    } catch (error) {
        spinner4.fail("Failed to set up Prisma client");
        throw error;
    }

    // Step 5: Update globals.css with Helix theme
    const spinner5 = ora("Applying Helix design tokens...").start();
    try {
        const globalsPath = path.join(projectPath, "src", "app", "globals.css");
        await fs.writeFile(
            globalsPath,
            `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: 0 0% 3.9%;
  --foreground: 0 0% 98%;
  --card: 0 0% 7%;
  --card-foreground: 0 0% 98%;
  --primary: 239 84% 67%;
  --primary-foreground: 0 0% 98%;
}

body {
  background: linear-gradient(135deg, #0f0f1a 0%, #1a0a2e 50%, #0d1117 100%);
  color: rgb(255, 255, 255);
  min-height: 100vh;
}

/* Glassmorphism utilities */
.glass {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.glass-hover:hover {
  background: rgba(255, 255, 255, 0.1);
}
`
        );
        spinner5.succeed("Helix theme applied");
    } catch (error) {
        spinner5.fail("Failed to apply theme");
        throw error;
    }

    // Step 6: Create helix.config.json
    const spinner6 = ora("Creating Helix configuration...").start();
    try {
        await fs.writeJSON(
            path.join(projectPath, "helix.config.json"),
            {
                version: "3.0.0",
                database: "sqlite",
                theme: "glassmorphism",
                generatedAt: new Date().toISOString(),
            },
            { spaces: 2 }
        );
        spinner6.succeed("Helix config created");
    } catch (error) {
        spinner6.fail("Failed to create config");
        throw error;
    }

    // Success message
    console.log(chalk.green("\n✅ Project created successfully!\n"));
    console.log(chalk.white("Next steps:"));
    console.log(chalk.gray(`  cd ${projectName}`));
    console.log(chalk.gray("  Create your app.helix file"));
    console.log(chalk.gray("  helix generate app.helix"));
    console.log(chalk.gray("  helix run\n"));
}
