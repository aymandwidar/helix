/**
 * Helix Command: spawn
 * ONE-SHOT GENERATION - Full-stack app from natural language with ZERO intervention
 * v11.0 - Clean Factory: All builds isolated to builds/{app_name}/
 */

import chalk from "chalk";
import * as fs from "fs-extra";
import * as path from "path";
import execa = require("execa");
import ora from "ora";
import { createCompletion, DEFAULT_MODEL, RESEARCH_MODEL, LOCAL_MODEL } from "../openrouter";
import {
  parseHelix,
  generatePrismaSchema,
  generateAPIRoute,
  generateUIPage,
  HelixAST,
} from "../parser";
import { ARCHITECT_SYSTEM_PROMPT, HELIX_SYNTAX_GUIDE } from "../types";
import { SupabaseDeployer } from "../services/SupabaseDeployer";
import {
  validateConstitution,
  autoCorrectOptions,
  printConstitutionalReport,
  enhancePromptWithConstitution,
  type SpawnOptions,
} from "../utils/constitutional-validator";
import { MASTER_ARCHITECT_PROMPT, CONSTITUTIONAL_ENHANCEMENT_PROMPT } from "../prompts/master-architect";
import { resolveTheme, generateThemeCSS, getThemeClasses } from "../themes";
import { verifyBuild } from "../self-heal";
import { generateAPITests, generateComponentTests, generateTestConfig } from "../test-generator";
import { generateLayout, generateSidebarLayout, generatePageComponent, generateRootRedirect } from "../page-generator";

const MAX_RETRY_ATTEMPTS = 3;

// =============================================================================
// CLEAN FACTORY: All projects scoped to builds/
// =============================================================================
const HELIX_ROOT = path.resolve(__dirname, "..", "..");
const BUILDS_DIR = path.join(HELIX_ROOT, "builds");
const MASTER_ENV = path.join(HELIX_ROOT, ".env");

/**
 * Spawn a complete full-stack application from a natural language prompt
 */
