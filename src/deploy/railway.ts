import { CommandRunner, DeployContext, DeployResult } from "./types";
import { parseEnvFile, syncEnv, summarizeEnv } from "./env_sync";
import { defaultRunner, extractDeployUrl, ensureCli } from "./shared";

const RAILWAY_INSTALL_HINT = "npm i -g @railway/cli";

export async function deployToRailway(ctx: DeployContext): Promise<DeployResult> {
    const runner: CommandRunner = ctx.runner || defaultRunner;
    const cliCheck = await ensureCli("railway", ["version"], runner);
    if (!cliCheck.installed) {
        return {
            target: "railway",
            success: false,
            skippedReason: `railway CLI not installed. Install with: ${RAILWAY_INSTALL_HINT}`,
        };
    }

    if (ctx.dryRun) {
        return { target: "railway", success: true, skippedReason: "dry-run" };
    }

    const args = ["up", "--detach"];

    let stdout = "", stderr = "", exitCode = 0;
    try {
        const r = await runner("railway", args, { cwd: ctx.cwd });
        stdout = r.stdout; stderr = r.stderr; exitCode = r.exitCode;
    } catch (err: any) {
        return { target: "railway", success: false, error: err?.message || String(err) };
    }

    if (exitCode !== 0) {
        return {
            target: "railway",
            success: false,
            output: stdout,
            error: stderr || "railway exited non-zero",
        };
    }

    const url = extractDeployUrl(stdout);

    let envPushed = 0;
    if (!ctx.skipEnvSync) {
        const envFilePath = (ctx.envFile ? ctx.cwd + "/" + ctx.envFile : ctx.cwd + "/.env");
        const env = parseEnvFile(envFilePath);
        if (env.keys.length > 0) {
            const confirm = ctx.confirm || (async () => true);
            const ok = await confirm(`Push ${summarizeEnv(env)} to Railway? `);
            if (ok) {
                const sync = await syncEnv({
                    cwd: ctx.cwd,
                    envFile: ctx.envFile,
                    runner,
                    label: "railway",
                    buildUploadArgs: (key, value) => ({
                        command: "railway",
                        args: ["variables", "set", `${key}=${value}`],
                    }),
                });
                envPushed = sync.pushed;
            }
        }
    }

    return {
        target: "railway",
        success: true,
        url,
        output: stdout,
        envPushed,
    };
}
