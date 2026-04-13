#!/usr/bin/env node

/**
 * Helix CLI v11.0 - Complete Development Platform
 * AI-Native Programming Language with Full-Stack Generation
 * 
 * Commands:
 *   spawn <prompt>        - ONE-SHOT: Full app from natural language
 *   new <project>         - Scaffold a new Helix project
 *   generate <blueprint>  - Generate Prisma + API + UI from .helix
 *   run                   - Start the dev server
 *   preview               - Hot-reload preview with file watching
 *   deploy                - One-command deployment
 *   research <topic>      - Generate domain research
 *   draft <idea>          - Create a .helix blueprint
 *   build <file>          - Compile .helix to React component
 *   plugins               - List registered generator plugins
 *   models                - List available AI models
 */

import { Command } from "commander";
import chalk from "chalk";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

// Load environment variables
dotenv.config();

// Import core modules
import { conductResearch } from "../researcher";
import { draftBlueprint } from "../architect";
import { compileToReact } from "../compiler";
import { AVAILABLE_MODELS, DEFAULT_MODEL, RESEARCH_MODEL } from "../openrouter";

// Import v11.0 command modules
import { createProject } from "../commands/new";
import { generateStack } from "../commands/generate";
import { runDevServer } from "../commands/run";

// Import v11.0 command modules (spawn & flutter)
import { spawnApp } from "../commands/spawn";
import { generateFlutterApp, regenerateFlutterDart } from "../generators/flutter";

// Import v11.0 command modules (deploy & platform)
import { deploy } from "../commands/deploy";
import { preview } from "../commands/preview";
import { getRegistry } from "../core/registry";
import { DeploymentPlatform } from "../core/types";
import { evolveCodebase } from "../commands/evolve";

// ASCII Art Banner
const banner = `
${chalk.cyan("╦ ╦╔═╗╦  ╦═╗ ╦")}
${chalk.cyan("╠═╣║╣ ║  ║╔╩╦╝")}
${chalk.cyan("╩ ╩╚═╝╩═╝╩╩ ╚═")} ${chalk.magenta("v11.0")}
${chalk.gray("AI-Native Development Platform")}
${chalk.gray("Generate • Preview • Deploy • Evolve")}
`;

const program = new Command();

program
    .name("helix")
    .description("Helix - AI-Native Development Platform")
    .version("12.0.0")
    .addHelpText("before", banner);

// ============================================================================
// V4.0 COMMAND: One-Shot Spawn
// ============================================================================

