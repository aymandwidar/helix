/**
 * Permission engine for the chat agent.
 *
 * Decides — for any (tool, args) pair — whether to:
 *   "allow"  : run without asking
 *   "ask"    : prompt the user
 *   "deny"   : refuse outright (and tell the model why)
 *
 * Decision sources, in priority order:
 *   1. Explicit `deny` rule matches → deny
 *   2. Explicit `allow` rule matches → allow
 *   3. Explicit `ask` rule matches → ask
 *   4. Mode default
 *
 * Rules live in `~/.helix/settings.json` under `permissions.rules`. The
 * mode lives at `permissions.mode`. See the README in this folder.
 */

import { loadSettings } from "../../mcp/config";

export type PermissionAction = "allow" | "ask" | "deny";
export type PermissionMode = "manual" | "normal" | "trusted" | "yolo";

export interface PermissionRule {
    /** Glob pattern matched against the tool name (e.g. "file_*", "shell_exec"). */
    tool: string;
    /** Action to take when this rule matches. */
    action: PermissionAction;
    /**
     * Optional per-arg substring match. Map key = arg name, value = substring
     * (case-insensitive) that must be present in the stringified arg value.
     * Useful for "allow `shell_exec` but only when command starts with npm".
     */
    argMatch?: Record<string, string>;
    /** Free-form note for /perm output. */
    note?: string;
}

export interface PermissionSettings {
    mode: PermissionMode;
    rules: PermissionRule[];
}

const DEFAULT_SETTINGS: PermissionSettings = { mode: "normal", rules: [] };

const TRUSTED_MODE_ASK_TOOLS = new Set([
    "shell_exec",
    "deploy_app",
    "spawn_app",
    "evolve_app",
]);

export interface PermissionDecision {
    action: PermissionAction;
    /** Which rule produced the decision (or null for mode defaults). */
    matchedRule: PermissionRule | null;
    /** Human-readable reason — surfaced to the user/model on deny. */
    reason: string;
}

export interface PermissionEngineOptions {
    mode?: PermissionMode;
    rules?: PermissionRule[];
    /** Override mode at runtime (--trust / --yolo on chat). */
    overrideMode?: PermissionMode;
}

export class PermissionEngine {
    public mode: PermissionMode;
    public readonly rules: PermissionRule[];

    constructor(options: PermissionEngineOptions = {}) {
        this.mode = options.overrideMode || options.mode || DEFAULT_SETTINGS.mode;
        this.rules = options.rules ? [...options.rules] : [];
    }

    static fromSettings(settingsPath?: string, overrideMode?: PermissionMode): PermissionEngine {
        try {
            const settings = loadSettings(settingsPath);
            const perms = (settings as any).permissions as Partial<PermissionSettings> | undefined;
            return new PermissionEngine({
                mode: perms?.mode || DEFAULT_SETTINGS.mode,
                rules: Array.isArray(perms?.rules) ? perms!.rules : [],
                overrideMode,
            });
        } catch {
            return new PermissionEngine({ overrideMode });
        }
    }

    /** Decide whether a (tool, args) call may proceed. */
    evaluate(toolName: string, args: Record<string, unknown>, defaultRequiresApproval: boolean): PermissionDecision {
        // 1. Rule-based: deny first (highest priority)
        for (const action of ["deny", "allow", "ask"] as const) {
            const rule = this.rules.find(r => r.action === action && this.ruleMatches(r, toolName, args));
            if (rule) {
                return {
                    action,
                    matchedRule: rule,
                    reason: rule.note || `matched rule ${action} ${rule.tool}`,
                };
            }
        }

        // 2. Mode defaults
        switch (this.mode) {
            case "yolo":
                return { action: "allow", matchedRule: null, reason: "mode=yolo" };
            case "trusted":
                if (TRUSTED_MODE_ASK_TOOLS.has(toolName) || /^mcp__/.test(toolName)) {
                    return { action: "ask", matchedRule: null, reason: "mode=trusted asks for sensitive tools" };
                }
                return { action: "allow", matchedRule: null, reason: "mode=trusted auto-allows safe tools" };
            case "manual":
                return { action: "ask", matchedRule: null, reason: "mode=manual asks for all tools" };
            case "normal":
            default:
                return defaultRequiresApproval
                    ? { action: "ask", matchedRule: null, reason: "tool requires approval (mode=normal)" }
                    : { action: "allow", matchedRule: null, reason: "tool is auto-approved (mode=normal)" };
        }
    }

    addRule(rule: PermissionRule): void {
        this.rules.unshift(rule); // newest wins for the same action
    }

    removeRule(rule: Partial<PermissionRule>): boolean {
        const idx = this.rules.findIndex(r =>
            (rule.tool === undefined || r.tool === rule.tool) &&
            (rule.action === undefined || r.action === rule.action)
        );
        if (idx === -1) return false;
        this.rules.splice(idx, 1);
        return true;
    }

    listRules(): PermissionRule[] {
        return [...this.rules];
    }

    private ruleMatches(rule: PermissionRule, toolName: string, args: Record<string, unknown>): boolean {
        if (!globMatch(rule.tool, toolName)) return false;
        if (rule.argMatch) {
            for (const [key, needle] of Object.entries(rule.argMatch)) {
                const value = args[key];
                if (value === undefined) return false;
                const haystack = typeof value === "string" ? value : JSON.stringify(value);
                if (!haystack.toLowerCase().includes(needle.toLowerCase())) return false;
            }
        }
        return true;
    }
}

/** Tiny glob matcher (`*` and `?` only). */
export function globMatch(pattern: string, value: string): boolean {
    if (pattern === value) return true;
    const regex = new RegExp("^" + pattern
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*")
        .replace(/\?/g, ".") + "$");
    return regex.test(value);
}

export const ALL_MODES: PermissionMode[] = ["manual", "normal", "trusted", "yolo"];
