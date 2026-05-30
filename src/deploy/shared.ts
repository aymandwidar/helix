/**
 * Shared helpers across deploy adapters.
 */

import { CommandRunner } from "./types";

export const defaultRunner: CommandRunner = async (command, args, opts) => {
    const execa = (await import("execa")).default;
    try {
        const r = await execa(command, args, { cwd: opts?.cwd, env: opts?.env, reject: false });
        return {
            stdout: r.stdout || "",
            stderr: r.stderr || "",
            exitCode: r.exitCode ?? 0,
        };
    } catch (e: any) {
        return { stdout: "", stderr: e?.message || String(e), exitCode: 1 };
    }
};

export async function ensureCli(command: string, probeArgs: string[], runner: CommandRunner): Promise<{ installed: boolean; version?: string }> {
    try {
        const r = await runner(command, probeArgs, {});
        if (r.exitCode === 0) {
            const version = (r.stdout || r.stderr || "").trim().split("\n")[0];
            return { installed: true, version };
        }
        return { installed: false };
    } catch {
        return { installed: false };
    }
}

const URL_REGEX = /https?:\/\/[a-zA-Z0-9.\-/?=&%_]+/g;

export function extractDeployUrl(text: string): string | undefined {
    const matches = text.match(URL_REGEX);
    if (!matches) return undefined;
    // Prefer the LAST URL the CLI emits — that's typically the production URL.
    return matches[matches.length - 1];
}