program
    .command("spawn <prompt>")
    .description("One-shot generation: Full app from natural language")
    .option("-t, --target <platform>", "Target: 'web' (Next.js) or 'flutter'", "web")
    .option("-d, --db <database>", "Database: 'postgres', 'mongodb', 'redis', or comma-separated")
    .option("--theme <theme>", "UI theme: glassmorphism, professional, minimal, vibrant, midnight, sunset", "glassmorphism")
    .option("--ai-context", "Enable AI context layer with Redis")
    .option("--cache", "Add Redis caching layer")
    .option("--no-constitution", "Bypass constitutional validation")
    .option("--components <ids>", "Helix Library component IDs (comma-separated)")
    .option("--constitution <file>", "Path to constitution.md file")
    .option("--ai <provider>", "AI provider (for Flutter): 'openrouter'")
    .option("--dry-run", "Show what would be generated without creating files")
    .action(async (prompt: string, options: any) => {
        console.log(banner);

        // Build spawn options
        const spawnOptions = {
            target: options.target,
            db: options.db,
            theme: options.theme,
            aiContext: options.aiContext,
            cache: options.cache,
            noConstitution: options.noConstitution,
            components: options.components ? options.components.split(',') : [],
            dryRun: options.dryRun || false,
        };

        // Dry run mode - show what would happen
        if (options.dryRun) {
            console.log(chalk.yellow("🔍 DRY RUN MODE — No files will be created\n"));
            console.log(chalk.white("  Configuration:"));
            console.log(chalk.gray(`    Target:       ${options.target}`));
            console.log(chalk.gray(`    Theme:        ${options.theme}`));
            console.log(chalk.gray(`    Database:     ${options.db || 'sqlite (default)'}`));
            console.log(chalk.gray(`    Constitution: ${options.noConstitution ? 'disabled' : 'enabled'}`));
            console.log(chalk.gray(`    Components:   ${spawnOptions.components.length > 0 ? spawnOptions.components.join(', ') : 'none'}`));
            console.log(chalk.gray(`    AI Context:   ${options.aiContext ? 'yes' : 'no'}`));
            console.log(chalk.gray(`    Cache:        ${options.cache ? 'yes' : 'no'}`));
            console.log(chalk.white("\n  Would generate:"));
            console.log(chalk.gray("    • Next.js project scaffold"));
            console.log(chalk.gray("    • AI-generated .helix blueprint from prompt"));
            console.log(chalk.gray(`    • Prisma schema + ${options.db === 'postgres' ? 'PostgreSQL' : options.db === 'supabase' ? 'Supabase (PostgreSQL)' : 'SQLite'} database`));
            console.log(chalk.gray("    • API routes with validation, rate limiting, pagination"));
            console.log(chalk.gray("    • React UI pages with theme applied"));
            console.log(chalk.gray("    • globals.css with theme CSS"));
            console.log(chalk.yellow("\n  Run without --dry-run to generate the app."));
            return;
        }

        // Load constitution if specified
        let constitutionContent: string | undefined;
        let constitutionSource: string | null = null;

        if (options.constitution) {
            // Priority 1: Explicit --constitution flag
            const userConstitutionPath = path.isAbsolute(options.constitution)
                ? options.constitution
                : path.join(process.cwd(), options.constitution);
            if (fs.existsSync(userConstitutionPath)) {
                constitutionContent = fs.readFileSync(userConstitutionPath, "utf-8");
                constitutionSource = path.basename(userConstitutionPath);
            } else {
                console.error(chalk.red(`❌ Constitution file not found: ${options.constitution}`));
                process.exit(1);
            }
        } else {
            // Priority 2: Auto-detect constitution.md in current directory
            const defaultConstitution = path.join(process.cwd(), "constitution.md");
            if (fs.existsSync(defaultConstitution)) {
                constitutionContent = fs.readFileSync(defaultConstitution, "utf-8");
                constitutionSource = "constitution.md";
            }
        }

        // Log if constitution is loaded
        if (constitutionSource) {
            console.log(chalk.yellow(`⚖️  Constitution Loaded: ${constitutionSource}`));
        }

        // Check API key for ALL targets (web uses OpenRouter for blueprint generation)
        if (!process.env.OPENROUTER_API_KEY) {
            console.error(chalk.red("❌ OPENROUTER_API_KEY not found in environment"));
            console.error(chalk.gray("   Set it in .env or export OPENROUTER_API_KEY=sk-or-v1-..."));
            process.exit(1);
        }

        // Route to appropriate generator based on target
        if (options.target === "flutter") {
            console.log(chalk.magenta("📱 Target: Flutter Mobile App"));
            if (options.db === "supabase") {
                console.log(chalk.blue("☁️  Database: Supabase Cloud (Realtime)"));
            } else {
                console.log(chalk.gray("💾 Database: Local (In-Memory)"));
            }
            if (options.ai === "openrouter") {
                console.log(chalk.green("🤖 AI: OpenRouter (Cloud Intelligence)"));
            }
            await generateFlutterApp(prompt, constitutionContent, options.db, options.ai);
        } else {
            console.log(chalk.cyan("🌐 Target: Next.js Web App"));
            await spawnApp(prompt, spawnOptions, constitutionContent);
        }
    });

// ============================================================================
// V3.0 COMMANDS: Full-Stack Generation
// ============================================================================

program
    .command("new <project-name>")
    .description("Scaffold a new Helix project (Next.js + Prisma + Tailwind)")
    .action(async (projectName: string) => {
        console.log(banner);
        await createProject(projectName);
    });

program
    .command("generate [blueprint]")
    .alias("gen")
    .description("Generate full stack from .helix blueprint or prompt")
    .option("-t, --target <platform>", "Target platform: 'web' (Next.js) or 'flutter' (Mobile)", "web")
    .option("-p, --prompt <text>", "Direct prompt for generation (Flutter only)")
    .action(async (blueprint: string | undefined, options: { target?: string; prompt?: string }) => {
        console.log(banner);

        // Route to appropriate generator based on target
        if (options.target === "flutter") {
            console.log(chalk.magenta("📱 Target: Flutter Mobile App"));

            let generationPrompt: string;

            // Priority 1: Direct --prompt flag
            if (options.prompt) {
                generationPrompt = options.prompt;
                console.log(chalk.yellow("📝 Using direct prompt"));
            }
            // Priority 2: Blueprint file
            else if (blueprint) {
                const blueprintPath = path.resolve(process.cwd(), blueprint);
                if (!fs.existsSync(blueprintPath)) {
                    console.error(chalk.red(`❌ Blueprint file not found: ${blueprint}`));
                    process.exit(1);
                }
                const blueprintContent = fs.readFileSync(blueprintPath, "utf-8");
                generationPrompt = `Generate from this .helix blueprint:\n\n${blueprintContent}`;
                console.log(chalk.yellow(`📄 Using blueprint: ${blueprint}`));
            }
            // No input provided
            else {
                console.error(chalk.red("❌ Please provide a blueprint file or use --prompt"));
                console.log(chalk.gray("  helix generate blueprint.helix --target flutter"));
                console.log(chalk.gray('  helix generate --target flutter --prompt "A task app with..."'));
                process.exit(1);
            }

            await regenerateFlutterDart(generationPrompt);
        } else {
            // Web target requires a blueprint file
            if (!blueprint) {
                console.error(chalk.red("❌ Please provide a blueprint file for web generation"));
                console.log(chalk.gray("  helix generate blueprint.helix"));
                process.exit(1);
            }
            console.log(chalk.cyan("🌐 Target: Next.js Web App"));
            await generateStack(blueprint);
        }
    });

