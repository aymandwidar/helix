/**
 * Deploy adapter types — shared shape across Vercel/Netlify/Railway.
 */

export type DeployTarget = "vercel" | "netlify" | "railway";

export interface DeployContext {
    cwd: string;
    /** Auth token (optional — adapter falls back to CLI default auth). */
    token?: string;
    /** When true, skip the env-sync confirmation and the env push entirely. */
    skipEnvSync?: boolean;
    /** Override which .env file to read (default ".env"). */
    envFile?: string;
    /** When true, do not run the deploy command — print what would happen. */
    dryRun?: boolean;
    /** Override execa for tests. */
    runner?: CommandRunner;
    /** Override yes/no confirmation for non-TTY use (e.g. tests). */
    confirm?: (question: string) => Promise<boolean>;
}

export interface CommandRunner {
    (command: string, args: string[], opts?: { cwd?: string; env?: NodeJS.ProcessEnv }): Promise<{
        stdout: string;
        stderr: string;
        exitCode: number;
    }>;
}

export interface DeployResult {
    target: DeployTarget;
    success: boolean;
    url?: string;
    skippedReason?: string;
    /** Captured stdout (truncated). */
    output?: string;
    /** Captured error (when success=false). */
    error?: string;
    /** Number of env vars pushed (0 when skipped or empty). */
    envPushed?: number;
}
