import { describe, it, expect } from "vitest";
import { detectCouncilTrigger } from "../../src/council/triggers";

describe("detectCouncilTrigger", () => {
    it("detects database choice questions", () => {
        const r = detectCouncilTrigger("Should I use Postgres or MongoDB for this schema?");
        expect(r.matched).toBe(true);
        expect(r.category).toBe("database");
        expect(r.preset).toBe("technical");
    });

    it("detects architecture decisions", () => {
        const r = detectCouncilTrigger("Monolith vs microservices for a 5-engineer team?");
        expect(r.matched).toBe(true);
        expect(r.category).toBe("architecture");
    });

    it("detects framework upgrades", () => {
        const r = detectCouncilTrigger("Should we upgrade to Next.js 15 or stay on 14?");
        expect(r.matched).toBe(true);
        expect(r.category).toBe("framework");
    });

    it("detects security questions", () => {
        const r = detectCouncilTrigger("What's the best way to handle JWT refresh securely?");
        expect(r.matched).toBe(true);
        expect(r.category).toBe("security");
    });

    it("does not fire on plain mentions without a decision marker", () => {
        const r = detectCouncilTrigger("I just installed Postgres locally.");
        expect(r.matched).toBe(false);
    });

    it("does not fire on unrelated tasks", () => {
        const r = detectCouncilTrigger("Add a logout button to the navbar.");
        expect(r.matched).toBe(false);
    });
});
