/**
 * Planner — given a project snapshot and a high-level user intent, asks the
 * AI to produce a structured `ChangePlan` describing every file create/edit
 * and package change needed.
 *
 * The planner returns plans only; nothing is written to disk here.
 */

import { ChangePlan, EvolveAction, FileChange, PackageChange, ScriptChange } from "./types";
import { ProjectSnapshot, summarizeSnapshot } from "./scanner";
import { createCompletion, DEFAULT_MODEL } from "../openrouter";

export interface PlanOptions {
    action: EvolveAction;
    intent: string;
    snapshot: ProjectSnapshot;
    /** Extra context (e.g. CMM findings, custom strategy notes). */
    contextNotes?: string;
    /** Files the user wants the planner to focus on. */
    focusFiles?: string[];
    model?: string;
}

const SYSTEM_PROMPT = `You are Helix's evolution planner. Given an existing project's structure and a developer's intent, propose a minimal, surgical change plan that achieves the intent without breaking the codebase.

Hard rules:
- Output ONE single JSON object. No prose before or after. No markdown fences.
- Prefer small targeted edits ("op":"edit") over full file replacements.
- Use "op":"create" only for genuinely new files.
- Use "op":"replace" sparingly — only when the entire file content needs to change.
- For edits, "old" must match the existing file content EXACTLY (whitespace and all). Include enough surrounding context that the match is unique.
- Don't invent files or APIs that aren't in the project. Reference existing modules, deps, and routes.
- If the intent requires new packages, list them in "packages" with the proper version range; don't put npm-install commands in "postCommands".
- Keep "postCommands" for things like "npx prisma generate" or "npx prisma migrate dev --name <slug>" only.

Output schema:
{
  "summary": "<one-line description>",
  "rationale": "<why these changes>",
  "files": [
    { "op": "create",  "path": "...", "content": "...", "rationale": "..." },
    { "op": "edit",    "path": "...", "old": "...", "new": "...", "rationale": "..." },
    { "op": "replace", "path": "...", "content": "...", "rationale": "..." },
    { "op": "delete",  "path": "...", "rationale": "..." }
  ],
  "packages": [
    { "op": "add", "name": "package-name", "version": "^1.0.0", "dev": false }
  ],
  "scripts": [
    { "op": "add", "name": "lint", "command": "next lint" }
  ],
  "postCommands": ["npx prisma generate"],
  "confidence": 0.85
}`;

const ACTION_HINTS: Record<EvolveAction, string> = {
    "add-feature": "The user is ADDING new functionality. Plan new files, new routes, new components, and the minimum edits to wire them in (navigation, layouts, schema additions). Prefer additive changes over rewrites.",
    "refactor": "The user is RESTRUCTURING existing code. Preserve external behavior. Move/rename files thoughtfully and update every import.",
    "fix": "The user reported a BUG. Identify the root cause from the snapshot if possible; otherwise propose the smallest plausible fix and call out assumptions in the rationale.",
    "migrate": "The user is MIGRATING dependencies or framework versions. Update package versions, config files, and idiomatic API usages. Flag breaking changes explicitly.",
    "optimize": "The user wants PERFORMANCE / a11y / SEO / DX improvements. Focus on measurable wins (bundle size, query count, image optimization, semantic HTML, missing aria-*, etc).",
};

export async function planChanges(options: PlanOptions): Promise<ChangePlan> {
    const { action, intent, snapshot, contextNotes, focusFiles } = options;
    const summary = summarizeSnapshot(snapshot);

    const userMessage = [
        `Intent (${action}): ${intent}`,
        "",
        ACTION_HINTS[action],
        "",
        "Project snapshot:",
        summary,
        contextNotes ? `\nAdditional context:\n${contextNotes}` : "",
        focusFiles && focusFiles.length > 0 ? `\nFocus files: ${focusFiles.join(", ")}` : "",
        "",
        "Return the JSON change plan now.",
    ].join("\n");

    const raw = await createCompletion(SYSTEM_PROMPT, userMessage, {
        model: options.model || DEFAULT_MODEL,
        temperature: 0.2,
        maxTokens: 8000,
    });

    return parsePlan(raw);
}

/**
 * Parse a planner response into a ChangePlan. Tolerant to surrounding prose
 * and ```json fences. Throws on malformed JSON or missing required fields.
 */
export function parsePlan(raw: string): ChangePlan {
    const json = extractJson(raw);
    let parsed: any;
    try {
        parsed = JSON.parse(json);
    } catch (e: any) {
        throw new Error(`Planner returned invalid JSON: ${e.message}`);
    }
    return normalizePlan(parsed);
}

function extractJson(raw: string): string {
    const trimmed = raw.trim();
    // Strip markdown fences
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) return fenceMatch[1].trim();
    // Find the first { ... } block
    const open = trimmed.indexOf("{");
    const close = trimmed.lastIndexOf("}");
    if (open === -1 || close === -1 || close < open) return trimmed;
    return trimmed.slice(open, close + 1);
}

function normalizePlan(parsed: any): ChangePlan {
    if (!parsed || typeof parsed !== "object") {
        throw new Error("Planner output is not an object");
    }
    const files: FileChange[] = Array.isArray(parsed.files)
        ? parsed.files.map(normalizeFile).filter((f: FileChange | null): f is FileChange => f !== null)
        : [];
    const packages: PackageChange[] = Array.isArray(parsed.packages)
        ? parsed.packages.map(normalizePackage).filter(Boolean) as PackageChange[]
        : [];
    const scripts: ScriptChange[] = Array.isArray(parsed.scripts)
        ? parsed.scripts.map(normalizeScript).filter(Boolean) as ScriptChange[]
        : [];
    const postCommands: string[] = Array.isArray(parsed.postCommands)
        ? parsed.postCommands.filter((c: any) => typeof c === "string")
        : [];
    return {
        summary: typeof parsed.summary === "string" ? parsed.summary : "(no summary)",
        rationale: typeof parsed.rationale === "string" ? parsed.rationale : "",
        files,
        packages,
        scripts,
        postCommands,
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : undefined,
    };
}

function normalizeFile(f: any): FileChange | null {
    if (!f || typeof f !== "object") return null;
    if (typeof f.path !== "string") return null;
    switch (f.op) {
        case "create":
            if (typeof f.content !== "string") return null;
            return { op: "create", path: f.path, content: f.content, rationale: f.rationale };
        case "edit":
            if (typeof f.old !== "string" || typeof f.new !== "string") return null;
            return { op: "edit", path: f.path, old: f.old, new: f.new, rationale: f.rationale };
        case "replace":
            if (typeof f.content !== "string") return null;
            return { op: "replace", path: f.path, content: f.content, rationale: f.rationale };
        case "delete":
            return { op: "delete", path: f.path, rationale: f.rationale };
        default:
            return null;
    }
}

function normalizePackage(p: any): PackageChange | null {
    if (!p || typeof p !== "object" || typeof p.name !== "string") return null;
    const op = p.op === "remove" || p.op === "upgrade" ? p.op : "add";
    return {
        op,
        name: p.name,
        version: typeof p.version === "string" ? p.version : undefined,
        dev: !!p.dev,
    };
}

function normalizeScript(s: any): ScriptChange | null {
    if (!s || typeof s !== "object" || typeof s.name !== "string") return null;
    const op = s.op === "remove" ? "remove" : "add";
    return {
        op,
        name: s.name,
        command: typeof s.command === "string" ? s.command : undefined,
    };
}
