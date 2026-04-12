import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';

const execAsync = promisify(exec);

export interface DeployOptions {
    platform?: 'vercel' | 'railway' | 'fly';
    env?: 'preview' | 'production';
    projectPath?: string;
}

export interface DeployResult {
    url: string;
    platform: string;
    env: string;
    deploymentId: string;
}

export abstract class Deployer {
    protected projectPath: string;
    protected env: 'preview' | 'production';

    constructor(projectPath: string, env: 'preview' | 'production' = 'preview') {
        this.projectPath = projectPath;
        this.env = env;
    }

    abstract initialize(): Promise<void>;
    abstract validateConfig(): Promise<boolean>;
    abstract deploy(): Promise<DeployResult>;
    abstract rollback(deploymentId?: string): Promise<void>;

    protected async runCommand(command: string): Promise<string> {
        try {
            const { stdout } = await execAsync(command, {
                cwd: this.projectPath,
            });
            return stdout;
        } catch (error: any) {
            throw new Error(`Command failed: ${command}\n${error.message}`);
        }
    }

    protected async fileExists(filePath: string): Promise<boolean> {
        return fs.pathExists(path.join(this.projectPath, filePath));
    }
}

export async function deployApp(options: DeployOptions = {}): Promise<DeployResult> {
    const platform = options.platform || await detectPlatform(options.projectPath);
    const projectPath = options.projectPath || process.cwd();
    const env = options.env || 'preview';

    console.log(chalk.cyan(`\n🚀 Helix Deploy`));
    console.log(chalk.gray(`Platform: ${platform}`));
    console.log(chalk.gray(`Environment: ${env}\n`));

    const deployer = getDeployer(platform, projectPath, env);

    await deployer.initialize();

    const isValid = await deployer.validateConfig();
    if (!isValid) {
        throw new Error('Invalid deployment configuration');
    }

    const result = await deployer.deploy();

    console.log(chalk.green(`\n✅ Deployment successful!`));
    console.log(chalk.cyan(`🌍 URL: ${result.url}`));
    console.log(chalk.gray(`Deployment ID: ${result.deploymentId}\n`));

    return result;
}

async function detectPlatform(projectPath: string = process.cwd()): Promise<string> {
    const hasVercelJson = await fs.pathExists(path.join(projectPath, 'vercel.json'));
    const hasRailwayToml = await fs.pathExists(path.join(projectPath, 'railway.toml'));
    const hasFlyToml = await fs.pathExists(path.join(projectPath, 'fly.toml'));

    if (hasVercelJson) return 'vercel';
    if (hasRailwayToml) return 'railway';
    if (hasFlyToml) return 'fly';

    // Default to Vercel for Next.js projects
    const hasNextConfig = await fs.pathExists(path.join(projectPath, 'next.config.ts')) ||
        await fs.pathExists(path.join(projectPath, 'next.config.js'));
    if (hasNextConfig) return 'vercel';

    return 'vercel'; // Default
}

function getDeployer(platform: string, projectPath: string, env: 'preview' | 'production'): Deployer {
    switch (platform) {
        case 'vercel':
            const { VercelDeployer } = require('./platforms/vercel');
            return new VercelDeployer(projectPath, env);
        case 'railway':
            const { RailwayDeployer } = require('./platforms/railway');
            return new RailwayDeployer(projectPath, env);
        case 'fly':
            const { FlyDeployer } = require('./platforms/fly');
            return new FlyDeployer(projectPath, env);
        default:
            throw new Error(`Unsupported platform: ${platform}`);
    }
}

export async function rollbackDeployment(deploymentId?: string, options: DeployOptions = {}): Promise<void> {
    const platform = options.platform || await detectPlatform(options.projectPath);
    const projectPath = options.projectPath || process.cwd();

    console.log(chalk.yellow(`\n⏮️  Rolling back deployment...`));

    const deployer = getDeployer(platform, projectPath, 'production');
    await deployer.rollback(deploymentId);

    console.log(chalk.green(`✅ Rollback successful!\n`));
}
