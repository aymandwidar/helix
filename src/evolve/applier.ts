/**
 * Applier — translates a `ChangePlan` into actual filesystem mutations.
 *
 * The applier is intentionally NOT responsible for checkpointing; the
 * orchestrator (index.ts) does that before calling apply, then this module
 * makes the changes. This separation keeps the applier easy to unit test in
 * isolated tmpdirs.
 */

import * as fs from "fs";
import * as path from "path";
import { ChangePlan, FileChange, PackageChange, ScriptChange } from "./types";

export interface ApplyOptions {
    cwd: string;
    /** When true, no files are written; the result lists what would change. */
    dryRun?: boolean;
}

export interface ApplyDiff {
    file: string;
    op: FileChange["op"];
    before?: string;
    after?: string;
    rationale?: string;
    /** Set when an edit's `old` did not match the file content. */
    error?: string;
}

export interface ApplyOutcome {
    /** Absolute paths affected (for checkpointing — populated even on dry-run). */
    affectedFiles: string[];
    /** Per-file diff entries describing the change. */
    diffs: ApplyDiff[];
    /** Errors that prevented an op from completing. */
    errors: Array<{ file: string; message: string }>;
    /** Final package.json text (if changed) for inspection. */
    packageJsonAfter?: string;
}

/** List the absolute paths a plan would touch — used for pre-apply checkpoints. */
export function planAffectedFiles(plan: ChangePlan, cwd: string): string[] {
    const set = new Set<string>();
    for (const f of plan.files) {
        set.add(path.isAbsolute(f.path) ? f.path : path.join(cwd, f.path));
    }
    if (plan.packages.length || plan.scripts.length) {
        set.add(path.join(cwd, "package.json"));
    }
    return [...set];
}

export async function applyPlan(plan: ChangePlan, options: ApplyOptions): Promise<ApplyOutcome> {
    const cwd = options.cwd;
    const dryRun = !!options.dryRun;
    const outcome: ApplyOutcome = {
        affectedFiles: planAffectedFiles(plan, cwd),
        diffs: [],
        errors: [],
    };

    for (const file of plan.files) {
        try {
            const diff = applyFileChange(file, cwd, dryRun);
            outcome.diffs.push(diff);
            if (diff.error) outcome.errors.push({ file: file.path, message: diff.error });
        } catch (e: any) {
            outcome.errors.push({ file: file.path, message: e?.message || String(e) });
        }
    }

    if (plan.packages.length > 0 || plan.scripts.length > 0) {
        try {
            const before = readPackageJson(cwd);
            const after = mutatePackageJson(before, plan.packages, plan.scripts);
            const beforeText = JSON.stringify(before, null, 2);
            const afterText = JSON.stringify(after, null, 2);
            if (beforeText !== afterText) {
                if (!dryRun) fs.writeFileSync(path.join(cwd, "package.json"), afterText + "\n");
                outcome.diffs.push({
                    file: "package.json",
                    op: "edit",
                    before: beforeText,
                    after: afterText,
                    rationale: describePackageChanges(plan.packages, plan.scripts),
                });
                outcome.packageJsonAfter = afterText;
            }
        } catch (e: any) {
            outcome.errors.push({ file: "package.json", message: e?.message || String(e) });
        }
    }

    return outcome;
}

