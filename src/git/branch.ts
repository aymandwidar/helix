/**
 * Branch protection helper — emits a recommended GitHub branch-protection
 * payload + the gh-api command line the user can run.
 *
 * We deliberately do NOT call gh api here — branch protection is a
 * privileged change and should require an explicit human invocation.
 */

import { GitRunner } from "./types";
import { defaultRunner } from "./shared";

export interface BranchProtectionPayload {
    required_status_checks: {
        strict: boolean;
        contexts: string[];
    } | null;
    enforce_admins: boolean;
    required_pull_request_reviews: {
        dismissal_restrictions: Record<string, never>;
        dismiss_stale_reviews: boolean;
        require_code_owner_reviews: boolean;
        required_approving_review_count: number;
    };
    restrictions: null;
    allow_force_pushes: boolean;
    allow_deletions: boolean;
    required_conversation_resolution: boolean;
}

export interface BranchProtectOptions {
    cwd: string;
    /** Branch to protect (default: detected default branch). */
    branch?: string;
    /** Required CI check names (default: ["build", "test"]). */
    checks?: string[];
    /** Required approving reviews (default 1). */
    requiredReviews?: number;
    runner?: GitRunner;
}

export interface BranchProtectResult {
    repo: string | null;
    branch: string;
    payload: BranchProtectionPayload;
    /** Suggested CLI command (single string, ready to copy). */
    command: string;
}

export async function describeBranchProtection(options: BranchProtectOptions): Promise<BranchProtectResult> {
    const runner = options.runner || defaultRunner;
    const branch = options.branch || "main";
    const checks = options.checks || ["build", "test"];

    let repo: string | null = null;
    try {
        const r = await runner("gh", ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"], { cwd: options.cwd });
        if (r.exitCode === 0 && r.stdout.trim()) repo = r.stdout.trim();
    } catch { /* ignore */ }

    const payload: BranchProtectionPayload = {
        required_status_checks: { strict: true, contexts: checks },
        enforce_admins: false,
        required_pull_request_reviews: {
            dismissal_restrictions: {},
            dismiss_stale_reviews: true,
            require_code_owner_reviews: false,
            required_approving_review_count: options.requiredReviews ?? 1,
        },
        restrictions: null,
        allow_force_pushes: false,
        allow_deletions: false,
        required_conversation_resolution: true,
    };

    const repoSpec = repo || "OWNER/REPO";
    const command = [
        "gh api",
        "--method PUT",
        `repos/${repoSpec}/branches/${branch}/protection`,
        "--input -",
        "<<'JSON'",
        JSON.stringify(payload, null, 2),
        "JSON",
    ].join(" \\\n  ").replace("\\\n  <<'JSON'", " <<'JSON'");

    return { repo, branch, payload, command };
}
