import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';

export interface SecurityIssue {
    type: 'hardcoded-secret' | 'missing-auth' | 'no-rate-limiting' | 'no-input-validation';
    file: string;
    line: number;
    description: string;
    suggestion: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface SecurityReport {
    score: number;
    issues: SecurityIssue[];
    summary: {
        critical: number;
        high: number;
        medium: number;
        low: number;
    };
}

async function findFiles(dir: string, pattern: RegExp): Promise<string[]> {
    const results: string[] = [];

    try {
        const files = await fs.readdir(dir, { withFileTypes: true });

        for (const file of files) {
            const filePath = path.join(dir, file.name);
            if (file.isDirectory() && !['node_modules', '.next', 'dist', '.git'].includes(file.name)) {
                results.push(...await findFiles(filePath, pattern));
            } else if (file.isFile() && pattern.test(file.name)) {
                results.push(filePath);
            }
        }
    } catch (error) {
        // Skip inaccessible directories
    }

    return results;
}

export async function analyzeSecurity(projectPath: string): Promise<SecurityReport> {
    console.log(chalk.cyan('  Running security analysis...\n'));

    const issues: SecurityIssue[] = [];

    const codeFiles = await findFiles(projectPath, /\.(ts|tsx|js|jsx|env|json)$/);

    for (const filePath of codeFiles) {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        const relativePath = path.relative(projectPath, filePath);

        // Skip node_modules and common false-positive files
        if (relativePath.includes('node_modules') || relativePath.includes('.next')) {
            continue;
        }

        issues.push(...detectHardcodedSecrets(relativePath, lines));
        issues.push(...detectMissingAuth(relativePath, lines, content));
        issues.push(...detectNoRateLimiting(relativePath, lines, content));
        issues.push(...detectNoInputValidation(relativePath, lines, content));
    }

    const summary = {
        critical: issues.filter(i => i.severity === 'critical').length,
        high: issues.filter(i => i.severity === 'high').length,
        medium: issues.filter(i => i.severity === 'medium').length,
        low: issues.filter(i => i.severity === 'low').length,
    };

    // Calculate security score (100 = perfect)
    const score = Math.max(0, 100 - (summary.critical * 25 + summary.high * 15 + summary.medium * 5 + summary.low * 2));

    return { score, issues, summary };
}

function detectHardcodedSecrets(file: string, lines: string[]): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // Skip .env.example files (they contain placeholder values)
    if (file.includes('.env.example') || file.includes('.env.sample')) {
        return issues;
    }

