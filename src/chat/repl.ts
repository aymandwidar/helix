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
import { HookManager } from "./hooks";
import { McpRegistry } from "../mcp/registry";
import { bridgeAllAutoServers } from "../mcp/tool_bridge";

export interface ReplOptions {
    cwd?: string;
    extraDirs?: string[];
    model?: string;
    autoApprove?: boolean;
    display?: Display;
    /** Stream model output token-by-token. Defaults to true. */
    stream?: boolean;
    /** Skip MCP autoConnect (e.g. for tests / offline use). */
    noMcp?: boolean;
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
  ${chalk.bold("/mcp")}         List configured MCP servers and their status
  ${chalk.bold("/remember")}    Save a fact to cognitive memory (requires CMM)
  ${chalk.bold("/recall")}      Search cognitive memory for a topic (requires CMM)

${chalk.cyan("Inline routing:")}
  ${chalk.bold("@<server> <command>")}   Route directly to an MCP server (e.g. @memory search "prisma")
`;

export async function startRepl(options: ReplOptions = {}): Promise<void> {
    const cwd = options.cwd || process.cwd();
    const context = new ChatContext({ cwd, extraDirs: options.extraDirs });
    const registry = (await import("./tools")).buildDefaultRegistry();
    const checkpoints = new CheckpointManager({ cwd });
    const hooks = HookManager.fromSettings();
    const display = options.display || defaultDisplay;
    const stream = options.stream !== false;

    let mcp: McpRegistry | undefined;
    if (!options.noMcp) {
        try {
            mcp = McpRegistry.fromSettings();
            const auto = await bridgeAllAutoServers(mcp, registry);
            if (auto.added.length > 0) {
                display.info(chalk.gray(`mcp: bridged ${auto.added.length} tool(s) from auto-connect servers`));
            }
            for (const err of auto.errors) {
                display.warn(`mcp ${err.server}: ${err.error}`);
            }
        } catch (e: any) {
            display.warn(`mcp init failed: ${e.message}`);
        }
    }

    display.info(chalk.bold.cyan("Helix Chat") + chalk.gray("  — type /help for commands, /exit to quit"));
    display.info(chalk.gray(`cwd: ${cwd}`));
    if (context.helixMd) display.info(chalk.gray(`loaded: ${context.helixMd.path}`));
    if (context.project.framework) {
        display.info(chalk.gray(`project: ${context.project.name} (${context.project.framework})`));
    }
    if (hooks.list().length > 0) {
        display.info(chalk.gray(`hooks: ${hooks.list().length} configured`));
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
            const exit = await handleSlashCommand(input, { context, registry, checkpoints, display, mcp });
            if (exit) { rl.close(); return; }
            rl.prompt();
            return;
        }

        if (input.startsWith("@")) {
            rl.pause();
            await handleMcpRoute(input, { display, mcp });
            process.stdout.write("\n");
            rl.resume();
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
                hooks,
                stream,
                onStream: stream ? (chunk: string) => process.stdout.write(chunk) : undefined,
            });
        } catch (err: any) {
            display.error(err?.message || String(err));
        }
        process.stdout.write("\n");
        rl.resume();
        rl.prompt();
    });

    rl.on("close", async () => {
        if (mcp) await mcp.closeAll();
        printSessionSummary(display);
        process.exit(0);
    });
}

interface SlashCtx {
    context: ChatContext;
    registry: ToolRegistry;
    checkpoints: CheckpointManager;
    display: Display;
    mcp?: McpRegistry;
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
        case "mcp": {
            if (!ctx.mcp) {
                ctx.display.warn("MCP disabled in this session.");
                return false;
            }
            const status = await ctx.mcp.status();
            if (status.length === 0) {
                ctx.display.info("No MCP servers configured. Use `helix mcp add` to add one.");
                return false;
            }
            for (const s of status) {
                const dot = s.connected ? chalk.green("●") : (s.error ? chalk.red("●") : chalk.gray("○"));
                const tools = s.toolCount !== undefined ? chalk.gray(` (${s.toolCount} tools)`) : "";
                const err = s.error ? chalk.red(` — ${s.error}`) : "";
                ctx.display.raw(`  ${dot} ${chalk.bold(s.name)}${tools}${err}\n`);
            }
            return false;
        }
        case "remember": {
            const text = rest.join(" ").trim();
            if (!text) {
                ctx.display.warn("Usage: /remember <fact-to-store>");
                return false;
            }
            await callMemoryTool(ctx, "store_memory", { content: text });
            return false;
        }
        case "recall": {
            const query = rest.join(" ").trim();
            if (!query) {
                ctx.display.warn("Usage: /recall <topic>");
                return false;
            }
            await callMemoryTool(ctx, "search_memory", { query });
            return false;
        }
        default:
            ctx.display.warn(`Unknown command: /${cmd} (try /help)`);
            return false;
    }
}

async function callMemoryTool(ctx: SlashCtx, candidate: string, args: Record<string, unknown>): Promise<void> {
    if (!ctx.mcp) {
        ctx.display.warn("MCP not initialized — configure a memory server first (e.g. CMM).");
        return;
    }
    const memName = findMemoryServer(ctx.mcp);
    if (!memName) {
        ctx.display.warn("No 'memory' server configured. Add one via: helix mcp add memory --command ...");
        return;
    }
    try {
        const tools = await ctx.mcp.listTools(memName);
        const tool = tools.find(t => t.name === candidate)
            || tools.find(t => t.name.toLowerCase().includes(candidate.split("_")[0]));
        if (!tool) {
            ctx.display.warn(`Server '${memName}' does not expose a '${candidate}'-like tool.`);
            return;
        }
        const result = await ctx.mcp.callTool(memName, tool.name, args);
        const text = (result.content || []).map(p => p.text || JSON.stringify(p)).join("\n");
        ctx.display.raw(chalk.gray(`[${memName}.${tool.name}]\n`) + text + "\n");
    } catch (e: any) {
        ctx.display.error(`memory call failed: ${e.message}`);
    }
}

function findMemoryServer(mcp: McpRegistry): string | undefined {
    const names = mcp.listServerNames();
    return names.find(n => /memory|cmm|cogn/i.test(n));
}

async function handleMcpRoute(line: string, ctx: { display: Display; mcp?: McpRegistry }): Promise<void> {
    if (!ctx.mcp) {
        ctx.display.warn("MCP disabled in this session.");
        return;
    }
    const match = line.match(/^@([a-zA-Z0-9_-]+)\s*(.*)$/);
    if (!match) {
        ctx.display.warn("Usage: @<server> <tool> [json-args]");
        return;
    }
    const [, server, tail] = match;
    const known = ctx.mcp.listServerNames();
    const target = known.includes(server)
        ? server
        : known.find(n => n.toLowerCase().includes(server.toLowerCase()));
    if (!target) {
        ctx.display.warn(`Unknown MCP server: ${server}. Configured: ${known.join(", ") || "(none)"}`);
        return;
    }

    const trimmed = tail.trim();
    if (!trimmed) {
        try {
            const tools = await ctx.mcp.listTools(target);
            ctx.display.raw(chalk.cyan(`${target} — ${tools.length} tool(s):\n`));
            for (const t of tools) {
                ctx.display.raw(`  ${chalk.bold(t.name)}${t.description ? chalk.gray(" — " + t.description) : ""}\n`);
            }
        } catch (e: any) {
            ctx.display.error(`@${target}: ${e.message}`);
        }
        return;
    }

    // Parse "<tool> [json|key=value ...]"
    const sepIdx = trimmed.search(/\s/);
    const toolName = sepIdx === -1 ? trimmed : trimmed.slice(0, sepIdx);
    const argText = sepIdx === -1 ? "" : trimmed.slice(sepIdx + 1).trim();
    let args: Record<string, unknown> = {};
    if (argText) {
        try {
            args = JSON.parse(argText);
        } catch {
            // Fall back to k=v pairs / single positional string
            if (/=/.test(argText)) {
                args = parseKeyValuePairs(argText);
            } else {
                args = { query: argText };
            }
        }
    }

    try {
        const result = await ctx.mcp.callTool(target, toolName, args);
        const text = (result.content || []).map(p => p.text || JSON.stringify(p)).join("\n");
        if (result.isError) {
            ctx.display.error(`@${target}.${toolName}: ${text}`);
        } else {
            ctx.display.raw(chalk.gray(`[${target}.${toolName}]\n`) + (text || "(empty)") + "\n");
        }
    } catch (e: any) {
        ctx.display.error(`@${target}: ${e.message}`);
    }
}

function parseKeyValuePairs(text: string): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const part of text.match(/(?:[^\s"]+|"[^"]*")+/g) || []) {
        const eq = part.indexOf("=");
        if (eq < 0) continue;
        const key = part.slice(0, eq);
        let value = part.slice(eq + 1);
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        out[key] = value;
    }
    return out;
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
