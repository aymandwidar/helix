/**
 * Helix Command: generate
 * The "Explosion" Pattern - Parses .helix and generates Prisma + API + UI layers
 */

import chalk from "chalk";
import * as fs from "fs-extra";
import * as path from "path";
import execa = require("execa");
import ora from "ora";
import {
    parseHelix,
    generatePrismaSchema,
    generateAPIRoute,
    generateUIPage,
    HelixAST,
} from "../parser";

export async function generateStack(blueprintPath: string): Promise<void> {
    const fullPath = path.isAbsolute(blueprintPath)
        ? blueprintPath
        : path.join(process.cwd(), blueprintPath);

    // Validate file exists
    if (!fs.existsSync(fullPath)) {
        console.error(chalk.red(`❌ Blueprint not found: ${fullPath}`));
        process.exit(1);
    }

    // Check for helix.config.json to confirm we're in a Helix project
    const configPath = path.join(process.cwd(), "helix.config.json");
    if (!fs.existsSync(configPath)) {
        console.error(chalk.red("❌ Not a Helix project. Run 'helix new <name>' first."));
        process.exit(1);
    }

    console.log(chalk.cyan("\n⚡ Helix Generate - The Explosion Pattern\n"));

    // Read and parse the blueprint
    const spinner1 = ora("Parsing Helix blueprint...").start();
    let ast: HelixAST;
    try {
        const content = await fs.readFile(fullPath, "utf-8");
        ast = parseHelix(content);
        spinner1.succeed(`Parsed ${ast.strands.length} strands, ${ast.views.length} views`);
    } catch (error) {
        spinner1.fail("Failed to parse blueprint");
        throw error;
    }

    // Layer A: Generate Prisma Schema
    const spinner2 = ora("Layer A: Generating Prisma schema...").start();
    try {
        const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
        const schema = generatePrismaSchema(ast);
        await fs.writeFile(schemaPath, schema);
        spinner2.succeed("Prisma schema generated");
    } catch (error) {
        spinner2.fail("Failed to generate Prisma schema");
        throw error;
    }

    // Push database changes
    const spinner3 = ora("Syncing database...").start();
    try {
        await execa("npx", ["prisma", "db", "push", "--accept-data-loss"], {
            cwd: process.cwd(),
            stdio: "pipe",
        });
        spinner3.succeed("Database synced");
    } catch (error) {
        spinner3.fail("Failed to sync database");
        throw error;
    }

    // Generate Prisma client
    const spinner4 = ora("Generating Prisma client...").start();
    try {
        await execa("npx", ["prisma", "generate"], {
            cwd: process.cwd(),
            stdio: "pipe",
        });
        spinner4.succeed("Prisma client generated");
    } catch (error) {
        spinner4.fail("Failed to generate Prisma client");
        throw error;
    }

    // Layer B: Generate API Routes
    const spinner5 = ora("Layer B: Generating API routes...").start();
    try {
        for (const strand of ast.strands) {
            const apiDir = path.join(
                process.cwd(),
                "src",
                "app",
                "api",
                strand.name.toLowerCase()
            );
            await fs.ensureDir(apiDir);

            const routeCode = generateAPIRoute(strand);
            await fs.writeFile(path.join(apiDir, "route.ts"), routeCode);
        }
        spinner5.succeed(`Generated ${ast.strands.length} API route(s)`);
    } catch (error) {
        spinner5.fail("Failed to generate API routes");
        throw error;
    }

    // Layer C: Generate UI Pages
    const spinner6 = ora("Layer C: Generating UI components...").start();
    try {
        for (const view of ast.views) {
            // Find the associated strand from view properties
            const listProp = view.properties["list"] || "";
            const strandName = listProp.split(".")[0] || ast.strands[0]?.name || "Item";
            const strand = ast.strands.find((s) => s.name === strandName) || ast.strands[0];

            if (!strand) {
                console.log(chalk.yellow(`⚠️ No strand found for view ${view.name}`));
                continue;
            }

            const viewDir = path.join(
                process.cwd(),
                "src",
                "app",
                view.name.toLowerCase()
            );
            await fs.ensureDir(viewDir);

            const pageCode = generateUIPage(view, strand);
            await fs.writeFile(path.join(viewDir, "page.tsx"), pageCode);
        }
        spinner6.succeed(`Generated ${ast.views.length} UI page(s)`);
    } catch (error) {
        spinner6.fail("Failed to generate UI pages");
        throw error;
    }

    // Update the home page to link to generated views
    const spinner7 = ora("Updating home page...").start();
    try {
        const homePage = generateHomePage(ast);
        await fs.writeFile(
            path.join(process.cwd(), "src", "app", "page.tsx"),
            homePage
        );
        spinner7.succeed("Home page updated");
    } catch (error) {
        spinner7.fail("Failed to update home page");
        throw error;
    }

    // Success summary
    console.log(chalk.green("\n✅ Generation complete!\n"));
    console.log(chalk.white("Generated layers:"));
    console.log(chalk.gray("  📊 Prisma Schema (prisma/schema.prisma)"));
    for (const strand of ast.strands) {
        console.log(chalk.gray(`  🔌 API: /api/${strand.name.toLowerCase()}`));
    }
    for (const view of ast.views) {
        console.log(chalk.gray(`  🖼️  UI: /${view.name.toLowerCase()}`));
    }
    console.log(chalk.gray("\nRun 'helix run' to start the dev server.\n"));
}

function generateHomePage(ast: HelixAST): string {
    const links = ast.views
        .map(
            (v) => `
        <a
          href="/${v.name.toLowerCase()}"
          className="glass glass-hover rounded-xl p-6 transition-all hover:scale-105"
        >
          <h2 className="text-2xl font-bold mb-2">${v.name}</h2>
          <p className="text-gray-400">View and manage ${v.name.toLowerCase()}</p>
        </a>`
        )
        .join("\n");

    return `// Generated by Helix v3.0
import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-bold text-white mb-4">
          🧬 Helix App
        </h1>
        <p className="text-gray-400 text-xl mb-12">
          Built with the Autonomic Stack
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          ${links}
        </div>
        
        <footer className="mt-16 text-center text-gray-500">
          Powered by Helix v3.0 • Next.js • Prisma • Tailwind
        </footer>
      </div>
    </main>
  );
}
`;
}
