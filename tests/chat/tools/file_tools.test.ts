import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { fileReadTool } from "../../../src/chat/tools/file_read";
import { fileWriteTool } from "../../../src/chat/tools/file_write";
import { fileEditTool } from "../../../src/chat/tools/file_edit";
import { listDirTool } from "../../../src/chat/tools/list_dir";
import { searchFilesTool } from "../../../src/chat/tools/search_files";

describe("file_read tool", () => {
    let tmp: string;
    beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "helix-fr-")); });
    afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

    it("reads existing file", async () => {
        fs.writeFileSync(path.join(tmp, "a.txt"), "hello world");
        const result = await fileReadTool.execute({ path: "a.txt" }, { cwd: tmp });
        expect(result.success).toBe(true);
        expect(result.output).toBe("hello world");
    });

    it("fails for missing file", async () => {
        const result = await fileReadTool.execute({ path: "missing.txt" }, { cwd: tmp });
        expect(result.success).toBe(false);
        expect(result.error).toContain("not found");
    });
});

describe("file_write tool", () => {
    let tmp: string;
    beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "helix-fw-")); });
    afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

    it("creates new file and reports diff", async () => {
        const result = await fileWriteTool.execute({ path: "out.txt", content: "hi" }, { cwd: tmp });
        expect(result.success).toBe(true);
        expect(fs.readFileSync(path.join(tmp, "out.txt"), "utf-8")).toBe("hi");
        expect(result.diff?.oldText).toBe("");
        expect(result.diff?.newText).toBe("hi");
    });

    it("declares it mutates the target file", () => {
        expect(fileWriteTool.requiresApproval).toBe(true);
        const fn = fileWriteTool.mutatesFiles as (a: any) => string[];
        expect(fn({ path: "x.txt" })).toEqual(["x.txt"]);
    });
});

describe("file_edit tool", () => {
    let tmp: string;
    beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "helix-fe-")); });
    afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

    it("replaces a unique occurrence", async () => {
        fs.writeFileSync(path.join(tmp, "a.txt"), "alpha bravo");
        const result = await fileEditTool.execute({ path: "a.txt", old_string: "bravo", new_string: "charlie" }, { cwd: tmp });
        expect(result.success).toBe(true);
        expect(fs.readFileSync(path.join(tmp, "a.txt"), "utf-8")).toBe("alpha charlie");
    });

    it("rejects non-unique matches without replace_all", async () => {
        fs.writeFileSync(path.join(tmp, "a.txt"), "x x x");
        const result = await fileEditTool.execute({ path: "a.txt", old_string: "x", new_string: "y" }, { cwd: tmp });
        expect(result.success).toBe(false);
        expect(result.error).toContain("matches");
    });

    it("replace_all replaces every occurrence", async () => {
        fs.writeFileSync(path.join(tmp, "a.txt"), "x x x");
        const result = await fileEditTool.execute({ path: "a.txt", old_string: "x", new_string: "y", replace_all: true }, { cwd: tmp });
        expect(result.success).toBe(true);
        expect(fs.readFileSync(path.join(tmp, "a.txt"), "utf-8")).toBe("y y y");
    });
});

describe("list_dir tool", () => {
    let tmp: string;
    beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "helix-ld-")); });
    afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

    it("lists files in a directory", async () => {
        fs.writeFileSync(path.join(tmp, "a.txt"), "");
        fs.mkdirSync(path.join(tmp, "sub"));
        const result = await listDirTool.execute({ path: "." }, { cwd: tmp });
        expect(result.success).toBe(true);
        expect(result.output).toContain("a.txt");
        expect(result.output).toContain("sub/");
    });
});

describe("search_files tool", () => {
    let tmp: string;
    beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "helix-sf-")); });
    afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

    it("finds matching lines", async () => {
        fs.writeFileSync(path.join(tmp, "a.ts"), "const FOO = 1;\nconst BAR = 2;\n");
        fs.writeFileSync(path.join(tmp, "b.ts"), "const FOO = 3;\n");
        const result = await searchFilesTool.execute({ pattern: "FOO", path: "." }, { cwd: tmp });
        expect(result.success).toBe(true);
        expect(result.output).toContain("a.ts:1");
        expect(result.output).toContain("b.ts:1");
    });

    it("respects extension filter", async () => {
        fs.writeFileSync(path.join(tmp, "a.ts"), "FOO");
        fs.writeFileSync(path.join(tmp, "a.md"), "FOO");
        const result = await searchFilesTool.execute({ pattern: "FOO", path: ".", extension: "ts" }, { cwd: tmp });
        expect(result.output).toContain("a.ts");
        expect(result.output).not.toContain("a.md");
    });
});
