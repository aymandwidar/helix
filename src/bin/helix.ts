#!/usr/bin/env node

/**
 * Helix CLI v4.0 - One-Shot Generation
 * AI-Native Programming Language with Full-Stack Generation
 * 
 * Commands:
 *   spawn <prompt>        - ONE-SHOT: Full app from natural language
 *   new <project>         - Scaffold a new Helix project
 *   generate <blueprint>  - Generate Prisma + API + UI from .helix
 *   run                   - Start the dev server
 *   research <topic>      - Generate domain research
 *   draft <idea>          - Create a .helix blueprint
 *   build <file>          - Compile .helix to React component
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

// ASCII Art Banner
const banner = `
${chalk.cyan("╦ ╦╔═╗╦  ╦═╗ ╦")}
${chalk.cyan("╠═╣║╣ ║  ║╔╩╦╝")}
${chalk.cyan("╩ ╩╚═╝╩═╝╩╩ ╚═")} ${chalk.yellow("v4.0")}
${chalk.gray("One-Shot Generation")}
${chalk.gray("Full-Stack from Natural Language")}
`;

const program = new Command();

program
    .name("helix")
    .description("Helix - AI-Native Programming Language CLI")
    .version("4.0.0")
    .addHelpText("before", banner);

// ============================================================================
// V4.0 COMMAND: One-Shot Spawn
// ============================================================================

program
    .command("spawn <prompt>")
    .description("ONE-SHOT: Build complete app from natural language (zero intervention)")
    .action(async (prompt: string) => {
        console.log(banner);

        if (!process.env.OPENROUTER_API_KEY) {
            console.error(chalk.red("❌ OPENROUTER_API_KEY not found in environment"));
            process.exit(1);
        }

        await spawnApp(prompt);
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
    .command("generate <blueprint>")
    .alias("gen")
    .description("Generate full stack from .helix blueprint (Prisma + API + UI)")
    .action(async (blueprint: string) => {
        console.log(banner);
        await generateStack(blueprint);
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
// HELP ENHANCEMENTS
// ============================================================================

program.addHelpText("after", `
${chalk.cyan("Examples:")}
  ${chalk.gray("# ONE-SHOT: Complete app from natural language")}
  $ helix spawn "Expense tracker for my small business"

  ${chalk.gray("# Manual workflow:")}
  $ helix new my-app
  $ helix generate app.helix
  $ helix run

  ${chalk.gray("# AI-powered research and drafting")}
  $ helix research "e-commerce best practices"
  $ helix draft "shopping cart with checkout"
  $ helix build cart.helix
`);

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
    program.outputHelp();
}
