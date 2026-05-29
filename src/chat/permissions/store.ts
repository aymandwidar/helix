/**
 * Persist permission settings back to ~/.helix/settings.json.
 */

import { loadSettings, saveSettings, getSettingsPath } from "../../mcp/config";
import { PermissionMode, PermissionRule, PermissionSettings } from "./index";

export function readPermissionSettings(settingsPath?: string): PermissionSettings {
    const settings = loadSettings(settingsPath);
    const perms = (settings as any).permissions || {};
    return {
        mode: perms.mode || "normal",
        rules: Array.isArray(perms.rules) ? perms.rules : [],
    };
}

export function writePermissionSettings(perms: PermissionSettings, settingsPath?: string): string {
    const path = settingsPath || getSettingsPath();
    const settings = loadSettings(path);
    (settings as any).permissions = perms;
    saveSettings(settings, path);
    return path;
}

export function setMode(mode: PermissionMode, settingsPath?: string): PermissionSettings {
    const current = readPermissionSettings(settingsPath);
    current.mode = mode;
    writePermissionSettings(current, settingsPath);
    return current;
}

export function addRule(rule: PermissionRule, settingsPath?: string): PermissionSettings {
    const current = readPermissionSettings(settingsPath);
    current.rules.unshift(rule);
    writePermissionSettings(current, settingsPath);
    return current;
}

export function removeRule(matcher: Partial<PermissionRule>, settingsPath?: string): { settings: PermissionSettings; removed: boolean } {
    const current = readPermissionSettings(settingsPath);
    const idx = current.rules.findIndex(r =>
        (matcher.tool === undefined || r.tool === matcher.tool) &&
        (matcher.action === undefined || r.action === matcher.action)
    );
    if (idx === -1) return { settings: current, removed: false };
    current.rules.splice(idx, 1);
    writePermissionSettings(current, settingsPath);
    return { settings: current, removed: true };
}