program
    .command("run")
    .description("Start the dev server and open browser")
    .action(async () => {
        console.log(banner);
        await runDevServer();
    });

// ============================================================================
// RESEARCH COMMAND
// ============================================================================

program
    .command("research <topic>")
    .description("Conduct deep domain research and generate context file")
    .option("-m, --model <model>", "AI model to use")
    .action(async (topic: string, options: { model?: string }) => {
        console.log(banner);

        if (!process.env.OPENROUTER_API_KEY) {
            console.error(chalk.red("❌ OPENROUTER_API_KEY not found in environment"));
            process.exit(1);
        }

        const model = options.model || RESEARCH_MODEL;
        console.log(chalk.yellow(`💰 Using research-optimized model: ${model}`));

        try {
            await conductResearch(topic, model);
        } catch (error) {
            process.exit(1);
        }
    });

// ============================================================================
// DRAFT COMMAND
// ============================================================================

program
    .command("draft <idea>")
    .description("Draft a .helix blueprint from a user idea")
    .option("-c, --context <file>", "Path to context/research file")
    .option("-m, --model <model>", "AI model to use")
    .action(async (idea: string, options: { context?: string; model?: string }) => {
        console.log(banner);

        if (!process.env.OPENROUTER_API_KEY) {
            console.error(chalk.red("❌ OPENROUTER_API_KEY not found in environment"));
            process.exit(1);
        }

        const model = options.model || DEFAULT_MODEL;

        try {
            let contextFile = options.context;

            if (!contextFile) {
                const defaultContext = path.join(process.cwd(), "research.md");
                if (fs.existsSync(defaultContext)) {
                    contextFile = defaultContext;
                    console.log(chalk.yellow(`📎 Auto-using context: research.md`));
                }
            }

            await draftBlueprint(idea, contextFile, model);
        } catch (error) {
            process.exit(1);
        }
    });

// ============================================================================
// BUILD COMMAND
// ============================================================================

program
    .command("build <file>")
    .description("Compile a .helix blueprint to React/Next.js component")
    .option("-m, --model <model>", "AI model to use")
    .action(async (file: string, options: { model?: string }) => {
        console.log(banner);

        if (!process.env.OPENROUTER_API_KEY) {
            console.error(chalk.red("❌ OPENROUTER_API_KEY not found in environment"));
            process.exit(1);
        }

        const model = options.model || DEFAULT_MODEL;

        if (!file.endsWith(".helix")) {
            console.error(chalk.red(`❌ Invalid file type. Expected .helix file`));
            process.exit(1);
        }

        try {
            await compileToReact(file, model);
        } catch (error) {
            process.exit(1);
        }
    });

// ============================================================================
// PIPELINE COMMAND
// ============================================================================

program
    .command("pipeline <topic> <idea>")
    .description("Run full AI pipeline: research -> draft -> build")
    .option("-m, --model <model>", "AI model for draft/build")
    .action(async (topic: string, idea: string, options: { model?: string }) => {
        console.log(banner);
        console.log(chalk.magenta("\n🚀 Starting Helix Pipeline...\n"));

        if (!process.env.OPENROUTER_API_KEY) {
            console.error(chalk.red("❌ OPENROUTER_API_KEY not found"));
            process.exit(1);
        }

        const draftModel = options.model || DEFAULT_MODEL;

        try {
            console.log(chalk.magenta("━━━ STEP 1: RESEARCH ━━━"));
            await conductResearch(topic, RESEARCH_MODEL);

            console.log(chalk.magenta("\n━━━ STEP 2: DRAFT ━━━"));
            const contextFile = path.join(process.cwd(), "research.md");
            const helixFile = await draftBlueprint(idea, contextFile, draftModel);

            console.log(chalk.magenta("\n━━━ STEP 3: BUILD ━━━"));
            await compileToReact(helixFile, draftModel);

            console.log(chalk.green("\n🎉 Pipeline complete!"));
        } catch (error) {
            console.error(chalk.red("\n❌ Pipeline failed"));
            process.exit(1);
        }
    });

