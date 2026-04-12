import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';

export interface PerformanceIssue {
    type: 'n+1-query' | 'missing-index' | 'large-component' | 'unused-import' | 'inefficient-render';
    file: string;
    line: number;
    description: string;
    suggestion: string;
    severity: 'low' | 'medium' | 'high';
    autoFixable: boolean;
    fixData?: Record<string, string>;
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

export async function analyzePerformance(projectPath: string): Promise<PerformanceIssue[]> {
    console.log(chalk.cyan('\n  Analyzing performance...\n'));

    const issues: PerformanceIssue[] = [];

    // Find all TypeScript/JavaScript files
    const codeFiles = await findFiles(projectPath, /\.(ts|tsx|js|jsx)$/);

    // Find Prisma schema files
    const prismaFiles = await findFiles(projectPath, /schema\.prisma$/);

    for (const filePath of codeFiles) {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        const relativePath = path.relative(projectPath, filePath);

        // Detect N+1 queries (findMany inside loops)
        issues.push(...detectNPlusOneQueries(relativePath, lines));

        // Detect large components
        issues.push(...detectLargeComponents(relativePath, lines, content));

        // Detect unused imports
        issues.push(...detectUnusedImports(relativePath, lines, content));

        // Detect inefficient React renders
        issues.push(...detectInefficientRenders(relativePath, lines));
    }

    // Detect missing indexes in Prisma schemas
    for (const prismaFile of prismaFiles) {
        const content = await fs.readFile(prismaFile, 'utf-8');
        const relativePath = path.relative(projectPath, prismaFile);

        // Gather all where-clause fields from code files
        const whereFields = await gatherWhereClauseFields(codeFiles);
        issues.push(...detectMissingIndexes(relativePath, content, whereFields));
    }

    // Report findings
    if (issues.length > 0) {
        console.log(chalk.yellow(`\n  Found ${issues.length} performance issues:\n`));

        issues.forEach((issue, index) => {
            const severityColor = issue.severity === 'high' ? chalk.red :
                issue.severity === 'medium' ? chalk.yellow :
                    chalk.gray;

            const fixLabel = issue.autoFixable ? chalk.green(' [auto-fixable]') : chalk.gray(' [manual]');
            console.log(severityColor(`${index + 1}. [${issue.severity.toUpperCase()}] ${issue.type}${fixLabel}`));
            console.log(chalk.gray(`   ${issue.file}:${issue.line}`));
            console.log(chalk.white(`   ${issue.description}`));
            console.log(chalk.cyan(`   Suggestion: ${issue.suggestion}\n`));
        });
    } else {
        console.log(chalk.green('  No performance issues found.\n'));
    }

    return issues;
}

function detectNPlusOneQueries(file: string, lines: string[]): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];

    lines.forEach((line, index) => {
        // Detect loops with database queries inside them
        if (line.includes('for') || line.includes('.map(') || line.includes('.forEach(')) {
            const nextFewLines = lines.slice(index, Math.min(index + 10, lines.length)).join('\n');

            // Check for prisma findMany/findUnique/findFirst inside the loop
            const prismaMatch = nextFewLines.match(/prisma\.(\w+)\.(findMany|findUnique|findFirst)/);
            if (prismaMatch) {
                const model = prismaMatch[1];
                const method = prismaMatch[2];

                issues.push({
                    type: 'n+1-query',
                    file,
                    line: index + 1,
                    description: `N+1 query: prisma.${model}.${method} called inside a loop`,
                    suggestion: `Use prisma.${model}.findMany with a where/in clause outside the loop, or add include to the parent query`,
                    severity: 'high',
                    autoFixable: true,
                    fixData: { model, method },
                });
            }

            // Also catch generic db calls
            if (!prismaMatch && nextFewLines.includes('await db.')) {
                issues.push({
                    type: 'n+1-query',
                    file,
                    line: index + 1,
                    description: 'Potential N+1 query: Database call inside loop',
                    suggestion: 'Batch queries using findMany with where/in clause outside the loop',
                    severity: 'high',
                    autoFixable: false,
                });
            }
        }

        // Detect findMany/findUnique without include when relations are accessed
        if ((line.includes('findMany') || line.includes('findUnique')) &&
            !line.includes('include')) {
            const nextFewLines = lines.slice(index, Math.min(index + 10, lines.length)).join('\n');

            // Check if relation access pattern exists (e.g., user.posts, item.category)
            const relationMatch = nextFewLines.match(/\.(\w+)\.(\w+)/);
            if (relationMatch) {
                const relationName = relationMatch[1];
                issues.push({
                    type: 'n+1-query',
                    file,
                    line: index + 1,
                    description: 'Query may trigger additional queries for relations',
                    suggestion: `Add include: { ${relationName}: true } to prevent N+1 queries`,
                    severity: 'medium',
                    autoFixable: true,
                    fixData: { relationName },
                });
            }
        }
    });

    return issues;
}