    const secretPatterns: Array<{ pattern: RegExp; name: string }> = [
        { pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"`]([a-zA-Z0-9_\-]{20,})['"`]/i, name: 'API key' },
        { pattern: /(?:secret|password|passwd|pwd)\s*[:=]\s*['"`]([^'"`\s]{8,})['"`]/i, name: 'Secret/Password' },
        { pattern: /(?:token)\s*[:=]\s*['"`]([a-zA-Z0-9_\-\.]{20,})['"`]/i, name: 'Token' },
        { pattern: /(?:aws_access_key_id)\s*[:=]\s*['"`](AKIA[A-Z0-9]{16})['"`]/i, name: 'AWS Access Key' },
        { pattern: /(?:aws_secret_access_key)\s*[:=]\s*['"`]([A-Za-z0-9/+=]{40})['"`]/i, name: 'AWS Secret Key' },
        { pattern: /(?:database_url|db_url)\s*[:=]\s*['"`]((?:postgres|mysql|mongodb):\/\/[^'"`\s]+)['"`]/i, name: 'Database URL' },
        { pattern: /sk[-_](?:live|test)[-_][a-zA-Z0-9]{20,}/i, name: 'Stripe Secret Key' },
        { pattern: /ghp_[a-zA-Z0-9]{36}/i, name: 'GitHub Personal Access Token' },
        { pattern: /(?:private[_-]?key)\s*[:=]\s*['"`]([^'"`\s]{20,})['"`]/i, name: 'Private key' },
    ];

    lines.forEach((line, index) => {
        // Skip comments
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*')) {
            return;
        }

        // Skip lines that reference environment variables (not hardcoded)
        if (line.includes('process.env') || line.includes('env(') || line.includes('${')) {
            return;
        }

        for (const { pattern, name } of secretPatterns) {
            if (pattern.test(line)) {
                issues.push({
                    type: 'hardcoded-secret',
                    file,
                    line: index + 1,
                    description: `Potential hardcoded ${name} found`,
                    suggestion: `Move to environment variable (process.env) and add to .gitignore`,
                    severity: 'critical',
                });
            }
        }
    });

    return issues;
}

function detectMissingAuth(file: string, lines: string[], content: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // Check API route files for missing auth middleware
    const isApiRoute = file.includes('/api/') && (file.endsWith('route.ts') || file.endsWith('route.js'));

    if (!isApiRoute) return issues;

    // Check for common auth patterns
    const hasAuth = content.includes('getServerSession') ||
        content.includes('auth(') ||
        content.includes('authenticate') ||
        content.includes('verifyToken') ||
        content.includes('jwt.verify') ||
        content.includes('getToken') ||
        content.includes('withAuth') ||
        content.includes('requireAuth') ||
        content.includes('isAuthenticated') ||
        content.includes('session') ||
        content.includes('authorization');

    if (!hasAuth) {
        // Find the first export line (handler function)
        lines.forEach((line, index) => {
            if (line.match(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)/)) {
                issues.push({
                    type: 'missing-auth',
                    file,
                    line: index + 1,
                    description: `API route handler "${line.trim()}" has no authentication check`,
                    suggestion: 'Add authentication middleware (e.g., getServerSession, jwt.verify) before processing requests',
                    severity: 'high',
                });
            }
        });
    }

    return issues;
}

function detectNoRateLimiting(file: string, lines: string[], content: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // Check API route files for rate limiting
    const isApiRoute = file.includes('/api/') && (file.endsWith('route.ts') || file.endsWith('route.js'));

    if (!isApiRoute) return issues;

    const hasRateLimiting = content.includes('rateLimit') ||
        content.includes('rate-limit') ||
        content.includes('rateLimiter') ||
        content.includes('throttle') ||
        content.includes('limiter') ||
        content.includes('RateLimiter');

    if (!hasRateLimiting) {
        // Report on the POST handler if it exists, otherwise the first handler
        let reported = false;
        lines.forEach((line, index) => {
            if (!reported && line.match(/export\s+(?:async\s+)?function\s+POST/)) {
                issues.push({
                    type: 'no-rate-limiting',
                    file,
                    line: index + 1,
                    description: 'POST endpoint has no rate limiting',
                    suggestion: 'Add rate limiting middleware to prevent abuse (e.g., upstash/ratelimit, express-rate-limit)',
                    severity: 'medium',
                });
                reported = true;
            }
        });

        if (!reported) {
            lines.forEach((line, index) => {
                if (!reported && line.match(/export\s+(?:async\s+)?function\s+(GET|PUT|DELETE|PATCH)/)) {
                    issues.push({
                        type: 'no-rate-limiting',
                        file,
                        line: index + 1,
                        description: 'API endpoint has no rate limiting',
                        suggestion: 'Add rate limiting middleware to prevent abuse (e.g., upstash/ratelimit, express-rate-limit)',
                        severity: 'low',
                    });
                    reported = true;
                }
            });
        }
    }

    return issues;
}

function detectNoInputValidation(file: string, lines: string[], content: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // Check API route files for input validation
    const isApiRoute = file.includes('/api/') && (file.endsWith('route.ts') || file.endsWith('route.js'));

    if (!isApiRoute) return issues;

    const hasValidation = content.includes('zod') ||
        content.includes('yup') ||
        content.includes('joi') ||
        content.includes('.parse(') ||
        content.includes('.validate(') ||
        content.includes('ajv') ||
        content.includes('class-validator') ||
        content.includes('superstruct');

    // Check if the route handles POST/PUT/PATCH (mutation endpoints that accept body)
    const hasMutationHandler = content.match(/export\s+(?:async\s+)?function\s+(POST|PUT|PATCH)/);
    const readsBody = content.includes('request.json()') ||
        content.includes('req.body') ||
        content.includes('req.json()');

    if (!hasValidation && hasMutationHandler && readsBody) {
        lines.forEach((line, index) => {
            if (line.includes('request.json()') || line.includes('req.body') || line.includes('req.json()')) {
                issues.push({
                    type: 'no-input-validation',
                    file,
                    line: index + 1,
                    description: 'Request body is used without input validation',
                    suggestion: 'Validate input with a schema library (e.g., zod: z.object({...}).parse(body))',
                    severity: 'high',
                });
            }
        });
    }

    return issues;
}

export function printSecurityReport(report: SecurityReport): void {
    const scoreColor = report.score >= 80 ? chalk.green :
        report.score >= 60 ? chalk.yellow :
            report.score >= 40 ? chalk.hex('#FFA500') :
                chalk.red;

    console.log(chalk.cyan('\n  Security Audit Report\n'));
    console.log(chalk.white(`  Security Score: ${scoreColor(`${report.score}/100`)}\n`));

    console.log(chalk.white('  Issue Summary:'));
    if (report.summary.critical > 0) console.log(chalk.red(`    Critical: ${report.summary.critical}`));
    if (report.summary.high > 0) console.log(chalk.red(`    High:     ${report.summary.high}`));
    if (report.summary.medium > 0) console.log(chalk.yellow(`    Medium:   ${report.summary.medium}`));
    if (report.summary.low > 0) console.log(chalk.gray(`    Low:      ${report.summary.low}`));

    if (report.issues.length === 0) {
        console.log(chalk.green('\n  No security issues found. Well done!\n'));
        return;
    }

    console.log(chalk.white('\n  Findings:\n'));

    report.issues.forEach((issue, index) => {
        const severityColor = issue.severity === 'critical' ? chalk.red :
            issue.severity === 'high' ? chalk.red :
                issue.severity === 'medium' ? chalk.yellow :
                    chalk.gray;

        console.log(severityColor(`  ${index + 1}. [${issue.severity.toUpperCase()}] ${issue.type}`));
        console.log(chalk.gray(`     ${issue.file}:${issue.line}`));
        console.log(chalk.white(`     ${issue.description}`));
        console.log(chalk.cyan(`     Fix: ${issue.suggestion}\n`));
    });
}