export async function spawnApp(
  prompt: string,
  options: SpawnOptions = {},
  constitution?: string,
  connectionString?: string
): Promise<void> {
  console.log(chalk.cyan("\n🧬 HELIX SPAWN v11.0 - Clean Factory\n"));
  console.log(chalk.gray(`Prompt: "${prompt}"\n`));
  if (connectionString) {
    console.log(chalk.gray(`Supabase Autopilot: ENABLED\n`));
  }

  // =========================================================================
  // CONSTITUTIONAL VALIDATION (V10.2)
  // =========================================================================
  if (!options.noConstitution) {
    console.log(chalk.cyan("📜 Validating Constitutional Compliance...\n"));

    const report = validateConstitution(prompt, options);
    printConstitutionalReport(report);

    if (report.violations.length > 0) {
      const autoFixableCount = report.violations.filter(v => v.autoFixable).length;
      if (autoFixableCount > 0) {
        console.log(chalk.yellow(`\n✨ Auto-correcting ${autoFixableCount} violations...\n`));
        options = autoCorrectOptions(options, report.violations);
      }
    }

    prompt = enhancePromptWithConstitution(prompt);
    console.log(chalk.green("✅ Constitutional validation complete\n"));
  }

  // =========================================================================
  // CLEAN FACTORY: Enforce builds/ isolation
  // =========================================================================
  const projectName = generateProjectName(prompt);
  await fs.ensureDir(BUILDS_DIR);
  const projectPath = path.join(BUILDS_DIR, projectName);

  if (fs.existsSync(projectPath)) {
    console.error(chalk.red(`❌ Build "${projectName}" already exists in builds/`));
    console.error(chalk.gray(`   Path: ${projectPath}`));
    console.error(chalk.gray(`   Remove it first or use a different prompt.`));
    process.exit(1);
  }

  console.log(chalk.cyan(`📂 Clean Factory: builds/${projectName}/\n`));

  try {
    // =========================================================================
    // PHASE 1: Scaffolding
    // =========================================================================
    console.log(chalk.cyan("\n📦 Phase 1: Scaffolding Next.js project...\n"));

    const createNextArgs = [
      "create-next-app@latest",
      projectPath,
      "--typescript",
      "--tailwind",
      "--eslint",
      "--app",
      "--src-dir",
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
      await cleanupOnFailure(projectPath);
      process.exit(1);
    }

    console.log(chalk.green("\n✓ Next.js project created\n"));

    // =========================================================================
    // SELF-CONTAINMENT: .env, Dockerfile, docker-compose, .gitignore
    // =========================================================================
    console.log(chalk.cyan("🔒 Self-Containment: Injecting isolation files...\n"));

    // Clone master .env + add project-specific vars
    let masterEnvContent = "";
    if (fs.existsSync(MASTER_ENV)) {
      masterEnvContent = await fs.readFile(MASTER_ENV, "utf-8");
    }
    const projectEnv = `# Helix Clean Factory - Project Environment
# Cloned from master .env at ${new Date().toISOString()}
${masterEnvContent}
# Project-specific
DATABASE_URL="file:./dev.db"
NEXT_PUBLIC_APP_NAME="${projectName}"
`;
    await fs.writeFile(path.join(projectPath, ".env"), projectEnv);
    console.log(chalk.green("  ✅ .env (cloned from master)"));

    // Dockerfile
    await fs.writeFile(path.join(projectPath, "Dockerfile"), `# Helix Clean Factory - Auto-generated Dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --only=production

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
`);
    console.log(chalk.green("  ✅ Dockerfile"));

    // docker-compose.yml
    await fs.writeFile(path.join(projectPath, "docker-compose.yml"), `# Helix Clean Factory - Auto-generated
version: "3.8"
services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
    volumes:
      - app-data:/app/prisma
    restart: unless-stopped

volumes:
  app-data:
`);
    console.log(chalk.green("  ✅ docker-compose.yml"));

    // .gitignore
    await fs.writeFile(path.join(projectPath, ".gitignore"), `node_modules/
.next/
.env
*.db
*.db-journal
dist/
.turbo/
`);
    console.log(chalk.green("  ✅ .gitignore"));

    // next.config.ts - LAN-friendly
    await fs.writeFile(path.join(projectPath, "next.config.ts"), [
      'import type { NextConfig } from "next";',
      '',
      'const nextConfig: NextConfig = {',
      '  allowedDevOrigins: ["*"],',
      '};',
      '',
      'export default nextConfig;',
      ''
    ].join("\n"));
    console.log(chalk.green("  ✅ next.config.ts (LAN-friendly)"));

    // Override layout.tsx - no Google Fonts (blocks hydration over LAN)
    const layoutPath = path.join(projectPath, "src", "app", "layout.tsx");
    await fs.writeFile(layoutPath, [
      'import type { Metadata } from "next";',
      'import "./globals.css";',
      '',
      'export const metadata: Metadata = {',
      '  title: "' + projectName + '",',
      '  description: "Built by Helix v11.0",',
      '};',
      '',
      'export default function RootLayout({',
      '  children,',
      '}: Readonly<{',
      '  children: React.ReactNode;',
      '}>) {',
      '  return (',
      '    <html lang="en">',
      '      <body>{children}</body>',
      '    </html>',
      '  );',
      '}',
      ''
    ].join("\n"));
    console.log(chalk.green("  ✅ layout.tsx (no Google Fonts)"));

    // =========================================================================
    // Prisma Setup
    // =========================================================================
    const prismaSpinner = ora("Setting up Prisma@5.22.0...").start();

    await execa("npm", ["install", "-D", "prisma@5.22.0"], {
      cwd: projectPath,
      stdio: "pipe",
    });

    await execa("npm", ["install", "@prisma/client@5.22.0"], {
      cwd: projectPath,
      stdio: "pipe",
    });

    // Install test dependencies
    await execa("npm", ["install", "-D", "vitest", "@vitejs/plugin-react", "jsdom", "@testing-library/react", "@testing-library/jest-dom"], {
      cwd: projectPath,
      stdio: "pipe",
    });

    const prismaDir = path.join(projectPath, "prisma");
    await fs.ensureDir(prismaDir);

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

    // Create lib/utils.ts
    await fs.writeFile(
      path.join(libDir, "utils.ts"),
      `import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
`
    );

    // Apply Helix theme (V2: data-driven theme engine)
    // Theme is resolved later after blueprint parsing; write default for now
    // The actual theme CSS will be written in the post-blueprint phase
    const defaultThemeCSS = generateThemeCSS(resolveTheme(options.theme));
    await fs.writeFile(
      path.join(projectPath, "src", "app", "globals.css"),
      defaultThemeCSS
    );

    // Tailwind v4: config via CSS @theme, remove scaffold-generated tailwind.config.ts
    const twConfigPath = path.join(projectPath, "tailwind.config.ts");
    if (fs.existsSync(twConfigPath)) {
      await fs.remove(twConfigPath);
    }

    // Helix config
    await fs.writeJSON(
      path.join(projectPath, "helix.config.json"),
      { version: "10.3.0", spawned: true, cleanFactory: true, prompt, generatedAt: new Date().toISOString() },
      { spaces: 2 }
    );

    console.log(chalk.green("✓ Project scaffolded\n"));

    // =========================================================================
    // PHASE 1.5: SCOPE Stage (V2 — conditional, for complex prompts only)
    // =========================================================================
    let scopeRequirements: string | null = null;
    const isComplexPrompt = prompt.split(/\s+/).length > 30 || countEntityMentions(prompt) >= 3;

    if (isComplexPrompt) {
      const spinnerScope = ora("Analyzing requirements (complex prompt detected)...").start();
      try {
        scopeRequirements = await generateRequirements(prompt);
        spinnerScope.succeed("Requirements analyzed");
        // Save for reference
        await fs.writeFile(path.join(projectPath, "requirements.json"), scopeRequirements);
      } catch (error) {
        spinnerScope.warn("SCOPE stage failed — proceeding with direct blueprint generation");
        scopeRequirements = null;
      }
    }

    // =========================================================================
    // PHASE 2: Blueprint Generation with Self-Healing Retry
    // =========================================================================
    let helixBlueprint = "";
    let blueprintAttempts = 0;
    const maxBlueprintRetries = MAX_RETRY_ATTEMPTS;
    let blueprintSuccess = false;

    // Enrich prompt with SCOPE requirements if available
    const enrichedPrompt = scopeRequirements
      ? `${prompt}\n\n=== REQUIREMENTS ANALYSIS ===\n${scopeRequirements}\n=== END REQUIREMENTS ===`
      : prompt;

    while (blueprintAttempts < maxBlueprintRetries && !blueprintSuccess) {
      blueprintAttempts++;
      const spinner2 = ora(`Designing blueprint... (attempt ${blueprintAttempts}/${maxBlueprintRetries})`).start();

      try {
        helixBlueprint = await generateBlueprint(enrichedPrompt, constitution);

        // Validate the blueprint is parseable
        parseHelix(helixBlueprint);
        blueprintSuccess = true;
        spinner2.succeed("Blueprint designed");
      } catch (error: any) {
        const errMsg = error.message || String(error);
        if (blueprintAttempts < maxBlueprintRetries) {
          spinner2.warn(`Blueprint parse failed, self-healing... (${errMsg.substring(0, 80)})`);
          // Feed error back to LLM for retry
          helixBlueprint = await repairBlueprint(helixBlueprint, errMsg);
          try {
            parseHelix(helixBlueprint);
            blueprintSuccess = true;
            console.log(chalk.green("  ✅ Self-healed blueprint"));
          } catch {
            // Will retry in next loop iteration
          }
        } else {
          spinner2.fail("Blueprint generation failed after retries");
          await cleanupOnFailure(projectPath);
          throw error;
        }
      }
    }

    // Save blueprint for reference
    await fs.writeFile(path.join(projectPath, "blueprint.helix"), helixBlueprint);

    // =========================================================================
    // PHASE 3: Database Generation with Self-Healing
    // =========================================================================
    const spinner3 = ora("Building database...").start();

    let ast: HelixAST;
    try {
      ast = parseHelix(helixBlueprint);
    } catch (error) {
      spinner3.fail("Failed to parse blueprint");
      await cleanupOnFailure(projectPath);
      throw error;
    }

    // V2: Re-apply theme from blueprint AST (overrides default if theme specified in view)
    const blueprintThemeName = ast.views.find(v => v.properties.theme)?.properties.theme;
    if (blueprintThemeName) {
      const resolvedTheme = resolveTheme(blueprintThemeName);
      await fs.writeFile(
        path.join(projectPath, "src", "app", "globals.css"),
        generateThemeCSS(resolvedTheme)
      );
      console.log(chalk.cyan(`  Theme: ${resolvedTheme.name} (from blueprint)`));
    }

    let attempts = 0;
    let lastError = "";
    let currentSchema = generatePrismaSchema(ast);

    while (attempts < MAX_RETRY_ATTEMPTS) {
      attempts++;

      try {
        await fs.writeFile(
          path.join(projectPath, "prisma", "schema.prisma"),
          currentSchema
        );

        // CLEANUP: Remove any hallucinated prisma.config.ts
        const badConfigPath = path.join(projectPath, "prisma.config.ts");
        if (fs.existsSync(badConfigPath)) {
          await fs.remove(badConfigPath);
        }

        if (connectionString) {
          const spinnerMigrate = ora("Supabase: Deploying Schema...").start();
          try {
            const envPath = path.join(projectPath, ".env");
            let envContent = await fs.readFile(envPath, 'utf-8');
            envContent = envContent.replace(/DATABASE_URL=".*"/, `DATABASE_URL="${connectionString}"`);
            await fs.writeFile(envPath, envContent);

            await execa("npm", ["exec", "--", "prisma", "db", "push", "--accept-data-loss"], {
              cwd: projectPath,
              stdio: "pipe",
            });
            spinnerMigrate.succeed("Supabase: Schema Deployed Successfully");
          } catch (err: any) {
            spinnerMigrate.fail("Supabase Deployment Failed");
            console.error(chalk.red(err.message));
          }
        } else {
          await execa("npm", ["exec", "--", "prisma", "db", "push", "--accept-data-loss"], {
            cwd: projectPath,
            stdio: "pipe",
          });
        }

        await execa("npm", ["exec", "--", "prisma", "generate"], {
          cwd: projectPath,
          stdio: "pipe",
        });

        break;
      } catch (error: any) {
        lastError = error.stderr || error.message || String(error);

        if (attempts < MAX_RETRY_ATTEMPTS) {
          spinner3.text = `Building database... (self-healing attempt ${attempts + 1}/${MAX_RETRY_ATTEMPTS})`;
          currentSchema = await fixPrismaSchema(currentSchema, lastError);
        } else {
          spinner3.fail(`Database build failed after ${MAX_RETRY_ATTEMPTS} attempts`);
          console.error(chalk.red(lastError));
          await cleanupOnFailure(projectPath);
          throw new Error("Failed to build database");
        }
      }
    }

    spinner3.succeed("Database built");

    // =========================================================================
    // PHASE 4: Generate API & UI
    // =========================================================================
    const spinner4 = ora("Generating application...").start();

    // Resolve the active theme for component class generation
    const activeThemeName = blueprintThemeName || options.theme;
    const activeThemeClasses = getThemeClasses(activeThemeName);

    for (const strand of ast.strands) {
      const apiDir = path.join(projectPath, "src", "app", "api", strand.name.toLowerCase());
      await fs.ensureDir(apiDir);
      await fs.writeFile(path.join(apiDir, "route.ts"), generateAPIRoute(strand));
    }

    for (const view of ast.views) {
      const strandName = view.properties["list"]?.split(".")[0] || ast.strands[0]?.name;
      const strand = ast.strands.find((s) => s.name === strandName) || ast.strands[0];

      if (strand) {
        const viewDir = path.join(projectPath, "src", "app", view.name.toLowerCase());
        await fs.ensureDir(viewDir);
        await fs.writeFile(path.join(viewDir, "page.tsx"), generateUIPage(view, strand, ast.strands, activeThemeClasses));
      }
    }

    // Multi-page generation: if blueprint defines pages, generate per-page routes + layout
    if (ast.pages && ast.pages.length > 0) {
      // Generate layout based on page config
      const useSidebar = ast.pages.some(p => p.layout === 'sidebar');
      const layoutContent = useSidebar
        ? generateSidebarLayout(ast.pages, prompt.split(' ').slice(0, 4).join(' '))
        : generateLayout(ast.pages, prompt.split(' ').slice(0, 4).join(' '));

      await fs.writeFile(
        path.join(projectPath, "src", "app", "layout.tsx"),
        layoutContent
      );

      // Generate each page route
      for (const page of ast.pages) {
        const pageDir = path.join(projectPath, "src", "app", page.route.replace(/^\//, ''));
        await fs.ensureDir(pageDir);
        await fs.writeFile(
          path.join(pageDir, "page.tsx"),
          generatePageComponent(page, ast.strands)
        );
      }

      // Root redirect to first page
      await fs.writeFile(
        path.join(projectPath, "src", "app", "page.tsx"),
        generateRootRedirect(ast.pages[0].route)
      );
    } else {
      // Single-page default
      await fs.writeFile(
        path.join(projectPath, "src", "app", "page.tsx"),
        generateSpawnHomePage(prompt, ast, activeThemeClasses)
      );
    }

    // Generate test files for each strand
    const testApiDir = path.join(projectPath, "__tests__", "api");
    const testCompDir = path.join(projectPath, "__tests__", "components");
    await fs.ensureDir(testApiDir);
    await fs.ensureDir(testCompDir);

    for (const strand of ast.strands) {
      await fs.writeFile(
        path.join(testApiDir, `${strand.name.toLowerCase()}.test.ts`),
        generateAPITests(strand)
      );
      await fs.writeFile(
        path.join(testCompDir, `${strand.name.toLowerCase()}.test.tsx`),
        generateComponentTests(strand)
      );
    }

    await fs.writeFile(
      path.join(projectPath, "vitest.config.ts"),
      generateTestConfig()
    );

    // Exclude vitest.config.ts from Next.js tsconfig so `next build` doesn't type-check it
    const tsconfigPath = path.join(projectPath, "tsconfig.json");
    try {
      const tsconfigRaw = await fs.readFile(tsconfigPath, "utf-8");
      const tsconfig = JSON.parse(tsconfigRaw);
      if (tsconfig.exclude && !tsconfig.exclude.includes("vitest.config.ts")) {
        tsconfig.exclude.push("vitest.config.ts");
      } else if (!tsconfig.exclude) {
        tsconfig.exclude = ["node_modules", "vitest.config.ts"];
      }
      await fs.writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2));
    } catch {
      // Non-fatal — vitest config will still work, just might cause build warnings
    }

    spinner4.succeed("Application generated (with test suite)");

    // =========================================================================
    // PHASE 5: Post-Build Cleanup
    // =========================================================================
    const cleanupSpinner = ora("Cleaning temp files...").start();
    await postBuildCleanup(projectPath);
    cleanupSpinner.succeed("Clean build verified");

    // =========================================================================
    // PHASE 5.5: Build Verification with Self-Heal
    // =========================================================================
    const buildOk = await verifyBuild(projectPath);

    // =========================================================================
    // PHASE 6: Final Report (NO auto-launch on server)
    // =========================================================================
    console.log(chalk.green("\n✅ App spawned successfully!\n"));
    console.log(chalk.white(`📂 Project: ${projectPath}`));
    console.log(chalk.white(`📦 Docker:  cd builds/${projectName} && docker compose up`));
    console.log(chalk.white(`🔗 Dev:     cd builds/${projectName} && npm run dev`));
    console.log(chalk.white(`🌐 URL:     http://localhost:3000\n`));

    // Do NOT auto-launch dev server or open browser on headless server
    // The user can start it manually

  } catch (error: any) {
    console.error(chalk.red(`\n❌ Spawn failed: ${error.message}`));
    await cleanupOnFailure(projectPath);
    process.exit(1);
  }
}