async function gatherWhereClauseFields(codeFiles: string[]): Promise<Map<string, Set<string>>> {
    const modelFields = new Map<string, Set<string>>();

    for (const filePath of codeFiles) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');

            // Match prisma.model.findMany({ where: { field: ... } })
            const whereRegex = /prisma\.(\w+)\.(?:findMany|findFirst|findUnique|count|deleteMany|updateMany)\(\s*\{[^}]*where\s*:\s*\{([^}]+)\}/g;
            let match: RegExpExecArray | null;

            while ((match = whereRegex.exec(content)) !== null) {
                const model = match[1];
                const whereClause = match[2];

                if (!modelFields.has(model)) {
                    modelFields.set(model, new Set());
                }

                // Extract field names from the where clause
                const fieldRegex = /(\w+)\s*:/g;
                let fieldMatch: RegExpExecArray | null;
                while ((fieldMatch = fieldRegex.exec(whereClause)) !== null) {
                    const field = fieldMatch[1];
                    // Skip Prisma operators
                    if (!['contains', 'startsWith', 'endsWith', 'equals', 'not', 'in', 'notIn', 'lt', 'lte', 'gt', 'gte', 'mode'].includes(field)) {
                        modelFields.get(model)!.add(field);
                    }
                }
            }
        } catch (error) {
            // Skip unreadable files
        }
    }

    return modelFields;
}

function detectMissingIndexes(file: string, schemaContent: string, whereFields: Map<string, Set<string>>): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];

    // Parse models from Prisma schema
    const modelRegex = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
    let modelMatch: RegExpExecArray | null;

    while ((modelMatch = modelRegex.exec(schemaContent)) !== null) {
        const modelName = modelMatch[1];
        const modelBody = modelMatch[2];
        const modelStartLine = schemaContent.substring(0, modelMatch.index).split('\n').length;

        // Find existing indexes
        const existingIndexes = new Set<string>();

        // Check for @id
        const idMatch = modelBody.match(/(\w+)\s+.*@id/);
        if (idMatch) {
            existingIndexes.add(idMatch[1]);
        }

        // Check for @unique
        const uniqueRegex = /(\w+)\s+.*@unique/g;
        let uniqueMatch: RegExpExecArray | null;
        while ((uniqueMatch = uniqueRegex.exec(modelBody)) !== null) {
            existingIndexes.add(uniqueMatch[1]);
        }

        // Check for @@index
        const indexRegex = /@@index\(\[([^\]]+)\]\)/g;
        let indexMatch: RegExpExecArray | null;
        while ((indexMatch = indexRegex.exec(modelBody)) !== null) {
            const indexFields = indexMatch[1].split(',').map(f => f.trim());
            indexFields.forEach(f => existingIndexes.add(f));
        }

        // Convert model name to lowercase for matching (Prisma convention)
        const modelNameLower = modelName.charAt(0).toLowerCase() + modelName.slice(1);
        const queriedFields = whereFields.get(modelNameLower) || whereFields.get(modelName);

        if (queriedFields) {
            for (const field of queriedFields) {
                if (!existingIndexes.has(field) && field !== 'id') {
                    // Find the line number for this field in the model
                    const fieldRegex = new RegExp(`^\\s+${field}\\s+`, 'm');
                    const fieldMatch = modelBody.match(fieldRegex);
                    const lineOffset = fieldMatch
                        ? modelBody.substring(0, modelBody.indexOf(fieldMatch[0])).split('\n').length
                        : 1;

                    issues.push({
                        type: 'missing-index',
                        file,
                        line: modelStartLine + lineOffset,
                        description: `Field "${field}" on model "${modelName}" is used in where clauses but has no index`,
                        suggestion: `Add @@index([${field}]) to the ${modelName} model`,
                        severity: 'medium',
                        autoFixable: true,
                        fixData: { modelName, field },
                    });
                }
            }
        }
    }

    return issues;
}

