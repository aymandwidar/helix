import { WebSocketServer, WebSocket } from 'ws';
import chalk from 'chalk';
import * as http from 'http';

export interface CollaborationMessage {
    type: 'schema_update' | 'cursor_position' | 'presence' | 'chat';
    userId: string;
    data: any;
    timestamp: number;
}

export interface UserPresence {
    userId: string;
    email: string;
    cursorPosition?: { file: string; line: number };
    lastSeen: number;
}

export class CollaborationServer {
    private wss: WebSocketServer;
    private clients: Map<string, WebSocket> = new Map();
    private presence: Map<string, UserPresence> = new Map();
    private schemaHistory: CollaborationMessage[] = [];

    constructor(port: number = 3001) {
        const server = http.createServer();
        this.wss = new WebSocketServer({ server });

        this.wss.on('connection', (ws: WebSocket) => {
            this.handleConnection(ws);
        });

        server.listen(port, () => {
            console.log(chalk.green(`\n🤝 Helix Collaboration Server running on port ${port}\n`));
        });
    }

    private handleConnection(ws: WebSocket): void {
        const userId = crypto.randomUUID();
        this.clients.set(userId, ws);

        console.log(chalk.cyan(`✅ User connected: ${userId}`));

        // Send connection confirmation
        ws.send(JSON.stringify({
            type: 'connected',
            userId,
            message: 'Connected to Helix Collaboration',
        }));

        // Handle messages
        ws.on('message', (data: string) => {
            this.handleMessage(userId, data);
        });

        // Handle disconnect
        ws.on('close', () => {
            this.clients.delete(userId);
            this.presence.delete(userId);
            this.broadcast({
                type: 'presence',
                userId,
                data: { status: 'offline' },
                timestamp: Date.now(),
            }, userId);
            console.log(chalk.yellow(`👋 User disconnected: ${userId}`));
        });
    }

    private handleMessage(userId: string, data: string): void {
        try {
            const message: CollaborationMessage = JSON.parse(data);
            message.userId = userId;
            message.timestamp = Date.now();

            switch (message.type) {
                case 'schema_update':
                    this.handleSchemaUpdate(message);
                    break;

                case 'cursor_position':
                    this.handleCursorUpdate(message);
                    break;

                case 'presence':
                    this.handlePresenceUpdate(message);
                    break;

                case 'chat':
                    this.broadcast(message);
                    break;
            }
        } catch (error: any) {
            console.error('Error handling message:', error.message);
        }
    }

    private handleSchemaUpdate(message: CollaborationMessage): void {
        // Store in history
        this.schemaHistory.push(message);

        // Broadcast to all other clients
        this.broadcast(message, message.userId);

        console.log(chalk.blue(`📝 Schema update from ${message.userId}`));
    }

    private handleCursorUpdate(message: CollaborationMessage): void {
        const userPresence = this.presence.get(message.userId);
        if (userPresence) {
            userPresence.cursorPosition = message.data;
            userPresence.lastSeen = Date.now();
        }

        // Broadcast cursor position to others
        this.broadcast(message, message.userId);
    }

    private handlePresenceUpdate(message: CollaborationMessage): void {
        this.presence.set(message.userId, {
            userId: message.userId,
            email: message.data.email,
            lastSeen: Date.now(),
        });

        // Send current presence list to all clients
        this.broadcastPresence();
    }

    private broadcast(message: CollaborationMessage, excludeUserId?: string): void {
        const payload = JSON.stringify(message);

        this.clients.forEach((client, userId) => {
            if (userId !== excludeUserId && client.readyState === WebSocket.OPEN) {
                client.send(payload);
            }
        });
    }

    private broadcastPresence(): void {
        const presenceList = Array.from(this.presence.values());

        this.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: 'presence_list',
                    data: presenceList,
                }));
            }
        });
    }
}

export function startCollaborationServer(port: number = 3001): CollaborationServer {
    return new CollaborationServer(port);
}
