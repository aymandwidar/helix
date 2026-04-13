/**
 * Pipeline Phase 3: Database — Generate Prisma schema, push to DB, and generate client
 */

import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';
import execa = require('execa');
import ora from 'ora';
import { createCompletion, DEFAULT_MODEL } from '../openrouter.js';
import { parseHelix, generatePrismaSchema } from '../parser.js';
import { resolveTheme, generateThemeCSS } from '../themes/index.js';
import { MAX_RETRY_ATTEMPTS, type PipelineContext } from './types.js';

/**
 * Parse blueprint, generate Prisma schema, push to DB with self-healing.
 * Mutates ctx.ast and ctx.activeThemeName.
 */
export async function database(ctx: PipelineContext): Promise<void> {
  const spinner = ora('Building database...').start();

  const ast = parseHelix(ctx.blueprint!);
  ctx.ast = ast;

  // Re-apply theme from blueprint if specified in a view
  const blueprintThemeName = ast.views.find(v => v.properties.theme)?.properties.theme;
  if (blueprintThemeName) {
    const resolvedTheme = resolveTheme(blueprintThemeName);
    await fs.writeFile(
      path.join(ctx.projectPath, 'src', 'app', 'globals.css'),
      generateThemeCSS(resolvedTheme),
    );
    console.log(chalk.cyan(`  Theme: ${resolvedTheme.name} (from blueprint)`));
  }
  ctx.activeThemeName = blueprintThemeName || ctx.options.theme;

  let attempts = 0;
  let lastError = '';
  let currentSchema = generatePrismaSchema(ast);

  while (attempts < MAX_RETRY_ATTEMPTS) {
    attempts++;
    try {
      await fs.writeFile(path.join(ctx.projectPath, 'prisma', 'schema.prisma'), currentSchema);

      // Remove hallucinated prisma.config.ts
      const badConfigPath = path.join(ctx.projectPath, 'prisma.config.ts');
      if (fs.existsSync(badConfigPath)) await fs.remove(badConfigPath);

      if (ctx.connectionString) {
        const spinnerMigrate = ora('Supabase: Deploying Schema...').start();
        try {
          const envPath = path.join(ctx.projectPath, '.env');
          let envContent = await fs.readFile(envPath, 'utf-8');
          envContent = envContent.replace(/DATABASE_URL=".*"/, `DATABASE_URL="${ctx.connectionString}"`);
          await fs.writeFile(envPath, envContent);

          await execa('npm', ['exec', '--', 'prisma', 'db', 'push', '--accept-data-loss'], { cwd: ctx.projectPath, stdio: 'pipe' });
          spinnerMigrate.succeed('Supabase: Schema Deployed Successfully');
        } catch (err: any) {
          spinnerMigrate.fail('Supabase Deployment Failed');
          console.error(chalk.red(err.message));
        }
      } else {
        await execa('npm', ['exec', '--', 'prisma', 'db', 'push', '--accept-data-loss'], { cwd: ctx.projectPath, stdio: 'pipe' });
      }

      await execa('npm', ['exec', '--', 'prisma', 'generate'], { cwd: ctx.projectPath, stdio: 'pipe' });
      break;
    } catch (error: any) {
      lastError = error.stderr || error.message || String(error);
      if (attempts < MAX_RETRY_ATTEMPTS) {
        spinner.text = `Building database... (self-healing attempt ${attempts + 1}/${MAX_RETRY_ATTEMPTS})`;
        currentSchema = await fixPrismaSchema(currentSchema, lastError);
      } else {
        spinner.fail(`Database build failed after ${MAX_RETRY_ATTEMPTS} attempts`);
        console.error(chalk.red(lastError));
        throw new Error('Failed to build database');
      }
    }
  }

  spinner.succeed('Database built');
}

async function fixPrismaSchema(schema: string, error: string): Promise<string> {
  const systemPrompt = `You are a Prisma schema repair assistant.
Your task is to fix syntax errors in Prisma schema files.

CRITICAL RULES:
- You are STRICTLY FORBIDDEN from generating or referencing prisma.config.ts
- Standard Prisma uses ONLY schema.prisma - nothing else
- Output ONLY the fixed schema content, no configuration code
- Output ONLY the fixed schema, no explanations or markdown
- Keep the same models and fields, just fix the syntax
- Ensure all types are valid Prisma types (String, Int, Float, Boolean, DateTime)
- Ensure proper formatting with @id, @default, etc.
- Do NOT include any TypeScript/JavaScript code
`;

  return await createCompletion(systemPrompt,
    `Fix this Prisma schema that has an error:

ERROR:
${error}

SCHEMA:
${schema}

Output the corrected schema:`,
    { model: DEFAULT_MODEL, maxTokens: 2048, thinking: true },
  );
}
