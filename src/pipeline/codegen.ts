/**
 * Pipeline Phase 4: Codegen — Generate API routes, UI pages, and test files
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import ora from 'ora';
import { generateAPIRoute, generateUIPage } from '../parser.js';
import { getThemeClasses } from '../themes/index.js';
import { generateAPITests, generateComponentTests, generateTestConfig } from '../test-generator.js';
import { generateLayout, generateSidebarLayout, generatePageComponent, generateRootRedirect } from '../page-generator.js';
import { generateSpawnHomePage } from './homepage.js';
import type { PipelineContext } from './types.js';

/**
 * Generate all application code: API routes, UI pages, tests.
 */
export async function codegen(ctx: PipelineContext): Promise<void> {
  const spinner = ora('Generating application...').start();
  const ast = ctx.ast!;
  const themeClasses = getThemeClasses(ctx.activeThemeName);

  // API routes
  for (const strand of ast.strands) {
    const apiDir = path.join(ctx.projectPath, 'src', 'app', 'api', strand.name.toLowerCase());
    await fs.ensureDir(apiDir);
    await fs.writeFile(path.join(apiDir, 'route.ts'), generateAPIRoute(strand));
  }

  // View pages
  for (const view of ast.views) {
    const strandName = view.properties['list']?.split('.')[0] || ast.strands[0]?.name;
    const strand = ast.strands.find(s => s.name === strandName) || ast.strands[0];
    if (strand) {
      const viewDir = path.join(ctx.projectPath, 'src', 'app', view.name.toLowerCase());
      await fs.ensureDir(viewDir);
      await fs.writeFile(path.join(viewDir, 'page.tsx'), generateUIPage(view, strand, ast.strands, themeClasses));
    }
  }

  // Multi-page or single-page generation
  if (ast.pages && ast.pages.length > 0) {
    const useSidebar = ast.pages.some(p => p.layout === 'sidebar');
    const appName = ctx.prompt.split(' ').slice(0, 4).join(' ');
    const layoutContent = useSidebar
      ? generateSidebarLayout(ast.pages, appName)
      : generateLayout(ast.pages, appName);

    await fs.writeFile(path.join(ctx.projectPath, 'src', 'app', 'layout.tsx'), layoutContent);

    for (const page of ast.pages) {
      const pageDir = path.join(ctx.projectPath, 'src', 'app', page.route.replace(/^\//, ''));
      await fs.ensureDir(pageDir);
      await fs.writeFile(path.join(pageDir, 'page.tsx'), generatePageComponent(page, ast.strands));
    }

    await fs.writeFile(
      path.join(ctx.projectPath, 'src', 'app', 'page.tsx'),
      generateRootRedirect(ast.pages[0].route),
    );
  } else {
    await fs.writeFile(
      path.join(ctx.projectPath, 'src', 'app', 'page.tsx'),
      generateSpawnHomePage(ctx.prompt, ast, themeClasses),
    );
  }

  // Test files
  const testApiDir = path.join(ctx.projectPath, '__tests__', 'api');
  const testCompDir = path.join(ctx.projectPath, '__tests__', 'components');
  await fs.ensureDir(testApiDir);
  await fs.ensureDir(testCompDir);

  for (const strand of ast.strands) {
    await fs.writeFile(
      path.join(testApiDir, `${strand.name.toLowerCase()}.test.ts`),
      generateAPITests(strand),
    );
    await fs.writeFile(
      path.join(testCompDir, `${strand.name.toLowerCase()}.test.tsx`),
      generateComponentTests(strand),
    );
  }

  await fs.writeFile(path.join(ctx.projectPath, 'vitest.config.ts'), generateTestConfig());

  // Exclude vitest.config.ts from Next.js tsconfig
  const tsconfigPath = path.join(ctx.projectPath, 'tsconfig.json');
  try {
    const tsconfigRaw = await fs.readFile(tsconfigPath, 'utf-8');
    const tsconfig = JSON.parse(tsconfigRaw);
    if (tsconfig.exclude && !tsconfig.exclude.includes('vitest.config.ts')) {
      tsconfig.exclude.push('vitest.config.ts');
    } else if (!tsconfig.exclude) {
      tsconfig.exclude = ['node_modules', 'vitest.config.ts'];
    }
    await fs.writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2));
  } catch {
    // Non-fatal
  }

  spinner.succeed('Application generated (with test suite)');
}
