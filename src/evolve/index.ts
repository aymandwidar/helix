/**
 * Sprint 9 evolve orchestrator.
 *
 * Flow:
 *   1. Scan project → ProjectSnapshot
 *   2. (Optional) CMM pre-check for relevant pitfalls / dead-ends
 *   3. Planner produces a ChangePlan
 *   4. Preview the plan to the user (skip on --yes / --dry-run with --apply false)
 *   5. Checkpoint affected files
 *   6. Apply the plan
 *   7. Validate (build + test). On failure, ask the planner to self-heal.
 *   8. (Optional) Log outcome to CMM
 */

import chalk from "chalk";
import * as path from "path";
import { scanProject, ProjectSnapshot } from "./scanner";
import { planChanges, parsePlan } from "./planner";
import { applyPlan, planAffectedFiles, renderApplyPreview, ApplyOutcome } from "./applier";
import { validateProject, summarizeValidation, ValidationResult } from "./validator";
import { getStrategyNotes, SUPPORTED_ACTIONS } from "./strategies";
import { ChangePlan, EvolveAction, EvolveResult } from "./types";
import { CheckpointManager } from "../chat/checkpoints";
import { renderDiff, summarizeDiff } from "../chat/display/diff";
import * as readline from "readline";
import * as fs from "fs";

export interface EvolveOptions {
    action: EvolveAction;
    intent: string;
    cwd?: string;
    /** Skip user confirmation (useful for scripts / chat tool calls). */
    yes?: boolean;
    /** Don't apply changes — only print the plan. */
    dryRun?: boolean;
    /** Skip the build/test validation pass. */
    skipValidation?: boolean;
    /** Maximum self-heal attempts after a failed validation. Default 1. */
    maxHealAttempts?: number;
    /** Override AI model. */
    model?: string;
    /** Skip CMM pre-check (e.g. when MCP is not configured). */
    skipMemory?: boolean;
}

