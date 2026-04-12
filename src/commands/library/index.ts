import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';

export interface ComponentManifest {
    name: string;
    version: string;
    description: string;
    author: string;
    category: 'auth' | 'dashboard' | 'payment' | 'analytics' | 'other';
    dependencies: string[];
    files: {
        schema?: string;
        api: string[];
        components: string[];
    };
}

export interface ComponentSearchResult {
    name: string;
    description: string;
    downloads: number;
    rating: number;
}

const COMPONENT_REGISTRY: ComponentSearchResult[] = [
    { name: 'auth-flow', description: 'Complete authentication flow with login, registration, session middleware, and NextAuth config', downloads: 1250, rating: 4.8 },
    { name: 'dashboard-analytics', description: 'Analytics dashboard with stats cards, line charts, activity feed, and summary grid', downloads: 980, rating: 4.6 },
    { name: 'data-table', description: 'Sortable data table with pagination, search, column toggle, CSV export, and bulk actions', downloads: 1540, rating: 4.7 },
    { name: 'file-upload', description: 'Drag-and-drop file upload with preview, progress tracking, and server-side handling', downloads: 870, rating: 4.5 },
    { name: 'notification-system', description: 'Toast notifications, React context provider, SSE real-time updates, and bell icon badge', downloads: 1120, rating: 4.6 },
    { name: 'stripe-checkout', description: 'Stripe payment integration', downloads: 2100, rating: 4.9 },
];

export async function searchComponents(query: string): Promise<ComponentSearchResult[]> {
    console.log(chalk.cyan(`\n🔍 Searching for: ${query}\n`));

    const results = COMPONENT_REGISTRY.filter(comp =>
        comp.name.includes(query.toLowerCase()) ||
        comp.description.toLowerCase().includes(query.toLowerCase())
    );

    results.forEach(comp => {
        console.log(chalk.white(`📦 ${comp.name}`));
        console.log(chalk.gray(`   ${comp.description}`));
        console.log(chalk.gray(`   ⬇️  ${comp.downloads} downloads | ⭐ ${comp.rating}/5.0\n`));
    });

    return results;
}

export async function installComponent(
    componentName: string,
    options: { theme?: string; projectPath?: string } = {}
): Promise<void> {
    const projectPath = options.projectPath || process.cwd();
    const componentPath = path.join(__dirname, '../../library', componentName);

    console.log(chalk.cyan(`\n📦 Installing component: ${componentName}\n`));

    // Check if component exists
    if (!await fs.pathExists(componentPath)) {
        console.log(chalk.red(`❌ Component not found: ${componentName}`));
        console.log(chalk.yellow(`Available components: ${COMPONENT_REGISTRY.map(c => c.name).join(', ')}`));
        return;
    }

    // Read manifest
    const manifest: ComponentManifest = await fs.readJSON(path.join(componentPath, 'manifest.json'));

    console.log(chalk.gray(`📄 ${manifest.description}`));
    console.log(chalk.gray(`👤 By: ${manifest.author}`));
    console.log(chalk.gray(`🏷️  Category: ${manifest.category}\n`));

    // Copy components
    if (manifest.files.components) {
        for (const component of manifest.files.components) {
            const sourcePath = path.join(componentPath, component);
            const targetPath = path.join(projectPath, 'src', component);

            await fs.ensureDir(path.dirname(targetPath));
            await fs.copy(sourcePath, targetPath);

            console.log(chalk.green(`✅ Copied: ${component}`));
        }
    }

    // Copy API routes
    if (manifest.files.api) {
        for (const apiRoute of manifest.files.api) {
            const sourcePath = path.join(componentPath, apiRoute);
            const targetPath = path.join(projectPath, 'src', apiRoute);

            await fs.ensureDir(path.dirname(targetPath));
            await fs.copy(sourcePath, targetPath);

            console.log(chalk.green(`✅ Copied: ${apiRoute}`));
        }
    }

    // Merge schema if exists
    if (manifest.files.schema) {
        const schemaPath = path.join(componentPath, manifest.files.schema);
        const targetSchemaPath = path.join(projectPath, 'prisma', 'schema.prisma');

        if (await fs.pathExists(schemaPath)) {
            const newSchema = await fs.readFile(schemaPath, 'utf-8');
            let existingSchema = '';

            if (await fs.pathExists(targetSchemaPath)) {
                existingSchema = await fs.readFile(targetSchemaPath, 'utf-8');
            }

            // Simple merge - append new schema
            await fs.writeFile(targetSchemaPath, `${existingSchema}\n\n${newSchema}`);
            console.log(chalk.green(`✅ Merged schema changes`));
        }
    }

    console.log(chalk.green(`\n✅ Component installed successfully!`));
    console.log(chalk.yellow(`\n⚠️  Don't forget to run: npx prisma generate\n`));
}

export async function listInstalledComponents(projectPath: string = process.cwd()): Promise<void> {
    console.log(chalk.cyan('\n📦 Installed Components:\n'));
    console.log(chalk.gray('(Feature coming soon)\n'));
}

export async function publishComponent(componentPath: string): Promise<void> {
    console.log(chalk.cyan('\n📤 Publishing component...\n'));
    console.log(chalk.yellow('⚠️  Component publishing will be available in v11.0\n'));
}
