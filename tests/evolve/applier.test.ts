import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { applyPlan, planAffectedFiles } from "../../src/evolve/applier";
import { ChangePlan } from "../../src/evolve/types";

function emptyPlan(): ChangePlan {
    return { summary: "", rationale: "", files: [], packages: [], scripts: [], postCommands: [] };
}

describe("applyPlan", () => {
    let tmp: string;
    beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "helix-app-")); });
    afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

    it("creates a new file", async () => {
        const plan: ChangePlan = { ...emptyPlan(), files: [{ op: "create", path: "a.txt", content: "hi" }] };
        const out = await applyPlan(plan, { cwd: tmp });
        expect(fs.readFileSync(path.join(tmp, "a.txt"), "utf-8")).toBe("hi");
        expect(out.errors).toEqual([]);
        expect(out.diffs[0].after).toBe("hi");
    });

    it("dry-run does not write to disk", async () => {
        const plan: ChangePlan = { ...emptyPlan(), files: [{ op: "create", path: "a.txt", content: "hi" }] };
        await applyPlan(plan, { cwd: tmp, dryRun: true });
        expect(fs.existsSync(path.join(tmp, "a.txt"))).toBe(false);
    });

    it("edits a file when old_string matches uniquely", async () => {
        fs.writeFileSync(path.join(tmp, "a.txt"), "alpha bravo charlie");
        const plan: ChangePlan = { ...emptyPlan(), files: [{ op: "edit", path: "a.txt", old: "bravo", new: "delta" }] };
        const out = await applyPlan(plan, { cwd: tmp });
        expect(fs.readFileSync(path.join(tmp, "a.txt"), "utf-8")).toBe("alpha delta charlie");
        expect(out.errors).toEqual([]);
    });

    it("rejects an edit when old_string is not found", async () => {
        fs.writeFileSync(path.join(tmp, "a.txt"), "alpha");
        const plan: ChangePlan = { ...emptyPlan(), files: [{ op: "edit", path: "a.txt", old: "missing", new: "x" }] };
        const out = await applyPlan(plan, { cwd: tmp });
        expect(out.errors.length).toBe(1);
        expect(out.errors[0].message).toMatch(/not found/);
        expect(fs.readFileSync(path.join(tmp, "a.txt"), "utf-8")).toBe("alpha");
    });

    it("rejects an edit when old_string matches multiple times", async () => {
        fs.writeFileSync(path.join(tmp, "a.txt"), "x x x");
        const plan: ChangePlan = { ...emptyPlan(), files: [{ op: "edit", path: "a.txt", old: "x", new: "y" }] };
        const out = await applyPlan(plan, { cwd: tmp });
        expect(out.errors.length).toBe(1);
        expect(out.errors[0].message).toMatch(/matches/);
    });

    it("replaces an entire file", async () => {
        fs.writeFileSync(path.join(tmp, "a.txt"), "old");
        const plan: ChangePlan = { ...emptyPlan(), files: [{ op: "replace", path: "a.txt", content: "new" }] };
        await applyPlan(plan, { cwd: tmp });
        expect(fs.readFileSync(path.join(tmp, "a.txt"), "utf-8")).toBe("new");
    });

    it("deletes a file", async () => {
        fs.writeFileSync(path.join(tmp, "a.txt"), "x");
        const plan: ChangePlan = { ...emptyPlan(), files: [{ op: "delete", path: "a.txt" }] };
        await applyPlan(plan, { cwd: tmp });
        expect(fs.existsSync(path.join(tmp, "a.txt"))).toBe(false);
    });

    it("updates package.json with package and script changes", async () => {
        fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({
            name: "demo",
            dependencies: { react: "18" },
            scripts: { dev: "next dev" },
        }, null, 2));
        const plan: ChangePlan = {
            ...emptyPlan(),
            packages: [
                { op: "add", name: "next-auth", version: "^4.0.0" },
                { op: "remove", name: "react" },
                { op: "add", name: "vitest", version: "^1.0.0", dev: true },
            ],
            scripts: [{ op: "add", name: "test", command: "vitest run" }],
        };
        await applyPlan(plan, { cwd: tmp });
        const pkg = JSON.parse(fs.readFileSync(path.join(tmp, "package.json"), "utf-8"));
        expect(pkg.dependencies["next-auth"]).toBe("^4.0.0");
        expect(pkg.dependencies.react).toBeUndefined();
        expect(pkg.devDependencies.vitest).toBe("^1.0.0");
        expect(pkg.scripts.test).toBe("vitest run");
    });

    it("planAffectedFiles includes package.json when packages change", () => {
        const plan: ChangePlan = {
            ...emptyPlan(),
            files: [{ op: "create", path: "x.txt", content: "" }],
            packages: [{ op: "add", name: "z" }],
        };
        const files = planAffectedFiles(plan, "/root");
        expect(files).toContain("/root/x.txt");
        expect(files).toContain("/root/package.json");
    });
});
