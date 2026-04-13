# Web Dashboard

The Helix Web Dashboard is a browser-based UI for managing your generated projects, browsing templates, and viewing available AI models.

## Starting the Dashboard

```bash
helix web
# or
helix web --port 4000
```

Open your browser to [http://localhost:4000](http://localhost:4000).

## Features

### Projects Tab
- Lists all projects in your `builds/` directory
- Shows the original prompt, generation date, and whether the project has a database
- Click any project card to view its blueprint and Prisma schema

### Templates Tab
- Browse all available templates with descriptions, themes, and tags
- Shows the `helix init <template>` command for each

### AI Models Tab
- Lists all configured AI models (primary, fallback, research)
- Auto-detects locally running Ollama models at `localhost:11434`

## Options

| Flag | Default | Description |
|---|---|---|
| `-p, --port` | `4000` | Port to serve the dashboard on |

## API Endpoints

The dashboard server also exposes a JSON API:

| Endpoint | Description |
|---|---|
| `GET /api/projects` | List all projects |
| `GET /api/project/:name` | Project details, blueprint, Prisma schema |
| `GET /api/templates` | List all templates |
| `GET /api/models` | Available AI models (including local Ollama) |
| `GET /api/status` | Server status and version |
