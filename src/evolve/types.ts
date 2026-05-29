/**
 * Shared types for the Sprint 9 evolve engine.
 */

export type EvolveAction = "add-feature" | "refactor" | "fix" | "migrate" | "optimize";

export interface FileCreate {
    op: "create";
    path: string;
    content: string;
    rationale?: string;
}

export interface FileEdit {
    op: "edit";
    path: string;
    old: string;
    new: string;
    rationale?: string;
}

export interface FileReplace {
    op: "replace";
    path: string;
    content: string;
    rationale?: string;
}

export interface FileDelete {
    op: "delete";
    path: string;
    rationale?: string;
}

export interface PackageChange {
    op: "add" | "remove" | "upgrade";
    name: string;
    version?: string;
    dev?: boolean;
}

export interface ScriptChange {
    op: "add" | "remove";
    name: string;
    command?: string;
}

export type FileChange = FileCreate | FileEdit | FileReplace | FileDelete;

export interface ChangePlan {
    summary: string;
    rationale: string;
    files: FileChange[];
    packages: PackageChange[];
    scripts: ScriptChange[];
    /** Optional shell commands to run after applying (e.g. `npx prisma generate`). */
    postCommands: string[];
    /** AI's confidence on a 0-1 scale (or null if not provided). */
    confidence?: number;
}

export interface EvolveResult {
    plan: ChangePlan;
    applied: boolean;
    /** The checkpoint id created before applying (null if dry-run / not applied). */
    checkpointId: string | null;
    /** Validation outcome ("skipped" if validator was disabled). */
    validation: "passed" | "failed" | "skipped";
    /** Self-heal attempt count (0 if validation passed first try or was skipped). */
    healAttempts: number;
    /** Final error message when validation/heal didn't recover. */
    error?: string;
}
