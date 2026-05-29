import { describe, it, expect } from "vitest";
import { parsePlan } from "../../src/evolve/planner";

describe("parsePlan", () => {
    it("parses a clean JSON object", () => {
        const raw = JSON.stringify({
            summary: "add login page",
            rationale: "the user wants auth",
            files: [
                { op: "create", path: "app/login/page.tsx", content: "<>login</>", rationale: "new route" },
                { op: "edit", path: "app/layout.tsx", old: "<nav>", new: "<nav><Link href='/login'>Login</Link>", rationale: "wire it up" },
            ],
            packages: [{ op: "add", name: "next-auth", version: "^4.0.0" }],
            scripts: [],
            postCommands: ["npx prisma generate"],
            confidence: 0.8,
        });
        const plan = parsePlan(raw);
        expect(plan.summary).toBe("add login page");
        expect(plan.files).toHaveLength(2);
        expect(plan.packages[0].name).toBe("next-auth");
        expect(plan.postCommands).toEqual(["npx prisma generate"]);
        expect(plan.confidence).toBe(0.8);
    });

    it("strips ```json fences", () => {
        const raw = "```json\n" + JSON.stringify({
            summary: "x", rationale: "", files: [], packages: [], scripts: [], postCommands: [],
        }) + "\n```";
        const plan = parsePlan(raw);
        expect(plan.summary).toBe("x");
    });

    it("extracts the JSON block from prose-padded responses", () => {
        const raw = `Here's the plan:\n\n${JSON.stringify({
            summary: "y", rationale: "", files: [], packages: [], scripts: [], postCommands: [],
        })}\n\nLet me know if you want changes.`;
        const plan = parsePlan(raw);
        expect(plan.summary).toBe("y");
    });

    it("drops malformed file entries instead of throwing", () => {
        const raw = JSON.stringify({
            summary: "x",
            rationale: "",
            files: [
                { op: "create", path: "ok.txt", content: "yes" },
                { op: "edit", path: "no.txt" /* missing old/new */ },
                { op: "wat", path: "no.txt" },
                "garbage",
            ],
            packages: [], scripts: [], postCommands: [],
        });
        const plan = parsePlan(raw);
        expect(plan.files).toHaveLength(1);
        expect(plan.files[0].path).toBe("ok.txt");
    });

    it("throws on unparseable JSON", () => {
        expect(() => parsePlan("totally not json")).toThrow(/invalid JSON/);
    });
});
