import { describe, it, expect } from "vitest";
import {
    AUTO_MANAGED_FIELDS,
    userFields,
    dedupeInterfaceLines,
    dedupeInlineFieldList,
} from "../../src/utils/strand-fields";

describe("AUTO_MANAGED_FIELDS", () => {
    it("includes the boilerplate names that fail to build when duplicated", () => {
        expect(AUTO_MANAGED_FIELDS.has("id")).toBe(true);
        expect(AUTO_MANAGED_FIELDS.has("createdAt")).toBe(true);
        expect(AUTO_MANAGED_FIELDS.has("updatedAt")).toBe(true);
    });
});

describe("userFields", () => {
    it("returns user fields untouched when no auto-managed names appear", () => {
        const strand = { fields: [{ name: "title", type: "String" }, { name: "priority", type: "Int" }] };
        expect(userFields(strand)).toEqual(strand.fields);
    });

    it("filters out id, createdAt, updatedAt", () => {
        const strand = {
            fields: [
                { name: "id", type: "String" },
                { name: "title", type: "String" },
                { name: "createdAt", type: "DateTime" },
                { name: "updatedAt", type: "DateTime" },
                { name: "dueDate", type: "DateTime" },
            ],
        };
        const out = userFields(strand);
        expect(out.map(f => f.name)).toEqual(["title", "dueDate"]);
    });

    it("collapses duplicate user fields, keeping the first", () => {
        const strand = {
            fields: [
                { name: "title", type: "String" },
                { name: "title", type: "Int" }, // dup with different type
                { name: "priority", type: "Int" },
            ],
        };
        const out = userFields(strand);
        expect(out).toHaveLength(2);
        expect(out[0].type).toBe("String"); // first wins
    });

    it("handles missing/empty fields safely", () => {
        expect(userFields(undefined)).toEqual([]);
        expect(userFields({ fields: [] })).toEqual([]);
        expect(userFields({} as any)).toEqual([]);
        expect(userFields({ fields: [{ name: "" } as any, { name: "good" } as any] }).map(f => f.name))
            .toEqual(["good"]);
    });
});

describe("dedupeInterfaceLines", () => {
    it("keeps unique lines unchanged", () => {
        const body = `  id: string;
  title: string;
  createdAt: string;`;
        expect(dedupeInterfaceLines(body)).toBe(body);
    });

    it("drops repeat property lines, keeping the first", () => {
        const body = `  id: string;
  id: string;
  title: string;
  createdAt: string;
  createdAt: string;`;
        const out = dedupeInterfaceLines(body);
        expect(out.split("\n").filter(l => l.includes("id:"))).toHaveLength(1);
        expect(out.split("\n").filter(l => l.includes("createdAt:"))).toHaveLength(1);
        expect(out).toContain("title: string;");
    });

    it("preserves non-property lines (blank lines, JSDoc) verbatim", () => {
        const body = `  id: string;

  /** doc */
  title: string;`;
        expect(dedupeInterfaceLines(body)).toBe(body);
    });

    it("recognizes optional properties (name?:)", () => {
        const body = `  user?: User;
  user?: User;`;
        const out = dedupeInterfaceLines(body);
        expect(out.split("\n").filter(l => l.includes("user?:"))).toHaveLength(1);
    });

    it("treats different names as distinct even when prefixes match", () => {
        const body = `  id: string;
  identifier: string;`;
        expect(dedupeInterfaceLines(body)).toBe(body);
    });
});

describe("dedupeInlineFieldList", () => {
    it("dedupes inline { id: string; id: string }", () => {
        const input = "user?: { id: string; id: string }";
        const out = dedupeInlineFieldList(input);
        expect(out).toContain("{ id: string }");
        // exactly one "id:"
        expect((out.match(/id:/g) || []).length).toBe(1);
    });

    it("preserves multiple distinct fields", () => {
        const input = "{ id: string; name: string; id: string }";
        expect(dedupeInlineFieldList(input)).toContain("id: string");
        expect(dedupeInlineFieldList(input)).toContain("name: string");
        expect((dedupeInlineFieldList(input).match(/id:/g) || []).length).toBe(1);
    });

    it("only dedupes one level (does not recurse into nested braces)", () => {
        const input = "outer: { inner: { id: string } }";
        const out = dedupeInlineFieldList(input);
        expect(out).toContain("inner:");
        expect(out).toContain("id: string");
    });

    it("is a no-op when no duplicates exist", () => {
        const input = "{ id: string; createdAt: string }";
        expect(dedupeInlineFieldList(input)).toBe("{ id: string; createdAt: string }");
    });
});

describe("integration: simulate the broken codegen pattern", () => {
    it("turns the buggy template output into valid TypeScript", () => {
        // Reproduce the actual failure mode from Phase 2 of the integration pass:
        // user blueprint had id + createdAt in fields, template hardcoded both.
        const broken = `  id: string;
  id: string;
  title: string;
  user?: { id: string; id: string };
  createdAt: string;
  createdAt: string;`;
        const cleaned = dedupeInterfaceLines(broken);
        const cleanedSafe = dedupeInlineFieldList(cleaned);
        // exactly one of each
        expect((cleanedSafe.match(/^\s*id:/gm) || []).length).toBe(1);
        expect((cleanedSafe.match(/^\s*createdAt:/gm) || []).length).toBe(1);
        // inline relation field also deduped
        expect(cleanedSafe).toMatch(/user\?:\s*\{\s*id:\s*string\s*\}/);
        // user-defined field preserved
        expect(cleanedSafe).toMatch(/title:\s*string;/);
    });
});
