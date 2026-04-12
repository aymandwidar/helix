import { Deployer, DeployResult } from '../index';
import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';

export class RailwayDeployer extends Deployer {
    private projectId?: string;

    async initialize(): Promise<void> {
        console.log(chalk.cyan('🚂 Initializing Railway deployment...'));

        // Check for Railway CLI
        try {
            await this.runCommand('railway --version');
        } catch {
            console.log(chalk.yellow('⚠️  Railway CLI not found'));
            console.log(chalk.gray('Install: npm install -g @railway/cli'));
            throw new Error('Railway CLI not installed');
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

        // Check if logged in
        try {
            await this.runCommand('railway whoami');
        } catch {
            console.log(chalk.red('❌ Not logged in to Railway'));
            console.log(chalk.yellow('Run: railway login'));
            return false;
        }

        // linkproject if not linked
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

        try {
            const output = await this.runCommand('railway up --detach');

            // Get deployment URL
            const urlOutput = await this.runCommand('railway domain');
            const url = urlOutput.trim();

            // Get deployment ID from status
            const statusOutput = await this.runCommand('railway status');
            const deploymentId = new Date().getTime().toString();

            return {
                url: url || 'https://railway.app',
                platform: 'railway',
                env: this.env,
                deploymentId,
            };
        } catch (error: any) {
            console.error(chalk.red('❌ Railway deployment failed'));
            throw error;
        }
    }

    async rollback(deploymentId?: string): Promise<void> {
        console.log(chalk.yellow('⏮️  Railway rollback not directly supported'));
        console.log(chalk.gray('Use Railway dashboard to rollback: https://railway.app'));
    }
}
