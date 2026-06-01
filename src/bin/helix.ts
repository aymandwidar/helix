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

// Import template init
import { listTemplates, initFromTemplate } from "../commands/init";

// Import web dashboard
import { startWebDashboard } from "../commands/web";

// Import collaboration
import { startCollaborationServer } from "../commands/collaborate/server";
import { joinCollaborationSession } from "../commands/collaborate/client";

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
${chalk.cyan("╩ ╩╚═╝╩═╝╩╩ ╚═")} ${chalk.magenta("v17.0.0")}
${chalk.gray("AI-Native Development Platform")}
${chalk.gray("Generate • Chat • Preview • Deploy • Evolve")}
`;

const program = new Command();

program
    .name("helix")
    .description("Helix - AI-Native Development Platform")
    .version("17.0.0")
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
    .option("--production-grade", "Apply strict-quality policy and run a post-generation audit")
    .option("--components <ids>", "Helix Library component IDs (comma-separated)")
    .option("--constitution <file>", "Path to constitution.md file")
    .option("--ai <provider>", "AI provider (for Flutter): 'openrouter'")
    .option("--dry-run", "Show what would be generated without creating files")
    .option("--parallel <prompts...>", "Run N spawns in parallel worktrees instead — pass extra prompts here")
    .option("--budget <n>", "Total token budget across parallel workers", v => parseInt(v, 10))
    .action(async (prompt: string, options: any) => {
        console.log(banner);

        // Sprint 13: --parallel re-routes to the parallel orchestrator.
        if (Array.isArray(options.parallel) && options.parallel.length > 0) {
            const { runParallel, formatConflictReport } = await import("../parallel");
            const prompts = [prompt, ...options.parallel];
            const result = await runParallel({
                tasks: prompts.map(p => ({ prompt: p })),
                cwd: process.cwd(),
                totalBudget: options.budget ?? null,
            });
            for (const w of result.workers) {
                const icon = w.success ? chalk.green("✓") : chalk.red("✗");
                console.log(`  ${icon} ${w.task.label || w.task.prompt.slice(0, 40)} — ${w.changedFiles.length} files${w.error ? ` (error: ${w.error})` : ""}`);
            }
            console.log("\n" + formatConflictReport(result.conflicts));
            if (result.workers.some(w => !w.success)) process.exit(1);
            return;
        }

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
            // --production-grade: prepend strict-quality policy to the prompt
            let effectivePrompt = prompt;
            if (options.productionGrade) {
                const { PRODUCTION_GRADE_PROMPT_SUFFIX, runPostGenerateAudit } = await import("../quality/production_grade");
                effectivePrompt = `${prompt}\n\n${PRODUCTION_GRADE_PROMPT_SUFFIX}`;
                console.log(chalk.bold.magenta("🏭 Production-grade policy enabled"));
                await spawnApp(effectivePrompt, spawnOptions, constitutionContent);

                // Post-generation audit on the most recent build
                const buildsDir = path.resolve(__dirname, "..", "..", "builds");
                const projects = fs.existsSync(buildsDir)
                    ? fs.readdirSync(buildsDir, { withFileTypes: true })
                        .filter(d => d.isDirectory())
                        .map(d => ({ name: d.name, mtime: fs.statSync(path.join(buildsDir, d.name)).mtime.getTime() }))
                        .sort((a, b) => b.mtime - a.mtime)
                    : [];
                if (projects.length > 0) {
                    const latest = path.join(buildsDir, projects[0].name);
                    console.log(chalk.cyan(`\n🔬 Running post-generation audit on ${projects[0].name}...`));
                    const audit = runPostGenerateAudit({ cwd: latest });
                    console.log(audit.formattedReport);
                    if (!audit.passed) {
                        console.error(chalk.red(`\n❌ Production-grade audit failed: ${audit.blockingFindings} blocking finding(s).`));
                        process.exit(1);
                    }
                }
                return;
            }
            await spawnApp(prompt, spawnOptions, constitutionContent);
        }
    });

// ============================================================================
// V17.0 COMMANDS: Parallel worktree execution
// ============================================================================

const parallelCmd = program
    .command("parallel")
    .description("Run multiple subagent tasks in isolated git worktrees");

parallelCmd
    .command("spawn <prompts...>")
    .description("Spawn N agents in parallel — each gets its own worktree")
    .option("--budget <n>", "Total token budget across all workers (split evenly)", v => parseInt(v, 10))
    .option("--no-merge", "Skip the auto-merge step (leave worktrees in place)")
    .option("--no-clean", "Keep worktrees on disk after the run finishes")
    .action(async (prompts: string[], options: { budget?: number; merge?: boolean; clean?: boolean }) => {
        console.log(banner);
        const { runParallel, formatConflictReport } = await import("../parallel");
        const tasks = prompts.map(p => ({ prompt: p }));
        const result = await runParallel({
            tasks,
            cwd: process.cwd(),
            totalBudget: options.budget ?? null,
            autoMerge: options.merge !== false,
            autoClean: options.clean !== false,
        });
        for (const w of result.workers) {
            const icon = w.success ? chalk.green("✓") : chalk.red("✗");
            console.log(`  ${icon} ${w.task.label || w.task.prompt.slice(0, 40)} — ${w.changedFiles.length} files${w.error ? ` (error: ${w.error})` : ""}`);
        }
        console.log("\n" + formatConflictReport(result.conflicts));
        if (result.merge) {
            console.log(`merge: ${result.merge.merged.length} merged, ${result.merge.skipped.length} skipped`);
        }
        if (result.workers.some(w => !w.success)) process.exit(1);
    });

parallelCmd
    .command("evolve <prompts...>")
    .description("Run N evolve tasks in parallel worktrees")
    .option("--budget <n>", "Total token budget across all workers", v => parseInt(v, 10))
    .option("--no-merge", "Skip auto-merge")
    .option("--no-clean", "Keep worktrees on disk")
    .action(async (prompts: string[], options: { budget?: number; merge?: boolean; clean?: boolean }) => {
        console.log(banner);
        const { runParallel, formatConflictReport } = await import("../parallel");
        const tasks = prompts.map(p => ({ prompt: `Evolve the project to: ${p}` }));
        const result = await runParallel({
            tasks,
            cwd: process.cwd(),
            totalBudget: options.budget ?? null,
            autoMerge: options.merge !== false,
            autoClean: options.clean !== false,
        });
        for (const w of result.workers) {
            const icon = w.success ? chalk.green("✓") : chalk.red("✗");
            console.log(`  ${icon} ${w.task.label || w.task.prompt.slice(0, 40)} — ${w.changedFiles.length} files${w.error ? ` (error: ${w.error})` : ""}`);
        }
        console.log("\n" + formatConflictReport(result.conflicts));
        if (result.merge) {
            console.log(`merge: ${result.merge.merged.length} merged, ${result.merge.skipped.length} skipped`);
        }
        if (result.workers.some(w => !w.success)) process.exit(1);
    });

parallelCmd
    .command("status")
    .description("Show progress of the most recent parallel run")
    .action(async () => {
        const { readStatus, formatStatus } = await import("../parallel");
        const status = readStatus(process.cwd());
        console.log(formatStatus(status));
    });

// ============================================================================
// V16.0 COMMANDS: Git workflows, themes, usage, recap, verify-visual
// ============================================================================

const prCmd = program.command("pr").description("AI-assisted GitHub PR workflows");

prCmd
    .command("create")
    .description("Open a PR for the current branch with an AI-generated title and body")
    .option("-b, --base <branch>", "Base branch to compare against (default: detected)")
    .option("-m, --model <model>", "AI model to use")
    .option("--print-only", "Print the title/body and gh command instead of running gh")
    .action(async (options: { base?: string; model?: string; printOnly?: boolean }) => {
        console.log(banner);
        if (!process.env.OPENROUTER_API_KEY) {
            console.error(chalk.red("❌ OPENROUTER_API_KEY not found in environment"));
            process.exit(1);
        }
        const { createPr } = await import("../git");
        const result = await createPr({
            cwd: process.cwd(),
            base: options.base,
            printOnly: !!options.printOnly,
            model: options.model,
        });
        console.log(chalk.cyan(`\nBranch: ${result.branch || "(unknown)"}  →  Base: ${result.base}`));
        console.log(chalk.gray(`Diff: ${result.diffPreview || "(none)"}\n`));
        console.log(chalk.bold("Title: ") + result.title);
        console.log("\n" + result.body + "\n");
        if (result.prUrl) console.log(chalk.green(`✅ PR opened: ${result.prUrl}`));
        else if (result.method === "gh") console.log(chalk.yellow("gh ran but no PR URL was extracted from output."));
        else if (result.method === "no-gh") console.log(chalk.yellow("`gh` CLI not installed — body printed above; install with: brew install gh"));
    });

prCmd
    .command("review")
    .description("AI code review of the current branch's diff vs base")
    .option("-b, --base <branch>", "Base branch (default: detected)")
    .option("-m, --model <model>", "AI model to use")
    .action(async (options: { base?: string; model?: string }) => {
        console.log(banner);
        if (!process.env.OPENROUTER_API_KEY) {
            console.error(chalk.red("❌ OPENROUTER_API_KEY not found in environment"));
            process.exit(1);
        }
        const { reviewPr } = await import("../git");
        const text = await reviewPr({ cwd: process.cwd(), base: options.base, model: options.model });
        console.log("\n" + text + "\n");
    });

program
    .command("changelog")
    .description("Generate a CHANGELOG.md section from git history")
    .option("--since <ref>", "Start from this git ref (default: most recent tag)")
    .option("--style <style>", "Format: 'conventional' or 'semver'", "conventional")
    .option("-m, --model <model>", "AI model to use")
    .option("--dry-run", "Print the section without writing CHANGELOG.md")
    .action(async (options: any) => {
        console.log(banner);
        if (!process.env.OPENROUTER_API_KEY) {
            console.error(chalk.red("❌ OPENROUTER_API_KEY not found in environment"));
            process.exit(1);
        }
        const { generateChangelog } = await import("../git");
        const result = await generateChangelog({
            cwd: process.cwd(),
            since: options.since,
            style: options.style,
            model: options.model,
            dryRun: !!options.dryRun,
        });
        console.log(chalk.cyan(`\n📜 Changelog (${result.commits} commits since ${result.since})\n`));
        console.log(result.section);
        if (!options.dryRun) {
            console.log(chalk.green(`\n${result.merged ? "✅ Merged into" : "✅ Wrote"} ${result.file}`));
        }
    });

program
    .command("branch-protect")
    .description("Show recommended GitHub branch-protection settings + the gh-api command to apply them")
    .option("-b, --branch <branch>", "Branch to protect", "main")
    .option("--checks <list>", "Comma-separated required CI checks", "build,test")
    .option("--reviews <n>", "Required approving reviews", "1")
    .action(async (options: { branch: string; checks: string; reviews: string }) => {
        console.log(banner);
        const { describeBranchProtection } = await import("../git");
        const result = await describeBranchProtection({
            cwd: process.cwd(),
            branch: options.branch,
            checks: options.checks.split(",").map(s => s.trim()).filter(Boolean),
            requiredReviews: parseInt(options.reviews, 10) || 1,
        });
        console.log(chalk.cyan(`\nRecommended protection for ${result.repo || "(detect repo)"} branch '${result.branch}':\n`));
        console.log(JSON.stringify(result.payload, null, 2));
        console.log(chalk.cyan("\nApply with:\n"));
        console.log(result.command);
    });

const themeCmd = program.command("theme").description("Manage chat output themes");

themeCmd
    .command("list")
    .description("List available themes (built-in + custom)")
    .action(async () => {
        console.log(banner);
        const { listAvailableThemes, getActiveTheme } = await import("../chat/themes");
        const all = listAvailableThemes();
        const active = getActiveTheme();
        for (const t of all) {
            const marker = t.name === active.name ? chalk.green("●") : " ";
            console.log(`  ${marker} ${chalk.bold(t.name)}${t.description ? chalk.gray(" — " + t.description) : ""}`);
        }
    });

themeCmd
    .command("use <name>")
    .description("Persist a theme as the default in ~/.helix/settings.json")
    .action(async (name: string) => {
        const { resolveTheme } = await import("../chat/themes");
        const { loadSettings, saveSettings } = await import("../mcp/config");
        const theme = resolveTheme(name);
        if (theme.name !== name && !["default", "monokai", "solarized-dark", "solarized-light", "high-contrast"].includes(name)) {
            console.error(chalk.red(`❌ Unknown theme: ${name}`));
            process.exit(1);
        }
        const settings = loadSettings();
        (settings as any).chatTheme = name;
        saveSettings(settings);
        console.log(chalk.green(`✅ Default theme set to '${name}'`));
    });

program
    .command("usage")
    .description("Show usage stats for the most recent chat session")
    .action(async () => {
        console.log(banner);
        const { readMostRecentSession, formatUsage } = await import("../chat/usage");
        const entry = readMostRecentSession();
        if (!entry) {
            console.log(chalk.yellow("No session logs yet. Use `helix chat` first."));
            return;
        }
        console.log("\n" + formatUsage(entry.snapshot) + "\n");
    });

program
    .command("recap")
    .description("Print recent session recap files")
    .option("-n, --count <n>", "How many to print", "1")
    .action(async (options: { count: string }) => {
        console.log(banner);
        const dir = path.join(process.cwd(), ".helix", "recaps");
        if (!fs.existsSync(dir)) {
            console.log(chalk.yellow("No recap files. Use /recap --save in chat to create one."));
            return;
        }
        const files = fs.readdirSync(dir).filter(f => f.endsWith(".md")).sort().reverse();
        const count = Math.max(1, parseInt(options.count, 10) || 1);
        for (const f of files.slice(0, count)) {
            console.log(chalk.cyan(`\n— ${f} —\n`));
            console.log(fs.readFileSync(path.join(dir, f), "utf-8"));
        }
    });

program
    .command("verify-visual")
    .description("Capture a screenshot of the running app and diff against the baseline")
    .option("--url <url>", "URL to capture (default: helix.config.json previewUrl or http://localhost:3000)")
    .option("--threshold <n>", "Pixel-diff threshold 0..1", "0.1")
    .action(async (options: { url?: string; threshold: string }) => {
        console.log(banner);
        const { verifyVisual } = await import("../quality/visual");
        const result = await verifyVisual({
            cwd: process.cwd(),
            url: options.url,
            threshold: parseFloat(options.threshold) || 0.1,
        });
        switch (result.status) {
            case "no-deps":
                console.log(chalk.yellow(result.message || "Optional dependencies missing."));
                process.exit(2);
                break;
            case "baseline-created":
                console.log(chalk.green(`✅ Captured baseline: ${result.baselinePath}`));
                break;
            case "match":
                console.log(chalk.green(`✅ Visual match (${result.totalPixels} pixels)`));
                break;
            case "mismatch":
                console.log(chalk.red(`✗ Visual mismatch: ${result.mismatchedPixels}/${result.totalPixels} pixels`));
                if (result.diffPath) console.log(chalk.gray(`   diff: ${result.diffPath}`));
                process.exit(1);
                break;
            case "error":
                console.error(chalk.red(`❌ ${result.message || "unknown error"}`));
                process.exit(1);
                break;
        }
    });

// ============================================================================
// V15.2 COMMANDS: Quality audits, regression guard, diff helpers
// ============================================================================

program
    .command("audit [project]")
    .description("Run quality audits (a11y, performance, SEO, security)")
    .option("-p, --path <path>", "Project path")
    .option("-c, --category <cat>", "Comma-separated subset: a11y,performance,seo,security")
    .option("--json", "Emit JSON instead of human-readable output")
    .action(async (project: string | undefined, options: { path?: string; category?: string; json?: boolean }) => {
        if (!options.json) console.log(banner);
        const cwd = options.path
            ? path.resolve(options.path)
            : project
                ? path.resolve(__dirname, "..", "..", "builds", project)
                : process.cwd();
        const { auditProject, formatAuditReport } = await import("../audit");
        const categories = options.category
            ? options.category.split(",").map(s => s.trim()).filter(Boolean) as any
            : undefined;
        const report = auditProject({ cwd, categories });
        if (options.json) {
            process.stdout.write(JSON.stringify(report, null, 2) + "\n");
            return;
        }
        console.log(formatAuditReport(report));
        // Exit non-zero when there are critical findings (CI-friendly)
        if (report.summary.bySeverity.critical > 0) process.exit(1);
    });

program
    .command("regression-guard [action]")
    .description("Capture and check a regression baseline (file checksums + validation steps)")
    .option("-p, --path <path>", "Project path", process.cwd())
    .option("--note <text>", "Annotate the baseline")
    .option("--skip-validation", "Don't run build/tests when capturing (faster, less reliable)")
    .action(async (action: string | undefined, options: { path: string; note?: string; skipValidation?: boolean }) => {
        console.log(banner);
        const a = (action || "check").toLowerCase();
        const { captureBaseline, checkAgainstBaseline, formatRegressionDiff } = await import("../quality/regression");
        if (a === "capture") {
            const baseline = await captureBaseline({ cwd: options.path, note: options.note, skipValidation: options.skipValidation });
            console.log(chalk.green(`✅ Captured baseline (${baseline.files.length} files, validation=${baseline.validation.passed ? "passed" : "failed"})`));
            console.log(chalk.gray(`   .helix/regression-baseline.json`));
            return;
        }
        if (a === "check") {
            const result = await checkAgainstBaseline(options.path);
            if (!result.baseline) {
                console.log(chalk.yellow("No baseline captured yet. Run: helix regression-guard capture"));
                process.exit(2);
            }
            console.log(formatRegressionDiff(result.diff));
            const failed = (result.diff?.newFailures?.length ?? 0) > 0;
            process.exit(failed ? 1 : 0);
        }
        console.error(chalk.red(`Unknown action: ${a}. Use 'capture' or 'check'.`));
        process.exit(1);
    });

program
    .command("explain-diff")
    .description("AI-explain the current git diff (staged → working → recent commit)")
    .option("-r, --range <range>", "Git revision range (e.g. HEAD~3..HEAD or main...feature)")
    .option("-m, --model <model>", "AI model to use")
    .action(async (options: { range?: string; model?: string }) => {
        console.log(banner);
        if (!process.env.OPENROUTER_API_KEY) {
            console.error(chalk.red("❌ OPENROUTER_API_KEY not found in environment"));
            process.exit(1);
        }
        const { explainDiff } = await import("../quality/diff");
        const text = await explainDiff({ range: options.range, model: options.model });
        console.log("\n" + text + "\n");
    });

program
    .command("review")
    .description("AI code review of the current diff")
    .option("-r, --range <range>", "Git revision range")
    .option("-m, --model <model>", "AI model to use")
    .action(async (options: { range?: string; model?: string }) => {
        console.log(banner);
        if (!process.env.OPENROUTER_API_KEY) {
            console.error(chalk.red("❌ OPENROUTER_API_KEY not found in environment"));
            process.exit(1);
        }
        const { reviewDiff } = await import("../quality/diff");
        const text = await reviewDiff({ range: options.range, model: options.model });
        console.log("\n" + text + "\n");
    });

program
    .command("cost-predict [completion]")
    .description("Estimate the cost of an upcoming agent turn given current settings")
    .option("-m, --model <model>", "AI model to evaluate")
    .option("--prompt <text>", "Inline prompt to estimate (default: empty)")
    .action(async (completion: string | undefined, options: { model?: string; prompt?: string }) => {
        console.log(banner);
        const { predictTurnCost, formatPrediction } = await import("../quality/cost_predict");
        const completionTokens = completion ? parseInt(completion, 10) : undefined;
        const messages = options.prompt
            ? [{ role: "user" as const, content: options.prompt }]
            : [];
        const prediction = predictTurnCost({ messages, model: options.model, completionTokens });
        console.log("\n" + formatPrediction(prediction) + "\n");
    });

// ============================================================================
// V15.1 COMMANDS: Permissions Engine
// ============================================================================

const permCmd = program
    .command("permissions")
    .alias("perm")
    .description("Manage chat-mode permissions (mode + rules) in ~/.helix/settings.json");

permCmd
    .command("list")
    .description("Show current mode and rules")
    .action(async () => {
        console.log(banner);
        const { readPermissionSettings } = await import("../chat/permissions/store");
        const perms = readPermissionSettings();
        console.log(chalk.bold.cyan(`\nMode: ${perms.mode}`));
        if (perms.rules.length === 0) {
            console.log(chalk.gray("  (no rules)"));
            return;
        }
        for (const r of perms.rules) {
            const a = r.action === "deny" ? chalk.red(r.action) : r.action === "allow" ? chalk.green(r.action) : chalk.yellow(r.action);
            const argMatch = r.argMatch ? chalk.gray("  args:" + JSON.stringify(r.argMatch)) : "";
            const note = r.note ? chalk.gray("  — " + r.note) : "";
            console.log(`  ${a.padEnd(15)} ${chalk.bold(r.tool)}${argMatch}${note}`);
        }
    });

permCmd
    .command("mode <mode>")
    .description("Set permission mode: manual | normal | trusted | yolo")
    .action(async (mode: string) => {
        const { ALL_MODES } = await import("../chat/permissions");
        if (!ALL_MODES.includes(mode as any)) {
            console.error(chalk.red(`❌ Invalid mode '${mode}'. Choose from: ${ALL_MODES.join(", ")}`));
            process.exit(1);
        }
        const { setMode } = await import("../chat/permissions/store");
        const perms = setMode(mode as any);
        console.log(chalk.green(`✅ Mode set to ${perms.mode}`));
    });

permCmd
    .command("allow <tool>")
    .description("Add an allow rule for a tool name pattern (e.g. 'file_*')")
    .option("--note <text>", "Free-form note shown in /perm output")
    .action(async (tool: string, options: { note?: string }) => {
        const { addRule } = await import("../chat/permissions/store");
        addRule({ tool, action: "allow", note: options.note });
        console.log(chalk.green(`✅ Added: allow ${tool}`));
    });

permCmd
    .command("deny <tool>")
    .description("Add a deny rule for a tool name pattern")
    .option("--note <text>", "Free-form note shown in /perm output")
    .action(async (tool: string, options: { note?: string }) => {
        const { addRule } = await import("../chat/permissions/store");
        addRule({ tool, action: "deny", note: options.note });
        console.log(chalk.green(`✅ Added: deny ${tool}`));
    });

permCmd
    .command("ask <tool>")
    .description("Add an ask rule (force prompt) for a tool name pattern")
    .option("--note <text>", "Free-form note")
    .action(async (tool: string, options: { note?: string }) => {
        const { addRule } = await import("../chat/permissions/store");
        addRule({ tool, action: "ask", note: options.note });
        console.log(chalk.green(`✅ Added: ask ${tool}`));
    });

permCmd
    .command("remove <tool>")
    .description("Remove the first rule matching a tool pattern")
    .option("--action <action>", "Only match rules with this action (allow/deny/ask)")
    .action(async (tool: string, options: { action?: string }) => {
        const { removeRule } = await import("../chat/permissions/store");
        const result = removeRule({ tool, action: options.action as any });
        if (result.removed) console.log(chalk.green(`✅ Removed rule for ${tool}`));
        else console.log(chalk.yellow(`No matching rule found for ${tool}`));
    });

// ============================================================================
// V15.1 COMMANDS: Council Multi-Model Deliberation
// ============================================================================

const councilCmd = program
    .command("council [question...]")
    .description("Multi-model deliberation via the Council MCP server")
    .option("-p, --preset <name>", "Use a pre-configured council composition (e.g. 'technical')")
    .option("-m, --models <list>", "Comma-separated model list (overrides preset)")
    .option("--list-presets", "Show available council presets and exit")
    .option("--list-models", "Show available council models and exit")
    .option("--history [limit]", "Show recent deliberations and exit")
    .action(async (
        question: string[] | undefined,
        options: { preset?: string; models?: string; listPresets?: boolean; listModels?: boolean; history?: string | boolean }
    ) => {
        console.log(banner);
        const { CouncilClient } = await import("../council");
        const { formatVerdict, formatPresets, formatHistory } = await import("../council/formatter");
        const client = new CouncilClient();

        // Probe availability up front for a clearer error message
        const avail = await client.availability();
        if (!avail.available) {
            console.error(chalk.red(`❌ Council unavailable: ${avail.reason || "unknown"}`));
            process.exit(1);
        }
        console.log(chalk.gray(`Council server: ${avail.server} (${avail.tools?.length || 0} tools)`));

        try {
            if (options.listPresets) {
                const presets = await client.getPresets();
                console.log("\n" + formatPresets(presets));
                return;
            }
            if (options.listModels) {
                const models = await client.listModels();
                console.log("\n" + chalk.bold.cyan("Council models:") + "\n  " + models.join("\n  "));
                return;
            }
            if (options.history !== undefined) {
                const limit = typeof options.history === "string" ? parseInt(options.history, 10) || 10 : 10;
                const items = await client.getHistory(limit);
                console.log("\n" + formatHistory(items));
                return;
            }

            const q = (question || []).join(" ").trim();
            if (!q) {
                console.error(chalk.red("❌ Provide a question. Try: helix council \"Postgres or MongoDB for this schema?\""));
                process.exit(1);
            }
            console.log(chalk.cyan(`\nDeliberating: "${q}"`) + (options.preset ? chalk.gray(` (preset: ${options.preset})`) : ""));
            const verdict = await client.deliberate(q, {
                preset: options.preset,
                models: options.models ? options.models.split(",").map(s => s.trim()).filter(Boolean) : undefined,
            });
            console.log("\n" + formatVerdict(verdict));
        } catch (e: any) {
            console.error(chalk.red(`Council error: ${e?.message || e}`));
            process.exit(1);
        }
    });

// ============================================================================
// V14.1 COMMANDS: MCP Client Integration
// ============================================================================

const mcpCmd = program
    .command("mcp")
    .description("Manage MCP server integrations (Cognitive Memory, Council, etc.)");

mcpCmd
    .command("list")
    .description("List configured MCP servers")
    .action(async () => {
        console.log(banner);
        const { listMcpServers, getSettingsPath } = await import("../mcp/config");
        const servers = listMcpServers();
        console.log(chalk.gray(`Settings: ${getSettingsPath()}\n`));
        if (servers.length === 0) {
            console.log(chalk.yellow("No MCP servers configured."));
            console.log(chalk.gray("Add one with: helix mcp add <name> --command <path> [--args ...] [--auto]"));
            return;
        }
        for (const { name, config } of servers) {
            const auto = config.autoConnect ? chalk.green(" [auto]") : "";
            console.log(`  ${chalk.bold.cyan(name)}${auto}`);
            console.log(chalk.gray(`    command: ${config.command}`));
            if (config.args && config.args.length) console.log(chalk.gray(`    args:    ${config.args.join(" ")}`));
            if (config.description) console.log(chalk.gray(`    desc:    ${config.description}`));
        }
    });

mcpCmd
    .command("status")
    .description("Connect to all configured MCP servers and report status")
    .action(async () => {
        console.log(banner);
        const { McpRegistry } = await import("../mcp/registry");
        const registry = McpRegistry.fromSettings();
        const names = registry.listServerNames();
        if (names.length === 0) {
            console.log(chalk.yellow("No MCP servers configured."));
            return;
        }
        console.log(chalk.cyan(`Probing ${names.length} server(s)...\n`));
        for (const name of names) {
            try {
                await registry.connect(name);
                const tools = await registry.listTools(name);
                console.log(`  ${chalk.green("●")} ${chalk.bold(name)} ${chalk.gray("— " + tools.length + " tool(s)")}`);
            } catch (e: any) {
                console.log(`  ${chalk.red("●")} ${chalk.bold(name)} ${chalk.gray("— " + (e?.message || "connect failed"))}`);
            }
        }
        await registry.closeAll();
    });

mcpCmd
    .command("add <name>")
    .description("Add a new MCP server config")
    .requiredOption("-c, --command <path>", "Executable path")
    .option("-a, --args <args...>", "Arguments to the command")
    .option("--auto", "Auto-connect when chat mode starts")
    .option("--cwd <dir>", "Working directory for the server process")
    .option("--description <text>", "Human description")
    .action(async (name: string, options: { command: string; args?: string[]; auto?: boolean; cwd?: string; description?: string }) => {
        console.log(banner);
        const { addMcpServer, getSettingsPath } = await import("../mcp/config");
        addMcpServer(name, {
            command: options.command,
            args: options.args || [],
            autoConnect: !!options.auto,
            cwd: options.cwd,
            description: options.description,
        });
        console.log(chalk.green(`✅ Added MCP server '${name}'`));
        console.log(chalk.gray(`   ${getSettingsPath()}`));
    });

mcpCmd
    .command("remove <name>")
    .description("Remove an MCP server config")
    .action(async (name: string) => {
        const { removeMcpServer } = await import("../mcp/config");
        removeMcpServer(name);
        console.log(chalk.green(`✅ Removed MCP server '${name}'`));
    });

mcpCmd
    .command("tools <name>")
    .description("List tools exposed by an MCP server")
    .action(async (name: string) => {
        console.log(banner);
        const { McpRegistry } = await import("../mcp/registry");
        const registry = McpRegistry.fromSettings();
        try {
            const tools = await registry.listTools(name);
            console.log(chalk.cyan(`\n${name} — ${tools.length} tool(s):\n`));
            for (const t of tools) {
                console.log(`  ${chalk.bold(t.name)}`);
                if (t.description) console.log(chalk.gray(`    ${t.description}`));
            }
        } catch (e: any) {
            console.error(chalk.red(`Failed: ${e?.message || e}`));
            process.exit(1);
        } finally {
            await registry.closeAll();
        }
    });

// ============================================================================
// V14.0 COMMANDS: Interactive Agent Mode
// ============================================================================

program
    .command("chat")
    .description("Enter interactive agent mode (REPL with tool use)")
    .option("-m, --model <model>", "AI model to use")
    .option("-i, --include-directories <dirs>", "Comma-separated extra context directories")
    .option("--trust", "Run in 'trusted' mode (only sensitive tools prompt)")
    .option("--yolo", "Run in 'yolo' mode (auto-approve everything — be careful)")
    .option("--manual", "Run in 'manual' mode (prompt for every tool call)")
    .action(async (options: { model?: string; includeDirectories?: string; trust?: boolean; yolo?: boolean; manual?: boolean }) => {
        console.log(banner);
        if (!process.env.OPENROUTER_API_KEY) {
            console.error(chalk.red("❌ OPENROUTER_API_KEY not found in environment"));
            process.exit(1);
        }
        const { chat } = await import("../chat");
        const extraDirs = options.includeDirectories
            ? options.includeDirectories.split(",").map(s => s.trim()).filter(Boolean)
            : [];
        const mode = options.yolo ? "yolo"
            : options.trust ? "trusted"
            : options.manual ? "manual"
            : undefined;
        await chat({
            model: options.model,
            extraDirs,
            permissionMode: mode,
            autoApprove: !!options.yolo,
        });
    });

program
    .command("ask <prompt>")
    .description("One-shot agent query (headless / scripting mode)")
    .option("-m, --model <model>", "AI model to use")
    .option("-i, --include-directories <dirs>", "Comma-separated extra context directories")
    .option("--output-format <format>", "Output format: 'text' or 'json'", "text")
    .option("--trust", "Auto-approve destructive tool calls")
    .action(async (prompt: string, options: { model?: string; includeDirectories?: string; outputFormat?: string; trust?: boolean }) => {
        if (!process.env.OPENROUTER_API_KEY) {
            console.error(chalk.red("❌ OPENROUTER_API_KEY not found in environment"));
            process.exit(1);
        }
        const { ask } = await import("../chat");
        const extraDirs = options.includeDirectories
            ? options.includeDirectories.split(",").map(s => s.trim()).filter(Boolean)
            : [];
        const format = (options.outputFormat === "json" ? "json" : "text") as "text" | "json";
        await ask(prompt, {
            model: options.model,
            extraDirs,
            outputFormat: format,
            autoApprove: !!options.trust || format === "json",
        });
    });

// ============================================================================
// TEMPLATE INIT
// ============================================================================

program
    .command("init [template] [project-name]")
    .description("Initialize from a template (run without args to list templates)")
    .action(async (template?: string, projectName?: string) => {
        console.log(banner);
        if (!template) {
            await listTemplates();
        } else {
            await initFromTemplate(template, projectName);
        }
    });

// ============================================================================
// WEB DASHBOARD
// ============================================================================

program
    .command("web")
    .description("Launch the browser-based Helix dashboard")
    .option("-p, --port <number>", "Port to listen on", "4000")
    .action(async (options: { port: string }) => {
        console.log(banner);
        await startWebDashboard(parseInt(options.port, 10));
    });

// ============================================================================
// COLLABORATION
// ============================================================================

const collabCmd = program
    .command("collab")
    .description("Real-time collaboration between Helix users");

collabCmd
    .command("serve")
    .description("Start a collaboration server that teammates can join")
    .option("-p, --port <number>", "Port to listen on", "3001")
    .option("-k, --key <string>", "API key required for clients to connect")
    .action(async (options: { port: string; key?: string }) => {
        console.log(banner);
        startCollaborationServer(parseInt(options.port, 10), options.key);
        process.on('SIGINT', () => { console.log(chalk.gray('\n\nShutting down…\n')); process.exit(0); });
    });

collabCmd
    .command("join <url>")
    .description("Join a collaboration session (e.g. ws://hostname:3001)")
    .option("-k, --key <string>", "API key for authenticated servers")
    .option("-d, --dir <path>", "Directory to watch for .helix changes", ".")
    .action(async (url: string, options: { key?: string; dir?: string }) => {
        console.log(banner);
        joinCollaborationSession(url, options.key);
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
    .option("-p, --platform <platform>", "Deployment platform: vercel, firebase, netlify, railway", "vercel")
    .option("-t, --token <token>", "Auth token for the platform (optional)")
    .option("--vercel", "Deploy to Vercel via the v16 adapter (env-sync, URL extraction)")
    .option("--netlify", "Deploy to Netlify via the v16 adapter")
    .option("--railway", "Deploy to Railway via the v16 adapter")
    .option("--skip-env-sync", "Don't push .env contents to the provider")
    .option("--env-file <path>", ".env file to read for sync", ".env")
    .option("--dry-run", "Print what would happen without running")
    .action(async (options: any) => {
        console.log(banner);
        // v16 adapter path: pick the first --vercel/--netlify/--railway flag, or
        // honor --platform=railway (new in v16). Legacy --platform=firebase stays
        // routed through the original deploy() to avoid breaking changes.
        const v16Target = options.vercel ? "vercel"
            : options.netlify ? "netlify"
            : options.railway ? "railway"
            : (options.platform === "railway" || options.platform === "netlify" || options.platform === "vercel") ? options.platform
            : null;

        if (v16Target && options.platform !== "firebase") {
            const { runDeploy } = await import("../deploy");
            const cwd = process.cwd();
            const result = await runDeploy(v16Target as any, {
                cwd,
                token: options.token,
                skipEnvSync: !!options.skipEnvSync,
                envFile: options.envFile,
                dryRun: !!options.dryRun,
            });
            if (!result.success) {
                if (result.skippedReason) console.log(chalk.yellow(`⚠  ${result.skippedReason}`));
                if (result.error) console.error(chalk.red(`❌ ${result.error}`));
                process.exit(1);
            }
            if (result.url) console.log(chalk.green(`\n✅ ${result.target}: ${result.url}`));
            else console.log(chalk.green(`\n✅ ${result.target}: deployed`));
            if (typeof result.envPushed === "number" && result.envPushed > 0) {
                console.log(chalk.gray(`   pushed ${result.envPushed} env var(s)`));
            }
            return;
        }

        await deploy(options.platform as DeploymentPlatform, options.token);
    });

const pluginCmd = program
    .command("plugin")
    .description("Manage Helix generator plugins");

pluginCmd
    .command("list")
    .description("List registered generator plugins")
    .action(async () => {
        console.log(banner);
        const registry = getRegistry();
        await registry.scanForPlugins();
        registry.listPlugins();
    });

pluginCmd
    .command("install <name>")
    .description("Install a generator plugin from npm (e.g. helix-gen-expo)")
    .action(async (name: string) => {
        const registry = getRegistry();
        await registry.installPlugin(name);
    });

// ── Plugins v2: chat tool plugins ──────────────────────────────────
pluginCmd
    .command("chat-list")
    .description("List installed chat tool plugins (helix-tool-*) and the tools they expose")
    .action(async () => {
        console.log(banner);
        const { ToolRegistry } = await import("../chat/tools");
        const { loadChatPlugins } = await import("../plugins/chat_plugins");
        const tmp = new ToolRegistry();
        const result = await loadChatPlugins(tmp);
        if (result.plugins.length === 0) {
            console.log(chalk.yellow("No chat plugins installed."));
            console.log(chalk.gray("Add one with: helix plugin chat-add helix-tool-<name>"));
            return;
        }
        for (const lp of result.plugins) {
            console.log(`${chalk.bold.cyan(lp.plugin.name)} ${chalk.gray("v" + lp.plugin.version)}`);
            if (lp.plugin.description) console.log(chalk.gray("  " + lp.plugin.description));
            console.log(chalk.gray("  tools: " + lp.registered.join(", ")));
        }
        for (const err of result.errors) {
            console.log(chalk.red(`✗ ${err.source}: ${err.error}`));
        }
    });

pluginCmd
    .command("chat-add <package>")
    .description("Install a chat plugin from npm and register it in ~/.helix/settings.json")
    .action(async (pkgName: string) => {
        console.log(banner);
        const execa = (await import("execa")).default;
        try {
            console.log(chalk.cyan(`📦 Installing ${pkgName}...`));
            await execa("npm", ["install", pkgName], { stdio: "inherit" });
        } catch (e: any) {
            console.error(chalk.red(`❌ npm install failed: ${e?.message || e}`));
            process.exit(1);
        }
        const { loadSettings, saveSettings } = await import("../mcp/config");
        const settings = loadSettings();
        const list = Array.isArray((settings as any).chatPlugins) ? (settings as any).chatPlugins : [];
        if (!list.includes(pkgName)) list.push(pkgName);
        (settings as any).chatPlugins = list;
        saveSettings(settings);
        console.log(chalk.green(`✅ Registered ${pkgName} as a chat plugin.`));
    });

pluginCmd
    .command("chat-remove <package>")
    .description("Unregister a chat plugin from ~/.helix/settings.json (does not uninstall the package)")
    .action(async (pkgName: string) => {
        const { loadSettings, saveSettings } = await import("../mcp/config");
        const settings = loadSettings();
        const list = Array.isArray((settings as any).chatPlugins) ? (settings as any).chatPlugins : [];
        const next = list.filter((s: string) => s !== pkgName);
        (settings as any).chatPlugins = next;
        saveSettings(settings);
        console.log(chalk.green(`✅ Unregistered ${pkgName}.`));
    });

// Keep old alias for backward compat
program
    .command("plugins")
    .description("List registered generator plugins (alias: plugin list)")
    .action(async () => {
        console.log(banner);
        const registry = getRegistry();
        await registry.scanForPlugins();
        registry.listPlugins();
    });

// ============================================================================
// EVOLVE COMMAND: Codebase Evolution & Analysis
// ============================================================================

// Sprint 9 evolve actions modify existing apps; v13 actions are read-only audits.
const SPRINT9_EVOLVE_ACTIONS = new Set(["add-feature", "refactor", "fix", "migrate", "optimize"]);

program
    .command("evolve [action] [intent...]")
    .description("Evolve codebase. Actions: scan, suggest, apply, security-audit (analysis); add-feature, refactor, fix, migrate, optimize (modify existing app).")
    .option("-p, --path <path>", "Project path", process.cwd())
    .option("-y, --yes", "Skip confirmation prompt")
    .option("--dry-run", "Print the change plan without applying it")
    .option("--skip-validation", "Skip the build+test validation pass")
    .option("--max-heal <n>", "Max self-heal attempts after a failed validation", "1")
    .option("-m, --model <model>", "AI model to use for planning")
    .option("--parallel <prompts...>", "Run additional evolve tasks in parallel worktrees")
    .option("--budget <n>", "Total token budget across parallel workers", v => parseInt(v, 10))
    .action(async (
        action: string | undefined,
        intent: string[] | undefined,
        options: { path: string; yes?: boolean; dryRun?: boolean; skipValidation?: boolean; maxHeal?: string; model?: string; parallel?: string[]; budget?: number }
    ) => {
        console.log(banner);
        const a = (action || "scan").toLowerCase();

        // Sprint 13: --parallel re-routes evolve tasks through the parallel orchestrator.
        if (Array.isArray(options.parallel) && options.parallel.length > 0) {
            const intentStr = (intent || []).join(" ").trim();
            const prompts = [intentStr || a, ...options.parallel].filter(Boolean);
            const { runParallel, formatConflictReport } = await import("../parallel");
            const result = await runParallel({
                tasks: prompts.map(p => ({ prompt: `Evolve the project (${a}): ${p}` })),
                cwd: options.path,
                totalBudget: options.budget ?? null,
            });
            for (const w of result.workers) {
                const icon = w.success ? chalk.green("✓") : chalk.red("✗");
                console.log(`  ${icon} ${w.task.label || w.task.prompt.slice(0, 40)} — ${w.changedFiles.length} files${w.error ? ` (error: ${w.error})` : ""}`);
            }
            console.log("\n" + formatConflictReport(result.conflicts));
            if (result.workers.some(w => !w.success)) process.exit(1);
            return;
        }

        // Sprint 9: modify existing app
        if (SPRINT9_EVOLVE_ACTIONS.has(a)) {
            if (!process.env.OPENROUTER_API_KEY) {
                console.error(chalk.red("❌ OPENROUTER_API_KEY not found in environment"));
                process.exit(1);
            }
            const intentStr = (intent || []).join(" ").trim();
            if (!intentStr) {
                console.error(chalk.red(`❌ Missing intent. Try: helix evolve ${a} "description of what you want"`));
                process.exit(1);
            }
            const { evolveProject } = await import("../evolve");
            const result = await evolveProject({
                action: a as any,
                intent: intentStr,
                cwd: options.path,
                yes: !!options.yes,
                dryRun: !!options.dryRun,
                skipValidation: !!options.skipValidation,
                maxHealAttempts: parseInt(options.maxHeal || "1", 10),
                model: options.model,
            });
            process.exit(result.applied && result.validation !== "failed" ? 0 : 1);
        }

        // Sprint 4 actions (analysis only)
        const category = (intent || []).join(" ").trim() || undefined;
        await evolveCodebase(a, category, options.path);
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
  ${chalk.gray("# Interactive agent mode (v14):")}
  $ helix chat                          ${chalk.gray("# REPL with tool use")}
  $ helix ask "explain this codebase"   ${chalk.gray("# one-shot headless query")}
  $ helix ask "..." --output-format json

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
  $ helix evolve add-feature "user auth with Google" ${chalk.gray("# Modify existing app")}
  $ helix evolve fix "login crashes on mobile" --dry-run
  $ helix evolve migrate "upgrade to Next.js 15"
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
