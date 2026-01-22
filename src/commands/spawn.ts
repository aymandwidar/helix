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
 * @param prompt - Natural language description of the app to build
 * @param constitution - Optional constitution/context content to prepend to system prompts
 */
export async function spawnApp(prompt: string, constitution?: string): Promise<void> {
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
    // PHASE 1: Scaffolding (with visible output)
    // =========================================================================
    console.log(chalk.cyan("\n📦 Phase 1: Scaffolding Next.js project...\n"));

    const createNextArgs = [
      "create-next-app@latest",
      projectName,
      "--typescript",
      "--tailwind",
      "--eslint",
      "--app",
      "--src-dir",
      "--no-import-alias",
      "--use-npm",
      "--no-git",
      "--yes",
    ];
    console.log(chalk.gray(`⬇️  Executing: npx ${createNextArgs.join(" ")}\n`));

    try {
      await execa("npx", createNextArgs, { stdio: "inherit" });
    } catch (scaffoldError: any) {
      console.error(chalk.red(`\n❌ Scaffolding failed: ${scaffoldError.message}`));
      if (scaffoldError.stderr) {
        console.error(chalk.red(scaffoldError.stderr));
      }
      process.exit(1);
    }

    console.log(chalk.green("\n✓ Next.js project created\n"));

    // Initialize Prisma with locked version for stability
    const prismaSpinner = ora("Setting up Prisma@5.22.0...").start();

    // Install Prisma CLI and client with locked versions
    await execa("npm", ["install", "-D", "prisma@5.22.0"], {
      cwd: projectPath,
      stdio: "pipe",
    });

    await execa("npm", ["install", "@prisma/client@5.22.0"], {
      cwd: projectPath,
      stdio: "pipe",
    });

    // Manually create prisma directory and schema (avoids CLI version conflicts)
    const prismaDir = path.join(projectPath, "prisma");
    await fs.ensureDir(prismaDir);

    // Create base schema.prisma file
    await fs.writeFile(
      path.join(prismaDir, "schema.prisma"),
      `// Helix Generated Prisma Schema
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
`
    );

    // Create .env with DATABASE_URL
    const envContent = `# Helix Generated Environment
DATABASE_URL="file:./dev.db"
`;
    const existingEnv = path.join(projectPath, ".env");
    if (fs.existsSync(existingEnv)) {
      const current = await fs.readFile(existingEnv, "utf-8");
      if (!current.includes("DATABASE_URL")) {
        await fs.appendFile(existingEnv, envContent);
      }
    } else {
      await fs.writeFile(existingEnv, envContent);
    }

    prismaSpinner.succeed("Prisma setup complete (v5.22.0)");

    // Install additional dependencies
    const depsSpinner = ora("Installing additional dependencies...").start();
    await execa("npm", [
      "install",
      "lucide-react",
      "clsx",
      "tailwind-merge",
    ], {
      cwd: projectPath,
      stdio: "pipe",
    });
    depsSpinner.succeed("Dependencies installed");

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

/* DARK MODE INPUTS - Override browser defaults */
input, select, textarea {
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  color: white !important;
  border-radius: 0.375rem;
  padding: 0.75rem;
}

input:focus, select:focus, textarea:focus {
  outline: none !important;
  border-color: #f59e0b !important;
  box-shadow: 0 0 0 1px #f59e0b !important;
}

input::placeholder, textarea::placeholder {
  color: rgba(255, 255, 255, 0.5);
}
`
    );

    // Create helix config
    await fs.writeJSON(
      path.join(projectPath, "helix.config.json"),
      { version: "4.0.0", spawned: true, prompt, generatedAt: new Date().toISOString() },
      { spaces: 2 }
    );

    // Inject API key into .env (Zero-Touch requirement)
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (apiKey) {
      await fs.writeFile(
        path.join(projectPath, ".env"),
        `# Helix Generated Environment
# DO NOT COMMIT THIS FILE TO VERSION CONTROL
DATABASE_URL="file:./dev.db"
OPENROUTER_API_KEY=${apiKey}
`
      );
      console.log(chalk.gray("🔑 API key injected into .env"));
    }

    console.log(chalk.green("✓ Project scaffolded\n"));

    // =========================================================================
    // PHASE 2: Internal Drafting (The Architect)
    // =========================================================================
    const spinner2 = ora("Designing blueprint...").start();

    const helixBlueprint = await generateBlueprint(prompt, constitution);

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

        // CLEANUP: Remove any hallucinated prisma.config.ts
        const badConfigPath = path.join(projectPath, "prisma.config.ts");
        if (fs.existsSync(badConfigPath)) {
          await fs.remove(badConfigPath);
        }

        // Try to push
        await execa("npm", ["exec", "--", "prisma", "db", "push", "--accept-data-loss"], {
          cwd: projectPath,
          stdio: "pipe",
        });

        // Generate client
        await execa("npm", ["exec", "--", "prisma", "generate"], {
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
    console.log(chalk.cyan(`🚀 Igniting ${projectName}...\n`));

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
 * @param prompt - The user's app description
 * @param constitution - Optional constitution/context to guide generation
 */
async function generateBlueprint(prompt: string, constitution?: string): Promise<string> {
  // Build system prompt, prepending constitution if provided
  let constitutionSection = '';
  if (constitution) {
    constitutionSection = `
=== CONSTITUTION / PROJECT CONTEXT ===
The following guidelines MUST be followed when designing the application:

${constitution}

=== END CONSTITUTION ===

`;
  }

  const systemPrompt = `${constitutionSection}You are the Helix Architect v4.0.
Your task is to convert a natural language app description into a valid Helix blueprint.

${HELIX_SYNTAX_GUIDE}

RULES:
- Create appropriate strands for the data models needed
- Create views that make sense for the user's request
- Keep it simple but complete
- Output ONLY valid Helix code, no markdown fences or explanations
${constitution ? '- IMPORTANT: Follow ALL guidelines from the CONSTITUTION section above' : ''}

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

CRITICAL RULES:
- You are STRICTLY FORBIDDEN from generating or referencing prisma.config.ts
- Standard Prisma uses ONLY schema.prisma - nothing else
- Output ONLY the fixed schema content, no configuration code
- Output ONLY the fixed schema, no explanations or markdown
- Keep the same models and fields, just fix the syntax
- Ensure all types are valid Prisma types (String, Int, Float, Boolean, DateTime)
- Ensure proper formatting with @id, @default, etc.
- Do NOT include any TypeScript/JavaScript code
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
 * Generate a home page for spawned apps with FULL CRUD for ALL strands
 */
function generateSpawnHomePage(prompt: string, ast: HelixAST): string {
  const appTitle = prompt.split(" ").slice(0, 5).join(" ");
  if (ast.strands.length === 0) {
    return `// Spawned by Helix v4.2\nexport default function Home() { return (<main className="min-h-screen p-8 flex items-center justify-center"><div className="text-center"><h1 className="text-4xl font-bold text-white mb-4">🧬 ${appTitle}</h1><p className="text-gray-400">No strands</p></div></main>); }`;
  }

  const interfaces = ast.strands.map(s => {
    const f = s.fields.map(f => `${f.name}: ${f.type === 'String' ? 'string' : f.type === 'Int' || f.type === 'Float' ? 'number' : 'string'}`).join('; ');
    return `interface ${s.name} { id: string; ${f}; createdAt: string; }`;
  }).join('\n');

  const states = ast.strands.map(s => {
    const l = s.name.toLowerCase();
    const init = s.fields.map(f => `${f.name}: ${f.type === 'Int' || f.type === 'Float' ? '0' : "''"}`).join(', ');
    return `const [${l}s, set${s.name}s] = useState<${s.name}[]>([]);
  const [show${s.name}Form, setShow${s.name}Form] = useState(false);
  const [${l}Form, set${s.name}Form] = useState({ ${init} });`;
  }).join('\n  ');

  const funcs = ast.strands.map(s => {
    const l = s.name.toLowerCase();
    return `const fetch${s.name}s = async () => { set${s.name}s(await (await fetch('/api/${l}')).json()); };
  const submit${s.name} = async (e: React.FormEvent) => { e.preventDefault(); await fetch('/api/${l}', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(${l}Form) }); setShow${s.name}Form(false); fetch${s.name}s(); };
  const del${s.name} = async (id: string) => { if (!confirm('Delete?')) return; await fetch('/api/${l}?id=' + id, { method: 'DELETE' }); fetch${s.name}s(); };`;
  }).join('\n  ');

  const fetchAll = ast.strands.map(s => `fetch${s.name}s()`).join('; ');

  const sections = ast.strands.map(s => {
    const l = s.name.toLowerCase();
    const inputs = s.fields.map(f => {
      const t = f.type === 'Int' || f.type === 'Float' ? 'number' : 'text';
      return `<div className="mb-3"><label className="block text-gray-400 text-sm mb-1">${f.name}</label><input type="${t}" value={${l}Form.${f.name} || ''} onChange={e => set${s.name}Form({...${l}Form, ${f.name}: ${t === 'number' ? 'Number(e.target.value)' : 'e.target.value'}})} className="w-full bg-white/5 border border-white/10 rounded-md p-3 text-white placeholder-white/50 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors" /></div>`;
    }).join('\n            ');
    const display = s.fields.slice(0, 4).map(f => `<div><span className="text-gray-500 text-xs">${f.name}</span><div className="text-white text-sm">{String(item.${f.name})}</div></div>`).join('\n                ');
    return `
        <section className="mb-10">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-white">${s.name}s</h2>
            <button onClick={() => setShow${s.name}Form(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg">+ Add</button>
          </div>
          {show${s.name}Form && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-gray-900 border border-white/10 rounded-xl p-6 w-full max-w-md">
                <h3 className="text-xl font-bold text-white mb-4">Add ${s.name}</h3>
                <form onSubmit={submit${s.name}}>
            ${inputs}
                  <div className="flex gap-3 mt-4">
                    <button type="button" onClick={() => setShow${s.name}Form(false)} className="flex-1 bg-white/10 text-white py-2 rounded-lg">Cancel</button>
                    <button type="submit" className="flex-1 bg-indigo-600 text-white py-2 rounded-lg">Create</button>
                  </div>
                </form>
              </div>
            </div>
          )}
          <div className="space-y-2">
            {${l}s.length === 0 ? <div className="glass rounded-lg p-6 text-center text-gray-400">No ${l}s yet</div> : ${l}s.map(item => (
              <div key={item.id} className="glass rounded-lg p-4 group flex justify-between hover:bg-white/5">
                <div className="grid grid-cols-4 gap-4 flex-1">${display}</div>
                <button onClick={() => del${s.name}(item.id)} className="opacity-0 group-hover:opacity-100 text-red-400">🗑️</button>
              </div>
            ))}
          </div>
        </section>`;
  }).join('\n');

  return `// Spawned by Helix v4.2 - Multi-Strand
'use client';
import { useState, useEffect } from 'react';
${interfaces}
export default function Home() {
  const [loading, setLoading] = useState(true);
  ${states}
  ${funcs}
  useEffect(() => { ${fetchAll}; setLoading(false); }, []);
  if (loading) return <main className="min-h-screen p-8 flex items-center justify-center"><div className="text-white animate-pulse">Loading...</div></main>;
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <span className="text-sm text-indigo-400 font-mono">🧬 Helix</span>
          <h1 className="text-4xl font-bold text-white mt-1">${appTitle}</h1>
          <p className="text-gray-400">${ast.strands.length} data types</p>
        </div>
${sections}
      </div>
    </main>
  );
}
`;
}



