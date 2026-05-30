/**
 * Changelog generator — reads git log since a ref, asks AI to group commits
 * into changelog sections, and writes/updates CHANGELOG.md.
 */

import * as fs from "fs";
import * as path from "path";
import { GitRunner, AiClient } from "./types";
import { defaultRunner, defaultAi } from "./shared";

export interface ChangelogOptions {
    cwd: string;
    /** Git ref to start from (default: most recent tag or last 30 commits). */
    since?: string;
    /** Output style. */
    style?: "conventional" | "semver";
    /** Override runner / ai for tests. */
    runner?: GitRunner;
    ai?: AiClient;
    model?: string;
    /** When true, return the section text without writing CHANGELOG.md. */
    dryRun?: boolean;
}

export interface ChangelogResult {
    section: string;
    commits: number;
    since: string;
    file: string;
    /** When the existing CHANGELOG.md was modified, this is the merged result. */
    merged: boolean;
}

const CONVENTIONAL_SYSTEM = `Group git commit messages into a conventional-style CHANGELOG section.
Output strictly:

## [Unreleased] - <YYYY-MM-DD>

### Added
- <new features>

### Changed
- <behavior changes / refactors>

### Fixed
- <bug fixes>

### Removed
- <deletions>

Omit empty sections. Keep bullet wording terse and customer-focused. No code fences.`;

const SEMVER_SYSTEM = `Group git commit messages into a SemVer-style CHANGELOG section.
Output strictly:

## <next version guess> - <YYYY-MM-DD>

**MAJOR / breaking**
- <breaking changes>

**MINOR / features**
- <new features>

**PATCH / fixes**
- <bug fixes / docs / chores>

Omit empty groups. No code fences.`;

export async function generateChangelog(options: ChangelogOptions): Promise<ChangelogResult> {
    const runner = options.runner || defaultRunner;
    const ai = options.ai || defaultAi;
    const cwd = options.cwd;

    let since = options.since;
    if (!since) {
        const tagRes = await runner("git", ["describe", "--tags", "--abbrev=0"], { cwd });
        since = tagRes.exitCode === 0 ? tagRes.stdout.trim() : "";
    }

    const range = since ? `${since}..HEAD` : "-n 30";
    const args = since
        ? ["log", `${since}..HEAD`, "--pretty=format:%h %s"]
        : ["log", "-n", "30", "--pretty=format:%h %s"];
    const log = await runner("git", args, { cwd });
    const lines = (log.stdout || "").split("\n").filter(Boolean);

    if (lines.length === 0) {
        return {
            section: "(no commits since " + (since || "last 30") + ")",
            commits: 0,
            since: since || "",
            file: path.join(cwd, "CHANGELOG.md"),
            merged: false,
        };
    }

    const system = options.style === "semver" ? SEMVER_SYSTEM : CONVENTIONAL_SYSTEM;
    const userMsg = `Range: ${range}\n\nCommits:\n${lines.join("\n")}`;
    const section = (await ai(system, userMsg, {
        model: options.model,
        temperature: 0.2,
        maxTokens: 1500,
    })).trim();

    const file = path.join(cwd, "CHANGELOG.md");
    let merged = false;

    if (!options.dryRun) {
        const header = "# Changelog\n\n";
        if (fs.existsSync(file)) {
            const existing = fs.readFileSync(file, "utf-8");
            // Insert new section right after the top-level heading (or at the top).
            const idx = existing.indexOf("\n## ");
            if (idx > 0) {
                const head = existing.slice(0, idx);
                const tail = existing.slice(idx);
                fs.writeFileSync(file, head + "\n\n" + section + "\n" + tail);
            } else {
                fs.writeFileSync(file, header + section + "\n\n" + existing.replace(/^#\s+Changelog\s*\n?/, ""));
            }
            merged = true;
        } else {
            fs.writeFileSync(file, header + section + "\n");
        }
    }

    return { section, commits: lines.length, since: since || "(last 30)", file, merged };
}
