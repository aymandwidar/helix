/**
 * Helix Command: init
 * Initialize a new project from a template blueprint
 */

import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';

const TEMPLATES_DIR = path.resolve(__dirname, '..', '..', 'templates');

interface TemplateConfig {
  name: string;
  title: string;
  description: string;
  theme: string;
  db: string;
  tags: string[];
}

/**
 * List all available templates
 */
export async function listTemplates(): Promise<void> {
  const templates = await loadTemplates();

  if (templates.length === 0) {
    console.log(chalk.yellow('No templates found.'));
    return;
  }

  console.log(chalk.cyan('\n📋 Available Templates\n'));

  for (const t of templates) {
    console.log(chalk.white(`  ${chalk.bold(t.name.padEnd(14))} ${t.title}`));
    console.log(chalk.gray(`${''.padEnd(16)}${t.description}`));
    console.log(chalk.gray(`${''.padEnd(16)}Theme: ${t.theme} | DB: ${t.db} | Tags: ${t.tags.join(', ')}`));
    console.log('');
  }

  console.log(chalk.gray(`  Usage: helix init <template> [project-name]\n`));
}

/**
 * Initialize a project from a template
 */
export async function initFromTemplate(templateName: string, projectName?: string): Promise<void> {
  const templates = await loadTemplates();
  const template = templates.find(t => t.name === templateName.toLowerCase());

  if (!template) {
    console.error(chalk.red(`❌ Template "${templateName}" not found.`));
    console.log(chalk.gray('Available templates:'));
    for (const t of templates) {
      console.log(chalk.gray(`  • ${t.name} — ${t.title}`));
    }
    process.exit(1);
  }

  const name = projectName || `${template.name}-app`;
  const templateDir = path.join(TEMPLATES_DIR, template.name);
  const blueprintPath = path.join(templateDir, 'blueprint.helix');

  if (!fs.existsSync(blueprintPath)) {
    console.error(chalk.red(`❌ Template blueprint not found: ${blueprintPath}`));
    process.exit(1);
  }

  const blueprint = await fs.readFile(blueprintPath, 'utf-8');

  console.log(chalk.cyan(`\n🧬 Initializing from template: ${chalk.bold(template.title)}\n`));
  console.log(chalk.gray(`  Theme:    ${template.theme}`));
  console.log(chalk.gray(`  Database: ${template.db}`));
  console.log(chalk.gray(`  Project:  ${name}\n`));

  // Import spawnApp and run with the blueprint as the prompt
  const { spawnApp } = await import('./spawn.js');
  await spawnApp(
    `${template.title}: ${template.description}`,
    {
      theme: template.theme,
      db: template.db,
    },
  );
}

async function loadTemplates(): Promise<TemplateConfig[]> {
  if (!fs.existsSync(TEMPLATES_DIR)) return [];

  const dirs = await fs.readdir(TEMPLATES_DIR, { withFileTypes: true });
  const templates: TemplateConfig[] = [];

  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const configPath = path.join(TEMPLATES_DIR, dir.name, 'config.json');
    if (!fs.existsSync(configPath)) continue;

    try {
      const config = await fs.readJSON(configPath);
      templates.push(config);
    } catch {
      // Skip malformed configs
    }
  }

  return templates.sort((a, b) => a.name.localeCompare(b.name));
}
