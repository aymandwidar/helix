/**
 * Pipeline Phase 5: Verify — Post-build cleanup and build verification
 */

import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';
import ora from 'ora';
import { verifyBuild } from '../self-heal.js';
import type { PipelineContext } from './types.js';

/**
 * Clean temp files and verify build.
 */
export async function verify(ctx: PipelineContext): Promise<void> {
  const cleanupSpinner = ora('Cleaning temp files...').start();
  await postBuildCleanup(ctx.projectPath);
  cleanupSpinner.succeed('Clean build verified');

  await verifyBuild(ctx.projectPath);

  console.log(chalk.green('\n✅ App spawned successfully!\n'));
  console.log(chalk.white(`📂 Project: ${ctx.projectPath}`));
  console.log(chalk.white(`📦 Docker:  cd builds/${ctx.projectName} && docker compose up`));
  console.log(chalk.white(`🔗 Dev:     cd builds/${ctx.projectName} && npm run dev`));
  console.log(chalk.white(`🌐 URL:     http://localhost:3000\n`));
}

async function postBuildCleanup(projectPath: string): Promise<void> {
  const junkFiles = ['prisma.config.ts', 'tsconfig.tsbuildinfo'];
  for (const file of junkFiles) {
    const junkPath = path.join(projectPath, file);
    if (fs.existsSync(junkPath)) await fs.remove(junkPath);
  }
}
