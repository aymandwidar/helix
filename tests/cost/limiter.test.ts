import { describe, it, expect } from "vitest";
import { IterationLimiter } from "../../src/cost/limiter";

describe("IterationLimiter", () => {
    it("is a no-op when max is undefined", () => {
        const l = new IterationLimiter();
        for (let i = 0; i < 10; i++) {
            const c = l.next();
            expect(c.allowed).toBe(true);
        }
    });

    it("treats max <= 0 as unlimited", () => {
        const l1 = new IterationLimiter(0);
        expect(l1.next().allowed).toBe(true);
        const l2 = new IterationLimiter(-3);
        expect(l2.next().allowed).toBe(true);
    });

    it("allows max iterations then denies", () => {
        const l = new IterationLimiter(3);
        expect(l.next().allowed).toBe(true);
        expect(l.next().allowed).toBe(true);
        expect(l.next().allowed).toBe(true);
        const denied = l.next();
        expect(denied.allowed).toBe(false);
        expect(denied.reason).toMatch(/limit reached/);
    });

    it("reset() restarts the counter", () => {
        const l = new IterationLimiter(2);
        l.next();
        l.next();
        expect(l.next().allowed).toBe(false);
        l.reset();
        expect(l.next().allowed).toBe(true);
    });

    it("current() reflects allowed iterations", () => {
        const l = new IterationLimiter(5);
        l.next();
        l.next();
        expect(l.current()).toBe(2);
    });
});
