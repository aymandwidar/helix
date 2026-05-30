import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { applyChalkChain, setActiveTheme, getActiveTheme, style, listAvailableThemes } from "../../../src/chat/themes";
import { ALL_PRESETS, getPreset, PRESET_DEFAULT } from "../../../src/chat/themes/presets";
import { saveCustomTheme, loadCustomTheme, resolveTheme, getThemesDir } from "../../../src/chat/themes/store";
import { REQUIRED_ROLES } from "../../../src/chat/themes/types";

describe("themes presets", () => {
    it("each preset defines every required role", () => {
        for (const preset of ALL_PRESETS) {
            for (const role of REQUIRED_ROLES) {
                expect(typeof preset.styles[role]).toBe("string");
                expect(preset.styles[role].length).toBeGreaterThan(0);
            }
        }
    });

    it("getPreset finds by name", () => {
        expect(getPreset("monokai")?.name).toBe("monokai");
        expect(getPreset("nope")).toBeUndefined();
    });
});

describe("applyChalkChain", () => {
    it("applies a simple chain", () => {
        const out = applyChalkChain("yellow", "x");
        expect(out).toContain("x");
    });

    it("ignores unknown segments without throwing", () => {
        const out = applyChalkChain("yellow.notARealStyle.bold", "x");
        expect(out).toContain("x");
    });

    it("handles rgb(...) segments", () => {
        const out = applyChalkChain("rgb(255,0,0)", "x");
        expect(out).toContain("x");
    });
});

describe("active theme + style()", () => {
    afterEach(() => setActiveTheme(PRESET_DEFAULT));

    it("default is the stock preset", () => {
        expect(getActiveTheme().name).toBe("default");
    });

    it("setActiveTheme + style applies chain", () => {
        setActiveTheme(getPreset("monokai")!);
        const out = style("warn", "msg");
        expect(out).toContain("msg");
    });
});

describe("custom theme storage", () => {
    let helixDir: string;
    let oldEnv: string | undefined;

    beforeEach(() => {
        helixDir = fs.mkdtempSync(path.join(os.tmpdir(), "helix-themes-"));
        oldEnv = process.env.HELIX_SETTINGS_DIR;
        process.env.HELIX_SETTINGS_DIR = helixDir;
    });
    afterEach(() => {
        fs.rmSync(helixDir, { recursive: true, force: true });
        if (oldEnv) process.env.HELIX_SETTINGS_DIR = oldEnv; else delete process.env.HELIX_SETTINGS_DIR;
    });

    it("save round-trips a custom theme", () => {
        const theme = { ...PRESET_DEFAULT, name: "mine", description: "custom" };
        const file = saveCustomTheme(theme);
        expect(fs.existsSync(file)).toBe(true);
        const loaded = loadCustomTheme("mine");
        expect(loaded?.name).toBe("mine");
        expect(loaded?.description).toBe("custom");
    });

    it("loadCustomTheme falls back to defaults for missing keys", () => {
        fs.mkdirSync(getThemesDir(), { recursive: true });
        fs.writeFileSync(path.join(getThemesDir(), "partial.json"), JSON.stringify({
            name: "partial",
            styles: { warn: "magenta.bold" },
        }));
        const loaded = loadCustomTheme("partial")!;
        expect(loaded.styles.warn).toBe("magenta.bold");
        expect(loaded.styles.error).toBe(PRESET_DEFAULT.styles.error);
    });

    it("resolveTheme returns default for unknown names", () => {
        expect(resolveTheme("does-not-exist").name).toBe("default");
    });

    it("listAvailableThemes includes presets and custom themes", () => {
        const theme = { ...PRESET_DEFAULT, name: "mine" };
        saveCustomTheme(theme);
        const all = listAvailableThemes();
        const names = all.map(t => t.name);
        expect(names).toContain("default");
        expect(names).toContain("monokai");
        expect(names).toContain("mine");
    });
});
