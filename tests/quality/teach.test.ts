import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { teach, inherit, listLearned, mergeMarkdown } from "../../src/quality/teach";

describe("teach + inherit", () => {
    let tmp: string;
    beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "helix-teach-")); });
    afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

    it("creates HELIX.md and appends a learned line", () => {
        const r = teach({ cwd: tmp, lesson: "Always use Tailwind." });
        expect(fs.existsSync(r.file)).toBe(true);
        expect(listLearned(tmp)).toEqual(["Always use Tailwind."]);
    });

    it("appends to an existing Learned conventions section", () => {
        teach({ cwd: tmp, lesson: "First lesson" });
        teach({ cwd: tmp, lesson: "Second lesson" });
        expect(listLearned(tmp)).toEqual(["First lesson", "Second lesson"]);
    });

    it("does not duplicate identical lessons", () => {
        teach({ cwd: tmp, lesson: "X" });
        teach({ cwd: tmp, lesson: "X" });
        expect(listLearned(tmp)).toEqual(["X"]);
    });

    it("inherit copies a HELIX.md when destination is absent", () => {
        const src = path.join(tmp, "src");
        fs.mkdirSync(src);
        fs.writeFileSync(path.join(src, "HELIX.md"), "# Source\n\n## Conventions\n- Use Postgres\n");
        const dest = path.join(tmp, "dest");
        fs.mkdirSync(dest);
        const r = inherit({ cwd: dest, source: path.join(src, "HELIX.md") });
        expect(r.merged).toBe(false);
        expect(fs.readFileSync(r.dest, "utf-8")).toContain("Use Postgres");
    });

    it("inherit merges sections without losing destination content", () => {
        const dest = path.join(tmp, "dest");
        fs.mkdirSync(dest);
        fs.writeFileSync(path.join(dest, "HELIX.md"), "# Dest\n\n## Conventions\n- Use Tailwind\n");
        const src = path.join(tmp, "src");
        fs.mkdirSync(src);
        fs.writeFileSync(path.join(src, "HELIX.md"), "# Src\n\n## Conventions\n- Use Postgres\n\n## Architecture\n- Use Next.js\n");
        const r = inherit({ cwd: dest, source: src });
        expect(r.merged).toBe(true);
        const merged = fs.readFileSync(r.dest, "utf-8");
        expect(merged).toContain("Use Tailwind");
        expect(merged).toContain("Use Postgres");
        expect(merged).toContain("Use Next.js");
    });

    it("mergeMarkdown is a pure function", () => {
        const dest = "## A\n- 1\n";
        const src = "## A\n- 2\n## B\n- 3\n";
        const merged = mergeMarkdown(dest, src);
        expect(merged).toContain("- 1");
        expect(merged).toContain("- 2");
        expect(merged).toContain("- 3");
    });
});
