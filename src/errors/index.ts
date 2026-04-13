/**
 * Helix Error Types — Structured errors with context and suggestions
 */

import chalk from 'chalk';

export class HelixError extends Error {
  code: string;
  suggestion?: string;
  context?: Record<string, string>;

  constructor(message: string, code: string, suggestion?: string, context?: Record<string, string>) {
    super(message);
    this.name = 'HelixError';
    this.code = code;
    this.suggestion = suggestion;
    this.context = context;
  }
}

export class HelixBuildError extends HelixError {
  constructor(message: string, suggestion?: string, context?: Record<string, string>) {
    super(message, 'BUILD_ERROR', suggestion, context);
    this.name = 'HelixBuildError';
  }
}

export class HelixDeployError extends HelixError {
  constructor(message: string, suggestion?: string, context?: Record<string, string>) {
    super(message, 'DEPLOY_ERROR', suggestion, context);
    this.name = 'HelixDeployError';
  }
}

export class HelixAPIError extends HelixError {
  statusCode?: number;

  constructor(message: string, statusCode?: number, suggestion?: string) {
    super(message, 'API_ERROR', suggestion, statusCode ? { statusCode: String(statusCode) } : undefined);
    this.name = 'HelixAPIError';
    this.statusCode = statusCode;
  }
}

export class HelixConfigError extends HelixError {
  constructor(message: string, suggestion?: string, context?: Record<string, string>) {
    super(message, 'CONFIG_ERROR', suggestion, context);
    this.name = 'HelixConfigError';
  }
}

/**
 * Format a HelixError into a rich, boxed terminal output.
 */
export function formatError(error: unknown): string {
  if (error instanceof HelixError) {
    const lines: string[] = [];
    lines.push('');
    lines.push(chalk.red(`  ❌ ${error.name} [${error.code}]`));
    lines.push(chalk.white(`     ${error.message}`));

    if (error.context) {
      for (const [key, value] of Object.entries(error.context)) {
        lines.push(chalk.gray(`     ${key}: ${value}`));
      }
    }

    if (error.suggestion) {
      lines.push('');
      lines.push(chalk.yellow(`  💡 ${error.suggestion}`));
    }

    lines.push('');
    return lines.join('\n');
  }

  if (error instanceof Error) {
    return chalk.red(`\n  ❌ ${error.message}\n`);
  }

  return chalk.red(`\n  ❌ ${String(error)}\n`);
}

/**
 * Wrap a command action with error formatting.
 * Use this to wrap async action handlers for consistent error output.
 */
export function withErrorHandling(fn: (...args: any[]) => Promise<void>): (...args: any[]) => Promise<void> {
  return async (...args: any[]) => {
    try {
      await fn(...args);
    } catch (error) {
      console.error(formatError(error));
      process.exit(1);
    }
  };
}
