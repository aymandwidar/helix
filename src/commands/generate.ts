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

  // CLEANUP: Remove any hallucinated prisma.config.ts that could crash Prisma
  const badConfigPath = path.join(process.cwd(), "prisma.config.ts");
  if (fs.existsSync(badConfigPath)) {
    await fs.remove(badConfigPath);
    console.log(chalk.yellow("⚠️  Removed invalid prisma.config.ts (not supported by Prisma)"));
  }

  // Push database changes
  const spinner3 = ora("Syncing database...").start();
  try {
    await execa("npm", ["exec", "--", "prisma", "db", "push", "--accept-data-loss"], {
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
    await execa("npm", ["exec", "--", "prisma", "generate"], {
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
  if (ast.strands.length === 0) {
    return `// Generated by Helix v4.2
export default function Home() {
  return (<main className="min-h-screen p-8 flex items-center justify-center"><div className="text-center"><h1 className="text-4xl font-bold text-white mb-4">🧬 Helix App</h1><p className="text-gray-400">No strands defined</p></div></main>);
}`;
  }

  // Generate interfaces for ALL strands
  const interfaces = ast.strands.map(s => {
    const fields = s.fields.map(f => `${f.name}: ${f.type === 'String' ? 'string' : f.type === 'Int' || f.type === 'Float' ? 'number' : f.type === 'Boolean' ? 'boolean' : 'string'}`).join('; ');
    return `interface ${s.name} { id: string; ${fields}; createdAt: string; }`;
  }).join('\n');

  // Generate state for ALL strands
  const states = ast.strands.map(s => {
    const lower = s.name.toLowerCase();
    const init = s.fields.map(f => `${f.name}: ${f.type === 'Boolean' ? 'false' : f.type === 'Int' || f.type === 'Float' ? '0' : "''"}`).join(', ');
    return `const [${lower}s, set${s.name}s] = useState<${s.name}[]>([]);
  const [show${s.name}Form, setShow${s.name}Form] = useState(false);
  const [${lower}Form, set${s.name}Form] = useState({ ${init} });`;
  }).join('\n  ');

  // Generate fetch/submit/delete for ALL strands
  const funcs = ast.strands.map(s => {
    const lower = s.name.toLowerCase();
    return `const fetch${s.name}s = async () => { const r = await fetch('/api/${lower}'); set${s.name}s(await r.json()); };
  const submit${s.name} = async (e: React.FormEvent) => { e.preventDefault(); await fetch('/api/${lower}', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(${lower}Form) }); setShow${s.name}Form(false); fetch${s.name}s(); };
  const delete${s.name} = async (id: string) => { if (!confirm('Delete?')) return; await fetch('/api/${lower}?id=' + id, { method: 'DELETE' }); fetch${s.name}s(); };`;
  }).join('\n  ');

  const fetchAll = ast.strands.map(s => `fetch${s.name}s()`).join('; ');

  // Generate sections for ALL strands
  const sections = ast.strands.map(s => {
    const lower = s.name.toLowerCase();
    const formInputs = s.fields.map(f => {
      const t = f.type === 'Int' || f.type === 'Float' ? 'number' : 'text';
      return `<div className="mb-3"><label className="block text-gray-400 text-sm mb-1">${f.name}</label><input type="${t}" value={${lower}Form.${f.name} || ''} onChange={e => set${s.name}Form({...${lower}Form, ${f.name}: ${t === 'number' ? 'Number(e.target.value)' : 'e.target.value'}})} className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white" /></div>`;
    }).join('\n            ');
    const displayFields = s.fields.slice(0, 4).map(f => `<div><span className="text-gray-500 text-xs">${f.name}</span><div className="text-white text-sm">{String(item.${f.name})}</div></div>`).join('\n                ');

    return `
        {/* ${s.name} */}
        <section className="mb-8">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xl font-bold text-white">${s.name}s</h2>
            <button onClick={() => setShow${s.name}Form(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm">+ Add</button>
          </div>
          {show${s.name}Form && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-gray-900 border border-white/10 rounded-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-bold text-white mb-4">Add ${s.name}</h3>
                <form onSubmit={submit${s.name}}>
            ${formInputs}
                  <div className="flex gap-3 mt-4">
                    <button type="button" onClick={() => setShow${s.name}Form(false)} className="flex-1 bg-white/10 text-white py-2 rounded-lg">Cancel</button>
                    <button type="submit" className="flex-1 bg-indigo-600 text-white py-2 rounded-lg">Create</button>
                  </div>
                </form>
              </div>
            </div>
          )}
          <div className="space-y-2">
            {${lower}s.length === 0 ? <div className="glass rounded-lg p-4 text-center text-gray-400 text-sm">No ${lower}s yet</div> : ${lower}s.map(item => (
              <div key={item.id} className="glass rounded-lg p-3 group flex justify-between">
                <div className="grid grid-cols-4 gap-4 flex-1">
                ${displayFields}
                </div>
                <button onClick={() => delete${s.name}(item.id)} className="opacity-0 group-hover:opacity-100 text-red-400 text-sm">🗑️</button>
              </div>
            ))}
          </div>
        </section>`;
  }).join('\n');

  return `// Generated by Helix v4.2 - Multi-Strand Dashboard
'use client';
import { useState, useEffect } from 'react';
${interfaces}
export default function Home() {
  const [loading, setLoading] = useState(true);
  ${states}
  ${funcs}
  useEffect(() => { ${fetchAll}; setLoading(false); }, []);
  if (loading) return <main className="min-h-screen p-8 flex items-center justify-center"><div className="text-white animate-pulse">Loading...</div></main>;
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <span className="text-sm text-indigo-400 font-mono">🧬 Helix</span>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 text-sm">${ast.strands.length} data types</p>
        </div>
${sections}
      </div>
    </main>
  );
}
`;
}

