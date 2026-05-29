/**
 * Settings file management for ~/.helix/settings.json
 *
 * The settings file holds MCP server definitions and Helix-wide preferences.
 * It is auto-created with sensible defaults on first read.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface McpServerConfig {
    /** Executable path (e.g. /path/to/python or /path/to/run_server.sh) */
    command: string;
    /** Arguments passed to the command */
    args?: string[];
    /** Optional environment variables for the spawned process */
    env?: Record<string, string>;
    /** Auto-connect this server when chat starts */
    autoConnect?: boolean;
    /** Optional human description shown in `helix mcp list` */
    description?: string;
    /** Working directory for the spawned process */
    cwd?: string;
}

export interface HelixSettings {
    mcpServers: Record<string, McpServerConfig>;
    defaultModel?: string;
    fallbackModels?: string[];
}

const DEFAULT_SETTINGS: HelixSettings = {
    mcpServers: {},
    defaultModel: "deepseek/deepseek-chat",
    fallbackModels: ["meta-llama/llama-3.3-70b-instruct"],
};

export function getSettingsDir(): string {
    return process.env.HELIX_SETTINGS_DIR || path.join(os.homedir(), ".helix");
}

export function getSettingsPath(): string {
    return path.join(getSettingsDir(), "settings.json");
}

export function loadSettings(settingsPath: string = getSettingsPath()): HelixSettings {
    if (!fs.existsSync(settingsPath)) {
        return { ...DEFAULT_SETTINGS, mcpServers: {} };
    }
    try {
        const raw = fs.readFileSync(settingsPath, "utf-8");
        const parsed = JSON.parse(raw);
        return {
            ...DEFAULT_SETTINGS,
            ...parsed,
            mcpServers: parsed.mcpServers || {},
        };
    } catch (e: any) {
        throw new Error(`Failed to read ${settingsPath}: ${e.message}`);
    }
}

export function saveSettings(settings: HelixSettings, settingsPath: string = getSettingsPath()): void {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
}

export function addMcpServer(name: string, config: McpServerConfig, settingsPath?: string): HelixSettings {
    const settings = loadSettings(settingsPath);
    settings.mcpServers[name] = config;
    saveSettings(settings, settingsPath);
    return settings;
}

export function removeMcpServer(name: string, settingsPath?: string): HelixSettings {
    const settings = loadSettings(settingsPath);
    delete settings.mcpServers[name];
    saveSettings(settings, settingsPath);
    return settings;
}

export function listMcpServers(settingsPath?: string): Array<{ name: string; config: McpServerConfig }> {
    const settings = loadSettings(settingsPath);
    return Object.entries(settings.mcpServers).map(([name, config]) => ({ name, config }));
}