// =============================================================================
// HELPERS
// =============================================================================

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

async function generateBlueprint(prompt: string, constitution?: string): Promise<string> {
  let constitutionSection = '';
  if (constitution) {
    constitutionSection = `
=== CONSTITUTION / PROJECT CONTEXT ===
The following guidelines MUST be followed when designing the application:

${constitution}

=== END CONSTITUTION ===

`;
  }

  const systemPrompt = `${constitutionSection}You are the Helix Architect v11.0.
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
 * Self-healing: Repair a broken blueprint by feeding error back to LLM
 */
// Self-healing with Qwen Thinking Mode for deeper reasoning
async function repairBlueprint(blueprint: string, error: string): Promise<string> {
  const systemPrompt = `You are a Helix blueprint repair specialist.
Fix the syntax errors in the provided .helix blueprint.

RULES:
- Output ONLY valid Helix code, no markdown fences or explanations
- Keep the same strands and views, just fix the syntax
- strands use: strand Name { field fieldName: Type }
- views use: view Name { list: StrandName.all() }
- Valid types: String, Int, Float, Boolean, DateTime
`;

  return await createCompletion(systemPrompt,
    `Fix this broken Helix blueprint:

ERROR: ${error}

BLUEPRINT:
${blueprint}

Output the corrected blueprint:`,
    { model: DEFAULT_MODEL, maxTokens: 2048, thinking: true }
  );
}

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

  return await createCompletion(systemPrompt,
    `Fix this Prisma schema that has an error:

ERROR:
${error}

SCHEMA:
${schema}

Output the corrected schema:`,
    { model: DEFAULT_MODEL, maxTokens: 2048, thinking: true }
  );
}

/**
 * Clean up orphaned/temp files after a successful build
 */
async function postBuildCleanup(projectPath: string): Promise<void> {
  const junkPatterns = [
    "prisma.config.ts",
    "*.tmp",
    "*.log",
    ".npm",
    "tsconfig.tsbuildinfo",
  ];

  for (const pattern of junkPatterns) {
    if (pattern.includes("*")) continue; // Skip glob patterns for now
    const junkPath = path.join(projectPath, pattern);
    if (fs.existsSync(junkPath)) {
      await fs.remove(junkPath);
    }
  }
}

/**
 * Clean up failed build directory
 */
async function cleanupOnFailure(projectPath: string): Promise<void> {
  if (fs.existsSync(projectPath)) {
    console.log(chalk.yellow(`🧹 Cleaning up failed build: ${projectPath}`));
    await fs.remove(projectPath);
  }
}

// =============================================================================
// HOME PAGE GENERATOR (unchanged logic, same smart view detection)
// =============================================================================

function generateSpawnHomePage(prompt: string, ast: HelixAST, themeClasses?: ReturnType<typeof getThemeClasses>): string {
  const tc = themeClasses || getThemeClasses();
  const appTitle = prompt.split(" ").slice(0, 5).join(" ");
  if (ast.strands.length === 0) {
    return `// Spawned by Helix v11.0 - Clean Factory\nexport default function Home() { return (<main className="min-h-screen p-8 flex items-center justify-center"><div className="text-center"><h1 className="text-4xl font-bold ${tc.heading} mb-4">🧬 ${appTitle}</h1><p className="${tc.textMuted}">No strands</p></div></main>); }`;
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
    const resetForm = s.fields.map(ff => `${ff.name}: ${ff.type === 'Int' || ff.type === 'Float' ? '0' : "''"}`).join(', ');
    return `const fetch${s.name}s = async () => { try { const r = await fetch('/api/${l}'); const j = await r.json(); set${s.name}s(j.data || j); } catch { setError('Failed to load ${l}s'); } };
  const submit${s.name} = async (e: React.FormEvent) => { e.preventDefault(); try { const r = await fetch('/api/${l}', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(${l}Form) }); if (!r.ok) { const err = await r.json(); setError(err.details?.join(', ') || err.error || 'Failed'); return; } setShow${s.name}Form(false); set${s.name}Form({ ${resetForm} }); fetch${s.name}s(); } catch { setError('Failed to create ${l}'); } };
  const del${s.name} = async (id: string) => { if (!confirm('Delete?')) return; try { await fetch('/api/${l}?id=' + id, { method: 'DELETE' }); fetch${s.name}s(); } catch { setError('Failed to delete ${l}'); } };`;
  }).join('\n  ');

  const fetchAll = ast.strands.map(s => `fetch${s.name}s()`).join('; ');

  const detectViewType = (fields: Array<{ name: string, type: string }>): 'gallery' | 'kanban' | 'feed' | 'grid' => {
    const fieldNames = fields.map(f => f.name.toLowerCase());
    if (fieldNames.some(n => ['image', 'photo', 'avatar', 'thumbnail', 'cover', 'picture', 'img'].includes(n))) return 'gallery';
    if (fieldNames.some(n => ['status', 'stage', 'phase', 'state', 'progress'].includes(n))) return 'kanban';
    const hasTitle = fieldNames.some(n => ['title', 'name', 'headline'].includes(n));
    const hasContent = fieldNames.some(n => ['body', 'content', 'description', 'message', 'text', 'note'].includes(n));
    if (hasTitle && hasContent) return 'feed';
    return 'grid';
  };

  const sections = ast.strands.map(s => {
    const l = s.name.toLowerCase();
    const viewType = detectViewType(s.fields);
    const inputs = s.fields.map(f => {
      const t = f.type === 'Int' || f.type === 'Float' ? 'number' : 'text';
      return `<div className="mb-3"><label className="block ${tc.textMuted} text-sm mb-1">${f.name}</label><input type="${t}" value={${l}Form.${f.name} || ''} onChange={e => set${s.name}Form({...${l}Form, ${f.name}: ${t === 'number' ? 'Number(e.target.value)' : 'e.target.value'}})} className="w-full rounded-md p-3 transition-colors" /></div>`;
    }).join('\n            ');

    const titleField = s.fields.find(f => ['title', 'name', 'headline', 'codename'].includes(f.name.toLowerCase()))?.name || s.fields[0]?.name || 'id';
    const statusField = s.fields.find(f => ['status', 'stage', 'phase', 'state', 'progress'].includes(f.name.toLowerCase()))?.name;
    const contentField = s.fields.find(f => ['body', 'content', 'description', 'message', 'text', 'note'].includes(f.name.toLowerCase()))?.name;

    let itemsLayout = '';

    if (viewType === 'kanban' && statusField) {
      itemsLayout = `<div className="flex gap-4 overflow-x-auto pb-4">
            {['Todo', 'In Progress', 'Done', 'Pending', 'Active', 'Complete'].filter(status => ${l}s.some(i => i.${statusField}?.toLowerCase().includes(status.toLowerCase()))).map(status => (
              <div key={status} className="min-w-[280px] glass rounded-xl p-4">
                <h4 className="${tc.heading} font-bold mb-3 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{background: status === 'Done' || status === 'Complete' ? '${tc.statusColors.success}' : status === 'In Progress' || status === 'Active' ? '${tc.statusColors.warning}' : '${tc.statusColors.info}'}}></span>
                  {status}
                </h4>
                <div className="space-y-2">
                  {${l}s.filter(i => i.${statusField}?.toLowerCase().includes(status.toLowerCase())).map(item => (
                    <div key={item.id} className="bg-white/5 rounded-lg p-3 group">
                      <div className="${tc.text} text-sm font-medium">{item.${titleField}}</div>
                      <button onClick={() => del${s.name}(item.id)} className="opacity-0 group-hover:opacity-100 text-red-400 text-xs mt-1">Delete</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>`;
    } else if (viewType === 'feed' && contentField) {
      itemsLayout = `<div className="space-y-4">
            {${l}s.map(item => (
              <article key={item.id} className="glass rounded-xl p-5 group">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-xl font-bold ${tc.heading}">{item.${titleField}}</h3>
                  <button onClick={() => del${s.name}(item.id)} className="opacity-0 group-hover:opacity-100 text-red-400">🗑️</button>
                </div>
                <p className="${tc.textMuted} leading-relaxed">{item.${contentField}}</p>
                <div className="mt-3 ${tc.textMuted} text-sm">{new Date(item.createdAt).toLocaleString()}</div>
              </article>
            ))}
          </div>`;
    } else {
      const display = s.fields.slice(0, 4).map(f => `<div><span className="${tc.textMuted} text-xs">${f.name}</span><div className="${tc.text} text-sm">{String(item.${f.name})}</div></div>`).join('\n                ');
      itemsLayout = `<div className="space-y-2">
            {${l}s.map(item => (
              <div key={item.id} className="glass rounded-lg p-4 group flex justify-between hover:bg-white/5">
                <div className="grid grid-cols-4 gap-4 flex-1">${display}</div>
                <button onClick={() => del${s.name}(item.id)} className="opacity-0 group-hover:opacity-100 text-red-400">🗑️</button>
              </div>
            ))}
          </div>`;
    }

    const viewLabel = viewType === 'gallery' ? '🖼️ Gallery' : viewType === 'kanban' ? '📋 Board' : viewType === 'feed' ? '📰 Feed' : '📊 Grid';

    return `
        <section className="mb-10">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-2xl font-bold ${tc.heading}">${s.name}s</h2>
              <span className="text-xs ${tc.textMuted}">${viewLabel}</span>
            </div>
            <button onClick={() => setShow${s.name}Form(true)} className="${tc.primaryButton} px-4 py-2 rounded-lg">+ Add</button>
          </div>
          {show${s.name}Form && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-gray-900 border border-white/10 rounded-xl p-6 w-full max-w-md">
                <h3 className="text-xl font-bold ${tc.heading} mb-4">Add ${s.name}</h3>
                <form onSubmit={submit${s.name}}>
            ${inputs}
                  <div className="flex gap-3 mt-4">
                    <button type="button" onClick={() => setShow${s.name}Form(false)} className="flex-1 ${tc.secondaryButton} py-2 rounded-lg">Cancel</button>
                    <button type="submit" className="flex-1 ${tc.primaryButton} py-2 rounded-lg">Create</button>
                  </div>
                </form>
              </div>
            </div>
          )}
          {${l}s.length === 0 ? <div className="glass rounded-lg p-6 text-center ${tc.textMuted}">No ${l}s yet</div> : ${itemsLayout}}
        </section>`;
  }).join('\n');

  return `// Spawned by Helix v11.0 — With error handling, loading states, pagination support
'use client';
import { useState, useEffect } from 'react';
${interfaces}

// Error Boundary Component
function ErrorBoundaryFallback({ error, reset }: { error: string; reset: () => void }) {
  return (
    <div className="glass rounded-xl p-6 text-center">
      <p className="text-red-400 mb-4">{error}</p>
      <button onClick={reset} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg">Try Again</button>
    </div>
  );
}

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  ${states}
  ${funcs}
  useEffect(() => { ${fetchAll}; setLoading(false); }, []);

  // Auto-dismiss error toast after 5 seconds
  useEffect(() => { if (error) { const t = setTimeout(() => setError(null), 5000); return () => clearTimeout(t); } }, [error]);

  if (loading) return (
    <main className="min-h-screen p-8 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="${tc.textMuted}">Loading...</p>
      </div>
    </main>
  );

  return (
    <main className="min-h-screen p-8">
      {/* Error Toast */}
      {error && (
        <div className="fixed top-4 right-4 z-50 bg-red-900/90 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-in">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">✕</button>
        </div>
      )}
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <span className="text-sm text-indigo-400 font-mono">🧬 Helix v11.0</span>
          <h1 className="text-4xl font-bold ${tc.heading} mt-1">${appTitle}</h1>
          <p className="${tc.textMuted}">${ast.strands.length} data types</p>
        </div>
${sections}
      </div>
    </main>
  );
}
`;
}

