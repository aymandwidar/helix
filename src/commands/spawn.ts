/**
 * Helix Command: spawn
 * ONE-SHOT GENERATION - Full-stack app from natural language with ZERO intervention
 * v11.1 - Clean Factory with modular pipeline
 */

import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';
import {
  validateConstitution,
  autoCorrectOptions,
  printConstitutionalReport,
  enhancePromptWithConstitution,
  type SpawnOptions,
} from '../utils/constitutional-validator.js';
import { scaffold, scope, generateBlueprintPhase, database, codegen, verify } from '../pipeline/index.js';
import type { PipelineContext } from '../pipeline/types.js';

const HELIX_ROOT = path.resolve(__dirname, '..', '..');
const BUILDS_DIR = path.join(HELIX_ROOT, 'builds');

/**
 * Spawn a complete full-stack application from a natural language prompt
 */
export async function spawnApp(
  prompt: string,
  options: SpawnOptions = {},
  constitution?: string,
  connectionString?: string,
): Promise<void> {
  console.log(chalk.cyan('\n🧬 HELIX SPAWN v11.1 - Clean Factory\n'));
  console.log(chalk.gray(`Prompt: "${prompt}"\n`));
  if (connectionString) {
    console.log(chalk.gray('Supabase Autopilot: ENABLED\n'));
  }

  // Constitutional validation
  if (!options.noConstitution) {
    console.log(chalk.cyan('📜 Validating Constitutional Compliance...\n'));
    const report = validateConstitution(prompt, options);
    printConstitutionalReport(report);

    if (report.violations.length > 0) {
      const autoFixableCount = report.violations.filter(v => v.autoFixable).length;
      if (autoFixableCount > 0) {
        console.log(chalk.yellow(`\n✨ Auto-correcting ${autoFixableCount} violations...\n`));
        options = autoCorrectOptions(options, report.violations);
      }
    }

    prompt = enhancePromptWithConstitution(prompt);
    console.log(chalk.green('✅ Constitutional validation complete\n'));
  }

  // Project naming and isolation
  const projectName = generateProjectName(prompt);
  await fs.ensureDir(BUILDS_DIR);
  const projectPath = path.join(BUILDS_DIR, projectName);

  if (fs.existsSync(projectPath)) {
    console.error(chalk.red(`❌ Build "${projectName}" already exists in builds/`));
    console.error(chalk.gray(`   Path: ${projectPath}`));
    console.error(chalk.gray('   Remove it first or use a different prompt.'));
    process.exit(1);
  }

  console.log(chalk.cyan(`📂 Clean Factory: builds/${projectName}/\n`));

  // Build pipeline context
  const ctx: PipelineContext = {
    prompt,
    enrichedPrompt: prompt,
    projectName,
    projectPath,
    options,
    constitution,
    connectionString,
  };

  try {
    await scaffold(ctx);          // Phase 1: Create Next.js project
    await scope(ctx);             // Phase 1.5: Analyze complex prompts
    await generateBlueprintPhase(ctx); // Phase 2: Generate .helix blueprint
    await database(ctx);          // Phase 3: Prisma schema + DB push
    await codegen(ctx);           // Phase 4: API routes, UI, tests
    await verify(ctx);            // Phase 5: Cleanup + build verification
  } catch (error: any) {
    console.error(chalk.red(`\n❌ Spawn failed: ${error.message}`));
    await cleanupOnFailure(projectPath);
    process.exit(1);
  }
}

function generateProjectName(prompt: string): string {
  return prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .slice(0, 3)
    .join('-')
    .substring(0, 30)
    || 'helix-app';
}

async function cleanupOnFailure(projectPath: string): Promise<void> {
  if (fs.existsSync(projectPath)) {
    console.log(chalk.yellow(`🧹 Cleaning up failed build: ${projectPath}`));
    await fs.remove(projectPath);
  }
}
