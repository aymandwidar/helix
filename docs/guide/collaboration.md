# Collaboration

Helix supports real-time collaboration on `.helix` files via WebSocket. One developer runs the server, and teammates join to sync blueprint changes live.

## Starting a Server

```bash
# Open server (no auth)
helix collab serve

# With API key protection
helix collab serve --key my-secret-key

# Custom port
helix collab serve --port 3001 --key my-secret-key
```

Share the server address and API key with your team.

## Joining a Session

```bash
# Connect to a collaboration server
helix collab join ws://hostname:3001

# With API key
helix collab join ws://hostname:3001 --key my-secret-key

# Watch a specific directory
helix collab join ws://hostname:3001 --key my-secret-key --dir ./my-project
```

## What Gets Synced

The client watches for changes to any `.helix` file in the watch directory. When a file changes, it broadcasts the new content to all connected peers. Other peers receive the update in their terminal.

## How It Works

```
Developer A                    Developer B
────────────                   ────────────
helix collab serve ←──────────── helix collab join ws://A:3001
Edits blueprint.helix ─────────► Receives update notification
                    ◄─────────── Edits their local .helix file
Receives update notification
```

All communication is JSON over WebSocket. The server maintains a session history and presence list.

## Security

- Without `--key`, any client can connect (suitable for trusted networks)
- With `--key`, clients must send the key in the `x-helix-api-key` HTTP header on connection
- The API key is never transmitted in the WebSocket message stream

## Presence

When multiple users are connected, the server broadcasts a presence list. In the terminal output, you'll see:
- `✅ Connected` when you join
- `👥 N user(s) online` on presence updates
- `👋 User left` when someone disconnects
