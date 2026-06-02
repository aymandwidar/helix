import { describe, it, expect } from "vitest";
import { generateSpawnHomePage } from "../../src/pipeline/homepage";
import type { HelixAST } from "../../src/parser";

const minimalAst: HelixAST = {
    strands: [],
    views: [],
    pages: [],
} as any;

describe("generateSpawnHomePage — version tag", () => {
    it("renders the running Helix version, not 'v11.1'", () => {
        const html = generateSpawnHomePage("a blog app", minimalAst);
        expect(html).not.toContain("v11.1");
    });

    it("renders the major.minor of the current package version", () => {
        const html = generateSpawnHomePage("any prompt", {
            strands: [{ name: "Post", fields: [{ name: "title", type: "String" }] }],
            views: [],
            pages: [],
        } as any);
        // package.json is at v17.2.0 → tag should be "17.2"
        expect(html).toMatch(/Helix v17\.\d/);
    });
});

describe("generateSpawnHomePage — title hygiene", () => {
    it("uses the user prompt verbatim in <h1>, no constitution text", () => {
        const html = generateSpawnHomePage("a blog app", {
            strands: [{ name: "Post", fields: [{ name: "title", type: "String" }] }],
            views: [],
            pages: [],
        } as any);
        // The h1 surfaces the first 5 words of the prompt
        expect(html).toContain("a blog app");
        // None of these constitution markers should appear in the rendered page
        expect(html).not.toContain("CONSTITUTIONAL REQUIREMENTS");
        expect(html).not.toContain("UI Constitution");
        expect(html).not.toContain("Deep Void");
        expect(html).not.toContain("backdrop-filter blur");
    });

    it("does not emit constitution body even when the prompt is short", () => {
        const html = generateSpawnHomePage("blog", {
            strands: [{ name: "Post", fields: [{ name: "title", type: "String" }] }],
            views: [],
            pages: [],
        } as any);
        expect(html).not.toMatch(/Constitution/);
    });

    it("preserves a multi-word prompt in the h1 (5-word cap)", () => {
        const html = generateSpawnHomePage("a fast project tracker for teams of three", {
            strands: [{ name: "Project", fields: [{ name: "name", type: "String" }] }],
            views: [],
            pages: [],
        } as any);
        // The truncation to 5 words is by design (avoids long titles).
        expect(html).toContain("a fast project tracker for");
    });
});

describe("generateSpawnHomePage — empty-strands fallback", () => {
    it("still renders the user prompt as the title and the dynamic version", () => {
        const html = generateSpawnHomePage("a blog app", minimalAst);
        expect(html).toContain("a blog app");
        expect(html).not.toContain("v11.1");
    });
});
