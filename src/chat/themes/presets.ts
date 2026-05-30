/**
 * Built-in themes for chat output.
 */

import { ChatTheme } from "./types";

export const PRESET_DEFAULT: ChatTheme = {
    name: "default",
    description: "Helix's stock theme — keeps existing colors.",
    styles: {
        info: "gray",
        warn: "yellow",
        error: "red",
        assistant: "white",
        user: "bold.blue",
        tool: "cyan",
        result: "green",
        dim: "gray",
        accent: "cyan",
        heading: "bold.cyan",
    },
};

export const PRESET_MONOKAI: ChatTheme = {
    name: "monokai",
    description: "Punchy dark theme inspired by Monokai.",
    styles: {
        info: "gray",
        warn: "yellow",
        error: "red.bold",
        assistant: "magenta",
        user: "bold.green",
        tool: "cyan",
        result: "green.bold",
        dim: "gray",
        accent: "magenta",
        heading: "bold.magenta",
    },
};

export const PRESET_SOLARIZED_DARK: ChatTheme = {
    name: "solarized-dark",
    description: "Solarized Dark palette.",
    styles: {
        info: "blue",
        warn: "yellow",
        error: "red",
        assistant: "cyan",
        user: "bold.green",
        tool: "magenta",
        result: "green",
        dim: "gray",
        accent: "yellow",
        heading: "bold.yellow",
    },
};

export const PRESET_SOLARIZED_LIGHT: ChatTheme = {
    name: "solarized-light",
    description: "Solarized Light palette.",
    styles: {
        info: "blue",
        warn: "yellow",
        error: "red",
        assistant: "blue",
        user: "bold.green",
        tool: "magenta",
        result: "green",
        dim: "gray",
        accent: "magenta",
        heading: "bold.blue",
    },
};

export const PRESET_HIGH_CONTRAST: ChatTheme = {
    name: "high-contrast",
    description: "Maximum contrast for accessibility.",
    styles: {
        info: "white",
        warn: "bold.yellow",
        error: "bold.red",
        assistant: "white.bold",
        user: "bold.cyan",
        tool: "bold.white",
        result: "bold.green",
        dim: "white",
        accent: "bold.white",
        heading: "bold.white.underline",
    },
};

export const ALL_PRESETS: ChatTheme[] = [
    PRESET_DEFAULT,
    PRESET_MONOKAI,
    PRESET_SOLARIZED_DARK,
    PRESET_SOLARIZED_LIGHT,
    PRESET_HIGH_CONTRAST,
];

export function getPreset(name: string): ChatTheme | undefined {
    return ALL_PRESETS.find(p => p.name === name);
}
