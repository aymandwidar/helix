import chalk from 'chalk';
import { startCollaborationServer } from './server';
import * as fs from 'fs-extra';
import * as path from 'path';

export async function collaborateCommand(
    action: string = 'init',
    email?: string
): Promise<void> {
    console.log(chalk.cyan('\n🤝 Helix Collaborate\n'));

    switch (action) {
        case 'init':
            await initCollaboration();
            break;

        case 'invite':
            if (!email) {
                console.log(chalk.red('❌ Email required for invite'));
                console.log(chalk.gray('Usage: helix collaborate invite user@team.com'));
                return;
            }
            await inviteTeamMember(email);
            break;

        case 'sync':
            await syncChanges();
            break;

        case 'server':
            await startServer();
            break;

        default:
            console.log(chalk.yellow(`Unknown action: ${action}`));
            console.log(chalk.gray('Available actions: init, invite, sync, server'));
    }
}

async function initCollaboration(): Promise<void> {
    console.log(chalk.cyan('🚀 Initializing collaborative workspace...\n'));

    const workspaceId = crypto.randomUUID();
    const config = {
        workspaceId,
        members: [],
        createdAt: new Date().toISOString(),
        syncEnabled: true,
    };

    // Save config
    await fs.writeJSON('.helix-collaborate.json', config, { spaces: 2 });

    console.log(chalk.green('✅ Workspace created!'));
    console.log(chalk.gray(`Workspace ID: ${workspaceId}\n`));
    console.log(chalk.yellow('Next steps:'));
    console.log(chalk.gray('1. helix collaborate invite user@team.com'));
    console.log(chalk.gray('2. helix collaborate server  # Start sync server\n'));
}

async function inviteTeamMember(email: string): Promise<void> {
    console.log(chalk.cyan(`📧 Inviting ${email}...\n`));

    // Check if workspace exists
    const configPath = '.helix-collaborate.json';
    if (!await fs.pathExists(configPath)) {
        console.log(chalk.red('❌ No workspace found'));
        console.log(chalk.yellow('Run: helix collaborate init'));
        return;
    }

    const config = await fs.readJSON(configPath);

    // Add member
    config.members.push({
        email,
        role: 'collaborator',
        invitedAt: new Date().toISOString(),
    });

    await fs.writeJSON(configPath, config, { spaces: 2 });

    console.log(chalk.green(`✅ Invited ${email}`));
    console.log(chalk.gray(`Workspace ID: ${config.workspaceId}\n`));
    console.log(chalk.yellow('⚠️  Send them the workspace ID to join\n'));
}

async function syncChanges(): Promise<void> {
    console.log(chalk.cyan('🔄 Syncing local changes...\n'));

    const configPath = '.helix-collaborate.json';
    if (!await fs.pathExists(configPath)) {
        console.log(chalk.red('❌ Not in a collaborative workspace'));
        return;
    }

    // In a real implementation, this would sync with WebSocket server
    console.log(chalk.yellow('⚠️  Real-time sync requires server to be running'));
    console.log(chalk.gray('Run: helix collaborate server\n'));
}

async function startServer(): Promise<void> {
    console.log(chalk.cyan('🚀 Starting collaboration server...\n'));

    const server = startCollaborationServer(3001);

    console.log(chalk.green('✅ Server ready for connections'));
    console.log(chalk.cyan('📡 WebSocket: ws://localhost:3001\n'));
    console.log(chalk.gray('Team members can now sync in real-time\n'));

    // Keep process alive
    process.on('SIGINT', () => {
        console.log(chalk.yellow('\n\n👋 Shutting down server...\n'));
        process.exit(0);
    });
}
