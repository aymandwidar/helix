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
  // The original user prompt is preserved verbatim for display surfaces
  // (page titles, project name, manifest). AI-side enrichments — constitution
  // text, CMM context, requirements analysis — live on enrichedPrompt and are
  // only visible to the model.
  const userPrompt = prompt;
  let enrichedPrompt = prompt;

  console.log(chalk.cyan('\n🧬 HELIX SPAWN v11.1 - Clean Factory\n'));
  console.log(chalk.gray(`Prompt: "${userPrompt}"\n`));
  if (connectionString) {
    console.log(chalk.gray('Supabase Autopilot: ENABLED\n'));
  }

  // Constitutional validation
  if (!options.noConstitution) {
    console.log(chalk.cyan('📜 Validating Constitutional Compliance...\n'));
    const report = validateConstitution(userPrompt, options);
    printConstitutionalReport(report);

    if (report.violations.length > 0) {
      const autoFixableCount = report.violations.filter(v => v.autoFixable).length;
      if (autoFixableCount > 0) {
        console.log(chalk.yellow(`\n✨ Auto-correcting ${autoFixableCount} violations...\n`));
        options = autoCorrectOptions(options, report.violations);
      }
    }

    // Constitution guidance is for the AI only — never bake it into the
    // user-facing prompt or any rendered string.
    enrichedPrompt = enhancePromptWithConstitution(userPrompt);
    console.log(chalk.green('✅ Constitutional validation complete\n'));
  }

  // Cognitive memory pre-generate check (Sprint 8) + Sprint 15 banner.
  // Fails open if no memory server is configured.
  try {
    const { runPreGenerateCheck } = await import('../mcp/pre_generate.js');
    const memoryCheck = await runPreGenerateCheck(userPrompt);
    if (memoryCheck.findings.length > 0) {
      const { renderCmmBanner } = await import('../chat/display/cmm_banner.js');
      const banner = renderCmmBanner(memoryCheck);
      if (banner.nonEmpty) console.log('\n' + banner.text + '\n');
      enrichedPrompt = `${memoryCheck.contextBlock}\n\n## Current request\n${enrichedPrompt}`;
    }
  } catch {
    // Memory check is best-effort; ignore failures.
  }

  // Project naming and isolation
  const projectName = generateProjectName(userPrompt);
  await fs.ensureDir(BUILDS_DIR);
  const projectPath = path.join(BUILDS_DIR, projectName);

  if (fs.existsSync(projectPath)) {
    console.error(chalk.red(`❌ Build "${projectName}" already exists in builds/`));
    console.error(chalk.gray(`   Path: ${projectPath}`));
    console.error(chalk.gray('   Remove it first or use a different prompt.'));
    process.exit(1);
  }

  console.log(chalk.cyan(`📂 Clean Factory: builds/${projectName}/\n`));

  // Determine database provider
  const dbProvider = connectionString ? 'supabase'
    : (options.db === 'postgres' || options.db === 'postgresql') ? 'postgres'
    : options.db === 'supabase' ? 'supabase'
    : 'sqlite';

  // Build pipeline context. ctx.prompt is the verbatim user input — it ends
  // up in page titles, project metadata, and the manifest. ctx.enrichedPrompt
  // carries any AI-only guidance (constitution, CMM context, requirements).
  const ctx: PipelineContext = {
    prompt: userPrompt,
    enrichedPrompt,
    projectName,
    projectPath,
    options,
    constitution,
    connectionString,
    dbProvider,
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
