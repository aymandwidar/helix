/**
 * Interactive REPL for `helix chat`.
 *
 * Reads lines from stdin, dispatches slash commands, and routes everything
 * else to the agent loop.
 */

import * as readline from "readline";
import chalk from "chalk";
import { ChatContext } from "./context";
import { ToolRegistry } from "./tools";
import { CheckpointManager } from "./checkpoints";
import { Display, display as defaultDisplay } from "./display";
import { runAgentTurn } from "./agent";
import { getCostSummary } from "../openrouter";

export interface ReplOptions {
    cwd?: string;
    extraDirs?: string[];
    model?: string;
    autoApprove?: boolean;
    display?: Display;
}

const HELP_TEXT = `${chalk.cyan("Slash commands:")}
  ${chalk.bold("/help")}        Show this help
  ${chalk.bold("/clear")}       Clear conversation history (keeps system prompt)
  ${chalk.bold("/exit")}        Exit chat (also: /quit, ctrl+d)
  ${chalk.bold("/checkpoint")}  Manually save a checkpoint of recent files
  ${chalk.bold("/restore")}     Restore the most recent checkpoint
  ${chalk.bold("/context")}     Show loaded context (project, HELIX.md, history size)
  ${chalk.bold("/cost")}        Show token usage and estimated cost so far
  ${chalk.bold("/tools")}       List available tools
`;

export async function startRepl(options: ReplOptions = {}): Promise<void> {
    const cwd = options.cwd || process.cwd();
    const context = new ChatContext({ cwd, extraDirs: options.extraDirs });
    const registry = (await import("./tools")).buildDefaultRegistry();
    const checkpoints = new CheckpointManager({ cwd });
    const display = options.display || defaultDisplay;

    display.info(chalk.bold.cyan("Helix Chat") + chalk.gray("  — type /help for commands, /exit to quit"));
    display.info(chalk.gray(`cwd: ${cwd}`));
    if (context.helixMd) {
        display.info(chalk.gray(`loaded: ${context.helixMd.path}`));
    }
    if (context.project.framework) {
        display.info(chalk.gray(`project: ${context.project.name} (${context.project.framework})`));
    }
    process.stdout.write("\n");

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: chalk.bold.blue("you ▸ "),
    });
    rl.prompt();

    rl.on("line", async (line) => {
        const input = line.trim();
        if (!input) { rl.prompt(); return; }

        if (input.startsWith("/")) {
            const exit = await handleSlashCommand(input, { context, registry, checkpoints, display });
            if (exit) { rl.close(); return; }
            rl.prompt();
            return;
        }

        rl.pause();
        try {
            await runAgentTurn(input, {
                registry,
                context,
                checkpoints,
                display,
                model: options.model,
                autoApprove: options.autoApprove,
            });
        } catch (err: any) {
            display.error(err?.message || String(err));
        }
        process.stdout.write("\n");
        rl.resume();
        rl.prompt();
    });

    rl.on("close", () => {
        printSessionSummary(display);
        process.exit(0);
    });
}

interface SlashCtx {
    context: ChatContext;
    registry: ToolRegistry;
    checkpoints: CheckpointManager;
    display: Display;
}

async function handleSlashCommand(line: string, ctx: SlashCtx): Promise<boolean> {
    const [cmd, ...rest] = line.slice(1).split(/\s+/);
    switch (cmd) {
        case "help":
            ctx.display.raw(HELP_TEXT);
            return false;
        case "exit":
        case "quit":
            return true;
        case "clear":
            ctx.context.history.clear();
            ctx.display.info("history cleared");
            return false;
        case "checkpoint": {
            const files = rest.length > 0 ? rest : [];
            if (files.length === 0) {
                ctx.display.warn("Usage: /checkpoint <file1> [file2 ...]");
                return false;
            }
            const entry = ctx.checkpoints.create("manual", files);
            ctx.display.info(`saved checkpoint ${entry.id} (${entry.files.length} files)`);
            return false;
        }
        case "restore": {
            const id = rest[0];
            const entry = ctx.checkpoints.restore(id);
            if (!entry) {
                ctx.display.warn(id ? `checkpoint not found: ${id}` : "no checkpoints to restore");
            } else {
                ctx.display.info(`restored checkpoint ${entry.id} (${entry.files.length} files)`);
            }
            return false;
        }
        case "context": {
            const summary = ctx.context.summary();
            ctx.display.raw(formatContextSummary(summary) + "\n");
            return false;
        }
        case "cost": {
            const summary = getCostSummary();
            if (summary.callCount === 0) {
                ctx.display.info("No API calls yet this session.");
            } else {
                ctx.display.raw(`${chalk.cyan("Session cost:")} $${summary.totalCost.toFixed(6)} across ${summary.callCount} call${summary.callCount === 1 ? "" : "s"}\n`);
            }
            return false;
        }
        case "tools": {
            const tools = ctx.registry.list();
            const lines = tools.map(t => `  ${chalk.bold(t.name)}${t.requiresApproval ? chalk.yellow(" *") : ""} — ${t.description}`);
            ctx.display.raw(lines.join("\n") + chalk.gray("\n  * = requires approval\n"));
            return false;
        }
        default:
            ctx.display.warn(`Unknown command: /${cmd} (try /help)`);
            return false;
    }
}

function formatContextSummary(s: ReturnType<ChatContext["summary"]>): string {
    const lines: string[] = [
        chalk.cyan("Project: ") + `${s.project.name} (${s.project.type})${s.project.framework ? " — " + s.project.framework : ""}`,
        chalk.cyan("CWD:     ") + s.project.cwd,
        chalk.cyan("History: ") + `${s.historySize} message(s)`,
    ];
    if (s.helixMd) lines.push(chalk.cyan("HELIX.md:") + " " + s.helixMd.path);
    if (s.extraDirs.length) lines.push(chalk.cyan("Extra:   ") + s.extraDirs.join(", "));
    if (s.project.keyFiles.length) lines.push(chalk.cyan("Key files:") + " " + s.project.keyFiles.join(", "));
    return lines.join("\n");
}

function printSessionSummary(display: Display): void {
    const summary = getCostSummary();
    process.stdout.write("\n");
    if (summary.callCount > 0) {
        display.info(`Session: ${summary.callCount} call(s), $${summary.totalCost.toFixed(6)}`);
    }
    display.info("bye");
}
