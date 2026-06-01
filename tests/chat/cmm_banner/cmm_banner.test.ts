import { describe, it, expect } from "vitest";
import { renderCmmBanner, classifyFindings } from "../../../src/chat/display/cmm_banner";

describe("renderCmmBanner", () => {
    it("returns nonEmpty=false when there are no findings", () => {
        const r = renderCmmBanner({ findings: [], contextBlock: "" });
        expect(r.nonEmpty).toBe(false);
        expect(r.text).toBe("");
    });

    it("renders sessions queried + dead ends + patterns", () => {
        const r = renderCmmBanner({
            findings: [
                { server: "memory", tool: "get_pitfalls", text: "Don't use Prisma adapter X" },
                { server: "memory", tool: "get_pitfalls", text: "CORS config dead end" },
                { server: "memory", tool: "search_pattern", text: "Auth middleware structure (proven)" },
            ],
            contextBlock: "",
        });
        expect(r.nonEmpty).toBe(true);
        expect(r.text).toMatch(/CMM Memory/);
        expect(r.text).toMatch(/2 known dead ends/);
        expect(r.text).toMatch(/1 proven pattern/);
        expect(r.estimatedSavingsUsd).toBeCloseTo(0.30, 5);
    });

    it("does NOT render savings line when no dead ends were avoided", () => {
        const r = renderCmmBanner({
            findings: [
                { server: "memory", tool: "search_pattern", text: "Some pattern" },
            ],
            contextBlock: "",
        });
        expect(r.nonEmpty).toBe(true);
        expect(r.text).not.toMatch(/Estimated savings/);
        expect(r.estimatedSavingsUsd).toBe(0);
    });

    it("classifyFindings infers categories", () => {
        const c = classifyFindings([
            { server: "memory", tool: "get_pitfalls", text: "..." },
            { server: "memory", tool: "search_pattern", text: "..." },
            { server: "memory", tool: "search_memory", text: "Past attempt failed because Z" },
            { server: "memory", tool: "search_memory", text: "neutral history" },
        ]);
        expect(c.avoidedDeadEnds).toBe(2); // get_pitfalls + "failed because"
        expect(c.appliedPatterns).toBe(1);
        expect(c.sessionsQueried).toBe(4);
    });

    it("accepts BannerInputs with explicit classification", () => {
        const r = renderCmmBanner({
            findings: [{ server: "x", tool: "x", text: "x" }],
            classification: {
                sessionsQueried: 3,
                avoidedDeadEnds: 4,
                appliedPatterns: 1,
            },
        });
        expect(r.text).toMatch(/3 past sessions/);
        expect(r.text).toMatch(/4 known dead ends/);
        expect(r.estimatedSavingsUsd).toBeCloseTo(0.60, 5);
    });
});
