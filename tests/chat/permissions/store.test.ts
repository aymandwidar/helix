import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { readPermissionSettings, writePermissionSettings, setMode, addRule, removeRule } from "../../../src/chat/permissions/store";

describe("permissions store", () => {
    let dir: string;
    let file: string;

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), "helix-perm-"));
        file = path.join(dir, "settings.json");
    });

    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it("returns defaults when no permissions block exists", () => {
        const perms = readPermissionSettings(file);
        expect(perms.mode).toBe("normal");
        expect(perms.rules).toEqual([]);
    });

    it("setMode persists to disk and is read back", () => {
        setMode("trusted", file);
        expect(readPermissionSettings(file).mode).toBe("trusted");
    });

    it("addRule then removeRule round-trip", () => {
        addRule({ tool: "shell_exec", action: "deny", note: "policy" }, file);
        expect(readPermissionSettings(file).rules).toHaveLength(1);
        const result = removeRule({ tool: "shell_exec" }, file);
        expect(result.removed).toBe(true);
        expect(readPermissionSettings(file).rules).toHaveLength(0);
    });

    it("preserves other settings keys (mcpServers, etc)", () => {
        fs.writeFileSync(file, JSON.stringify({
            mcpServers: { memory: { command: "/x" } },
        }));
        addRule({ tool: "file_*", action: "allow" }, file);
        const raw = JSON.parse(fs.readFileSync(file, "utf-8"));
        expect(raw.mcpServers.memory.command).toBe("/x");
        expect(raw.permissions.rules).toHaveLength(1);
    });
});
