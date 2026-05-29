import { ToolDefinition } from "./index";

const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_OUTPUT = 20_000;

const HARD_BLOCKED = [
    /\brm\s+-rf\s+\/(\s|$)/,
    /:\s*\(\s*\)\s*\{[^}]*:\|:&[^}]*\};\s*:/, // fork bomb
    /\bmkfs\b/,
    /\bdd\s+if=.*of=\/dev/,
    /\bshutdown\b/,
    /\breboot\b/,
];

export const shellExecTool: ToolDefinition = {
    name: "shell_exec",
    description: "Execute a shell command in the working directory. Requires user approval. Output is captured and returned.",
    parameters: {
        command: { type: "string", description: "Shell command to execute." },
        timeout_ms: { type: "number", description: "Timeout in milliseconds (max 120000).", default: DEFAULT_TIMEOUT_MS },
    },
    required: ["command"],
    requiresApproval: true,
    mutatesFiles: true, // assume shell commands may change files
    async execute(args, ctx) {
        const command = String(args.command || "").trim();
        if (!command) {
            return { success: false, output: "", error: "Empty command" };
        }
        for (const pattern of HARD_BLOCKED) {
            if (pattern.test(command)) {
                return { success: false, output: "", error: `Refused: command matches blocked pattern ${pattern}` };
            }
        }
        const timeout = Math.min(Number(args.timeout_ms) || DEFAULT_TIMEOUT_MS, 120_000);

        const execa = (await import("execa")).default;
        try {
            const result = await execa(command, {
                shell: true,
                cwd: ctx.cwd,
                timeout,
                reject: false,
                all: true,
            });
            const stdout = (result.all ?? `${result.stdout || ""}${result.stderr ? "\n" + result.stderr : ""}`) || "";
            const truncated = stdout.length > MAX_OUTPUT
                ? stdout.slice(0, MAX_OUTPUT) + `\n…(+${stdout.length - MAX_OUTPUT} chars)`
                : stdout;
            const success = (result.exitCode ?? 0) === 0;
            return {
                success,
                output: `exit=${result.exitCode ?? 0}\n${truncated}`,
                error: success ? undefined : `Command failed with exit code ${result.exitCode}`,
            };
        } catch (err: any) {
            return { success: false, output: "", error: err?.message || String(err) };
        }
    },
};
