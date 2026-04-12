import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-Sent Events endpoint for real-time notifications.
 *
 * GET /api/notifications - Opens an SSE stream for the authenticated user.
 * POST /api/notifications - Sends a notification (triggers SSE to all connected clients).
 *
 * Integration:
 *   const eventSource = new EventSource('/api/notifications');
 *   eventSource.onmessage = (event) => {
 *       const notification = JSON.parse(event.data);
 *       // Handle notification
 *   };
 */

interface SSEClient {
    id: string;
    controller: ReadableStreamDefaultController;
}

// In-memory client registry (replace with Redis pub/sub for multi-instance)
const clients = new Map<string, SSEClient>();

function broadcastNotification(data: Record<string, unknown>) {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    const encoder = new TextEncoder();
    const encoded = encoder.encode(message);

    for (const [id, client] of clients.entries()) {
        try {
            client.controller.enqueue(encoded);
        } catch {
            clients.delete(id);
        }
    }
}

export async function GET(request: NextRequest) {
    const clientId = request.headers.get('x-client-id') || crypto.randomUUID();

    const stream = new ReadableStream({
        start(controller) {
            clients.set(clientId, { id: clientId, controller });

            // Send initial connection message
            const encoder = new TextEncoder();
            controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`)
            );

            // Heartbeat every 30s to keep connection alive
            const heartbeat = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(': heartbeat\n\n'));
                } catch {
                    clearInterval(heartbeat);
                    clients.delete(clientId);
                }
            }, 30000);

            // Cleanup on close
            request.signal.addEventListener('abort', () => {
                clearInterval(heartbeat);
                clients.delete(clientId);
                try {
                    controller.close();
                } catch {
                    // Already closed
                }
            });
        },
        cancel() {
            clients.delete(clientId);
        },
    });

    return new NextResponse(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const { type = 'info', title, message, targetUserId } = body;

        if (!title) {
            return NextResponse.json(
                { error: 'Title is required' },
                { status: 400 }
            );
        }

        const notification = {
            id: crypto.randomUUID(),
            type,
            title,
            message: message || null,
            targetUserId: targetUserId || null,
            createdAt: new Date().toISOString(),
        };

        // Broadcast to connected clients
        broadcastNotification(notification);

        return NextResponse.json({
            message: 'Notification sent',
            notification,
            connectedClients: clients.size,
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Failed to send notification';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
