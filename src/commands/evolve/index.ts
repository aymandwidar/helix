import chalk from 'chalk';
import { analyzePerformance, autoFixPerformanceIssues } from './analyzers/performance';
import { analyzeSecurity, printSecurityReport } from './analyzers/security';
import { migrate } from '../migrate';

export async function evolveCodebase(
    action: string = 'scan',
    category?: string,
    projectPath: string = process.cwd()
): Promise<void> {
    console.log(chalk.cyan('\n  Helix Evolve\n'));

    switch (action) {
        case 'scan':
            await scanCodebase(projectPath);
            break;

        case 'suggest':
            await suggestImprovements(projectPath);
            break;

        case 'apply':
            await applyImprovements(projectPath, category);
            break;

        case 'security-audit':
            await securityAudit(projectPath);
            break;

        case 'migrate':
            await migrate(category || '', projectPath);
            break;

        default:
            console.log(chalk.yellow(`Unknown action: ${action}`));
            console.log(chalk.gray('Available actions: scan, suggest, apply, security-audit, migrate'));
    }
}

async function scanCodebase(projectPath: string): Promise<void> {
    console.log(chalk.cyan('  Scanning codebase for issues...\n'));

    // Performance analysis
    const performanceIssues = await analyzePerformance(projectPath);

    // Security analysis
    const securityReport = await analyzeSecurity(projectPath);

    // Calculate health score
    const totalIssues = performanceIssues.length + securityReport.issues.length;
    const highSeverity = performanceIssues.filter(i => i.severity === 'high').length +
        securityReport.summary.critical + securityReport.summary.high;
    const mediumSeverity = performanceIssues.filter(i => i.severity === 'medium').length +
        securityReport.summary.medium;
    const lowSeverity = totalIssues - highSeverity - mediumSeverity;

    const healthScore = Math.max(0, 100 - (highSeverity * 10 + mediumSeverity * 5 + lowSeverity * 1));

    console.log(chalk.cyan('\n  Code Health Report:\n'));
    console.log(chalk.white(`  Health Score: ${healthScore}/100`));
    console.log(chalk.white(`  Security Score: ${securityReport.score}/100`));
    console.log(chalk.gray(`  Total Issues: ${totalIssues}`));
    console.log(chalk.red(`  High/Critical Severity: ${highSeverity}`));
    console.log(chalk.yellow(`  Medium Severity: ${mediumSeverity}`));
    console.log(chalk.gray(`  Low Severity: ${lowSeverity}\n`));

    const autoFixable = performanceIssues.filter(i => i.autoFixable).length;
    if (autoFixable > 0) {
        console.log(chalk.green(`  ${autoFixable} issues can be auto-fixed with: helix evolve apply\n`));
    }
}

async function suggestImprovements(projectPath: string): Promise<void> {
    console.log(chalk.cyan('  Generating improvement suggestions...\n'));

    const perfIssues = await analyzePerformance(projectPath);
    const securityReport = await analyzeSecurity(projectPath);

    const allIssues = [
        ...perfIssues.map(i => ({
            category: 'performance' as const,
            suggestion: i.suggestion,
            severity: i.severity,
            file: i.file,
            line: i.line,
            autoFixable: i.autoFixable,
        })),
        ...securityReport.issues.map(i => ({
            category: 'security' as const,
            suggestion: i.suggestion,
            severity: i.severity === 'critical' ? 'high' as const : i.severity as 'low' | 'medium' | 'high',
            file: i.file,
            line: i.line,
            autoFixable: false,
        })),
    ];

    // Sort by severity
    const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    allIssues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    const topIssues = allIssues.slice(0, 10);

    console.log(chalk.white(`\n  Top ${topIssues.length} Recommended Fixes:\n`));

    topIssues.forEach((issue, index) => {
        const severityColor = issue.severity === 'high' ? chalk.red :
            issue.severity === 'medium' ? chalk.yellow :
                chalk.gray;

        const fixLabel = issue.autoFixable ? chalk.green(' [auto-fixable]') : '';
        console.log(severityColor(`  ${index + 1}. [${issue.category.toUpperCase()}] ${issue.suggestion}${fixLabel}`));
        console.log(chalk.gray(`     Impact: ${issue.severity} | File: ${issue.file}:${issue.line}\n`));
    });

    const autoFixable = allIssues.filter(i => i.autoFixable).length;
    if (autoFixable > 0) {
        console.log(chalk.green(`  Run "helix evolve apply" to auto-fix ${autoFixable} issues.\n`));
    }
}

async function applyImprovements(projectPath: string, category?: string): Promise<void> {
    console.log(chalk.cyan(`  Applying ${category || 'all'} improvements...\n`));

    if (category === 'performance' || !category) {
        const issues = await analyzePerformance(projectPath);
        await autoFixPerformanceIssues(projectPath, issues);
    }

    if (category === 'security' || !category) {
        const securityReport = await analyzeSecurity(projectPath);
        if (securityReport.issues.length > 0) {
            console.log(chalk.yellow('\n  Security issues require manual fixes:'));
            securityReport.issues.forEach((issue, index) => {
                console.log(chalk.gray(`    ${index + 1}. ${issue.file}:${issue.line} - ${issue.suggestion}`));
            });
            console.log('');
        }
    }

    console.log(chalk.green('\n  Improvements applied!\n'));
}

async function securityAudit(projectPath: string): Promise<void> {
    const report = await analyzeSecurity(projectPath);
    printSecurityReport(report);
}