// ============================================================================
// MODELS COMMAND
// ============================================================================

program
    .command("models")
    .description("List available AI models and current defaults")
    .action(() => {
        console.log(banner);

        console.log(chalk.cyan("\n⚙️  Current Configuration:\n"));
        console.log(`  ${chalk.gray("Default Model:")}  ${chalk.green(DEFAULT_MODEL)}`);
        console.log(`  ${chalk.gray("Research Model:")} ${chalk.green(RESEARCH_MODEL)} ${chalk.yellow("(cost-optimized)")}`);

        console.log(chalk.cyan("\n📋 Available Models:\n"));
        AVAILABLE_MODELS.forEach((model, index) => {
            const isDefault = model === DEFAULT_MODEL;
            const isResearch = model === RESEARCH_MODEL;
            let suffix = "";
            if (isDefault) suffix = chalk.green(" ← default");
            if (isResearch) suffix = chalk.yellow(" ← research");

            console.log(`  ${chalk.gray(`${index + 1}.`)} ${chalk.white(model)}${suffix}`);
        });

        console.log(chalk.gray("\nUsage: helix <command> --model <model>\n"));
    });

// ============================================================================
// V10.0 COMMANDS: Platform Features
// ============================================================================

program
    .command("preview")
    .description("Launch hot-reload preview server with .helix file watching")
    .action(async () => {
        console.log(banner);
        await preview();
    });

program
    .command("deploy")
    .description("One-command deployment to cloud platforms")
    .option("-p, --platform <platform>", "Deployment platform: vercel, firebase, netlify", "vercel")
    .option("-t, --token <token>", "Auth token for the platform (optional)")
    .action(async (options: { platform: string; token?: string }) => {
        console.log(banner);
        await deploy(options.platform as DeploymentPlatform, options.token);
    });

program
    .command("plugins")
    .description("List registered generator plugins")
    .action(async () => {
        console.log(banner);
        const registry = getRegistry();
        await registry.scanForPlugins();
        registry.listPlugins();
    });

// ============================================================================
// EVOLVE COMMAND: Codebase Evolution & Analysis
// ============================================================================

program
    .command("evolve [action] [category]")
    .description("Evolve codebase: scan, suggest, apply fixes, security-audit")
    .option("-p, --path <path>", "Project path to analyze", process.cwd())
    .action(async (action: string | undefined, category: string | undefined, options: { path: string }) => {
        console.log(banner);
        await evolveCodebase(action || 'scan', category, options.path);
    });

// ============================================================================
// LIST COMMAND: Show all generated projects
// ============================================================================

program
    .command("list")
    .alias("ls")
    .description("List all generated projects in builds/")
    .action(async () => {
        console.log(banner);
        const buildsDir = path.resolve(__dirname, "..", "..", "builds");
        if (!fs.existsSync(buildsDir)) {
            console.log(chalk.yellow("No builds directory found. Run 'helix spawn' to generate your first app."));
            return;
        }
        const projects = fs.readdirSync(buildsDir, { withFileTypes: true })
            .filter((d: fs.Dirent) => d.isDirectory())
            .map((d: fs.Dirent) => {
                const configPath = path.join(buildsDir, d.name, "helix.config.json");
                let config: any = {};
                if (fs.existsSync(configPath)) {
                    try { config = JSON.parse(fs.readFileSync(configPath, "utf-8")); } catch {}
                }
                const stat = fs.statSync(path.join(buildsDir, d.name));
                return { name: d.name, prompt: config.prompt || '(unknown)', date: config.generatedAt || stat.mtime.toISOString(), version: config.version || '?' };
            });

        if (projects.length === 0) {
            console.log(chalk.yellow("No projects found. Run 'helix spawn' to generate your first app."));
            return;
        }

        console.log(chalk.cyan(`\n📦 Generated Projects (${projects.length}):\n`));
        projects.forEach((p, i) => {
            console.log(`  ${chalk.white(`${i + 1}.`)} ${chalk.green(p.name)}`);
            console.log(`     ${chalk.gray('Prompt:')} ${p.prompt.substring(0, 60)}`);
            console.log(`     ${chalk.gray('Date:')} ${new Date(p.date).toLocaleDateString()}`);
            console.log(`     ${chalk.gray('Run:')} cd builds/${p.name} && npm run dev\n`);
        });
    });

// ============================================================================
// COST COMMAND: Show session cost summary
// ============================================================================

