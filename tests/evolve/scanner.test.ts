import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { scanProject, summarizeSnapshot } from "../../src/evolve/scanner";

describe("scanProject", () => {
    let tmp: string;
    beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "helix-scan-")); });
    afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

    function write(rel: string, content: string): void {
        const abs = path.join(tmp, rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, content);
    }

    it("identifies a Next.js project from package.json", () => {
        write("package.json", JSON.stringify({
            name: "demo",
            dependencies: { next: "14.0.0", react: "18" },
            devDependencies: { typescript: "5" },
            scripts: { dev: "next dev", build: "next build" },
        }));
        const snap = scanProject(tmp);
        expect(snap.kind).toBe("next");
        expect(snap.framework).toContain("Next.js");
        expect(snap.dependencies.next).toBe("14.0.0");
        expect(snap.scripts.build).toBe("next build");
    });

    it("parses prisma models", () => {
        write("package.json", JSON.stringify({ name: "demo", dependencies: { next: "14" } }));
        write("prisma/schema.prisma", `model User {
  id Int @id @default(autoincrement())
  email String @unique
  name String?
}

model Post {
  id Int @id
  title String
  author User @relation(fields: [authorId], references: [id])
  authorId Int
}`);
        const snap = scanProject(tmp);
        expect(snap.prismaModels.length).toBe(2);
        expect(snap.prismaModels.map(m => m.name)).toEqual(["User", "Post"]);
        expect(snap.prismaModels[0].fields.length).toBeGreaterThan(0);
    });

    it("collects App Router routes including dynamic and route groups", () => {
        write("package.json", JSON.stringify({ name: "demo", dependencies: { next: "14" } }));
        write("app/page.tsx", "");
        write("app/layout.tsx", "");
        write("app/blog/[slug]/page.tsx", "");
        write("app/(marketing)/about/page.tsx", "");
        write("app/api/users/route.ts", "");
        const snap = scanProject(tmp);
        const routes = snap.routes.map(r => `${r.kind}:${r.route}`).sort();
        expect(routes).toContain("page:/");
        expect(routes).toContain("page:/blog/[slug]");
        // Route groups don't add a URL segment
        expect(routes).toContain("page:/about");
        expect(routes).toContain("route:/api/users");
    });

    it("collects components from /components", () => {
        write("package.json", JSON.stringify({ name: "demo" }));
        write("components/Header.tsx", "");
        write("components/ui/Button.tsx", "");
        const snap = scanProject(tmp);
        expect(snap.components.some(c => c.endsWith("Header.tsx"))).toBe(true);
        expect(snap.components.some(c => c.endsWith("Button.tsx"))).toBe(true);
    });

    it("collects env keys from .env / .env.example", () => {
        write("package.json", JSON.stringify({ name: "demo" }));
        write(".env.example", "DATABASE_URL=\nNEXTAUTH_SECRET=\n# comment\nFOO=bar");
        const snap = scanProject(tmp);
        expect(snap.envKeys).toContain("DATABASE_URL");
        expect(snap.envKeys).toContain("NEXTAUTH_SECRET");
        expect(snap.envKeys).toContain("FOO");
    });

    it("returns kind=unknown when nothing matches", () => {
        const snap = scanProject(tmp);
        expect(snap.kind).toBe("unknown");
    });

    it("summarizeSnapshot produces a non-empty multi-line description", () => {
        write("package.json", JSON.stringify({
            name: "demo",
            dependencies: { next: "14" },
            scripts: { dev: "next dev" },
        }));
        const snap = scanProject(tmp);
        const summary = summarizeSnapshot(snap);
        expect(summary).toContain("demo");
        expect(summary).toContain("Dependencies");
        expect(summary.split("\n").length).toBeGreaterThan(2);
    });
});
