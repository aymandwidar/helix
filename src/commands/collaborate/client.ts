/**
 * Helix Collaboration Client
 * Watches .helix files for changes and broadcasts updates via WebSocket
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as http from 'http';
import chalk from 'chalk';
import { WebSocket } from 'ws';

interface ClientOptions {
  serverUrl: string;
  apiKey?: string;
  watchDir?: string;
}

export class CollaborationClient {
  private ws: WebSocket | null = null;
  private userId: string | null = null;
  private readonly serverUrl: string;
  private readonly apiKey: string | undefined;
  private readonly watchDir: string;
  private watchers: fs.FSWatcher[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: ClientOptions) {
    this.serverUrl = options.serverUrl;
    this.apiKey = options.apiKey;
    this.watchDir = options.watchDir || process.cwd();
  }

  connect(): void {
    const wsUrl = this.serverUrl.replace(/^http/, 'ws');
    const headers: Record<string, string> = {};
    if (this.apiKey) headers['x-helix-api-key'] = this.apiKey;

    console.log(chalk.cyan(`\n🔌 Connecting to ${wsUrl}…\n`));

    try {
      this.ws = new WebSocket(wsUrl, { headers });
    } catch (err: any) {
      console.error(chalk.red(`❌ Failed to connect: ${err.message}`));
      this.scheduleReconnect();
      return;
    }

    this.ws.on('open', () => {
      console.log(chalk.green('✅ Connected to Helix collaboration server'));
      this.startWatching();
    });

    this.ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        this.handleMessage(msg);
      } catch {}
    });

    this.ws.on('close', (code: number) => {
      console.log(chalk.yellow(`\n⚠️  Disconnected (code ${code}). Reconnecting…`));
      this.stopWatching();
      this.scheduleReconnect();
    });

    this.ws.on('error', (err: Error) => {
      console.error(chalk.red(`❌ WebSocket error: ${err.message}`));
    });
  }

  private handleMessage(msg: any): void {
    switch (msg.type) {
      case 'connected':
        this.userId = msg.userId;
        console.log(chalk.gray(`   Session ID: ${this.userId}`));
        break;

      case 'schema_update':
        if (msg.userId !== this.userId) {
          console.log(chalk.blue(`📥 Blueprint update from ${msg.userId.slice(0, 8)}…`));
          // Optionally write the received blueprint to a temp file for review
        }
        break;

      case 'presence_list':
        console.log(chalk.gray(`👥 ${msg.data.length} user(s) online`));
        break;

      case 'presence':
        if (msg.data?.status === 'offline') {
          console.log(chalk.gray(`👋 User ${msg.userId.slice(0, 8)}… left`));
        }
        break;

      case 'chat':
        console.log(chalk.white(`💬 ${msg.userId.slice(0, 8)}: ${msg.data?.text}`));
        break;
    }
  }

  private startWatching(): void {
    // Watch all .helix files in the watch directory
    const helixFiles = this.findHelixFiles(this.watchDir);

    if (helixFiles.length === 0) {
      console.log(chalk.gray(`  No .helix files found in ${this.watchDir}`));
      console.log(chalk.gray('  Watching for new files…\n'));
    } else {
      console.log(chalk.gray(`  Watching ${helixFiles.length} .helix file(s):\n`));
      for (const f of helixFiles) {
        console.log(chalk.gray(`    • ${path.relative(this.watchDir, f)}`));
      }
      console.log('');
    }

    // Watch directory for new .helix files
    const dirWatcher = fs.watch(this.watchDir, { recursive: true }, (event, filename) => {
      if (filename && filename.endsWith('.helix')) {
        const fullPath = path.join(this.watchDir, filename);
        this.broadcastFileChange(fullPath);
      }
    });
    this.watchers.push(dirWatcher as unknown as fs.FSWatcher);
  }

  private broadcastFileChange(filePath: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      this.send({
        type: 'schema_update',
        data: {
          file: path.relative(this.watchDir, filePath),
          content,
        },
      });
      console.log(chalk.green(`📤 Broadcast: ${path.basename(filePath)}`));
    } catch {}
  }

  private send(payload: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private stopWatching(): void {
    for (const w of this.watchers) w.close();
    this.watchers = [];
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }

  private findHelixFiles(dir: string): string[] {
    const results: string[] = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
          results.push(...this.findHelixFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.helix')) {
          results.push(fullPath);
        }
      }
    } catch {}
    return results;
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopWatching();
    this.ws?.close();
  }
}

export function joinCollaborationSession(serverUrl: string, apiKey?: string): void {
  const client = new CollaborationClient({ serverUrl, apiKey });
  client.connect();

  process.on('SIGINT', () => {
    console.log(chalk.gray('\n\nDisconnecting…'));
    client.disconnect();
    process.exit(0);
  });
}