program
    .command("cost")
    .description("Show AI model cost summary for the current session")
    .action(async () => {
        console.log(banner);
        const { getCostSummary } = await import("../openrouter");
        const summary = getCostSummary();
        if (summary.callCount === 0) {
            console.log(chalk.yellow("No API calls made in this session."));
            return;
        }
        console.log(chalk.cyan(`\n💰 Session Cost Summary:\n`));
        console.log(`  Total Calls: ${chalk.white(String(summary.callCount))}`);
        console.log(`  Total Cost:  ${chalk.green('$' + summary.totalCost.toFixed(6))}`);
        console.log(`\n  ${chalk.gray('Breakdown:')}`);
        summary.entries.forEach(e => {
            console.log(`    ${chalk.gray(e.timestamp.toLocaleTimeString())} ${e.model} — $${e.cost.toFixed(6)} (${e.promptTokens}+${e.completionTokens} tokens)`);
        });
    });

// ============================================================================
// DOCTOR COMMAND: System Health Check
// ============================================================================

program
    .command("doctor")
    .description("Check system health: API keys, Node version, dependencies")
    .action(async () => {
        console.log(banner);
        console.log(chalk.cyan("\n🩺 Helix Doctor — System Health Check\n"));

        let issues = 0;
        let warnings = 0;

        // ── Runtime ──────────────────────────────────────────────
        console.log(chalk.white("  Runtime"));

        // Check Node.js version
        const nodeVersion = process.version;
        const major = parseInt(nodeVersion.slice(1).split('.')[0]);
        if (major >= 18) {
            console.log(chalk.green(`    ✅ Node.js ${nodeVersion}`));
        } else {
            console.log(chalk.red(`    ❌ Node.js ${nodeVersion} — requires >= 18`));
            issues++;
        }

        // Check npm
        try {
            const { stdout } = await import("execa").then(m => m.default("npm", ["--version"]));
            console.log(chalk.green(`    ✅ npm v${stdout.trim()}`));
        } catch {
            console.log(chalk.red("    ❌ npm not found"));
            issues++;
        }

        // Check npx (for prisma, create-next-app)
        try {
            const { stdout } = await import("execa").then(m => m.default("npx", ["--version"]));
            console.log(chalk.green(`    ✅ npx v${stdout.trim()}`));
        } catch {
            console.log(chalk.red("    ❌ npx not found"));
            issues++;
        }

        // Check git
        try {
            const { stdout } = await import("execa").then(m => m.default("git", ["--version"]));
            console.log(chalk.green(`    ✅ ${stdout.trim()}`));
        } catch {
            console.log(chalk.yellow("    ⚠️  git not found (optional, needed for version control)"));
            warnings++;
        }

        // ── AI Configuration ─────────────────────────────────────
        console.log(chalk.white("\n  AI Configuration"));

        // Check .env file
        const envPath = path.resolve(__dirname, "..", "..", ".env");
        if (fs.existsSync(envPath)) {
            console.log(chalk.green(`    ✅ .env file found`));
        } else {
            console.log(chalk.yellow("    ⚠️  No .env file found (using environment variables)"));
            warnings++;
        }

        // Check API key
        if (process.env.OPENROUTER_API_KEY) {
            const key = process.env.OPENROUTER_API_KEY;
            console.log(chalk.green(`    ✅ OPENROUTER_API_KEY (${key.substring(0, 12)}...)`));

            // Validate API key with a test call
            try {
                const response = await fetch("https://openrouter.ai/api/v1/models", {
                    headers: { "Authorization": `Bearer ${key}` },
                });
                if (response.ok) {
                    console.log(chalk.green("    ✅ OpenRouter API key is valid"));
                } else {
                    console.log(chalk.red(`    ❌ OpenRouter API key rejected (HTTP ${response.status})`));
                    issues++;
                }
            } catch {
                console.log(chalk.yellow("    ⚠️  Could not validate API key (network error)"));
                warnings++;
            }
        } else {
            console.log(chalk.red("    ❌ OPENROUTER_API_KEY not set"));
            console.log(chalk.gray("       Set it in .env or export OPENROUTER_API_KEY=sk-or-..."));
            issues++;
        }

        // Check Ollama (optional local model)
        try {
            const ollamaResponse = await fetch("http://localhost:11434/api/tags", { signal: AbortSignal.timeout(3000) });
            if (ollamaResponse.ok) {
                const data = await ollamaResponse.json() as { models?: Array<{ name: string }> };
                const modelCount = data.models?.length || 0;
                console.log(chalk.green(`    ✅ Ollama running (${modelCount} model${modelCount !== 1 ? 's' : ''} available)`));
            } else {
                console.log(chalk.gray("    ℹ️  Ollama not responding (optional — for local AI)"));
            }
        } catch {
            console.log(chalk.gray("    ℹ️  Ollama not running (optional — for local AI)"));
        }

        // ── Deploy CLIs ──────────────────────────────────────────
        console.log(chalk.white("\n  Deploy Tools"));

        // Check Vercel CLI
        try {
            const { stdout } = await import("execa").then(m => m.default("vercel", ["--version"]));
            console.log(chalk.green(`    ✅ Vercel CLI v${stdout.trim()}`));
        } catch {
            console.log(chalk.gray("    ℹ️  Vercel CLI not installed (optional — npm i -g vercel)"));
        }

        // Check Railway CLI
        try {
            const { stdout } = await import("execa").then(m => m.default("railway", ["version"]));
            console.log(chalk.green(`    ✅ Railway CLI ${stdout.trim()}`));
        } catch {
            console.log(chalk.gray("    ℹ️  Railway CLI not installed (optional)"));
        }

        // Check Docker
        try {
            const { stdout } = await import("execa").then(m => m.default("docker", ["--version"]));
            console.log(chalk.green(`    ✅ ${stdout.trim().split(',')[0]}`));
        } catch {
            console.log(chalk.gray("    ℹ️  Docker not installed (optional — for containerized builds)"));
        }

        // ── Project State ────────────────────────────────────────
        console.log(chalk.white("\n  Project State"));

        // Check builds directory
        const buildsDir = path.resolve(__dirname, "..", "..", "builds");
        if (fs.existsSync(buildsDir)) {
            const projects = fs.readdirSync(buildsDir, { withFileTypes: true })
                .filter((d: fs.Dirent) => d.isDirectory());
            console.log(chalk.green(`    ✅ Builds directory: ${projects.length} project(s)`));
            if (projects.length > 0) {
                for (const p of projects.slice(0, 5)) {
                    console.log(chalk.gray(`       → ${p.name}`));
                }
                if (projects.length > 5) {
                    console.log(chalk.gray(`       ... and ${projects.length - 5} more`));
                }
            }
        } else {
            console.log(chalk.gray("    ℹ️  No builds directory yet (run 'helix spawn' to create one)"));
        }

        // Check disk space
        try {
            const { stdout } = await import("execa").then(m => m.default("df", ["-h", "."]));
            const lines = stdout.split('\n');
            if (lines.length > 1) {
                const parts = lines[1].split(/\s+/);
                const available = parts[3];
                console.log(chalk.green(`    ✅ Disk space available: ${available}`));
            }
        } catch {
            // Windows: try wmic or just skip
            console.log(chalk.gray("    ℹ️  Could not check disk space"));
        }

        // ── Summary ──────────────────────────────────────────────
        console.log('');
        if (issues === 0 && warnings === 0) {
            console.log(chalk.green("  🎉 All checks passed! Helix is ready to go.\n"));
        } else if (issues === 0) {
            console.log(chalk.green(`  ✅ Ready to go (${warnings} optional warning${warnings !== 1 ? 's' : ''}).\n`));
        } else {
            console.log(chalk.red(`  ⚠️  ${issues} issue(s) found. Fix them above and run 'helix doctor' again.\n`));
        }
    });

