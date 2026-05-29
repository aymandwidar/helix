/**
 * /teach + /inherit — manage `HELIX.md` learned-conventions section.
 *
 * /teach appends a one-line lesson under "## Learned conventions".
 * /inherit copies/merges another project's HELIX.md into the current one.
 *
 * The functions are pure file operations with deterministic output, so they
 * can be tested without an AI in the loop.
 */

import * as fs from "fs";
import * as path from "path";

const LEARNED_HEADER = "## Learned conventions";
const LEARNED_INTRO = "*This section is auto-maintained by `/teach`. Each entry is a single learned fact about how the user wants to work.*";
const HELIX_MD_FILE = "HELIX.md";

export interface TeachOptions {
    cwd: string;
    lesson: string;
    /** Override default file location. */
    filePath?: string;
}

export interface InheritOptions {
    cwd: string;
    /** Path to the source HELIX.md (or directory containing one). */
    source: string;
    /** Override default destination. */
    destPath?: string;
    /** Replace destination instead of merging. Default false. */
    overwrite?: boolean;
}

export function teach(options: TeachOptions): { file: string; appended: string } {
    const file = options.filePath || path.join(options.cwd, HELIX_MD_FILE);
    const lesson = options.lesson.trim();
    if (!lesson) throw new Error("teach: lesson must be non-empty");

    let current = "";
    if (fs.existsSync(file)) current = fs.readFileSync(file, "utf-8");
    if (!current.trim()) {
        current = `# Project Context for Helix\n\n${LEARNED_HEADER}\n${LEARNED_INTRO}\n`;
    }

    const next = appendLearnedLine(current, lesson);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, next);
    return { file, appended: lesson };
}

export function inherit(options: InheritOptions): { dest: string; merged: boolean } {
    const dest = options.destPath || path.join(options.cwd, HELIX_MD_FILE);
    const sourcePath = resolveSource(options.source);
    if (!sourcePath || !fs.existsSync(sourcePath)) {
        throw new Error(`inherit: no HELIX.md found at ${options.source}`);
    }
    const incoming = fs.readFileSync(sourcePath, "utf-8");

    if (options.overwrite || !fs.existsSync(dest)) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, incoming);
        return { dest, merged: false };
    }

    const current = fs.readFileSync(dest, "utf-8");
    const merged = mergeMarkdown(current, incoming);
    fs.writeFileSync(dest, merged);
    return { dest, merged: true };
}

export function listLearned(cwd: string): string[] {
    const file = path.join(cwd, HELIX_MD_FILE);
    if (!fs.existsSync(file)) return [];
    return parseLearnedLines(fs.readFileSync(file, "utf-8"));
}

// ─── helpers ─────────────────────────────────────────────────────────────

function appendLearnedLine(text: string, lesson: string): string {
    const lines = text.split("\n");
    const headerIdx = lines.findIndex(l => l.trim() === LEARNED_HEADER);
    const newLine = `- ${lesson}`;
    if (headerIdx === -1) {
        // Append a new section
        const append = (lines[lines.length - 1] ?? "").trim() === "" ? "" : "\n";
        return text + `${append}\n${LEARNED_HEADER}\n${LEARNED_INTRO}\n${newLine}\n`;
    }
    // Find the next blank line / next ## or EOF after the header
    let end = lines.length;
    for (let i = headerIdx + 1; i < lines.length; i++) {
        if (/^##\s/.test(lines[i])) { end = i; break; }
    }
    // Avoid duplicates
    const slice = lines.slice(headerIdx, end).join("\n");
    if (slice.includes(newLine)) return text;

    // Insert before the blank line that precedes the next ## (or at end)
    let insertAt = end;
    while (insertAt > headerIdx + 1 && lines[insertAt - 1].trim() === "") insertAt--;
    lines.splice(insertAt, 0, newLine);
    return lines.join("\n");
}

function parseLearnedLines(text: string): string[] {
    const lines = text.split("\n");
    const out: string[] = [];
    let inSection = false;
    for (const line of lines) {
        if (line.trim() === LEARNED_HEADER) { inSection = true; continue; }
        if (inSection && /^##\s/.test(line)) break;
        if (inSection && line.startsWith("- ")) out.push(line.slice(2).trim());
    }
    return out;
}

function resolveSource(source: string): string | null {
    const stat = fs.existsSync(source) ? fs.statSync(source) : null;
    if (!stat) return null;
    if (stat.isFile()) return source;
    const candidate = path.join(source, HELIX_MD_FILE);
    return fs.existsSync(candidate) ? candidate : null;
}

/**
 * Merge two HELIX.md files. We preserve the destination's structure and
 * append unique sections from the source. For overlapping sections (same
 * `## heading`), we append the source's bullet items if absent.
 */
export function mergeMarkdown(dest: string, source: string): string {
    const destSections = splitSections(dest);
    const srcSections = splitSections(source);

    // Merge content of matching sections; append the rest
    for (const [heading, srcBody] of srcSections.entries()) {
        if (destSections.has(heading)) {
            destSections.set(heading, mergeSectionBodies(destSections.get(heading)!, srcBody));
        } else {
            destSections.set(heading, srcBody);
        }
    }

    return joinSections(destSections);
}

function splitSections(md: string): Map<string, string> {
    const out = new Map<string, string>();
    const lines = md.split("\n");
    let currentHeading = "__preface__";
    let buf: string[] = [];
    for (const line of lines) {
        if (/^#{1,2}\s/.test(line)) {
            out.set(currentHeading, buf.join("\n"));
            currentHeading = line;
            buf = [];
        } else {
            buf.push(line);
        }
    }
    out.set(currentHeading, buf.join("\n"));
    return out;
}

function joinSections(sections: Map<string, string>): string {
    const parts: string[] = [];
    for (const [heading, body] of sections.entries()) {
        if (heading === "__preface__") {
            if (body.trim().length) parts.push(body.replace(/\n+$/, ""));
            continue;
        }
        parts.push(heading);
        if (body.trim().length) parts.push(body.replace(/^\n+/, "").replace(/\n+$/, ""));
    }
    return parts.join("\n") + "\n";
}

function mergeSectionBodies(destBody: string, srcBody: string): string {
    const destLines = destBody.split("\n");
    const srcLines = srcBody.split("\n");
    for (const line of srcLines) {
        if (line.trim().startsWith("- ") && !destLines.some(d => d.trim() === line.trim())) {
            destLines.push(line);
        }
    }
    return destLines.join("\n");
}
