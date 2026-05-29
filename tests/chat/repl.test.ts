import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

import { ChatContext } from "../../src/chat/context";
import { CheckpointManager } from "../../src/chat/checkpoints";
import { buildDefaultRegistry } from "../../src/chat/tools";

// The REPL itself reads from stdin which is hard to drive in unit tests, so we
// validate the slash-command surface indirectly by exercising the same
// component objects the REPL relies on. This guards against regressions in
// /clear, /context, and /checkpoint behavior.

describe("REPL building blocks", () => {
    it("/clear preserves the system message", () => {
        const ctx = new ChatContext();
        ctx.pushUser("hi");
        ctx.history.push({ role: "assistant", content: "hello" });
        ctx.history.clear();
        const msgs = ctx.messages();
        expect(msgs.length).toBe(1);
        expect(msgs[0].role).toBe("system");
    });

    it("/context summary exposes project, history, and helix.md", () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "helix-repl-"));
        try {
            fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "demo" }));
            fs.writeFileSync(path.join(tmp, "HELIX.md"), "rules");
            const ctx = new ChatContext({ cwd: tmp });
            const summary = ctx.summary();
            expect(summary.project.name).toBe("demo");
            expect(summary.helixMd?.content).toContain("rules");
            expect(summary.historySize).toBeGreaterThan(0);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it("/checkpoint + /restore round-trip works for an existing file", () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "helix-rrepl-"));
        try {
            const file = path.join(tmp, "a.txt");
            fs.writeFileSync(file, "original");
            const cm = new CheckpointManager({ cwd: tmp });
            const entry = cm.create("manual", [file]);
            fs.writeFileSync(file, "tampered");
            const restored = cm.restore(entry.id);
            expect(restored?.id).toBe(entry.id);
            expect(fs.readFileSync(file, "utf-8")).toBe("original");
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it("registry exposes tool list for /tools", () => {
        const reg = buildDefaultRegistry();
        const names = reg.list().map(t => t.name);
        expect(names.length).toBeGreaterThanOrEqual(10);
    });
});
