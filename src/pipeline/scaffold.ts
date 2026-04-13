/**
 * Pipeline Phase 1: Scaffold — Create Next.js project with isolation files
 */

import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';
import execa = require('execa');
import ora from 'ora';
import { resolveTheme, generateThemeCSS } from '../themes/index.js';
import type { PipelineContext } from './types.js';

export async function scaffold(ctx: PipelineContext): Promise<void> {
  console.log(chalk.cyan('\n📦 Phase 1: Scaffolding Next.js project...\n'));

  // Create Next.js app
  const createNextArgs = [
    'create-next-app@latest', ctx.projectPath,
    '--typescript', '--tailwind', '--eslint', '--app',
    '--src-dir', '--use-npm', '--no-git', '--yes',
  ];
  console.log(chalk.gray(`⬇️  Executing: npx ${createNextArgs.join(' ')}\n`));

  try {
    await execa('npx', createNextArgs, { stdio: 'inherit' });
  } catch (err: any) {
    console.error(chalk.red(`\n❌ Scaffolding failed: ${err.message}`));
    if (err.stderr) console.error(chalk.red(err.stderr));
    throw err;
  }

  console.log(chalk.green('\n✓ Next.js project created\n'));

  // Self-containment files
  console.log(chalk.cyan('🔒 Self-Containment: Injecting isolation files...\n'));

  await writeEnvFile(ctx);
  await writeDockerfile(ctx);
  await writeDockerCompose(ctx);
  await writeGitignore(ctx);
  await writeNextConfig(ctx);
  await writeLayout(ctx);

  // Prisma setup
  const prismaSpinner = ora('Setting up Prisma@5.22.0...').start();
  await execa('npm', ['install', '-D', 'prisma@5.22.0'], { cwd: ctx.projectPath, stdio: 'pipe' });
  await execa('npm', ['install', '@prisma/client@5.22.0'], { cwd: ctx.projectPath, stdio: 'pipe' });
  await execa('npm', ['install', '-D', 'vitest', '@vitejs/plugin-react', 'jsdom', '@testing-library/react', '@testing-library/jest-dom'], { cwd: ctx.projectPath, stdio: 'pipe' });

  const prismaDir = path.join(ctx.projectPath, 'prisma');
  await fs.ensureDir(prismaDir);
  const prismaProvider = ctx.dbProvider === 'postgres' || ctx.dbProvider === 'supabase' ? 'postgresql' : 'sqlite';
  await fs.writeFile(path.join(prismaDir, 'schema.prisma'), `// Helix Generated Prisma Schema
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "${prismaProvider}"
  url      = env("DATABASE_URL")
}
`);
  prismaSpinner.succeed('Prisma setup complete (v5.22.0)');

  // Additional dependencies
  const depsSpinner = ora('Installing additional dependencies...').start();
  await execa('npm', ['install', 'lucide-react', 'clsx', 'tailwind-merge'], { cwd: ctx.projectPath, stdio: 'pipe' });
  depsSpinner.succeed('Dependencies installed');

  // Lib files
  const libDir = path.join(ctx.projectPath, 'src', 'lib');
  await fs.ensureDir(libDir);
  await fs.writeFile(path.join(libDir, 'prisma.ts'), `import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
`);

  await fs.writeFile(path.join(libDir, 'utils.ts'), `import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
`);

  // Theme CSS
  const defaultThemeCSS = generateThemeCSS(resolveTheme(ctx.options.theme));
  await fs.writeFile(path.join(ctx.projectPath, 'src', 'app', 'globals.css'), defaultThemeCSS);

  // Remove Tailwind v4 config (using CSS @theme instead)
  const twConfigPath = path.join(ctx.projectPath, 'tailwind.config.ts');
  if (fs.existsSync(twConfigPath)) await fs.remove(twConfigPath);

  // Helix config
  await fs.writeJSON(
    path.join(ctx.projectPath, 'helix.config.json'),
    { version: '11.1.0', spawned: true, cleanFactory: true, prompt: ctx.prompt, generatedAt: new Date().toISOString() },
    { spaces: 2 },
  );

  console.log(chalk.green('✓ Project scaffolded\n'));
}

