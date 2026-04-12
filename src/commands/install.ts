/**
 * Helix Component Marketplace
 * Install library components into a Helix project
 */
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { execSync } from 'child_process';

interface ComponentManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  category: string;
  dependencies: string[];
  files: {
    schema?: string;
    api?: string[];
    components?: string[];
  };
  instructions?: string;
}

export async function installComponent(componentId: string, projectPath?: string): Promise<void> {
  const targetDir = projectPath || process.cwd();
  const libraryDir = path.resolve(__dirname, '..', '..', 'library');

  // List available if no component specified
  if (componentId === 'list' || !componentId) {
    listComponents(libraryDir);
    return;
  }

  const componentDir = path.join(libraryDir, componentId);
  if (!fs.existsSync(componentDir)) {
    console.error(chalk.red(`Component "${componentId}" not found.`));
    console.log(chalk.gray('Available components:'));
    listComponents(libraryDir);
    return;
  }

  // Read manifest
  const manifestPath = path.join(componentDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error(chalk.red(`No manifest.json found in ${componentId}`));
    return;
  }

  const manifest: ComponentManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  console.log(chalk.cyan(`\n📦 Installing: ${manifest.name} v${manifest.version}`));
  console.log(chalk.gray(`   ${manifest.description}\n`));

  // Copy component files
  let filesCopied = 0;

  // Copy API routes
  if (manifest.files.api) {
    for (const apiFile of manifest.files.api) {
      const src = path.join(componentDir, apiFile);
      const dest = path.join(targetDir, apiFile);
      if (fs.existsSync(src)) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
        console.log(chalk.green(`  ✅ ${apiFile}`));
        filesCopied++;
      }
    }
  }

  // Copy components
  if (manifest.files.components) {
    for (const compFile of manifest.files.components) {
      const src = path.join(componentDir, compFile);
      const dest = path.join(targetDir, compFile);
      if (fs.existsSync(src)) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
        console.log(chalk.green(`  ✅ ${compFile}`));
        filesCopied++;
      }
    }
  }

  // Merge Prisma schema if present
  if (manifest.files.schema) {
    const schemaSrc = path.join(componentDir, manifest.files.schema);
    const schemaDest = path.join(targetDir, 'prisma', 'schema.prisma');
    if (fs.existsSync(schemaSrc) && fs.existsSync(schemaDest)) {
      const existingSchema = fs.readFileSync(schemaDest, 'utf-8');
      const newModels = fs.readFileSync(schemaSrc, 'utf-8');
      // Extract model blocks from the component schema
      const modelBlocks = newModels.match(/model\s+\w+\s*\{[^}]+\}/g) || [];
      let merged = existingSchema;
      for (const block of modelBlocks) {
        const modelName = block.match(/model\s+(\w+)/)?.[1];
        if (modelName && !existingSchema.includes(`model ${modelName}`)) {
          merged += '\n\n' + block;
          console.log(chalk.green(`  ✅ Prisma model: ${modelName}`));
        } else {
          console.log(chalk.yellow(`  ⚠️  Prisma model ${modelName} already exists, skipping`));
        }
      }
      fs.writeFileSync(schemaDest, merged);
    } else if (fs.existsSync(schemaSrc)) {
      fs.mkdirSync(path.join(targetDir, 'prisma'), { recursive: true });
      fs.copyFileSync(schemaSrc, path.join(targetDir, 'prisma', 'schema.prisma'));
      console.log(chalk.green(`  ✅ prisma/schema.prisma`));
    }
  }

  // Install dependencies
  if (manifest.dependencies && manifest.dependencies.length > 0) {
    console.log(chalk.cyan(`\n  📥 Installing dependencies: ${manifest.dependencies.join(', ')}`));
    try {
      execSync(`npm install ${manifest.dependencies.join(' ')}`, {
        cwd: targetDir,
        stdio: 'inherit'
      });
      console.log(chalk.green('  ✅ Dependencies installed'));
    } catch {
      console.log(chalk.yellow('  ⚠️  Some dependencies failed to install. Run npm install manually.'));
    }
  }

  // Show instructions
  if (manifest.instructions) {
    console.log(chalk.cyan('\n  📋 Setup Instructions:'));
    console.log(chalk.gray('  ' + manifest.instructions.replace(/\n/g, '\n  ')));
  }

  console.log(chalk.green(`\n  🎉 Installed ${manifest.name} (${filesCopied} files)\n`));
}

function listComponents(libraryDir: string): void {
  if (!fs.existsSync(libraryDir)) {
    console.log(chalk.yellow('No library directory found.'));
    return;
  }

  const dirs = fs.readdirSync(libraryDir, { withFileTypes: true })
    .filter(d => d.isDirectory());

  console.log(chalk.cyan(`\n📚 Helix Component Library (${dirs.length} packages):\n`));

  for (const dir of dirs) {
    const manifestPath = path.join(libraryDir, dir.name, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      try {
        const manifest: ComponentManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        console.log(`  ${chalk.green(manifest.name)} ${chalk.gray(`v${manifest.version}`)}`);
        console.log(`    ${chalk.gray(manifest.description)}`);
        if (manifest.dependencies.length > 0) {
          console.log(`    ${chalk.gray('deps: ' + manifest.dependencies.join(', '))}`);
        }
        console.log('');
      } catch {
        console.log(`  ${chalk.yellow(dir.name)} ${chalk.gray('(invalid manifest)')}\n`);
      }
    }
  }

  console.log(chalk.gray('  Usage: helix install <component-name>\n'));
}