export async function evolveProject(options: EvolveOptions): Promise<EvolveResult> {
    if (!SUPPORTED_ACTIONS.includes(options.action)) {
        throw new Error(`Unsupported evolve action: ${options.action}. Use one of: ${SUPPORTED_ACTIONS.join(", ")}`);
    }

    const cwd = options.cwd || process.cwd();
    console.log(chalk.cyan(`\n🧬 Helix Evolve — ${options.action}`));
    console.log(chalk.gray(`Intent: ${options.intent}`));
    console.log(chalk.gray(`CWD:    ${cwd}\n`));

    // 1. Scan
    const snapshot = scanProject(cwd);
    if (snapshot.kind === "unknown") {
        console.log(chalk.yellow("⚠  Could not detect a known project type (no package.json / pubspec.yaml / helix.config.json). Proceeding anyway."));
    } else {
        console.log(chalk.gray(`Detected: ${snapshot.framework} — ${snapshot.routes.length} route(s), ${snapshot.prismaModels.length} model(s), ${snapshot.components.length} component(s)\n`));
    }

    // 2. CMM pre-check (best-effort)
    const memoryNotes = options.skipMemory ? "" : await runMemoryCheck(options.intent);

    // 3. Plan
    let plan: ChangePlan;
    try {
        const strategyNotes = getStrategyNotes(options.action);
        plan = await planChanges({
            action: options.action,
            intent: options.intent,
            snapshot,
            contextNotes: [strategyNotes, memoryNotes].filter(Boolean).join("\n\n"),
            model: options.model,
        });
    } catch (e: any) {
        console.log(chalk.red(`Planner failed: ${e?.message || e}`));
        return emptyResult({ summary: "(plan failed)", rationale: "", files: [], packages: [], scripts: [], postCommands: [] }, e?.message);
    }

    printPlan(plan);

    // 4. Preview / confirmation
    if (options.dryRun) {
        console.log(chalk.yellow("\n[dry-run] No changes applied."));
        return { plan, applied: false, checkpointId: null, validation: "skipped", healAttempts: 0 };
    }
    if (!options.yes && !(await confirm(chalk.yellow("\nApply this plan? [y/N] ")))) {
        console.log(chalk.gray("Aborted by user."));
        return { plan, applied: false, checkpointId: null, validation: "skipped", healAttempts: 0 };
    }

    // 5. Checkpoint
    const cm = new CheckpointManager({ cwd });
    const affected = planAffectedFiles(plan, cwd);
    const checkpoint = cm.create(`pre-evolve-${options.action}`, affected);
    console.log(chalk.gray(`\n📌 Checkpoint ${checkpoint.id} (${affected.length} file${affected.length === 1 ? "" : "s"})`));

    // 6. Apply
    let outcome = await applyPlan(plan, { cwd });
    printOutcome(outcome);

    if (outcome.errors.length > 0) {
        console.log(chalk.red(`\n${outcome.errors.length} error(s) during apply. Run 'helix chat' and use /restore to roll back to ${checkpoint.id}.`));
        return {
            plan,
            applied: true,
            checkpointId: checkpoint.id,
            validation: "skipped",
            healAttempts: 0,
            error: `apply errors: ${outcome.errors.map(e => e.file).join(", ")}`,
        };
    }

    // Run post-commands
    if (plan.postCommands.length > 0) {
        await runPostCommands(plan.postCommands, cwd);
    }

    // 7. Validate (+ self-heal)
    if (options.skipValidation) {
        return { plan, applied: true, checkpointId: checkpoint.id, validation: "skipped", healAttempts: 0 };
    }
    const maxHeal = options.maxHealAttempts ?? 1;
    let healAttempts = 0;
    let validation: ValidationResult = await validateProject({ cwd });
    console.log(chalk.cyan("\n🔬 Validation"));
    console.log(summarizeValidation(validation));

    while (!validation.passed && healAttempts < maxHeal) {
        healAttempts++;
        console.log(chalk.yellow(`\n🔧 Self-heal attempt ${healAttempts}/${maxHeal}...`));
        const failOutput = validation.steps.find(s => !s.passed && !s.skipped)?.output || "";
        try {
            const followup = await planChanges({
                action: options.action,
                intent: `${options.intent}\n\nThe previous plan failed validation. Use the failure output below to diagnose and propose a SMALL fix. Do not rewrite already-correct files.\n\nFailure output:\n${failOutput.slice(-4000)}`,
                snapshot: scanProject(cwd),
                contextNotes: [getStrategyNotes("fix"), memoryNotes].filter(Boolean).join("\n\n"),
                model: options.model,
            });
            printPlan(followup, " (heal)");
            const healOutcome = await applyPlan(followup, { cwd });
            printOutcome(healOutcome);
            validation = await validateProject({ cwd });
            console.log(chalk.cyan("\n🔬 Validation"));
            console.log(summarizeValidation(validation));
        } catch (e: any) {
            console.log(chalk.red(`Self-heal failed: ${e?.message || e}`));
            break;
        }
    }

    if (!validation.passed) {
        console.log(chalk.red(`\n❌ Validation still failing after ${healAttempts} heal attempt(s).`));
        console.log(chalk.gray(`   Use 'helix chat' and /restore ${checkpoint.id} to roll back, or fix manually.`));
        return {
            plan,
            applied: true,
            checkpointId: checkpoint.id,
            validation: "failed",
            healAttempts,
            error: "validation failed",
        };
    }

    console.log(chalk.green(`\n✅ Evolve complete. Checkpoint: ${checkpoint.id}`));
    return { plan, applied: true, checkpointId: checkpoint.id, validation: "passed", healAttempts };
}

function emptyResult(plan: ChangePlan, error?: string): EvolveResult {
    return { plan, applied: false, checkpointId: null, validation: "skipped", healAttempts: 0, error };
}

async function runMemoryCheck(intent: string): Promise<string> {
    try {
        const { runPreGenerateCheck } = await import("../mcp/pre_generate");
        const result = await runPreGenerateCheck(intent);
        if (result.findings.length === 0) return "";
        const { renderCmmBanner } = await import("../chat/display/cmm_banner");
        const banner = renderCmmBanner(result);
        if (banner.nonEmpty) console.log("\n" + banner.text + "\n");
        return result.contextBlock;
    } catch {
        return "";
    }
}