// =============================================================================
// SCOPE STAGE (V2) - Requirements generation for complex prompts
// =============================================================================

/**
 * Count potential entity/model mentions in a prompt.
 * Heuristic: capitalized nouns that could be data models.
 */
function countEntityMentions(prompt: string): number {
  const entityPattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
  const matches = prompt.match(entityPattern) || [];
  // Deduplicate
  const unique = new Set(matches.map(m => m.toLowerCase()));
  return unique.size;
}

/**
 * SCOPE Stage: Generate structured requirements from a complex prompt.
 * Uses the fast/cheap model (Qwen Flash) to produce a JSON requirements doc.
 */
async function generateRequirements(prompt: string): Promise<string> {
  const systemPrompt = `You are a requirements analyst for a code generation system.
Analyze the user's app description and produce a structured JSON requirements document.

Output ONLY valid JSON with this structure:
{
  "models": [
    {
      "name": "ModelName",
      "fields": [{ "name": "fieldName", "type": "String|Int|Float|Boolean|DateTime" }],
      "relations": [{ "name": "relName", "target": "OtherModel", "type": "belongs_to|has_many" }]
    }
  ],
  "views": [
    { "name": "ViewName", "displays": "ModelName", "type": "list|kanban|feed|gallery" }
  ],
  "theme": "glassmorphism|professional|minimal|vibrant",
  "complexity": "simple|moderate|complex"
}

Rules:
- Identify ALL data models and their relationships
- Choose appropriate field types
- Detect the best view type for each model
- Suggest a theme that matches the domain
- Output ONLY JSON, no markdown fences or explanations`;

  return await createCompletion(
    systemPrompt,
    `Analyze requirements for: ${prompt}`,
    { model: LOCAL_MODEL, maxTokens: 2048 }
  );
}
