import { Deployer, DeployResult } from '../index';
import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';

export class VercelDeployer extends Deployer {
    private vercelToken?: string;
    private projectName?: string;

    async initialize(): Promise<void> {
        console.log(chalk.cyan('📦 Initializing Vercel deployment...'));

        // Check for Vercel CLI
        try {
            await this.runCommand('vercel --version');
        } catch {
            console.log(chalk.yellow('⚠️  Vercel CLI not found. Installing...'));
            await this.runCommand('npm install -g vercel');
        }

        // Get Vercel token from env or prompt
        this.vercelToken = process.env.VERCEL_TOKEN;

        if (!this.vercelToken) {
            console.log(chalk.yellow('⚠️  VERCEL_TOKEN not found in environment'));
            console.log(chalk.gray('Run: vercel login'));
        }

        // Get project name from package.json
        const packageJson = await fs.readJSON(path.join(this.projectPath, 'package.json'));
        this.projectName = packageJson.name || path.basename(this.projectPath);

        console.log(chalk.green(`✅ Project: ${this.projectName}`));
    }

    async validateConfig(): Promise<boolean> {
        console.log(chalk.cyan('🔍 Validating configuration...'));

        // Check for required files
        const hasPackageJson = await this.fileExists('package.json');
        if (!hasPackageJson) {
            console.log(chalk.red('❌ package.json not found'));
            return false;
        }

        // Check for build script
        const packageJson = await fs.readJSON(path.join(this.projectPath, 'package.json'));
        if (!packageJson.scripts?.build) {
            console.log(chalk.yellow('⚠️  No build script found in package.json'));
        }

        // Create .vercelignore if not exists
        const vercelIgnorePath = path.join(this.projectPath, '.vercelignore');
        if (!await fs.pathExists(vercelIgnorePath)) {
            await fs.writeFile(vercelIgnorePath, `node_modules\n.next\n.env.local\n`);
        }

        console.log(chalk.green('✅ Configuration valid'));
        return true;
    }

    async deploy(): Promise<DeployResult> {
        console.log(chalk.cyan(`\n🚀 Deploying to Vercel (${this.env})...`));

        const deployCommand = this.env === 'production'
            ? 'vercel --prod --yes'
            : 'vercel --yes';

        try {
            const output = await this.runCommand(deployCommand);

            // Extract URL from Vercel output
            const urlMatch = output.match(/https:\/\/[^\s]+/);
            const url = urlMatch ? urlMatch[0] : '';

            // Parse deployment ID from output
            const deploymentId = url.split('/').pop() || new Date().getTime().toString();

            return {
                url,
                platform: 'vercel',
                env: this.env,
                deploymentId,
            };
        } catch (error: any) {
            console.error(chalk.red('❌ Deployment failed'));
            throw error;
        }
    }

    async rollback(deploymentId?: string): Promise<void> {
        console.log(chalk.yellow('⏮️  Rolling back Vercel deployment...'));

        if (deploymentId) {
            await this.runCommand(`vercel rollback ${deploymentId}`);
        } else {
            // Rollback to previous production deployment
            await this.runCommand('vercel rollback');
        }

        console.log(chalk.green('✅ Rollback complete'));
    }
}