function applyFileChange(change: FileChange, cwd: string, dryRun: boolean): ApplyDiff {
    const abs = path.isAbsolute(change.path) ? change.path : path.join(cwd, change.path);

    if (change.op === "create") {
        const exists = fs.existsSync(abs);
        const before = exists ? safeRead(abs) : "";
        if (!dryRun) {
            fs.mkdirSync(path.dirname(abs), { recursive: true });
            fs.writeFileSync(abs, change.content);
        }
        return {
            file: change.path,
            op: "create",
            before: exists ? before : undefined,
            after: change.content,
            rationale: change.rationale,
        };
    }

    if (change.op === "replace") {
        if (!fs.existsSync(abs)) {
            return { file: change.path, op: "replace", error: "file not found", rationale: change.rationale };
        }
        const before = safeRead(abs);
        if (!dryRun) fs.writeFileSync(abs, change.content);
        return {
            file: change.path,
            op: "replace",
            before,
            after: change.content,
            rationale: change.rationale,
        };
    }

    if (change.op === "delete") {
        if (!fs.existsSync(abs)) {
            return { file: change.path, op: "delete", error: "file not found", rationale: change.rationale };
        }
        const before = safeRead(abs);
        if (!dryRun) fs.unlinkSync(abs);
        return {
            file: change.path,
            op: "delete",
            before,
            rationale: change.rationale,
        };
    }

    // edit
    if (!fs.existsSync(abs)) {
        return { file: change.path, op: "edit", error: "file not found", rationale: change.rationale };
    }
    const before = safeRead(abs);
    if (!before.includes(change.old)) {
        return {
            file: change.path,
            op: "edit",
            error: "old_string not found in file",
            rationale: change.rationale,
        };
    }
    const occurrences = before.split(change.old).length - 1;
    if (occurrences > 1) {
        return {
            file: change.path,
            op: "edit",
            error: `old_string matches ${occurrences} times — planner must include more context`,
            rationale: change.rationale,
        };
    }
    const after = before.replace(change.old, change.new);
    if (!dryRun) fs.writeFileSync(abs, after);
    return {
        file: change.path,
        op: "edit",
        before,
        after,
        rationale: change.rationale,
    };
}

function safeRead(p: string): string {
    try { return fs.readFileSync(p, "utf-8"); } catch { return ""; }
}

function readPackageJson(cwd: string): any {
    const p = path.join(cwd, "package.json");
    if (!fs.existsSync(p)) return { dependencies: {}, devDependencies: {}, scripts: {} };
    return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function mutatePackageJson(pkg: any, packages: PackageChange[], scripts: ScriptChange[]): any {
    const out = { ...pkg };
    out.dependencies = { ...(out.dependencies || {}) };
    out.devDependencies = { ...(out.devDependencies || {}) };
    out.scripts = { ...(out.scripts || {}) };

    for (const change of packages) {
        if (change.op === "remove") {
            delete out.dependencies[change.name];
            delete out.devDependencies[change.name];
            continue;
        }
        const target = change.dev ? out.devDependencies : out.dependencies;
        target[change.name] = change.version || "*";
    }

    for (const change of scripts) {
        if (change.op === "remove") {
            delete out.scripts[change.name];
            continue;
        }
        if (change.command) out.scripts[change.name] = change.command;
    }

    return out;
}

function describePackageChanges(packages: PackageChange[], scripts: ScriptChange[]): string {
    const parts: string[] = [];
    for (const p of packages) {
        if (p.op === "remove") parts.push(`- ${p.name}`);
        else parts.push(`+ ${p.name}@${p.version || "*"}${p.dev ? " (dev)" : ""}`);
    }
    for (const s of scripts) {
        if (s.op === "remove") parts.push(`- script ${s.name}`);
        else parts.push(`+ script ${s.name}: ${s.command}`);
    }
    return parts.join(", ");
}

/**
 * Render a human-readable preview of an outcome (used by --dry-run).
 */
export function renderApplyPreview(outcome: ApplyOutcome): string {
    const lines: string[] = [];
    for (const d of outcome.diffs) {
        if (d.error) {
            lines.push(`✗ ${d.op.padEnd(7)} ${d.file} — ${d.error}`);
            continue;
        }
        lines.push(`• ${d.op.padEnd(7)} ${d.file}${d.rationale ? "  — " + d.rationale : ""}`);
    }
    if (outcome.errors.length > 0) {
        lines.push("");
        lines.push("Errors:");
        for (const e of outcome.errors) lines.push(`  ${e.file}: ${e.message}`);
    }
    return lines.join("\n");
}
