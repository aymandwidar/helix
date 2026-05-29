import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
    loadSettings,
    saveSettings,
    addMcpServer,
    removeMcpServer,
    listMcpServers,
} from "../../src/mcp/config";

describe("mcp config", () => {
    let dir: string;
    let file: string;

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), "helix-cfg-"));
        file = path.join(dir, "settings.json");
    });

    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it("returns defaults when settings file does not exist", () => {
        const settings = loadSettings(file);
        expect(settings.mcpServers).toEqual({});
    });

    it("save then load round-trips", () => {
        saveSettings({ mcpServers: { foo: { command: "/bin/echo" } } }, file);
        const settings = loadSettings(file);
        expect(settings.mcpServers.foo.command).toBe("/bin/echo");
    });

    it("addMcpServer persists to disk", () => {
        addMcpServer("memory", { command: "/path/to/cmm.sh", autoConnect: true }, file);
        const list = listMcpServers(file);
        expect(list.length).toBe(1);
        expect(list[0].name).toBe("memory");
        expect(list[0].config.autoConnect).toBe(true);
    });

    it("removeMcpServer drops the named entry", () => {
        addMcpServer("memory", { command: "/x" }, file);
        addMcpServer("council", { command: "/y" }, file);
        removeMcpServer("memory", file);
        const list = listMcpServers(file);
        expect(list.map(s => s.name)).toEqual(["council"]);
    });

    it("preserves unknown keys it does not own", () => {
        fs.writeFileSync(file, JSON.stringify({ mcpServers: {}, custom: "value" }));
        const settings = loadSettings(file);
        expect((settings as any).custom).toBe("value");
    });
});
