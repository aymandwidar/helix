/**
 * Helix Self-Heal — Automatic build failure recovery
 * When a generated app fails to build, feeds the error to DeepSeek
 * and applies the fix automatically (up to 3 attempts)
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { createCompletion } from './openrouter';

interface HealAttempt {
  attempt: number;
  error: string;
  file: string;
  fix: string;
  success: boolean;
}

export interface HealResult {
  healed: boolean;
  attempts: HealAttempt[];
  totalAttempts: number;
}

const MAX_ATTEMPTS = 3;

/**
 * Parse a Next.js/TypeScript build error to extract the file and error details
 */
function parseBuildError(stderr: string): { file: string; error: string; line?: number } | null {
  // Next.js build error: ./app/path/file.tsx:line:col
  const nextjsMatch = stderr.match(/\.\/([^\s:]+):(\d+):\d+[\s\S]*?(Type error|Error|SyntaxError):?\s*(.+)/);
  if (nextjsMatch) {
    return {
      file: nextjsMatch[1],
      line: parseInt(nextjsMatch[2]),
      error: `${nextjsMatch[3]}: ${nextjsMatch[4]}`
    };
  }

  // TypeScript error: src/file.ts(line,col): error TS...
  const tsMatch = stderr.match(/([^\s(]+)\((\d+),\d+\):\s*error\s+(TS\d+:.+)/);
  if (tsMatch) {
    return {
      file: tsMatch[1],
      line: parseInt(tsMatch[2]),
      error: tsMatch[3]
    };
  }

  // Module not found
  const moduleMatch = stderr.match(/Module not found.*'([^']+)'/);
  if (moduleMatch) {
    return {
      file: 'package.json',
      error: `Module not found: ${moduleMatch[1]}`
    };
  }

  // Generic file reference
  const genericMatch = stderr.match(/(?:in|at)\s+([^\s:]+\.[jt]sx?):?(\d+)?/);
  if (genericMatch) {
    return {
      file: genericMatch[1],
      line: genericMatch[2] ? parseInt(genericMatch[2]) : undefined,
      error: stderr.slice(0, 500)
    };
  }

  return null;
}

/**
 * Attempt to heal a build failure using AI
 */
async function attemptHeal(
  projectPath: string,
  errorInfo: { file: string; error: string; line?: number },
  previousAttempts: HealAttempt[]
): Promise<{ file: string; fix: string } | null> {
  const filePath = path.join(projectPath, errorInfo.file);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const fileContent = fs.readFileSync(filePath, 'utf-8');

  const previousContext = previousAttempts.length > 0
    ? `\n\nPrevious fix attempts that did NOT work:\n${previousAttempts.map(a => `Attempt ${a.attempt}: ${a.fix.slice(0, 200)}`).join('\n')}\nDo NOT repeat these fixes.`
    : '';

  const prompt = `You are fixing a Next.js build error. Return ONLY the complete corrected file content, no explanation.

FILE: ${errorInfo.file}
ERROR: ${errorInfo.error}
${errorInfo.line ? `LINE: ${errorInfo.line}` : ''}
${previousContext}

CURRENT FILE CONTENT:
\`\`\`
${fileContent}
\`\`\`

Return the COMPLETE fixed file. No markdown, no explanation, just the code.`;

  try {
    const response = await createCompletion(
      'You are a Next.js/TypeScript expert. Fix build errors. Return ONLY code, no markdown fences, no explanation.',
      prompt
    );

    let fixedContent = response.trim();

    // Strip markdown code fences if present
    fixedContent = fixedContent.replace(/^```(?:typescript|tsx?|javascript|jsx?)?\n?/m, '');
    fixedContent = fixedContent.replace(/\n?```\s*$/m, '');

    if (fixedContent && fixedContent !== fileContent) {
      return { file: errorInfo.file, fix: fixedContent };
    }
  } catch (e) {
    console.error('  Self-heal AI call failed:', (e as Error).message);
  }

  return null;
}

/**
 * Run build and capture output
 */
