/**
 * Checkpoint manager.
 *
 * Tracks file snapshots before destructive tool operations so the user can
 * `/restore` to a previous state. Uses on-disk snapshots under
 * `<cwd>/.helix/checkpoints/`. Each checkpoint stores the *prior* contents of
 * any files it touches, plus a manifest mapping checkpoint id → list of files.
 *
 * This is intentionally simple: file content snapshots, no git history. It is
 * scoped to files modified within the current working directory.
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

export interface CheckpointEntry {
    id: string;
    label: string;
    createdAt: string;
    files: string[]; // absolute paths captured
}

export interface CheckpointManagerOptions {
    cwd?: string;
    rootDir?: string; // override storage root (for tests)
}

export class CheckpointManager {
    public readonly cwd: string;
    public readonly rootDir: string;

    constructor(options: CheckpointManagerOptions = {}) {
        this.cwd = options.cwd || process.cwd();
        this.rootDir = options.rootDir || path.join(this.cwd, ".helix", "checkpoints");
    }

    /**
     * Create a new checkpoint with the given label and capture the current
     * contents of `files` (each absolute path). Files that don't exist are
     * recorded as deletions so restore can re-delete them.
     */
    create(label: string, files: string[]): CheckpointEntry {
        const id = this.generateId();
        const dir = path.join(this.rootDir, id);
        fs.mkdirSync(dir, { recursive: true });

        const captured: string[] = [];
        for (const file of files) {
            const abs = path.isAbsolute(file) ? file : path.join(this.cwd, file);
            const safeName = this.encodePath(abs);
            const dest = path.join(dir, safeName);
            if (fs.existsSync(abs)) {
                fs.copyFileSync(abs, dest);
                captured.push(abs);
            } else {
                // Mark as a "missing" file so restore knows to delete it
                fs.writeFileSync(dest + ".missing", "");
                captured.push(abs);
            }
        }

        const entry: CheckpointEntry = {
            id,
            label,
            createdAt: new Date().toISOString(),
            files: captured,
        };
        fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(entry, null, 2));
        return entry;
    }

    list(): CheckpointEntry[] {
        if (!fs.existsSync(this.rootDir)) return [];
        const entries: CheckpointEntry[] = [];
        for (const name of fs.readdirSync(this.rootDir)) {
            const manifestPath = path.join(this.rootDir, name, "manifest.json");
            if (!fs.existsSync(manifestPath)) continue;
            try {
                entries.push(JSON.parse(fs.readFileSync(manifestPath, "utf-8")));
            } catch {
                // skip corrupt manifest
            }
        }
        return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    /**
     * Restore the given checkpoint id (or the most recent if not given).
     * Returns the entry that was restored, or null if nothing to restore.
     */
    restore(id?: string): CheckpointEntry | null {
        const entries = this.list();
        if (entries.length === 0) return null;
        const entry = id ? entries.find(e => e.id === id) : entries[0];
        if (!entry) return null;

        const dir = path.join(this.rootDir, entry.id);
        for (const abs of entry.files) {
            const safeName = this.encodePath(abs);
            const src = path.join(dir, safeName);
            const missingMarker = src + ".missing";

            if (fs.existsSync(missingMarker)) {
                if (fs.existsSync(abs)) fs.unlinkSync(abs);
                continue;
            }
            if (fs.existsSync(src)) {
                fs.mkdirSync(path.dirname(abs), { recursive: true });
                fs.copyFileSync(src, abs);
            }
        }
        return entry;
    }

    private generateId(): string {
        const ts = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
        const rand = crypto.randomBytes(3).toString("hex");
        return `${ts}-${rand}`;
    }

    private encodePath(abs: string): string {
        return Buffer.from(abs).toString("base64url");
    }
}
