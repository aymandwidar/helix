import { Deployer, DeployResult } from '../index';
import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';
import { HelixDeployError } from '../../../errors/index.js';

export class FlyDeployer extends Deployer {
    private appName?: string;

    async initialize(): Promise<void> {
        console.log(chalk.cyan('🪰 Initializing Fly.io deployment...'));

        try {
            await this.runCommand('fly version');
        } catch {
            throw new HelixDeployError(
                'Fly CLI not installed',
                'Install it from: https://fly.io/docs/hands-on/install-flyctl/',
                { platform: 'fly' },
            );
        }

        console.log(chalk.green('✅ Fly.io initialized'));
    }

    async validateConfig(): Promise<boolean> {
        console.log(chalk.cyan('🔍 Validating Fly.io configuration...'));

        // Check if fly.toml exists
        const hasFlyToml = await this.fileExists('fly.toml');
        if (!hasFlyToml) {
            console.log(chalk.yellow('⚠️  fly.toml not found. Initializing...'));
            await this.runCommand('fly launch --no-deploy');
        }

        // Extract app name
        try {
            const flyToml = await fs.readFile(path.join(this.projectPath, 'fly.toml'), 'utf-8');
            const appMatch = flyToml.match(/app\s*=\s*"([^"]+)"/);
            if (appMatch) this.appName = appMatch[1];
        } catch {
            // Non-fatal
        }

        console.log(chalk.green('✅ Configuration valid'));
        return true;
    }

    async deploy(): Promise<DeployResult> {
        console.log(chalk.cyan('\n🪰 Deploying to Fly.io...'));

        // Check if Prisma uses PostgreSQL and offer to provision
        await this.provisionPostgresIfNeeded();

        try {
            await this.runCommand('fly deploy');

            const statusOutput = await this.runCommand('fly status');
            const urlMatch = statusOutput.match(/https:\/\/[^\s]+/);
            const url = urlMatch ? urlMatch[0] : this.appName ? `https://${this.appName}.fly.dev` : '';

            const deploymentId = new Date().getTime().toString();

            return {
                url,
                platform: 'fly',
                env: this.env,
                deploymentId,
            };
        } catch (error: any) {
            throw new HelixDeployError(
                `Fly.io deployment failed: ${error.message}`,
                'Check logs with: fly logs',
                { platform: 'fly' },
            );
        }
    }

    async rollback(deploymentId?: string): Promise<void> {
        console.log(chalk.yellow('⏮️  Rolling back Fly.io deployment...'));
        if (deploymentId) {
            await this.runCommand(`fly releases rollback ${deploymentId}`);
        } else {
            await this.runCommand('fly releases rollback');
        }
    }

    private async provisionPostgresIfNeeded(): Promise<void> {
        const schemaPath = path.join(this.projectPath, 'prisma', 'schema.prisma');
        if (!await fs.pathExists(schemaPath)) return;

        const schema = await fs.readFile(schemaPath, 'utf-8');
        if (!schema.includes('provider = "postgresql"')) return;

        console.log(chalk.cyan('🐘 PostgreSQL detected — creating Fly Postgres cluster...'));
        try {
            const pgName = this.appName ? `${this.appName}-db` : 'helix-db';
            await this.runCommand(`fly postgres create --name ${pgName} --region sjc --vm-size shared-cpu-1x`);
            console.log(chalk.green(`  ✅ Postgres cluster "${pgName}" created`));

            // Attach to app
            if (this.appName) {
                await this.runCommand(`fly postgres attach ${pgName} --app ${this.appName}`);
                console.log(chalk.green('  ✅ Postgres attached — DATABASE_URL set as secret'));
            }
        } catch {
            console.log(chalk.yellow('  ⚠️  Could not auto-provision PostgreSQL'));
            console.log(chalk.gray('  Create manually: fly postgres create --name mydb'));
        }
    }
}
