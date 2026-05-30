import { CommandRunner, DeployContext, DeployResult } from "./types";
import { parseEnvFile, syncEnv, summarizeEnv } from "./env_sync";
import { defaultRunner, extractDeployUrl, ensureCli } from "./shared";

const NETLIFY_INSTALL_HINT = "npm i -g netlify-cli";

export async function deployToNetlify(ctx: DeployContext): Promise<DeployResult> {
    const runner: CommandRunner = ctx.runner || defaultRunner;
    const cliCheck = await ensureCli("netlify", ["--version"], runner);
    if (!cliCheck.installed) {
        return {
            target: "netlify",
            success: false,
            skippedReason: `netlify CLI not installed. Install with: ${NETLIFY_INSTALL_HINT}`,
        };
    }

    if (ctx.dryRun) {
        return { target: "netlify", success: true, skippedReason: "dry-run" };
    }

    const args = ["deploy", "--prod", "--build", "--json"];
    if (ctx.token) args.push("--auth", ctx.token);

    let stdout = "", stderr = "", exitCode = 0;
    try {
        const r = await runner("netlify", args, { cwd: ctx.cwd });
        stdout = r.stdout; stderr = r.stderr; exitCode = r.exitCode;
    } catch (err: any) {
        return { target: "netlify", success: false, error: err?.message || String(err) };
    }

    if (exitCode !== 0) {
        return {
            target: "netlify",
            success: false,
            output: stdout,
            error: stderr || "netlify exited non-zero",
        };
    }

    let url = extractDeployUrl(stdout);
    // netlify --json output usually has {"url": "..."} — try to parse
    try {
        const parsed = JSON.parse(stdout);
        if (typeof parsed?.deploy_url === "string") url = parsed.deploy_url;
        else if (typeof parsed?.url === "string") url = parsed.url;
    } catch { /* not JSON, keep extractDeployUrl result */ }

    let envPushed = 0;
    if (!ctx.skipEnvSync) {
        const envFilePath = (ctx.envFile ? ctx.cwd + "/" + ctx.envFile : ctx.cwd + "/.env");
        const env = parseEnvFile(envFilePath);
        if (env.keys.length > 0) {
            const confirm = ctx.confirm || (async () => true);
            const ok = await confirm(`Push ${summarizeEnv(env)} to Netlify? `);
            if (ok) {
                const sync = await syncEnv({
                    cwd: ctx.cwd,
                    envFile: ctx.envFile,
                    runner,
                    label: "netlify",
                    buildUploadArgs: (key, value) => ({
                        command: "netlify",
                        args: ["env:set", key, value],
                    }),
                });
                envPushed = sync.pushed;
            }
        }
    }

    return {
        target: "netlify",
        success: true,
        url,
        output: stdout,
        envPushed,
    };
}