// ============================================================================
// DRIFT COMMAND: Detect manual changes vs original blueprint
// ============================================================================

program
    .command("drift [project]")
    .description("Detect manual changes made after generation")
    .option("-p, --path <path>", "Path to project directory")
    .action(async (project: string | undefined, options: { path?: string }) => {
        console.log(banner);
        const buildsDir = path.resolve(__dirname, "..", "..", "builds");
        let projectPath: string;

        if (options.path) {
            projectPath = path.resolve(options.path);
        } else if (project) {
            projectPath = path.join(buildsDir, project);
        } else {
            projectPath = process.cwd();
        }

        if (!fs.existsSync(projectPath)) {
            console.error(chalk.red(`Project not found: ${projectPath}`));
            process.exit(1);
        }

        const configPath = path.join(projectPath, "helix.config.json");
        if (!fs.existsSync(configPath)) {
            console.error(chalk.red("No helix.config.json found. Is this a Helix-generated project?"));
            process.exit(1);
        }

        console.log(chalk.cyan(`\n🔍 Drift Detection: ${path.basename(projectPath)}\n`));

        // Load the original generation manifest
        let config: any = {};
        try { config = JSON.parse(fs.readFileSync(configPath, "utf-8")); } catch {}

        // Track files by category
        const drifted: { file: string; type: string; detail: string }[] = [];
        const generated: string[] = [];

        // Scan key generated directories
        const scanDirs = ['app', 'prisma', 'components'];
        for (const dir of scanDirs) {
            const dirPath = path.join(projectPath, dir);
            if (!fs.existsSync(dirPath)) continue;

            const walkDir = (dirPath: string): string[] => {
                const entries = fs.readdirSync(dirPath, { withFileTypes: true });
                const files: string[] = [];
                for (const entry of entries) {
                    const fullPath = path.join(dirPath, entry.name);
                    if (entry.isDirectory()) {
                        if (entry.name !== 'node_modules' && entry.name !== '.next') {
                            files.push(...walkDir(fullPath));
                        }
                    } else {
                        files.push(fullPath);
                    }
                }
                return files;
            };

            const files = walkDir(dirPath);
            for (const file of files) {
                const relPath = path.relative(projectPath, file);
                generated.push(relPath);

                // Check git status for this file
                try {
                    const { execSync } = require('child_process');
                    const gitStatus = execSync(`git -C "${projectPath}" diff --name-only HEAD -- "${relPath}" 2>/dev/null`, { encoding: 'utf-8' }).trim();
                    if (gitStatus) {
                        // Get the diff stats
                        const diffStat = execSync(`git -C "${projectPath}" diff --stat HEAD -- "${relPath}" 2>/dev/null`, { encoding: 'utf-8' }).trim();
                        drifted.push({
                            file: relPath,
                            type: 'modified',
                            detail: diffStat.split('\n').pop()?.trim() || 'modified'
                        });
                    }
                } catch {
                    // Not a git repo or file not tracked — check modification time vs config
                    const fileStat = fs.statSync(file);
                    const genTime = config.generatedAt ? new Date(config.generatedAt) : new Date(0);
                    if (fileStat.mtime > genTime) {
                        drifted.push({
                            file: relPath,
                            type: 'modified-after-gen',
                            detail: `modified ${fileStat.mtime.toLocaleDateString()}`
                        });
                    }
                }
            }
        }

        // Report
        if (drifted.length === 0) {
            console.log(chalk.green("  ✅ No drift detected — project matches original generation."));
        } else {
            console.log(chalk.yellow(`  ⚠️  ${drifted.length} file(s) have drifted from original generation:\n`));
            drifted.forEach((d, i) => {
                const icon = d.type === 'modified' ? '📝' : '🔧';
                console.log(`  ${icon} ${chalk.white(d.file)}`);
                console.log(`     ${chalk.gray(d.detail)}`);
            });
            console.log(chalk.gray(`\n  Total generated files: ${generated.length}`));
            console.log(chalk.gray(`  Drifted files: ${drifted.length}`));
            console.log(chalk.yellow(`\n  💡 Use 'helix spawn' with --preserve-drift to keep these changes during regeneration.`));
        }
        console.log('');
    });

