/**
 * Chat output theme — a flat map of role → chalk style chain.
 *
 * Each value is a dot-separated chain like "yellow.bold" or "rgb(180,180,180)".
 * The renderer parses chains via `applyStyle()` so unknown segments are
 * silently dropped instead of throwing.
 */

export type ThemeRole =
    | "info"
    | "warn"
    | "error"
    | "assistant"
    | "user"
    | "tool"
    | "result"
    | "dim"
    | "accent"
    | "heading";

export interface ChatTheme {
    name: string;
    description?: string;
    /** Each role maps to a chalk style chain. */
    styles: Record<ThemeRole, string>;
}

export const REQUIRED_ROLES: ThemeRole[] = [
    "info", "warn", "error", "assistant", "user", "tool", "result", "dim", "accent", "heading",
];
