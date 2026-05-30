import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { generateRecap, saveRecap } from "../../src/quality/recap";

describe("generateRecap", () => {
    it("returns placeholder when history has only system messages", async () => {
        const ai = vi.fn();
        const text = await generateRecap({
            messages: [{ role: "system", content: "hi" }],
            ai,
        });
        expect(text).toContain("no conversation");
        expect(ai).not.toHaveBeenCalled();
    });

    it("invokes the AI with serialized recent messages", async () => {
        const ai = vi.fn(async () => "## Decisions\n- x\n## Next steps\n- y");
        const text = await generateRecap({
            messages: [
                { role: "system", content: "sys" },
                { role: "user", content: "do thing" },
                { role: "assistant", content: "sure" },
            ],
            ai,
        });
        expect(text).toContain("Decisions");
        expect(ai).toHaveBeenCalledOnce();
        const userPrompt = ai.mock.calls[0][1] as string;
        expect(userPrompt).toContain("USER: do thing");
        expect(userPrompt).toContain("ASSISTANT: sure");
    });

    it("respects lastN truncation", async () => {
        const ai = vi.fn(async () => "ok");
        await generateRecap({
            messages: [
                ...Array.from({ length: 50 }, (_, i) => ({ role: "user" as const, content: `msg ${i}` })),
            ],
            lastN: 5,
            ai,
        });
        const userPrompt = ai.mock.calls[0][1] as string;
        // Should not contain very-early messages
        expect(userPrompt).toContain("msg 49");
        expect(userPrompt).not.toContain("msg 0");
    });
});

describe("saveRecap", () => {
    let tmp: string;
    beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "helix-recap-")); });
    afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

    it("writes a markdown file under .helix/recaps", () => {
        const file = saveRecap({ cwd: tmp, recap: "## Decisions\n- x" });
        expect(fs.existsSync(file)).toBe(true);
        expect(fs.readFileSync(file, "utf-8")).toContain("## Decisions");
        expect(file.startsWith(path.join(tmp, ".helix", "recaps"))).toBe(true);
    });
});
