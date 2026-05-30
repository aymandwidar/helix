/**
 * Sync local .env file → deploy provider environment variables.
 *
 * The provider-specific upload command is injected so this module can be
 * unit-tested without spawning real CLIs.
 */

import * as fs from "fs";
import * as path from "path";
import { CommandRunner } from "./types";

export interface ParsedEnv {
    keys: string[];
    pairs: Record<string, string>;
}

const SECRET_LIKE = /(API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY|CLIENT_SECRET)/i;

export function parseEnvFile(filePath: string): ParsedEnv {
    if (!fs.existsSync(filePath)) return { keys: [], pairs: {} };
    const text = fs.readFileSync(filePath, "utf-8");
    const pairs: Record<string, string> = {};
    for (const rawLine of text.split("\n")) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq < 0) continue;
        const key = line.slice(0, eq).trim();
        if (!/^[A-Z][A-Z0-9_]*$/.test(key)) continue;
        let value = line.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        pairs[key] = value;
    }
    return { keys: Object.keys(pairs).sort(), pairs };
}

export interface SyncOptions {
    cwd: string;
    envFile?: string;
    runner: CommandRunner;
    /** Build the argv that uploads a single key=value pair. */
    buildUploadArgs(key: string, value: string): { command: string; args: string[] };
    /** Tag for log output (e.g. "vercel"). */
    label: string;
}

export interface SyncResult {
    pushed: number;
    failed: Array<{ key: string; reason: string }>;
    sensitiveKeys: string[];
}

/**
 * Push every key in the .env file via the provider-specific upload command.
 */
export async function syncEnv(options: SyncOptions): Promise<SyncResult> {
    const file = path.join(options.cwd, options.envFile || ".env");
    const env = parseEnvFile(file);
    const result: SyncResult = { pushed: 0, failed: [], sensitiveKeys: [] };

    for (const key of env.keys) {
        if (SECRET_LIKE.test(key)) result.sensitiveKeys.push(key);
        const { command, args } = options.buildUploadArgs(key, env.pairs[key]);
        try {
            const r = await options.runner(command, args, { cwd: options.cwd });
            if (r.exitCode === 0) result.pushed++;
            else result.failed.push({ key, reason: (r.stderr || r.stdout || "non-zero exit").slice(0, 200) });
        } catch (err: any) {
            result.failed.push({ key, reason: err?.message || String(err) });
        }
    }
    return result;
}

export function summarizeEnv(env: ParsedEnv): string {
    if (env.keys.length === 0) return "(no .env keys to sync)";
    const sensitive = env.keys.filter(k => SECRET_LIKE.test(k));
    return `${env.keys.length} key(s)${sensitive.length ? ` — ${sensitive.length} sensitive: ${sensitive.join(", ")}` : ""}`;
}
