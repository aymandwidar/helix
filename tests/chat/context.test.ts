import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { detectProject, summarizeProject } from "../../src/chat/context/project";
import { loadHelixMd } from "../../src/chat/context/helix_md";
import { ChatContext } from "../../src/chat/context";
import { ConversationHistory } from "../../src/chat/context/history";

describe("project detection", () => {
    let tmp: string;
    beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "helix-ctx-")); });
    afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

    it("detects a Next.js project from package.json", () => {
        fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({
            name: "demo",
            dependencies: { next: "14.0.0" },
        }));
        const info = detectProject(tmp);
        expect(info.type).toBe("next");
        expect(info.framework).toContain("Next.js");
        expect(info.name).toBe("demo");
        expect(info.keyFiles).toContain("package.json");
    });

    it("detects a generic node project", () => {
        fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "x" }));
        const info = detectProject(tmp);
        expect(info.type).toBe("node");
    });

    it("detects unknown when no config files present", () => {
        const info = detectProject(tmp);
        expect(info.type).toBe("unknown");
    });

    it("summarizeProject returns a non-empty multi-line string", () => {
        fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "demo" }));
        const summary = summarizeProject(detectProject(tmp));
        expect(summary).toContain("Project:");
        expect(summary.split("\n").length).toBeGreaterThan(1);
    });
});

describe("HELIX.md loader", () => {
    let tmp: string;
    beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "helix-md-")); });
    afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

    it("loads HELIX.md when present", () => {
        fs.writeFileSync(path.join(tmp, "HELIX.md"), "# Project rules\nUse Prisma.");
        const result = loadHelixMd(tmp);
        expect(result?.content).toContain("Use Prisma");
    });

    it("returns null when no context file is present", () => {
        expect(loadHelixMd(tmp)).toBeNull();
    });
});

describe("ChatContext", () => {
    let tmp: string;
    beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "helix-cc-")); });
    afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

    it("builds a system prompt that includes project info and HELIX.md", () => {
        fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "demo" }));
        fs.writeFileSync(path.join(tmp, "HELIX.md"), "Always use Tailwind.");
        const ctx = new ChatContext({ cwd: tmp });
        const messages = ctx.messages();
        expect(messages[0].role).toBe("system");
        expect(messages[0].content).toContain("demo");
        expect(messages[0].content).toContain("Always use Tailwind");
    });

    it("appends user messages", () => {
        const ctx = new ChatContext({ cwd: tmp });
        ctx.pushUser("hello");
        const msgs = ctx.messages();
        expect(msgs[msgs.length - 1]).toEqual({ role: "user", content: "hello" });
    });
});

describe("ConversationHistory", () => {
    it("clear() preserves the system message", () => {
        const h = new ConversationHistory();
        h.setSystem("sys");
        h.push({ role: "user", content: "hi" });
        h.push({ role: "assistant", content: "hello" });
        h.clear();
        const all = h.getAll();
        expect(all.length).toBe(1);
        expect(all[0].role).toBe("system");
    });
});
