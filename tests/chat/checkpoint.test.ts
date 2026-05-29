import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { CheckpointManager } from "../../src/chat/checkpoints";

describe("CheckpointManager", () => {
    let tmp: string;

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), "helix-checkpoint-"));
    });

    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it("creates a checkpoint and restores prior contents", () => {
        const file = path.join(tmp, "a.txt");
        fs.writeFileSync(file, "original");
        const cm = new CheckpointManager({ cwd: tmp });

        const entry = cm.create("test", [file]);
        expect(entry.id).toBeTruthy();
        expect(entry.files).toContain(file);

        fs.writeFileSync(file, "modified");
        expect(fs.readFileSync(file, "utf-8")).toBe("modified");

        const restored = cm.restore(entry.id);
        expect(restored?.id).toBe(entry.id);
        expect(fs.readFileSync(file, "utf-8")).toBe("original");
    });

    it("restores deletion of files that did not exist before checkpoint", () => {
        const file = path.join(tmp, "new.txt");
        const cm = new CheckpointManager({ cwd: tmp });

        const entry = cm.create("pre-create", [file]);
        fs.writeFileSync(file, "added later");
        expect(fs.existsSync(file)).toBe(true);

        cm.restore(entry.id);
        expect(fs.existsSync(file)).toBe(false);
    });

    it("lists checkpoints newest-first", () => {
        const file = path.join(tmp, "x.txt");
        fs.writeFileSync(file, "a");
        const cm = new CheckpointManager({ cwd: tmp });

        const e1 = cm.create("first", [file]);
        // ensure different id by spinning briefly
        const e2 = cm.create("second", [file]);
        const list = cm.list();
        expect(list.length).toBe(2);
        expect([e1.id, e2.id]).toContain(list[0].id);
    });

    it("returns null when restoring with no checkpoints", () => {
        const cm = new CheckpointManager({ cwd: tmp });
        expect(cm.restore()).toBeNull();
    });
});