function runBuild(projectPath: string): { success: boolean; stderr: string } {
  try {
    execSync('npx next build', {
      cwd: projectPath,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 120000,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }
    });
    return { success: true, stderr: '' };
  } catch (e: any) {
    const stderr = (e.stderr?.toString() || '') + (e.stdout?.toString() || '');
    return { success: false, stderr };
  }
}

/**
 * Main self-heal function.
 * Call after a build failure with the project path and initial error.
 */
export async function selfHeal(projectPath: string, initialStderr: string): Promise<HealResult> {
  const result: HealResult = {
    healed: false,
    attempts: [],
    totalAttempts: 0
  };

  let currentStderr = initialStderr;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    result.totalAttempts = attempt;
    console.log(`\n  🔧 Self-heal attempt ${attempt}/${MAX_ATTEMPTS}...`);

    const errorInfo = parseBuildError(currentStderr);
    if (!errorInfo) {
      console.log('  Could not parse build error. Self-heal cannot proceed.');
      break;
    }

    console.log(`  📍 Error in: ${errorInfo.file}`);
    console.log(`  💥 ${errorInfo.error.slice(0, 100)}`);

    const healResult = await attemptHeal(projectPath, errorInfo, result.attempts);
    if (!healResult) {
      console.log('  Could not generate a fix.');
      result.attempts.push({
        attempt,
        error: errorInfo.error,
        file: errorInfo.file,
        fix: 'no fix generated',
        success: false
      });
      break;
    }

    // Apply the fix
    const filePath = path.join(projectPath, healResult.file);
    const backup = fs.readFileSync(filePath, 'utf-8');
    fs.writeFileSync(filePath, healResult.fix);
    console.log(`  ✏️  Applied fix to ${healResult.file}`);

    // Retry build
    console.log('  🔨 Retrying build...');
    const buildResult = runBuild(projectPath);

    const attemptRecord: HealAttempt = {
      attempt,
      error: errorInfo.error,
      file: healResult.file,
      fix: `Modified ${healResult.file}`,
      success: buildResult.success
    };
    result.attempts.push(attemptRecord);

    if (buildResult.success) {
      console.log('  ✅ Build succeeded after self-heal!');
      result.healed = true;
      logHealPattern(projectPath, errorInfo);
      break;
    } else {
      console.log('  ❌ Build still failing, trying again...');
      currentStderr = buildResult.stderr;
      if (attempt === MAX_ATTEMPTS) {
        fs.writeFileSync(filePath, backup);
        console.log('  ↩️  Restored original file after all attempts failed.');
      }
    }
  }

  return result;
}

/**
 * Log successful heal patterns for future learning
 */
function logHealPattern(
  projectPath: string,
  errorInfo: { file: string; error: string }
): void {
  const logDir = path.join(projectPath, '.helix-heal-log');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const logEntry = {
    timestamp: new Date().toISOString(),
    error: errorInfo.error,
    file: errorInfo.file,
    fixApplied: true
  };

  const logFile = path.join(logDir, 'heal-history.json');
  let history: any[] = [];
  if (fs.existsSync(logFile)) {
    try { history = JSON.parse(fs.readFileSync(logFile, 'utf-8')); } catch {}
  }
  history.push(logEntry);
  fs.writeFileSync(logFile, JSON.stringify(history, null, 2));
}

/**
 * Verify build works, self-heal if it doesn't.
 * Returns true if build passes (with or without healing).
 */
export async function verifyBuild(projectPath: string): Promise<boolean> {
  console.log('\n  🔨 Verifying build...');
  const buildResult = runBuild(projectPath);

  if (buildResult.success) {
    console.log('  ✅ Build verified');
    return true;
  }

  console.log('  ⚠️  Build failed. Attempting self-heal...');
  const healResult = await selfHeal(projectPath, buildResult.stderr);

  if (healResult.healed) {
    console.log(`  ✅ Self-healed after ${healResult.totalAttempts} attempt(s)`);
    return true;
  }

  console.log(`  ❌ Self-heal failed after ${healResult.totalAttempts} attempt(s)`);
  console.log('  The app was generated but may have build issues.');
  console.log('  Run "npm run dev" to see errors in development mode.');
  return false;
}
