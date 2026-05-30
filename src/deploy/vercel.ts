import { CommandRunner, DeployContext, DeployResult } from "./types";
import { parseEnvFile, syncEnv, summarizeEnv } from "./env_sync";
import { defaultRunner, extractDeployUrl, ensureCli } from "./shared";

const VERCEL_INSTALL_HINT = "npm i -g vercel";

export async function deployToVercel(ctx: DeployContext): Promise<DeployResult> {
    const runner: CommandRunner = ctx.runner || defaultRunner;
    const cliCheck = await ensureCli("vercel", ["--version"], runner);
    if (!cliCheck.installed) {
        return {
            target: "vercel",
            success: false,
            skippedReason: `vercel CLI not installed. Install with: ${VERCEL_INSTALL_HINT}`,
        };
    }

    if (ctx.dryRun) {
        return { target: "vercel", success: true, skippedReason: "dry-run", url: undefined };
    }

    const args = ["--prod", "--yes", "--no-clipboard"];
    if (ctx.token) args.push("--token", ctx.token);

    let stdout = "", stderr = "", exitCode = 0;
    try {
        const r = await runner("vercel", args, { cwd: ctx.cwd });
        stdout = r.stdout; stderr = r.stderr; exitCode = r.exitCode;
    } catch (err: any) {
        return { target: "vercel", success: false, error: err?.message || String(err) };
    }

    if (exitCode !== 0) {
        return {
            target: "vercel",
            success: false,
            output: stdout,
            error: stderr || "vercel exited non-zero",
        };
    }

    const url = extractDeployUrl(stdout);

    let envPushed = 0;
    if (!ctx.skipEnvSync) {
        const env = parseEnvFile((ctx.envFile ? ctx.cwd + "/" + ctx.envFile : ctx.cwd + "/.env"));
        if (env.keys.length > 0) {
            const confirm = ctx.confirm || (async () => true);
            const ok = await confirm(`Push ${summarizeEnv(env)} to Vercel? `);
            if (ok) {
                const sync = await syncEnv({
                    cwd: ctx.cwd,
                    envFile: ctx.envFile,
                    runner,
                    label: "vercel",
                    buildUploadArgs: (key, value) => ({
                        command: "vercel",
                        args: ["env", "add", key, "production", "--value", value, "--yes"].concat(ctx.token ? ["--token", ctx.token] : []),
                    }),
                });
                envPushed = sync.pushed;
            }
        }
    }

    return {
        target: "vercel",
        success: true,
        url,
        output: stdout,
        envPushed,
    };
}
