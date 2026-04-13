import { Deployer, DeployResult } from '../index';
import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';
import { HelixDeployError } from '../../../errors/index.js';

export class RailwayDeployer extends Deployer {
    private projectId?: string;

    async initialize(): Promise<void> {
        console.log(chalk.cyan('🚂 Initializing Railway deployment...'));

        try {
            await this.runCommand('railway --version');
        } catch {
            throw new HelixDeployError(
                'Railway CLI not installed',
                'Install it with: npm install -g @railway/cli',
                { platform: 'railway' },
            );
        }

        // Check if project is linked
        const railwayJsonPath = path.join(this.projectPath, 'railway.json');
        if (await fs.pathExists(railwayJsonPath)) {
            const railwayJson = await fs.readJSON(railwayJsonPath);
            this.projectId = railwayJson.projectId;
        }

        console.log(chalk.green('✅ Railway initialized'));
    }

    async validateConfig(): Promise<boolean> {
        console.log(chalk.cyan('🔍 Validating Railway configuration...'));

        try {
            await this.runCommand('railway whoami');
        } catch {
            throw new HelixDeployError(
                'Not logged in to Railway',
                'Run: railway login',
                { platform: 'railway' },
            );
        }

        if (!this.projectId) {
            console.log(chalk.yellow('⚠️  Project not linked to Railway'));
            console.log(chalk.gray('Linking project...'));
            await this.runCommand('railway link');

            const railwayJson = await fs.readJSON(path.join(this.projectPath, 'railway.json'));
            this.projectId = railwayJson.projectId;
        }

        console.log(chalk.green('✅ Configuration valid'));
        return true;
    }

    async deploy(): Promise<DeployResult> {
        console.log(chalk.cyan('\n🚂 Deploying to Railway...'));

        // Check if Prisma uses PostgreSQL and offer to provision
        await this.provisionPostgresIfNeeded();

        try {
            await this.runCommand('railway up --detach');

            const urlOutput = await this.runCommand('railway domain');
            const url = urlOutput.trim();

            const deploymentId = new Date().getTime().toString();

            return {
                url: url || 'https://railway.app',
                platform: 'railway',
                env: this.env,
                deploymentId,
            };
        } catch (error: any) {
            throw new HelixDeployError(
                `Railway deployment failed: ${error.message}`,
                'Check railway logs with: railway logs',
                { platform: 'railway' },
            );
        }
    }

    async rollback(deploymentId?: string): Promise<void> {
        console.log(chalk.yellow('⏮️  Railway rollback not directly supported via CLI'));
        console.log(chalk.gray('Use Railway dashboard to rollback: https://railway.app'));
    }

    private async provisionPostgresIfNeeded(): Promise<void> {
        const schemaPath = path.join(this.projectPath, 'prisma', 'schema.prisma');
        if (!await fs.pathExists(schemaPath)) return;

        const schema = await fs.readFile(schemaPath, 'utf-8');
        if (!schema.includes('provider = "postgresql"')) return;

        console.log(chalk.cyan('🐘 PostgreSQL detected — provisioning Railway Postgres addon...'));
        try {
            await this.runCommand('railway add --plugin postgresql');
            console.log(chalk.green('  ✅ PostgreSQL addon provisioned'));
            console.log(chalk.gray('  DATABASE_URL will be automatically set by Railway'));
        } catch {
            console.log(chalk.yellow('  ⚠️  Could not auto-provision PostgreSQL'));
            console.log(chalk.gray('  Add it manually: railway add --plugin postgresql'));
        }
    }
}
