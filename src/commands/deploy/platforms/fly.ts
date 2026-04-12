import { Deployer, DeployResult } from '../index';
import chalk from 'chalk';

export class FlyDeployer extends Deployer {
    private appName?: string;

    async initialize(): Promise<void> {
        console.log(chalk.cyan('🪰 Initializing Fly.io deployment...'));

        // Check for Fly CLI
        try {
            await this.runCommand('fly version');
        } catch {
            console.log(chalk.red('❌ Fly CLI not found'));
            console.log(chalk.yellow('Install: https://fly.io/docs/hands-on/install-flyctl/'));
            throw new Error('Fly CLI not installed');
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

        console.log(chalk.green('✅ Configuration valid'));
        return true;
    }

    async deploy(): Promise<DeployResult> {
        console.log(chalk.cyan('\n🪰 Deploying to Fly.io...'));

        try {
            const output = await this.runCommand('fly deploy');

            // Get app URL
            const statusOutput = await this.runCommand('fly status');
            const urlMatch = statusOutput.match(/https:\/\/[^\s]+/);
            const url = urlMatch ? urlMatch[0] : '';

            const deploymentId = new Date().getTime().toString();

            return {
                url,
                platform: 'fly',
                env: this.env,
                deploymentId,
            };
        } catch (error: any) {
            console.error(chalk.red('❌ Fly.io deployment failed'));
            throw error;
        }
    }

    async rollback(deploymentId?: string): Promise<void> {
        console.log(chalk.yellow('⏮️  Rolling back Fly.io deployment...'));

        // Fly uses version numbers for rollback
        if (deploymentId) {
            await this.runCommand(`fly releases rollback ${deploymentId}`);
        } else {
            await this.runCommand('fly releases rollback');
        }
    }
}
