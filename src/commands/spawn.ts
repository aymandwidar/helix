/**
 * Helix Command: spawn
 * ONE-SHOT GENERATION - Full-stack app from natural language with ZERO intervention
 */

import chalk from "chalk";
import * as fs from "fs-extra";
import * as path from "path";
import execa = require("execa");
import ora from "ora";
import { createCompletion, DEFAULT_MODEL } from "../openrouter";
import {
    parseHelix,
    generatePrismaSchema,
    generateAPIRoute,
    generateUIPage,
    HelixAST,
} from "../parser";
import { ARCHITECT_SYSTEM_PROMPT, HELIX_SYNTAX_GUIDE } from "../types";

const MAX_RETRY_ATTEMPTS = 3;

/**
 * Spawn a complete full-stack application from a natural language prompt
 */
export async function spawnApp(prompt: string): Promise<void> {
    console.log(chalk.cyan("\n🧬 HELIX SPAWN - One-Shot Generation\n"));
    console.log(chalk.gray(`Prompt: "${prompt}"\n`));

    // Generate project name from prompt
    const projectName = generateProjectName(prompt);
    const projectPath = path.join(process.cwd(), projectName);

    // Check if directory exists
    if (fs.existsSync(projectPath)) {
        console.error(chalk.red(`❌ Directory "${projectName}" already exists`));
        process.exit(1);
    }

    try {
        // =========================================================================
        // PHASE 1: Silent Scaffolding
        // =========================================================================
        const spinner1 = ora("Creating project...").start();

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

        // Initialize Prisma
        await execa("npx", ["prisma", "init", "--datasource-provider", "sqlite"], {
            cwd: projectPath,
            stdio: "pipe",
        });

        // Install dependencies
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

        // Create Prisma client helper
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

        // Apply Helix theme
        await fs.writeFile(
            path.join(projectPath, "src", "app", "globals.css"),
            `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background: linear-gradient(135deg, #0f0f1a 0%, #1a0a2e 50%, #0d1117 100%);
  color: white;
  min-height: 100vh;
}

.glass {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
`
        );

        // Create helix config
        await fs.writeJSON(
            path.join(projectPath, "helix.config.json"),
            { version: "4.0.0", spawned: true, prompt, generatedAt: new Date().toISOString() },
            { spaces: 2 }
        );

        spinner1.succeed("Project scaffolded");

        // =========================================================================
        // PHASE 2: Internal Drafting (The Architect)
        // =========================================================================
        const spinner2 = ora("Designing blueprint...").start();

        const helixBlueprint = await generateBlueprint(prompt);

        // Save blueprint for reference
        await fs.writeFile(path.join(projectPath, "blueprint.helix"), helixBlueprint);

        spinner2.succeed("Blueprint designed");

        // =========================================================================
        // PHASE 3: Generation with Self-Healing
        // =========================================================================
        const spinner3 = ora("Building database...").start();

        let ast: HelixAST;
        try {
            ast = parseHelix(helixBlueprint);
        } catch (error) {
            spinner3.fail("Failed to parse blueprint");
            throw error;
        }

        // Generate and sync with retry logic
        let attempts = 0;
        let lastError = "";
        let currentSchema = generatePrismaSchema(ast);

        while (attempts < MAX_RETRY_ATTEMPTS) {
            attempts++;

            try {
                // Write schema
                await fs.writeFile(
                    path.join(projectPath, "prisma", "schema.prisma"),
                    currentSchema
                );

                // Try to push
                await execa("npx", ["prisma", "db", "push", "--accept-data-loss"], {
                    cwd: projectPath,
                    stdio: "pipe",
                });

                // Generate client
                await execa("npx", ["prisma", "generate"], {
                    cwd: projectPath,
                    stdio: "pipe",
                });

                // Success!
                break;
            } catch (error: any) {
                lastError = error.stderr || error.message || String(error);

                if (attempts < MAX_RETRY_ATTEMPTS) {
                    spinner3.text = `Building database... (fixing issue, attempt ${attempts + 1}/${MAX_RETRY_ATTEMPTS})`;

                    // Self-healing: ask AI to fix the schema
                    currentSchema = await fixPrismaSchema(currentSchema, lastError);
                } else {
                    spinner3.fail(`Database build failed after ${MAX_RETRY_ATTEMPTS} attempts`);
                    console.error(chalk.red(lastError));
                    throw new Error("Failed to build database");
                }
            }
        }

        spinner3.succeed("Database built");

        // =========================================================================
        // PHASE 4: Generate API & UI
        // =========================================================================
        const spinner4 = ora("Generating application...").start();

        // Generate API routes
        for (const strand of ast.strands) {
            const apiDir = path.join(projectPath, "src", "app", "api", strand.name.toLowerCase());
            await fs.ensureDir(apiDir);
            await fs.writeFile(path.join(apiDir, "route.ts"), generateAPIRoute(strand));
        }

        // Generate UI pages
        for (const view of ast.views) {
            const strandName = view.properties["list"]?.split(".")[0] || ast.strands[0]?.name;
            const strand = ast.strands.find((s) => s.name === strandName) || ast.strands[0];

            if (strand) {
                const viewDir = path.join(projectPath, "src", "app", view.name.toLowerCase());
                await fs.ensureDir(viewDir);
                await fs.writeFile(path.join(viewDir, "page.tsx"), generateUIPage(view, strand));
            }
        }

        // Generate home page
        await fs.writeFile(
            path.join(projectPath, "src", "app", "page.tsx"),
            generateSpawnHomePage(prompt, ast)
        );

        spinner4.succeed("Application generated");

        // =========================================================================
        // PHASE 5: Auto-Launch
        // =========================================================================
        const spinner5 = ora("Launching...").start();
        spinner5.succeed("Ready!");

        console.log(chalk.green("\n✅ App spawned successfully!\n"));
        console.log(chalk.white(`📂 Project: ${projectPath}`));
        console.log(chalk.white(`🔗 URL: http://localhost:3000\n`));

        // Change to project directory and launch
        process.chdir(projectPath);

        // Open browser after delay
        setTimeout(async () => {
            try {
                const platform = process.platform;
                const url = "http://localhost:3000";
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

        // Start dev server
        await execa("npm", ["run", "dev"], {
            cwd: projectPath,
            stdio: "inherit",
        });

    } catch (error: any) {
        console.error(chalk.red(`\n❌ Spawn failed: ${error.message}`));
        process.exit(1);
    }
}

/**
 * Generate a project name from the prompt
 */
function generateProjectName(prompt: string): string {
    return prompt
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .slice(0, 3)
        .join("-")
        .substring(0, 30)
        || "helix-app";
}

/**
 * Generate a Helix blueprint from natural language
 */
async function generateBlueprint(prompt: string): Promise<string> {
    const systemPrompt = `You are the Helix Architect v4.0.
Your task is to convert a natural language app description into a valid Helix blueprint.

${HELIX_SYNTAX_GUIDE}

RULES:
- Create appropriate strands for the data models needed
- Create views that make sense for the user's request
- Keep it simple but complete
- Output ONLY valid Helix code, no markdown fences or explanations

Example output:
strand Task {
  field title: String
  field is_completed: Boolean
  field priority: Int
}

view TaskList {
  list: Task.all()
  theme: Glassmorphism
}
`;

    return await createCompletion(
        systemPrompt,
        `Create a Helix blueprint for: ${prompt}`,
        { model: DEFAULT_MODEL, maxTokens: 2048 }
    );
}

/**
 * Self-healing: Fix Prisma schema errors using AI
 */
async function fixPrismaSchema(schema: string, error: string): Promise<string> {
    const systemPrompt = `You are a Prisma schema repair assistant.
Your task is to fix syntax errors in Prisma schema files.

RULES:
- Output ONLY the fixed schema, no explanations
- Keep the same models and fields, just fix the syntax
- Ensure all types are valid Prisma types (String, Int, Float, Boolean, DateTime)
- Ensure proper formatting with @id, @default, etc.
`;

    const userPrompt = `Fix this Prisma schema that has an error:

ERROR:
${error}

SCHEMA:
${schema}

Output the corrected schema:`;

    return await createCompletion(systemPrompt, userPrompt, { model: DEFAULT_MODEL, maxTokens: 2048 });
}

/**
 * Generate a home page for spawned apps
 */
function generateSpawnHomePage(prompt: string, ast: HelixAST): string {
    const links = ast.views
        .map(v => `
          <a
            href="/${v.name.toLowerCase()}"
            className="glass rounded-xl p-6 hover:bg-white/10 transition-all"
          >
            <h2 className="text-2xl font-bold mb-2">${v.name}</h2>
            <p className="text-gray-400">Manage ${v.name.toLowerCase()}</p>
          </a>`)
        .join("\n");

    return `// Spawned by Helix v4.0
export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <span className="text-sm text-indigo-400 font-mono">🧬 Spawned by Helix</span>
        </div>
        
        <h1 className="text-5xl font-bold text-white mb-4">
          ${prompt.split(" ").slice(0, 5).join(" ")}
        </h1>
        <p className="text-gray-400 text-xl mb-12">
          Built automatically from: "${prompt}"
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          ${links}
        </div>
        
        <footer className="mt-16 text-center text-gray-500 text-sm">
          Powered by Helix v4.0 One-Shot Generation
        </footer>
      </div>
    </main>
  );
}
`;
}
