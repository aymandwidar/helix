#!/usr/bin/env node

/**
 * Helix CLI v10.0 - Complete Development Platform
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

// Import v3.0 command modules
import { createProject } from "../commands/new";
import { generateStack } from "../commands/generate";
import { runDevServer } from "../commands/run";

// Import v4.0 command modules
import { spawnApp } from "../commands/spawn";
import { generateFlutterApp, regenerateFlutterDart } from "../generators/flutter";

// Import v10.0 command modules
import { deploy } from "../commands/deploy";
import { preview } from "../commands/preview";
import { getRegistry } from "../core/registry";
import { DeploymentPlatform } from "../core/types";

// ASCII Art Banner
const banner = `
${chalk.cyan("╦ ╦╔═╗╦  ╦═╗ ╦")}
${chalk.cyan("╠═╣║╣ ║  ║╔╩╦╝")}
${chalk.cyan("╩ ╩╚═╝╩═╝╩╩ ╚═")} ${chalk.magenta("v10.0")}
${chalk.gray("Complete Development Platform")}
${chalk.gray("Generate • Preview • Deploy")}
`;

const program = new Command();

program
    .name("helix")
    .description("Helix - AI-Native Development Platform")
    .version("10.0.0")
    .addHelpText("before", banner);

// ============================================================================
// V4.0 COMMAND: One-Shot Spawn
// ============================================================================

program
    .command("spawn <prompt>")
    .description("ONE-SHOT: Build complete app from natural language (zero intervention)")
    .option("-c, --context <path>", "Path to context/constitution file")
    .option("-t, --target <platform>", "Target platform: 'web' (Next.js) or 'flutter' (Mobile)", "web")
    .option("--db <type>", "Database type: 'local' (in-memory) or 'supabase' (cloud)", "local")
    .option("--ai <type>", "AI Provider: 'none' (no AI) or 'openrouter' (cloud AI)", "none")
    .action(async (prompt: string, options: { context?: string; target?: string; db?: string; ai?: string }) => {
        console.log(banner);

        if (!process.env.OPENROUTER_API_KEY) {
            console.error(chalk.red("❌ OPENROUTER_API_KEY not found in environment"));
            process.exit(1);
        }

        // Resolve constitution/context file
        let constitutionContent: string | undefined;
        let constitutionSource: string | undefined;

        // Priority 1: Explicit --context flag
        if (options.context) {
            const contextPath = path.resolve(process.cwd(), options.context);
            if (fs.existsSync(contextPath)) {
                constitutionContent = fs.readFileSync(contextPath, "utf-8");
                constitutionSource = options.context;
            } else {
                console.error(chalk.red(`❌ Context file not found: ${options.context}`));
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
            await spawnApp(prompt, constitutionContent);
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
    .action(async (options: { platform: string }) => {
        console.log(banner);
        await deploy(options.platform as DeploymentPlatform);
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

  ${chalk.gray("# Plugin system:")}
  $ helix plugins              ${chalk.gray("# List available generators")}
`);

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
    program.outputHelp();
}