function printPlan(plan: ChangePlan, suffix = ""): void {
    console.log(chalk.bold.cyan(`\n📋 Plan${suffix}`));
    console.log(chalk.white(`  ${plan.summary}`));
    if (plan.rationale) console.log(chalk.gray(`  ${plan.rationale}`));
    if (plan.files.length > 0) {
        console.log(chalk.cyan("\n  Files:"));
        for (const f of plan.files) {
            console.log(`    ${opMarker(f.op)} ${chalk.bold(f.path)}${f.rationale ? chalk.gray(" — " + f.rationale) : ""}`);
        }
    }
    if (plan.packages.length > 0) {
        console.log(chalk.cyan("\n  Packages:"));
        for (const p of plan.packages) {
            const sign = p.op === "remove" ? "-" : "+";
            console.log(`    ${sign} ${p.name}${p.version ? "@" + p.version : ""}${p.dev ? " (dev)" : ""}`);
        }
    }
    if (plan.scripts.length > 0) {
        console.log(chalk.cyan("\n  Scripts:"));
        for (const s of plan.scripts) {
            const sign = s.op === "remove" ? "-" : "+";
            console.log(`    ${sign} ${s.name}: ${s.command || ""}`);
        }
    }
    if (plan.postCommands.length > 0) {
        console.log(chalk.cyan("\n  Post-commands:"));
        for (const c of plan.postCommands) console.log(`    $ ${c}`);
    }
    if (plan.confidence !== undefined) {
        console.log(chalk.gray(`\n  Confidence: ${(plan.confidence * 100).toFixed(0)}%`));
    }
}

function opMarker(op: string): string {
    switch (op) {
        case "create":  return chalk.green("+");
        case "edit":    return chalk.yellow("~");
        case "replace": return chalk.yellow("≡");
        case "delete":  return chalk.red("-");
        default:        return "?";
    }
}

function printOutcome(outcome: ApplyOutcome): void {
    console.log(chalk.cyan("\n📐 Diff"));
    for (const d of outcome.diffs) {
        if (d.error) {
            console.log(chalk.red(`  ✗ ${d.op} ${d.file}: ${d.error}`));
            continue;
        }
        if (d.before !== undefined && d.after !== undefined) {
            const summary = summarizeDiff(d.before, d.after);
            console.log(`  ${opMarker(d.op)} ${d.file} ${chalk.gray(`(+${summary.added} -${summary.removed})`)}`);
        } else {
            console.log(`  ${opMarker(d.op)} ${d.file}`);
        }
    }
}

async function runPostCommands(commands: string[], cwd: string): Promise<void> {
    const execa = (await import("execa")).default;
    console.log(chalk.cyan("\n⚙  Running post-commands..."));
    for (const cmd of commands) {
        try {
            const result = await execa(cmd, { shell: true, cwd, reject: false, timeout: 120_000 });
            const ok = (result.exitCode ?? 0) === 0;
            console.log(`  ${ok ? chalk.green("✓") : chalk.red("✗")} ${cmd}`);
            if (!ok && result.stderr) console.log(chalk.gray("    " + result.stderr.split("\n")[0]));
        } catch (e: any) {
            console.log(`  ${chalk.red("✗")} ${cmd} — ${e?.message || e}`);
        }
    }
}

function confirm(question: string): Promise<boolean> {
    if (!process.stdin.isTTY) return Promise.resolve(false);
    return new Promise(resolve => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(question, answer => {
            rl.close();
            resolve(/^y(es)?$/i.test(answer.trim()));
        });
    });
}

// Re-exports for the public surface
export { scanProject } from "./scanner";
export { planChanges, parsePlan } from "./planner";
export { applyPlan, planAffectedFiles, renderApplyPreview } from "./applier";
export { validateProject, summarizeValidation } from "./validator";
export type { ProjectSnapshot } from "./scanner";
export type { ChangePlan, EvolveAction, EvolveResult } from "./types";
