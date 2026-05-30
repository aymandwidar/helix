/**
 * Chat theming — apply ChatTheme styles to chalk.
 *
 * The active theme is module-level state, mutated via `setActiveTheme()` so
 * the existing display module can read it via `style()` without rewiring.
 * The default theme is applied at import time and matches the colors used
 * before Sprint 12, so this is a backward-compatible enhancement.
 */

import chalk from "chalk";
import { ChatTheme, ThemeRole } from "./types";
import { PRESET_DEFAULT, ALL_PRESETS } from "./presets";
import { listCustomThemeFiles as listCustomFiles, loadCustomTheme as loadCustom } from "./store";

let active: ChatTheme = PRESET_DEFAULT;

export function setActiveTheme(theme: ChatTheme): void {
    active = theme;
}

export function getActiveTheme(): ChatTheme {
    return active;
}

/** Apply the current theme's style for `role` to `text`. */
export function style(role: ThemeRole, text: string): string {
    const chain = active.styles[role] || PRESET_DEFAULT.styles[role];
    return applyChalkChain(chain, text);
}

/**
 * Parse a chalk chain like "bold.red" or "rgb(180,180,180).underline" and
 * apply it to text. Unknown segments are silently dropped so a typo doesn't
 * crash the whole display.
 */
export function applyChalkChain(chain: string, text: string): string {
    let painter: any = chalk;
    for (const segment of chain.split(".")) {
        if (!segment) continue;
        const fn = resolveChalkSegment(painter, segment);
        if (fn) painter = fn;
        // else: skip unknown segment
    }
    if (typeof painter === "function") return painter(text);
    return text;
}

function resolveChalkSegment(painter: any, segment: string): any {
    // rgb(r,g,b)
    const rgb = segment.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (rgb && typeof painter.rgb === "function") {
        return painter.rgb(parseInt(rgb[1], 10), parseInt(rgb[2], 10), parseInt(rgb[3], 10));
    }
    // hex(#aabbcc) or just #aabbcc
    const hex = segment.match(/^(?:hex\(([^)]+)\)|#([0-9a-fA-F]{6}))$/);
    if (hex && typeof painter.hex === "function") {
        return painter.hex(hex[1] || "#" + hex[2]);
    }
    if (typeof painter[segment] !== "undefined") return painter[segment];
    return null;
}

export function listAvailableThemes(): ChatTheme[] {
    const seen = new Set<string>(ALL_PRESETS.map(p => p.name));
    const out: ChatTheme[] = [...ALL_PRESETS];
    for (const file of listCustomFiles()) {
        const name = file.replace(/\.json$/, "");
        if (seen.has(name)) continue;
        const t = loadCustom(name);
        if (t) { out.push(t); seen.add(name); }
    }
    return out;
}

export type { ChatTheme, ThemeRole } from "./types";
export { resolveTheme, saveCustomTheme, listCustomThemeFiles, loadCustomTheme } from "./store";
export { PRESET_DEFAULT, ALL_PRESETS, getPreset } from "./presets";
