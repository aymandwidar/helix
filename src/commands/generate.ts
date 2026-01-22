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
  const primaryViewNames = ['Main', 'Home', 'Root', 'Dashboard', 'App'];
  let primaryView = ast.views.find(v =>
    primaryViewNames.some(name => v.name.toLowerCase() === name.toLowerCase())
  ) || ast.views[0];

  if (!primaryView) {
    return `// Generated by Helix v4.0
export default function Home() {
  return (
    <main className="min-h-screen p-8 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">🧬 Helix App</h1>
        <p className="text-gray-400">No views defined</p>
      </div>
    </main>
  );
}
`;
  }

  const listProp = primaryView.properties["list"] || "";
  const strandName = listProp.split(".")[0] || ast.strands[0]?.name || "Item";
  const strand = ast.strands.find(s => s.name === strandName) || ast.strands[0];
  const lowerName = strandName.toLowerCase();
  const fieldTypes = strand?.fields.map(f => {
    const t = f.type === 'String' ? 'string' : f.type === 'Int' || f.type === 'Float' ? 'number' : f.type === 'Boolean' ? 'boolean' : 'string';
    return `  ${f.name}: ${t};`;
  }).join('\n') || '  name: string;';
  const formFields = strand?.fields.map(f => {
    const iType = f.type === 'Int' || f.type === 'Float' ? 'number' : 'text';
    return `                <div><label className="block text-gray-400 text-sm mb-1">${f.name}</label><input type="${iType}" value={formData.${f.name} || ''} onChange={(e) => setFormData({...formData, ${f.name}: ${iType === 'number' ? 'Number(e.target.value)' : 'e.target.value'}})} className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white" /></div>`;
  }).join('\n') || '';
  const initState = strand?.fields.map(f => {
    const v = f.type === 'Boolean' ? 'false' : f.type === 'Int' || f.type === 'Float' ? '0' : "''";
    return `    ${f.name}: ${v}`;
  }).join(',\n') || '    name: ""';

  return `// Generated by Helix v4.0 - CRUD App
'use client';
import { useState, useEffect } from 'react';
interface ${strandName} { id: string; ${fieldTypes.replace(/\n/g, ' ')} createdAt: string; }
export default function Home() {
  const [items, setItems] = useState<${strandName}[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ ${initState.replace(/\n/g, ' ')} });
  const fetchItems = async () => { const res = await fetch('/api/${lowerName}'); setItems(await res.json()); setLoading(false); };
  useEffect(() => { fetchItems(); }, []);
  const handleSubmit = async (e: React.FormEvent) => { e.preventDefault(); await fetch('/api/${lowerName}', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) }); setShowForm(false); fetchItems(); };
  const handleDelete = async (id: string) => { if (!confirm('Delete?')) return; await fetch('/api/${lowerName}?id=' + id, { method: 'DELETE' }); fetchItems(); };
  if (loading) return <main className="min-h-screen p-8 flex items-center justify-center"><div className="text-white animate-pulse">Loading...</div></main>;
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">${primaryView.name}</h1>
          <button onClick={() => setShowForm(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg">+ Add ${strandName}</button>
        </div>
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-8 w-full max-w-md">
              <h2 className="text-2xl font-bold text-white mb-6">Add ${strandName}</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
${formFields}
                <div className="flex gap-4 mt-6">
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-white/10 text-white py-3 rounded-lg">Cancel</button>
                  <button type="submit" className="flex-1 bg-indigo-600 text-white py-3 rounded-lg">Create</button>
                </div>
              </form>
            </div>
          </div>
        )}
        <div className="space-y-4">
          {items.length === 0 ? (
            <div className="glass rounded-xl p-12 text-center text-gray-400">No ${lowerName}s yet. Click "Add ${strandName}" above!</div>
          ) : items.map((item) => (
            <div key={item.id} className="glass rounded-xl p-6 group">
              <div className="flex justify-between">
                <div className="grid grid-cols-2 gap-4 flex-1">
${strand?.fields.map(f => `                  <div><span className="text-gray-500 text-sm">${f.name}</span><div className="text-white">{String(item.${f.name})}</div></div>`).join('\n') || ''}
                </div>
                <button onClick={() => handleDelete(item.id)} className="opacity-0 group-hover:opacity-100 text-red-400">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
`;
}

