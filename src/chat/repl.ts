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
import { PermissionEngine, PermissionMode, ALL_MODES } from "./permissions";

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
    /** Override the saved permission mode for this session. */
    permissionMode?: PermissionMode;
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
  ${chalk.bold("/council")}     Send a question to Council for multi-model deliberation
  ${chalk.bold("/perm")}        Show or edit permissions (e.g. /perm mode trusted)
  ${chalk.bold("/yolo")}        Switch to yolo mode (auto-approve everything) for this session
  ${chalk.bold("/manual")}      Switch to manual mode (ask for every tool call) for this session
  ${chalk.bold("/audit")}       Run quality audit (a11y/perf/seo/security)
  ${chalk.bold("/cost-predict")}    Estimate cost of the next agent turn
  ${chalk.bold("/explain-diff")}    AI-explain the current git diff
  ${chalk.bold("/review")}      AI code review of current diff
  ${chalk.bold("/regression-guard")}  capture | check
  ${chalk.bold("/compress")}    Summarize older messages to free up context
  ${chalk.bold("/loop")}        /loop <N> <prompt> — run the agent N times
  ${chalk.bold("/teach")}       Append a learned convention to HELIX.md
  ${chalk.bold("/inherit")}     Merge another project's HELIX.md into this one
  ${chalk.bold("/blocks")}      Toggle block (boxed) TUI output
  ${chalk.bold("/usage")}       Show session usage (tools, tokens, cost, checkpoints)
  ${chalk.bold("/recap")}       Generate a session recap (--save to write to .helix/recaps)
  ${chalk.bold("/theme")}       /theme [name|save <name>] — switch chat theme
  ${chalk.bold("/pr")}          /pr create | /pr review — AI PR title/body or review
  ${chalk.bold("/changelog")}   Generate a changelog section (--write to update CHANGELOG.md)
  ${chalk.bold("/verify-visual")}   Capture/diff a screenshot of the running app (optional deps)
  ${chalk.bold("/parallel")}    /parallel task1 | task2 | task3 — run agents in parallel worktrees

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
    const permissions = PermissionEngine.fromSettings(undefined, options.permissionMode);

    // Auto-load chat plugins (helix-tool-* packages)
    try {
        const { loadChatPlugins } = await import("../plugins/chat_plugins");
        const loaded = await loadChatPlugins(registry, cwd);
        if (loaded.added.length > 0) {
            display.info(chalk.gray(`plugins: loaded ${loaded.added.length} tool(s) from ${loaded.plugins.length} chat plugin(s)`));
        }
    } catch {
        // optional
    }

    // Sprint 12: load persisted theme + reset usage tracker for this session.
    try {
        const { loadSettings } = await import("../mcp/config");
        const { resolveTheme, setActiveTheme } = await import("./themes");
        const themeName = (loadSettings() as any).chatTheme;
        if (typeof themeName === "string" && themeName) setActiveTheme(resolveTheme(themeName));
    } catch { /* ignore */ }
    try {
        const { resetActiveTracker } = await import("./usage");
        resetActiveTracker();
    } catch { /* ignore */ }

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
    display.info(chalk.gray(`permissions: ${permissions.mode}${permissions.rules.length ? ` (${permissions.rules.length} rule${permissions.rules.length === 1 ? "" : "s"})` : ""}`));
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
            const exit = await handleSlashCommand(input, { context, registry, checkpoints, display, mcp, permissions });
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
                permissions,
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
        // Sprint 12: write session log + offer recap when session was substantial
        try {
            const { getActiveTracker, writeSessionLog } = await import("./usage");
            const snap = getActiveTracker().snapshot();
            writeSessionLog(snap, undefined);
            const turns = snap.messages.user;
            if (turns >= 3) {
                const ok = await display.confirm(`save session recap to .helix/recaps?`);
                if (ok) {
                    const { generateRecap, saveRecap } = await import("../quality/recap");
                    const recap = await generateRecap({ messages: context.messages() });
                    const file = saveRecap({ cwd, recap });
                    display.info(`recap saved: ${file}`);
                }
            }
        } catch { /* never block exit */ }
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
    permissions: PermissionEngine;
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
        case "council": {
            const question = rest.join(" ").trim();
            if (!question) {
                ctx.display.warn("Usage: /council <question>");
                return false;
            }
            await runCouncilDeliberation(ctx, question);
            return false;
        }
        case "perm":
        case "permission":
        case "permissions": {
            await handlePermCommand(ctx, rest);
            return false;
        }
        case "yolo": {
            ctx.permissions.mode = "yolo";
            ctx.display.warn("⚠ Mode → yolo. All tool calls will auto-approve for this session.");
            return false;
        }
        case "manual": {
            ctx.permissions.mode = "manual";
            ctx.display.info("Mode → manual. Every tool call will prompt.");
            return false;
        }
        case "trusted": {
            ctx.permissions.mode = "trusted";
            ctx.display.info("Mode → trusted. Only sensitive tools (shell_exec, deploy_app, MCP) will prompt.");
            return false;
        }
        case "audit": {
            const { auditProject, formatAuditReport } = await import("../audit");
            const categories = rest.length > 0 ? rest as any : undefined;
            const report = auditProject({ cwd: ctx.context.cwd, categories });
            ctx.display.raw(formatAuditReport(report) + "\n");
            return false;
        }
        case "cost-predict":
        case "costpredict": {
            const { predictTurnCost, formatPrediction } = await import("../quality/cost_predict");
            const prediction = predictTurnCost({ messages: ctx.context.messages() });
            ctx.display.raw(formatPrediction(prediction) + "\n");
            return false;
        }
        case "explain-diff":
        case "explaindiff": {
            try {
                const { explainDiff } = await import("../quality/diff");
                ctx.display.info("Asking AI to explain the diff...");
                const text = await explainDiff({ cwd: ctx.context.cwd, range: rest[0] });
                ctx.display.raw("\n" + text + "\n");
            } catch (e: any) { ctx.display.error(e?.message || String(e)); }
            return false;
        }
        case "review": {
            try {
                const { reviewDiff } = await import("../quality/diff");
                ctx.display.info("Running AI review on the diff...");
                const text = await reviewDiff({ cwd: ctx.context.cwd, range: rest[0] });
                ctx.display.raw("\n" + text + "\n");
            } catch (e: any) { ctx.display.error(e?.message || String(e)); }
            return false;
        }
        case "regression-guard":
        case "regressionguard": {
            const action = rest[0] || "check";
            const { captureBaseline, checkAgainstBaseline, formatRegressionDiff } = await import("../quality/regression");
            try {
                if (action === "capture") {
                    const baseline = await captureBaseline({ cwd: ctx.context.cwd });
                    ctx.display.info(`captured baseline (${baseline.files.length} files, validation=${baseline.validation.passed ? "passed" : "failed"})`);
                } else {
                    const result = await checkAgainstBaseline(ctx.context.cwd);
                    ctx.display.raw(formatRegressionDiff(result.diff) + "\n");
                }
            } catch (e: any) { ctx.display.error(e?.message || String(e)); }
            return false;
        }
        case "compress": {
            try {
                const { compressHistory } = await import("../quality/compress");
                const keepN = rest[0] ? parseInt(rest[0], 10) || 8 : 8;
                ctx.display.info("Compressing older messages...");
                const result = await compressHistory(ctx.context.messages(), { keepLastN: keepN });
                if (result.summarized === 0) {
                    ctx.display.info("Nothing to compress yet (history is short).");
                    return false;
                }
                // Replace history with compressed version
                ctx.context.history.clear();
                for (const m of result.messages) {
                    if (m.role === "system") ctx.context.history.setSystem(typeof m.content === "string" ? m.content : "");
                    else ctx.context.history.push(m);
                }
                ctx.display.info(`compressed ${result.summarized} message(s) into a summary`);
            } catch (e: any) { ctx.display.error(e?.message || String(e)); }
            return false;
        }
        case "loop": {
            const n = parseInt(rest[0] || "0", 10);
            const prompt = rest.slice(1).join(" ").trim();
            if (!n || !prompt) {
                ctx.display.warn("Usage: /loop <N> <prompt>");
                return false;
            }
            try {
                const { runLoop } = await import("../quality/loop");
                ctx.display.info(`Looping ${n} time(s)...`);
                await runLoop({
                    iterations: n,
                    prompt,
                    registry: ctx.registry,
                    context: ctx.context,
                    checkpoints: ctx.checkpoints,
                    display: ctx.display,
                    permissions: ctx.permissions,
                });
            } catch (e: any) { ctx.display.error(e?.message || String(e)); }
            return false;
        }
        case "teach": {
            const lesson = rest.join(" ").trim();
            if (!lesson) {
                ctx.display.warn("Usage: /teach <lesson to remember>");
                return false;
            }
            try {
                const { teach } = await import("../quality/teach");
                const r = teach({ cwd: ctx.context.cwd, lesson });
                ctx.display.info(`saved to ${r.file}: "${r.appended}"`);
                ctx.context.refresh();
            } catch (e: any) { ctx.display.error(e?.message || String(e)); }
            return false;
        }
        case "inherit": {
            const source = rest[0];
            if (!source) {
                ctx.display.warn("Usage: /inherit <path-to-other-project-or-HELIX.md>");
                return false;
            }
            try {
                const { inherit } = await import("../quality/teach");
                const r = inherit({ cwd: ctx.context.cwd, source, overwrite: rest.includes("--overwrite") });
                ctx.display.info(`${r.merged ? "merged" : "wrote"} HELIX.md → ${r.dest}`);
                ctx.context.refresh();
            } catch (e: any) { ctx.display.error(e?.message || String(e)); }
            return false;
        }
        case "blocks": {
            const sub = rest[0] || "toggle";
            const { blockDisplay } = await import("../quality/blocks");
            // We mutate the slash ctx's display for the rest of the session
            // by swapping it via a closure stored on `ctx.permissions` (rough,
            // but simple: store the original display so we can toggle back).
            const anyCtx = ctx as any;
            if (sub === "off") {
                if (anyCtx._originalDisplay) {
                    Object.assign(ctx.display, anyCtx._originalDisplay);
                    delete anyCtx._originalDisplay;
                    ctx.display.info("blocks off");
                } else {
                    ctx.display.info("blocks already off");
                }
            } else {
                if (!anyCtx._originalDisplay) anyCtx._originalDisplay = { ...ctx.display };
                Object.assign(ctx.display, blockDisplay(ctx.display));
                ctx.display.info("blocks on");
            }
            return false;
        }
        case "usage": {
            const { getActiveTracker, formatUsage } = await import("./usage");
            ctx.display.raw("\n" + formatUsage(getActiveTracker().snapshot()) + "\n");
            return false;
        }
        case "recap": {
            try {
                const { generateRecap, saveRecap } = await import("../quality/recap");
                ctx.display.info("Generating recap...");
                const recap = await generateRecap({ messages: ctx.context.messages() });
                ctx.display.raw("\n" + recap + "\n");
                if (rest.includes("--save") || rest.includes("save")) {
                    const file = saveRecap({ cwd: ctx.context.cwd, recap });
                    ctx.display.info(`saved: ${file}`);
                }
            } catch (e: any) { ctx.display.error(e?.message || String(e)); }
            return false;
        }
        case "theme": {
            const sub = rest[0];
            const { listAvailableThemes, getActiveTheme, setActiveTheme, resolveTheme, saveCustomTheme } = await import("./themes");
            if (!sub) {
                const all = listAvailableThemes();
                const active = getActiveTheme();
                for (const t of all) {
                    const m = t.name === active.name ? chalk.green("●") : " ";
                    ctx.display.raw(`  ${m} ${chalk.bold(t.name)}${t.description ? chalk.gray(" — " + t.description) : ""}\n`);
                }
                return false;
            }
            if (sub === "save") {
                const name = rest[1];
                if (!name) { ctx.display.warn("Usage: /theme save <name>"); return false; }
                const file = saveCustomTheme({ ...getActiveTheme(), name });
                ctx.display.info(`saved theme to ${file}`);
                return false;
            }
            const theme = resolveTheme(sub);
            setActiveTheme(theme);
            ctx.display.info(`theme → ${theme.name}`);
            return false;
        }
        case "pr": {
            const sub = rest[0];
            try {
                if (sub === "create") {
                    const { createPr } = await import("../git");
                    const result = await createPr({ cwd: ctx.context.cwd, printOnly: true });
                    ctx.display.raw(`\nTitle: ${result.title}\n\n${result.body}\n`);
                } else {
                    const { reviewPr } = await import("../git");
                    ctx.display.info("Reviewing branch diff...");
                    const text = await reviewPr({ cwd: ctx.context.cwd });
                    ctx.display.raw("\n" + text + "\n");
                }
            } catch (e: any) { ctx.display.error(e?.message || String(e)); }
            return false;
        }
        case "changelog": {
            try {
                const { generateChangelog } = await import("../git");
                const result = await generateChangelog({ cwd: ctx.context.cwd, dryRun: !rest.includes("--write") });
                ctx.display.raw("\n" + result.section + "\n");
                if (rest.includes("--write")) ctx.display.info(`wrote ${result.file}`);
                else ctx.display.info("(dry-run; pass --write to update CHANGELOG.md)");
            } catch (e: any) { ctx.display.error(e?.message || String(e)); }
            return false;
        }
        case "verify-visual":
        case "verifyvisual": {
            try {
                const { verifyVisual } = await import("../quality/visual");
                const url = rest[0];
                const result = await verifyVisual({ cwd: ctx.context.cwd, url });
                ctx.display.raw(`\nstatus: ${result.status}\n` +
                    (result.url ? `url: ${result.url}\n` : "") +
                    (result.message ? `note: ${result.message}\n` : "") +
                    (result.mismatchedPixels !== undefined ? `mismatched: ${result.mismatchedPixels}/${result.totalPixels}\n` : "") +
                    (result.diffPath ? `diff: ${result.diffPath}\n` : ""));
            } catch (e: any) { ctx.display.error(e?.message || String(e)); }
            return false;
        }
        case "parallel": {
            // /parallel task1 | task2 | task3
            const joined = rest.join(" ");
            const prompts = joined.split("|").map(s => s.trim()).filter(Boolean);
            if (prompts.length < 2) {
                ctx.display.warn("Usage: /parallel <task1> | <task2> | <task3>  (use '|' to separate)");
                return false;
            }
            try {
                const { runParallel, formatConflictReport } = await import("../parallel");
                ctx.display.info(`Running ${prompts.length} workers in parallel worktrees...`);
                const result = await runParallel({
                    tasks: prompts.map(p => ({ prompt: p })),
                    cwd: ctx.context.cwd,
                });
                for (const w of result.workers) {
                    const icon = w.success ? chalk.green("✓") : chalk.red("✗");
                    ctx.display.raw(`  ${icon} ${w.task.label || w.task.prompt.slice(0, 40)} — ${w.changedFiles.length} files${w.error ? ` (error: ${w.error})` : ""}\n`);
                }
                ctx.display.raw("\n" + formatConflictReport(result.conflicts) + "\n");
                if (result.merge) {
                    ctx.display.info(`merge: ${result.merge.merged.length} merged, ${result.merge.skipped.length} skipped`);
                }
            } catch (e: any) { ctx.display.error(e?.message || String(e)); }
            return false;
        }
        default:
            ctx.display.warn(`Unknown command: /${cmd} (try /help)`);
            return false;
    }
}

