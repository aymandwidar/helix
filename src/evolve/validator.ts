/**
 * Validator — runs the project's own build and test scripts to confirm a plan
 * didn't break anything. Returns structured pass/fail so the orchestrator can
 * decide whether to self-heal or revert.
 *
 * The validator never throws: failures (including missing scripts and
 * timeouts) are returned as `{ passed: false, ... }` so the orchestrator can
 * use a uniform code path.
 */

import * as fs from "fs";
import * as path from "path";

export interface ValidationStep {
    label: "build" | "test" | "typecheck";
    skipped: boolean;
    passed: boolean;
    durationMs: number;
    /** Captured stdout+stderr (truncated). */
    output: string;
    /** Exit code; 0 means success, > 0 means failure. */
    exitCode?: number;
    error?: string;
}

export interface ValidationResult {
    passed: boolean;
    steps: ValidationStep[];
}

export interface ValidatorOptions {
    cwd: string;
    /** Overall timeout per step (ms). Defaults to 5 minutes. */
    timeoutMs?: number;
    /** Skip build (e.g. for fast preview validation). Default false. */
    skipBuild?: boolean;
    /** Skip tests (sometimes the project doesn't ship tests). Default false. */
    skipTests?: boolean;
    /** Skip type-check fallback when no `build` script exists. Default false. */
    skipTypecheck?: boolean;
    /** Maximum captured output length per step. */
    maxOutput?: number;
}

const DEFAULT_TIMEOUT = 5 * 60 * 1000;
const DEFAULT_MAX_OUTPUT = 8000;

export async function validateProject(options: ValidatorOptions): Promise<ValidationResult> {
    const cwd = options.cwd;
    const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT;
    const maxOutput = options.maxOutput ?? DEFAULT_MAX_OUTPUT;

    const pkgPath = path.join(cwd, "package.json");
    let scripts: Record<string, string> = {};
    if (fs.existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
            scripts = pkg.scripts || {};
        } catch {
            // ignore
        }
    }

    const steps: ValidationStep[] = [];

    // Build (or fall back to typecheck)
    if (!options.skipBuild && scripts.build) {
        steps.push(await runStep("build", "npm run build", cwd, timeout, maxOutput));
    } else if (!options.skipTypecheck && hasTypescript(cwd)) {
        steps.push(await runStep("typecheck", "npx tsc --noEmit", cwd, timeout, maxOutput));
    } else {
        steps.push({ label: "build", skipped: true, passed: true, durationMs: 0, output: "(no build script)" });
    }

    // Tests
    if (!options.skipTests && scripts.test) {
        steps.push(await runStep("test", "npm test --silent", cwd, timeout, maxOutput));
    } else {
        steps.push({ label: "test", skipped: true, passed: true, durationMs: 0, output: "(no test script)" });
    }

    return {
        passed: steps.every(s => s.skipped || s.passed),
        steps,
    };
}

async function runStep(
    label: ValidationStep["label"],
    command: string,
    cwd: string,
    timeout: number,
    maxOutput: number
): Promise<ValidationStep> {
    const execa = (await import("execa")).default;
    const started = Date.now();
    try {
        const result = await execa(command, {
            shell: true,
            cwd,
            timeout,
            reject: false,
            all: true,
        });
        const all = result.all || `${result.stdout || ""}${result.stderr ? "\n" + result.stderr : ""}` || "";
        const output = all.length > maxOutput ? all.slice(-maxOutput) : all;
        return {
            label,
            skipped: false,
            passed: (result.exitCode ?? 0) === 0,
            durationMs: Date.now() - started,
            output,
            exitCode: result.exitCode ?? undefined,
        };
    } catch (e: any) {
        return {
            label,
            skipped: false,
            passed: false,
            durationMs: Date.now() - started,
            output: "",
            error: e?.message || String(e),
        };
    }
}

function hasTypescript(cwd: string): boolean {
    return fs.existsSync(path.join(cwd, "tsconfig.json"));
}

export function summarizeValidation(result: ValidationResult): string {
    return result.steps.map(s => {
        if (s.skipped) return `· ${s.label}: skipped`;
        const dur = (s.durationMs / 1000).toFixed(1) + "s";
        return `${s.passed ? "✓" : "✗"} ${s.label}: ${s.passed ? "passed" : "failed"} (${dur})`;
    }).join("\n");
}