function detectLargeComponents(file: string, lines: string[], content: string): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];

    if (!file.endsWith('.tsx') && !file.endsWith('.jsx')) {
        return issues;
    }

    // Find React component definitions and measure their size
    const componentPatterns = [
        /^(?:export\s+)?(?:default\s+)?function\s+([A-Z]\w*)/,
        /^(?:export\s+)?const\s+([A-Z]\w*)\s*[=:]/,
    ];

    lines.forEach((line, index) => {
        for (const pattern of componentPatterns) {
            const match = line.match(pattern);
            if (match) {
                const componentName = match[1];

                // Estimate component size by counting lines until the next component or end
                let braceDepth = 0;
                let componentEnd = lines.length;
                let started = false;

                for (let i = index; i < lines.length; i++) {
                    for (const ch of lines[i]) {
                        if (ch === '{') {
                            braceDepth++;
                            started = true;
                        }
                        if (ch === '}') braceDepth--;
                    }
                    if (started && braceDepth <= 0) {
                        componentEnd = i;
                        break;
                    }
                }

                const componentSize = componentEnd - index + 1;

                if (componentSize > 200) {
                    issues.push({
                        type: 'large-component',
                        file,
                        line: index + 1,
                        description: `Component "${componentName}" is ${componentSize} lines long (threshold: 200)`,
                        suggestion: `Split "${componentName}" into smaller sub-components for better readability and performance`,
                        severity: 'medium',
                        autoFixable: false, // Suggest only, don't auto-split
                    });
                }

                break; // Only match first pattern per line
            }
        }
    });

    return issues;
}

function detectUnusedImports(file: string, lines: string[], content: string): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];

    // Only check TS/JS files
    if (!file.match(/\.(ts|tsx|js|jsx)$/)) {
        return issues;
    }

    lines.forEach((line, index) => {
        // Match named imports: import { Foo, Bar } from '...'
        const namedImportMatch = line.match(/^import\s*\{([^}]+)\}\s*from\s/);
        if (namedImportMatch) {
            const importNames = namedImportMatch[1].split(',').map(s => {
                // Handle aliased imports: Foo as Bar
                const parts = s.trim().split(/\s+as\s+/);
                return { original: parts[0].trim(), alias: (parts[1] || parts[0]).trim() };
            });

            // Get the rest of the file content after this import line
            const restOfFile = lines.slice(index + 1).join('\n');

            for (const { original, alias } of importNames) {
                if (!alias) continue;

                // Check if the imported name is used anywhere after the import
                // Use word boundary to avoid false matches (e.g., "useState" matching "useStateManager")
                const usageRegex = new RegExp(`\\b${escapeRegex(alias)}\\b`);
                if (!usageRegex.test(restOfFile)) {
                    issues.push({
                        type: 'unused-import',
                        file,
                        line: index + 1,
                        description: `Unused import: "${alias}" is imported but never used`,
                        suggestion: `Remove unused import "${alias}"`,
                        severity: 'low',
                        autoFixable: true,
                        fixData: { importName: alias, originalName: original },
                    });
                }
            }
        }

        // Match default imports: import Foo from '...'
        const defaultImportMatch = line.match(/^import\s+([A-Za-z_$][\w$]*)\s+from\s/);
        if (defaultImportMatch) {
            const importName = defaultImportMatch[1];
            const restOfFile = lines.slice(index + 1).join('\n');
            const usageRegex = new RegExp(`\\b${escapeRegex(importName)}\\b`);

            if (!usageRegex.test(restOfFile)) {
                issues.push({
                    type: 'unused-import',
                    file,
                    line: index + 1,
                    description: `Unused import: "${importName}" is imported but never used`,
                    suggestion: `Remove unused import "${importName}"`,
                    severity: 'low',
                    autoFixable: true,
                    fixData: { importName },
                });
            }
        }
    });

    return issues;
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function detectInefficientRenders(file: string, lines: string[]): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];

    if (!file.endsWith('.tsx') && !file.endsWith('.jsx')) {
        return issues;
    }

    lines.forEach((line, index) => {
        // Detect inline function definitions in JSX
        if (line.includes('onClick={() =>') || line.includes('onChange={() =>')) {
            issues.push({
                type: 'inefficient-render',
                file,
                line: index + 1,
                description: 'Inline function in JSX causes re-renders',
                suggestion: 'Use useCallback or define function outside render',
                severity: 'low',
                autoFixable: false,
            });
        }

        // Detect missing React.memo on components that accept props
        if (line.includes('export default function') || line.includes('export const')) {
            const componentContent = lines.slice(index, Math.min(index + 50, lines.length)).join('\n');

            if (componentContent.includes('props') && !componentContent.includes('memo')) {
                issues.push({
                    type: 'inefficient-render',
                    file,
                    line: index + 1,
                    description: 'Component with props may benefit from React.memo',
                    suggestion: 'Wrap component with React.memo to prevent unnecessary re-renders',
                    severity: 'low',
                    autoFixable: false,
                });
            }
        }
    });

    return issues;
}

