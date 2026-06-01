/**
 * On-disk store for background task state under ~/.helix/bg/<id>/.
 *
 * Three files per task:
 *   - meta.json   — BgMeta (state, pid, timestamps)
 *   - output.log  — append-only progress log (one event per line)
 *   - result.json — BgResult written when state transitions to completed/failed/killed
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { getSettingsDir } from "../mcp/config";
import { BgMeta, BgResult, BgState } from "./types";

const BG_SUBDIR = "bg";

export function getBgRoot(): string {
    return path.join(getSettingsDir(), BG_SUBDIR);
}

export function generateBgId(): string {
    return "bg-" + crypto.randomBytes(3).toString("hex");
}

export function bgTaskDir(id: string): string {
    return path.join(getBgRoot(), id);
}

export function metaPath(id: string): string {
    return path.join(bgTaskDir(id), "meta.json");
}

export function outputPath(id: string): string {
    return path.join(bgTaskDir(id), "output.log");
}

export function resultPath(id: string): string {
    return path.join(bgTaskDir(id), "result.json");
}

export function writeMeta(meta: BgMeta): string {
    const dir = bgTaskDir(meta.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(metaPath(meta.id), JSON.stringify(meta, null, 2) + "\n");
    return metaPath(meta.id);
}

export function readMeta(id: string): BgMeta | null {
    const file = metaPath(id);
    if (!fs.existsSync(file)) return null;
    try {
        return JSON.parse(fs.readFileSync(file, "utf-8"));
    } catch {
        return null;
    }
}

export function updateMeta(id: string, patch: Partial<BgMeta>): BgMeta | null {
    const current = readMeta(id);
    if (!current) return null;
    const next = { ...current, ...patch };
    writeMeta(next);
    return next;
}

export function appendOutput(id: string, line: string): void {
    const dir = bgTaskDir(id);
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(outputPath(id), line.endsWith("\n") ? line : line + "\n");
}

export function readOutput(id: string): string {
    const file = outputPath(id);
    if (!fs.existsSync(file)) return "";
    try {
        return fs.readFileSync(file, "utf-8");
    } catch {
        return "";
    }
}

export function writeResult(id: string, result: BgResult): void {
    fs.writeFileSync(resultPath(id), JSON.stringify(result, null, 2) + "\n");
}

export function readResult(id: string): BgResult | null {
    const file = resultPath(id);
    if (!fs.existsSync(file)) return null;
    try {
        return JSON.parse(fs.readFileSync(file, "utf-8"));
    } catch {
        return null;
    }
}

export function listTasks(): BgMeta[] {
    const dir = getBgRoot();
    if (!fs.existsSync(dir)) return [];
    const out: BgMeta[] = [];
    for (const id of fs.readdirSync(dir)) {
        const meta = readMeta(id);
        if (meta) out.push(meta);
    }
    return out.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function countByState(state: BgState): number {
    return listTasks().filter(t => t.state === state).length;
}
