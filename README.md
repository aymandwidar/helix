# Helix v3.0 - The Autonomic Stack

AI-Native Programming Language with Full-Stack Generation

## Features

- **`helix new <project>`** - Scaffold Next.js + Prisma + Tailwind project
- **`helix generate <file>`** - Generate Prisma + API + UI from .helix blueprints
- **`helix run`** - Start dev server with auto browser open
- **`helix research <topic>`** - AI-powered domain research
- **`helix draft <idea>`** - Create .helix blueprints from ideas
- **`helix build <file>`** - Compile .helix to React components

## Quick Start

```bash
# Install
npm install
npm run build
npm link

# Create a project
helix new my-app
cd my-app

# Define your app
echo 'strand Task {
   field title: String
   field is_completed: Boolean
}

view TodoList {
   list: Task.all()
}' > app.helix

# Generate full stack
helix generate app.helix

# Run
helix run
```

## Configuration

Create a `.env` file:
```
OPENROUTER_API_KEY=your-key-here
HELIX_DEFAULT_MODEL=anthropic/claude-3.5-sonnet
HELIX_RESEARCH_MODEL=google/gemini-flash-1.5
```

## Tech Stack

- Node.js + TypeScript
- Commander.js (CLI)
- OpenRouter (AI)
- Next.js 14 (generated apps)
- Prisma + SQLite (database)
- Tailwind CSS (styling)

## License

MIT