// =============================================================================
// AUTO-FIXER
// =============================================================================

export async function autoFixPerformanceIssues(
    projectPath: string,
    issues: PerformanceIssue[]
): Promise<void> {
    console.log(chalk.cyan('\n  Auto-fixing performance issues...\n'));

    const fixableIssues = issues.filter(i => i.autoFixable);
    if (fixableIssues.length === 0) {
        console.log(chalk.yellow('  No auto-fixable issues found.\n'));
        return;
    }

    // Group issues by file
    const issuesByFile = fixableIssues.reduce((acc, issue) => {
        if (!acc[issue.file]) acc[issue.file] = [];
        acc[issue.file].push(issue);
        return acc;
    }, {} as Record<string, PerformanceIssue[]>);

    let fixedCount = 0;

    for (const [file, fileIssues] of Object.entries(issuesByFile)) {
        const filePath = path.join(projectPath, file);

        try {
            let content = await fs.readFile(filePath, 'utf-8');
            let lines = content.split('\n');
            let modified = false;

            // Sort issues by line number descending so we can fix from bottom up
            // without shifting line numbers
            const sortedIssues = [...fileIssues].sort((a, b) => b.line - a.line);

            for (const issue of sortedIssues) {
                switch (issue.type) {
                    case 'n+1-query': {
                        // Fix: Add include to Prisma queries
                        if (issue.fixData?.relationName) {
                            const lineIdx = issue.line - 1;
                            const currentLine = lines[lineIdx];

                            if (currentLine && (currentLine.includes('findMany') || currentLine.includes('findUnique'))) {
                                // Check if there's already an object argument
                                if (currentLine.includes('({')) {
                                    // Add include to existing args
                                    const insertLine = `    include: { ${issue.fixData.relationName}: true },`;
                                    // Find the opening brace and insert after it
                                    const braceIdx = currentLine.indexOf('({');
                                    if (braceIdx !== -1) {
                                        lines.splice(lineIdx + 1, 0, insertLine);
                                        modified = true;
                                        fixedCount++;
                                        console.log(chalk.green(`  Fixed: Added include for "${issue.fixData.relationName}" in ${file}:${issue.line}`));
                                    }
                                } else if (currentLine.includes('()')) {
                                    // No args yet, add them
                                    lines[lineIdx] = currentLine.replace(
                                        /\(\)/,
                                        `({ include: { ${issue.fixData.relationName}: true } })`
                                    );
                                    modified = true;
                                    fixedCount++;
                                    console.log(chalk.green(`  Fixed: Added include for "${issue.fixData.relationName}" in ${file}:${issue.line}`));
                                }
                            }
                        }
                        break;
                    }

                    case 'missing-index': {
                        // Fix: Add @@index to Prisma schema
                        if (issue.fixData?.modelName && issue.fixData?.field) {
                            const modelName = issue.fixData.modelName;
                            const field = issue.fixData.field;

                            // Find the closing brace of the model
                            const modelRegex = new RegExp(`model\\s+${modelName}\\s*\\{`);
                            const modelMatch = content.match(modelRegex);

                            if (modelMatch && modelMatch.index !== undefined) {
                                const modelStart = modelMatch.index;
                                // Find the closing brace
                                let braceDepth = 0;
                                let closingBraceIdx = -1;
                                for (let i = modelStart; i < content.length; i++) {
                                    if (content[i] === '{') braceDepth++;
                                    if (content[i] === '}') {
                                        braceDepth--;
                                        if (braceDepth === 0) {
                                            closingBraceIdx = i;
                                            break;
                                        }
                                    }
                                }

                                if (closingBraceIdx !== -1) {
                                    // Check if this index already exists
                                    const modelContent = content.substring(modelStart, closingBraceIdx);
                                    if (!modelContent.includes(`@@index([${field}])`)) {
                                        // Insert @@index before the closing brace
                                        const indexLine = `  @@index([${field}])\n`;
                                        content = content.substring(0, closingBraceIdx) + indexLine + content.substring(closingBraceIdx);
                                        lines = content.split('\n');
                                        modified = true;
                                        fixedCount++;
                                        console.log(chalk.green(`  Fixed: Added @@index([${field}]) to ${modelName} in ${file}`));
                                    }
                                }
                            }
                        }
                        break;
                    }

                    case 'unused-import': {
                        // Fix: Remove unused imports
                        if (issue.fixData?.importName) {
                            const lineIdx = issue.line - 1;
                            const currentLine = lines[lineIdx];

                            if (currentLine) {
                                const importName = issue.fixData.importName;
                                const originalName = issue.fixData.originalName || importName;

                                // Check if it's a named import
                                const namedImportMatch = currentLine.match(/^import\s*\{([^}]+)\}\s*from\s/);
                                if (namedImportMatch) {
                                    const imports = namedImportMatch[1].split(',').map(s => s.trim());

                                    if (imports.length === 1) {
                                        // Only import - remove the entire line
                                        lines.splice(lineIdx, 1);
                                        modified = true;
                                        fixedCount++;
                                        console.log(chalk.green(`  Fixed: Removed unused import "${importName}" from ${file}:${issue.line}`));
                                    } else {
                                        // Multiple imports - remove just this one
                                        const aliasPattern = originalName !== importName
                                            ? `${originalName}\\s+as\\s+${importName}`
                                            : importName;

                                        // Remove the import with possible trailing/leading comma
                                        let newImports = namedImportMatch[1];
                                        const patterns = [
                                            new RegExp(`\\s*${escapeRegex(aliasPattern)}\\s*,`),
                                            new RegExp(`,\\s*${escapeRegex(aliasPattern)}\\s*`),
                                            new RegExp(`\\s*${escapeRegex(aliasPattern)}\\s*`),
                                        ];

                                        for (const p of patterns) {
                                            if (p.test(newImports)) {
                                                newImports = newImports.replace(p, '');
                                                break;
                                            }
                                        }

                                        lines[lineIdx] = currentLine.replace(namedImportMatch[1], ` ${newImports.trim()} `);
                                        modified = true;
                                        fixedCount++;
                                        console.log(chalk.green(`  Fixed: Removed unused import "${importName}" from ${file}:${issue.line}`));
                                    }
                                }

                                // Check if it's a default import
                                const defaultImportMatch = currentLine.match(/^import\s+([A-Za-z_$][\w$]*)\s+from\s/);
                                if (defaultImportMatch && defaultImportMatch[1] === importName) {
                                    lines.splice(lineIdx, 1);
                                    modified = true;
                                    fixedCount++;
                                    console.log(chalk.green(`  Fixed: Removed unused import "${importName}" from ${file}:${issue.line}`));
                                }
                            }
                        }
                        break;
                    }

                    case 'large-component': {
                        // Suggest only - don't auto-split
                        console.log(chalk.yellow(`  Manual fix needed: ${issue.description}`));
                        console.log(chalk.gray(`    Suggestion: ${issue.suggestion}`));
                        break;
                    }

                    case 'inefficient-render': {
                        // Suggest only
                        console.log(chalk.yellow(`  Manual fix recommended for ${file}:${issue.line}`));
                        console.log(chalk.gray(`    ${issue.suggestion}`));
                        break;
                    }
                }
            }

            if (modified) {
                await fs.writeFile(filePath, lines.join('\n'), 'utf-8');
                console.log(chalk.green(`  Saved: ${file}`));
            }
        } catch (error) {
            console.log(chalk.red(`  Error processing ${file}: ${(error as Error).message}`));
        }
    }

    console.log(chalk.cyan(`\n  Auto-fixed ${fixedCount} issues.`));

    // Report manual fixes needed
    const manualIssues = issues.filter(i => !i.autoFixable);
    if (manualIssues.length > 0) {
        console.log(chalk.yellow(`  ${manualIssues.length} issues require manual attention.\n`));
    }
}