// ============================================================================
// SNAPSHOT COMMAND: Generate Docker configuration
// ============================================================================

program
    .command("snapshot [project]")
    .description("Bundle project with optimized Dockerfile for portable deployment")
    .option("-p, --path <path>", "Path to project directory")
    .option("--docker", "Generate Docker configuration (default)")
    .option("--compose", "Also generate docker-compose.yml")
    .action(async (project: string | undefined, options: { path?: string; docker?: boolean; compose?: boolean }) => {
        console.log(banner);
        const buildsDir = path.resolve(__dirname, "..", "..", "builds");
        let projectPath: string;

        if (options.path) {
            projectPath = path.resolve(options.path);
        } else if (project) {
            projectPath = path.join(buildsDir, project);
        } else {
            projectPath = process.cwd();
        }

        if (!fs.existsSync(projectPath)) {
            console.error(chalk.red(`Project not found: ${projectPath}`));
            process.exit(1);
        }

        const projectName = path.basename(projectPath);
        console.log(chalk.cyan(`\n📦 Snapshot: ${projectName}\n`));

        // Detect project type
        const hasPrisma = fs.existsSync(path.join(projectPath, "prisma", "schema.prisma"));
        const hasNextConfig = fs.existsSync(path.join(projectPath, "next.config.js")) || fs.existsSync(path.join(projectPath, "next.config.mjs")) || fs.existsSync(path.join(projectPath, "next.config.ts"));
        const pkgPath = path.join(projectPath, "package.json");
        let pkg: any = {};
        if (fs.existsSync(pkgPath)) {
            try { pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")); } catch {}
        }

        // Generate optimized multi-stage Dockerfile
        const dockerfile = `# Generated by Helix Snapshot
# Multi-stage build for optimized production image

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
${hasPrisma ? 'COPY prisma ./prisma/' : ''}
RUN \\
  if [ -f yarn.lock ]; then yarn install --frozen-lockfile; \\
  elif [ -f package-lock.json ]; then npm ci; \\
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm install --frozen-lockfile; \\
  else npm install; \\
  fi
${hasPrisma ? 'RUN npx prisma generate' : ''}

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
${hasPrisma ? 'COPY --from=builder /app/prisma ./prisma\nCOPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma' : ''}

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \\
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
`;

        const dockerignore = `node_modules
.next
.git
.env*
*.md
.DS_Store
builds/
`;

        // Write Dockerfile
        const dockerfilePath = path.join(projectPath, "Dockerfile");
        fs.writeFileSync(dockerfilePath, dockerfile);
        console.log(chalk.green(`  ✅ Created: Dockerfile`));

        // Write .dockerignore
        const dockerignorePath = path.join(projectPath, ".dockerignore");
        fs.writeFileSync(dockerignorePath, dockerignore);
        console.log(chalk.green(`  ✅ Created: .dockerignore`));

        // Generate docker-compose.yml if requested or by default
        const composeContent = `# Generated by Helix Snapshot
version: "3.8"

services:
  ${projectName}:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=file:./dev.db
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 10s
`;

        const composePath = path.join(projectPath, "docker-compose.yml");
        fs.writeFileSync(composePath, composeContent);
        console.log(chalk.green(`  ✅ Created: docker-compose.yml`));

        // Update next.config for standalone output if needed
        if (hasNextConfig) {
            const nextConfigPath = fs.existsSync(path.join(projectPath, "next.config.mjs"))
                ? path.join(projectPath, "next.config.mjs")
                : fs.existsSync(path.join(projectPath, "next.config.ts"))
                    ? path.join(projectPath, "next.config.ts")
                    : path.join(projectPath, "next.config.js");
            const nextConfig = fs.readFileSync(nextConfigPath, "utf-8");
            if (!nextConfig.includes("standalone")) {
                console.log(chalk.yellow(`  ⚠️  Add output: "standalone" to ${path.basename(nextConfigPath)} for optimized Docker builds`));
            }
        }

        console.log(chalk.cyan(`\n  📋 Quick start:`));
        console.log(chalk.gray(`    cd ${projectPath}`));
        console.log(chalk.gray(`    docker compose up --build`));
        console.log(chalk.gray(`    # App available at http://localhost:3000\n`));
    });

// ============================================================================
// PREFLIGHT COMMAND: Validate blueprint before generation
// ============================================================================

program
    .command("preflight <file>")
    .description("Validate a .helix blueprint before generation")
    .action(async (file: string) => {
        console.log(banner);

        const filePath = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
        if (!fs.existsSync(filePath)) {
            console.error(chalk.red(`File not found: ${file}`));
            process.exit(1);
        }

        const content = fs.readFileSync(filePath, "utf-8");

        try {
            const { preflight, formatPreflightResult } = await import("../commands/preflight");
            const result = preflight(content);
            console.log('\n' + formatPreflightResult(result));
            process.exit(result.passed ? 0 : 1);
        } catch (e: any) {
            console.error(chalk.red(`Preflight error: ${e.message}`));
            process.exit(1);
        }
    });

// ============================================================================
// INSTALL COMMAND: Component Marketplace
// ============================================================================

program
    .command("install [component]")
    .description("Install a component from the Helix library")
    .option("-p, --path <path>", "Target project directory", process.cwd())
    .action(async (component: string | undefined, options: { path: string }) => {
        console.log(banner);
        const { installComponent } = await import("../commands/install");
        await installComponent(component || 'list', options.path);
    });

// ============================================================================
// HELP ENHANCEMENTS
// ============================================================================

program.addHelpText("after", `
${chalk.cyan("Examples:")}
  ${chalk.gray("# ONE-SHOT: Complete app from natural language")}
  $ helix spawn "Expense tracker for my small business"
  $ helix spawn "Task app" --target flutter --db supabase --ai openrouter

  ${chalk.gray("# Development workflow:")}
  $ helix preview               ${chalk.gray("# Hot-reload with file watching")}
  $ helix deploy --platform vercel  ${chalk.gray("# Ship to production")}

  ${chalk.gray("# Manual workflow:")}
  $ helix new my-app
  $ helix generate app.helix
  $ helix run

  ${chalk.gray("# Project management:")}
  $ helix list                 ${chalk.gray("# Show all generated projects")}
  $ helix cost                 ${chalk.gray("# Show AI cost summary")}
  $ helix doctor               ${chalk.gray("# System health check")}
  $ helix drift my-app         ${chalk.gray("# Detect manual changes")}
  $ helix snapshot my-app      ${chalk.gray("# Generate Docker config")}
  $ helix preflight app.helix  ${chalk.gray("# Validate blueprint")}
  $ helix evolve scan          ${chalk.gray("# Analyze codebase health")}
  $ helix evolve apply         ${chalk.gray("# Auto-fix issues")}
  $ helix spawn "..." --dry-run ${chalk.gray("# Preview without generating")}

  ${chalk.gray("# Component library:")}
  $ helix install              ${chalk.gray("# List available components")}
  $ helix install auth-flow    ${chalk.gray("# Install a component package")}

  ${chalk.gray("# Plugin system:")}
  $ helix plugins              ${chalk.gray("# List available generators")}
`);

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
    program.outputHelp();
}