async function runCouncilDeliberation(ctx: SlashCtx, question: string): Promise<void> {
    try {
        const { CouncilClient } = await import("../council");
        const { formatVerdict } = await import("../council/formatter");
        const client = new CouncilClient();
        const avail = await client.availability();
        if (!avail.available) {
            ctx.display.warn(`Council unavailable: ${avail.reason || "unknown"}`);
            return;
        }
        ctx.display.info(chalk.gray(`Deliberating with ${avail.server}...`));
        const verdict = await client.deliberate(question);
        ctx.display.raw("\n" + formatVerdict(verdict) + "\n");
    } catch (e: any) {
        ctx.display.error(`council: ${e?.message || e}`);
    }
}

async function handlePermCommand(ctx: SlashCtx, rest: string[]): Promise<void> {
    const sub = rest[0];
    if (!sub) {
        ctx.display.raw(formatPermissionState(ctx.permissions) + "\n");
        return;
    }
    if (sub === "mode") {
        const mode = rest[1];
        if (!mode || !ALL_MODES.includes(mode as PermissionMode)) {
            ctx.display.warn(`Usage: /perm mode <${ALL_MODES.join("|")}>`);
            return;
        }
        ctx.permissions.mode = mode as PermissionMode;
        ctx.display.info(`Mode → ${mode} (session-only; persist with: helix permissions mode ${mode})`);
        return;
    }
    if (sub === "allow" || sub === "deny" || sub === "ask") {
        const tool = rest[1];
        if (!tool) {
            ctx.display.warn(`Usage: /perm ${sub} <tool-pattern> [note...]`);
            return;
        }
        const note = rest.slice(2).join(" ") || undefined;
        ctx.permissions.addRule({ tool, action: sub, note });
        ctx.display.info(`Added rule: ${sub} ${tool}${note ? " — " + note : ""} (session-only)`);
        return;
    }
    ctx.display.warn("Usage: /perm | /perm mode <mode> | /perm <allow|deny|ask> <tool>");
}

function formatPermissionState(engine: PermissionEngine): string {
    const lines: string[] = [chalk.bold.cyan(`Permissions — mode: ${engine.mode}`)];
    if (engine.rules.length === 0) {
        lines.push(chalk.gray("  (no rules)"));
        return lines.join("\n");
    }
    for (const r of engine.rules) {
        const action = r.action === "deny" ? chalk.red(r.action) : r.action === "allow" ? chalk.green(r.action) : chalk.yellow(r.action);
        const argMatch = r.argMatch ? chalk.gray(" args:" + JSON.stringify(r.argMatch)) : "";
        const note = r.note ? chalk.gray(" — " + r.note) : "";
        lines.push(`  ${action.padEnd(15)} ${chalk.bold(r.tool)}${argMatch}${note}`);
    }
    return lines.join("\n");
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