// ── File writers ──────────────────────────────────────────────────────

const HELIX_ROOT = path.resolve(__dirname, '..', '..');
const MASTER_ENV = path.join(HELIX_ROOT, '.env');

async function writeEnvFile(ctx: PipelineContext): Promise<void> {
  let masterEnvContent = '';
  if (fs.existsSync(MASTER_ENV)) masterEnvContent = await fs.readFile(MASTER_ENV, 'utf-8');

  let dbUrl = 'file:./dev.db';
  if (ctx.connectionString) {
    dbUrl = ctx.connectionString;
  } else if (ctx.dbProvider === 'postgres') {
    dbUrl = 'postgresql://postgres:postgres@localhost:5432/' + ctx.projectName + '?schema=public';
  } else if (ctx.dbProvider === 'supabase') {
    dbUrl = 'postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres';
  }

  const projectEnv = `# Helix Clean Factory - Project Environment
# Cloned from master .env at ${new Date().toISOString()}
${masterEnvContent}
# Project-specific
DATABASE_URL="${dbUrl}"
NEXT_PUBLIC_APP_NAME="${ctx.projectName}"
`;
  await fs.writeFile(path.join(ctx.projectPath, '.env'), projectEnv);
  console.log(chalk.green('  ✅ .env (cloned from master)'));
}

async function writeDockerfile(ctx: PipelineContext): Promise<void> {
  await fs.writeFile(path.join(ctx.projectPath, 'Dockerfile'), `# Helix Clean Factory - Auto-generated Dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --only=production

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
`);
  console.log(chalk.green('  ✅ Dockerfile'));
}

async function writeDockerCompose(ctx: PipelineContext): Promise<void> {
  await fs.writeFile(path.join(ctx.projectPath, 'docker-compose.yml'), `# Helix Clean Factory - Auto-generated
version: "3.8"
services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
    volumes:
      - app-data:/app/prisma
    restart: unless-stopped

volumes:
  app-data:
`);
  console.log(chalk.green('  ✅ docker-compose.yml'));
}

async function writeGitignore(ctx: PipelineContext): Promise<void> {
  await fs.writeFile(path.join(ctx.projectPath, '.gitignore'), `node_modules/
.next/
.env
*.db
*.db-journal
dist/
.turbo/
`);
  console.log(chalk.green('  ✅ .gitignore'));
}

async function writeNextConfig(ctx: PipelineContext): Promise<void> {
  await fs.writeFile(path.join(ctx.projectPath, 'next.config.ts'), [
    'import type { NextConfig } from "next";',
    '', 'const nextConfig: NextConfig = {',
    '  allowedDevOrigins: ["*"],',
    '};', '', 'export default nextConfig;', '',
  ].join('\n'));
  console.log(chalk.green('  ✅ next.config.ts (LAN-friendly)'));
}

async function writeLayout(ctx: PipelineContext): Promise<void> {
  const layoutPath = path.join(ctx.projectPath, 'src', 'app', 'layout.tsx');
  await fs.writeFile(layoutPath, [
    'import type { Metadata } from "next";',
    'import "./globals.css";', '',
    'export const metadata: Metadata = {',
    `  title: "${ctx.projectName}",`,
    '  description: "Built by Helix v11.1",',
    '};', '',
    'export default function RootLayout({',
    '  children,',
    '}: Readonly<{',
    '  children: React.ReactNode;',
    '}>) {',
    '  return (',
    '    <html lang="en">',
    '      <body>{children}</body>',
    '    </html>',
    '  );',
    '}', '',
  ].join('\n'));
  console.log(chalk.green('  ✅ layout.tsx (no Google Fonts)'));
}
