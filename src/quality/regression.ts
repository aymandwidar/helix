/**
 * Regression guard — captures a snapshot of the project's source-file
 * checksums and the latest test run pass/fail state. Subsequent `check`
 * runs flag any new failures or unexpected file changes.
 *
 * The baseline lives at `.helix/regression-baseline.json` inside the
 * project. It is intentionally a simple JSON file so it can be checked in
 * (or .gitignored) per project preference.
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { validateProject, ValidationResult } from "../evolve/validator";

export interface FileChecksum {
    path: string;
    sha256: string;
    bytes: number;
}

export interface RegressionBaseline {
    createdAt: string;
    files: FileChecksum[];
    validation: { passed: boolean; passedSteps: string[]; failedSteps: string[] };
    note?: string;
}

export interface RegressionDiff {
    added: string[];
    removed: string[];
    changed: string[];
    /** Validation steps that flipped from passing to failing. */
    newFailures: string[];
    /** Validation steps that flipped from failing to passing (good news). */
    fixed: string[];
}

const BASELINE_RELATIVE = ".helix/regression-baseline.json";
const SKIP = new Set(["node_modules", ".git", ".next", "dist", "build", ".helix", "coverage"]);
const SOURCE_EXT = /\.(tsx?|jsx?|prisma|json|md|html?|css)$/;

export interface CaptureOptions {
    cwd: string;
    note?: string;
    /** Skip the live validation run when capturing (faster, less reliable). */
    skipValidation?: boolean;
}

export async function captureBaseline(opts: CaptureOptions): Promise<RegressionBaseline> {
    const files = collectChecksums(opts.cwd);
    let validation: RegressionBaseline["validation"];
    if (opts.skipValidation) {
        validation = { passed: true, passedSteps: [], failedSteps: [] };
    } else {
        const v = await validateProject({ cwd: opts.cwd });
        validation = summarizeValidation(v);
    }
    const baseline: RegressionBaseline = {
        createdAt: new Date().toISOString(),
        files,
        validation,
        note: opts.note,
    };
    writeBaseline(opts.cwd, baseline);
    return baseline;
}

export async function checkAgainstBaseline(cwd: string): Promise<{ baseline: RegressionBaseline | null; diff: RegressionDiff | null; current: RegressionBaseline["validation"] }> {
    const baseline = readBaseline(cwd);
    const validation = await validateProject({ cwd });
    const current = summarizeValidation(validation);
    if (!baseline) return { baseline: null, diff: null, current };

    const currentFiles = collectChecksums(cwd);
    const baselineMap = new Map(baseline.files.map(f => [f.path, f]));
    const currentMap = new Map(currentFiles.map(f => [f.path, f]));

    const added: string[] = [];
    const removed: string[] = [];
    const changed: string[] = [];

    for (const [path, cur] of currentMap.entries()) {
        const prev = baselineMap.get(path);
        if (!prev) added.push(path);
        else if (prev.sha256 !== cur.sha256) changed.push(path);
    }
    for (const path of baselineMap.keys()) {
        if (!currentMap.has(path)) removed.push(path);
    }

    const baselineFailures = new Set(baseline.validation.failedSteps);
    const currentFailures = new Set(current.failedSteps);
    const newFailures = [...currentFailures].filter(s => !baselineFailures.has(s));
    const fixed = [...baselineFailures].filter(s => !currentFailures.has(s));

    return {
        baseline,
        diff: { added, removed, changed, newFailures, fixed },
        current,
    };
}

export function readBaseline(cwd: string): RegressionBaseline | null {
    const p = path.join(cwd, BASELINE_RELATIVE);
    if (!fs.existsSync(p)) return null;
    try {
        return JSON.parse(fs.readFileSync(p, "utf-8"));
    } catch {
        return null;
    }
}

function writeBaseline(cwd: string, baseline: RegressionBaseline): void {
    const p = path.join(cwd, BASELINE_RELATIVE);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(baseline, null, 2) + "\n");
}

function summarizeValidation(result: ValidationResult): RegressionBaseline["validation"] {
    const passedSteps: string[] = [];
    const failedSteps: string[] = [];
    for (const step of result.steps) {
        if (step.skipped) continue;
        (step.passed ? passedSteps : failedSteps).push(step.label);
    }
    return { passed: result.passed, passedSteps, failedSteps };
}

function collectChecksums(cwd: string): FileChecksum[] {
    const out: FileChecksum[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const entry of entries) {
            if (SKIP.has(entry.name)) continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) { walk(full); continue; }
            if (!SOURCE_EXT.test(entry.name)) continue;
            try {
                const buf = fs.readFileSync(full);
                const hash = crypto.createHash("sha256").update(buf).digest("hex");
                out.push({ path: path.relative(cwd, full), sha256: hash, bytes: buf.length });
            } catch {
                // skip
            }
        }
    };
    walk(cwd);
    return out.sort((a, b) => a.path.localeCompare(b.path));
}

export function formatRegressionDiff(diff: RegressionDiff | null): string {
    if (!diff) return "(no baseline yet — run `helix regression-guard capture` first)";
    const lines: string[] = [];
    lines.push(`Files: +${diff.added.length} ~${diff.changed.length} -${diff.removed.length}`);
    if (diff.newFailures.length) lines.push("⚠  New validation failures: " + diff.newFailures.join(", "));
    if (diff.fixed.length) lines.push("✓  Newly-passing steps: " + diff.fixed.join(", "));
    if (!diff.newFailures.length && !diff.fixed.length && !diff.added.length && !diff.removed.length && !diff.changed.length) {
        lines.push("(no regressions detected)");
    }
    return lines.join("\n");
}
