import { describe, it, expect } from "vitest";
import { renderBlock, stripAnsi } from "../../src/quality/blocks";

describe("block TUI", () => {
    it("renderBlock produces a header strip and indented body", () => {
        const out = renderBlock("info", "hello world", { width: 60 });
        const plain = stripAnsi(out);
        expect(plain).toContain("[INFO]");
        expect(plain).toContain("hello world");
        expect(plain.split("\n").length).toBeGreaterThan(1);
    });

    it("hideHeader removes the header line", () => {
        const out = renderBlock("warn", "msg", { width: 40, hideHeader: true });
        const plain = stripAnsi(out);
        expect(plain).not.toContain("[WARN]");
        expect(plain).toContain("msg");
    });

    it("respects minimum width", () => {
        const out = renderBlock("info", "x", { width: 20 });
        const plain = stripAnsi(out);
        // minimum 40 columns
        expect(plain.split("\n")[0].length).toBeGreaterThanOrEqual(40);
    });
});
