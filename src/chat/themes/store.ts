/**
 * Persist & load custom themes from ~/.helix/themes/<name>.json.
 *
 * Custom themes only need to override a subset of roles — missing roles fall
 * back to the default preset.
 */

import * as fs from "fs";
import * as path from "path";
import { ChatTheme, REQUIRED_ROLES, ThemeRole } from "./types";
import { PRESET_DEFAULT, getPreset } from "./presets";
import { getSettingsDir } from "../../mcp/config";

const THEMES_SUBDIR = "themes";

export function getThemesDir(): string {
    return path.join(getSettingsDir(), THEMES_SUBDIR);
}

export function listCustomThemeFiles(): string[] {
    const dir = getThemesDir();
    if (!fs.existsSync(dir)) return [];
    try {
        return fs.readdirSync(dir).filter(f => f.endsWith(".json"));
    } catch {
        return [];
    }
}

export function loadCustomTheme(name: string): ChatTheme | undefined {
    const file = path.join(getThemesDir(), `${name}.json`);
    if (!fs.existsSync(file)) return undefined;
    try {
        const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
        return normalizeTheme(name, parsed);
    } catch {
        return undefined;
    }
}

export function saveCustomTheme(theme: ChatTheme): string {
    const dir = getThemesDir();
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${theme.name}.json`);
    fs.writeFileSync(file, JSON.stringify(theme, null, 2) + "\n");
    return file;
}

/**
 * Resolve a theme by name — preset first, then custom, otherwise default.
 */
export function resolveTheme(name: string): ChatTheme {
    return getPreset(name) || loadCustomTheme(name) || PRESET_DEFAULT;
}

function normalizeTheme(name: string, raw: any): ChatTheme {
    const styles: Record<ThemeRole, string> = { ...PRESET_DEFAULT.styles };
    if (raw && raw.styles && typeof raw.styles === "object") {
        for (const role of REQUIRED_ROLES) {
            const value = raw.styles[role];
            if (typeof value === "string" && value) styles[role] = value;
        }
    }
    return {
        name: raw?.name && typeof raw.name === "string" ? raw.name : name,
        description: typeof raw?.description === "string" ? raw.description : undefined,
        styles,
    };
}
