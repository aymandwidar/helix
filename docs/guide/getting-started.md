# Getting Started

## What is Helix?

Helix is an AI-native development platform that generates complete, production-ready full-stack applications from natural language prompts. It combines a custom DSL (the Helix language), an AI pipeline powered by OpenRouter, and a suite of CLI commands to take you from idea to deployed app.

**What Helix generates:**
- Next.js 14 app with TypeScript and Tailwind CSS
- Prisma schema with migrations
- REST API routes for every model
- Full CRUD UI pages with your chosen theme
- NextAuth.js authentication (optional)
- Vitest test files
- Docker + docker-compose config

## Installation

::: code-group

```bash [npm]
npm install -g helix-lang
```

```bash [npx (no install)]
npx helix-lang spawn "your idea"
```

:::

**Requirements:**
- Node.js 18 or later
- An [OpenRouter](https://openrouter.ai) API key

## Configuration

Helix reads from a `.env` file in your working directory:

```bash
OPENROUTER_API_KEY=sk-or-...
```

Run `helix doctor` to verify your environment is set up correctly.

## Quick Start

```bash
# Generate a full app
helix spawn "A project management tool with tasks, projects, and team members"

# Use a template
helix init saas my-startup

# Launch the web dashboard
helix web

# Deploy to Vercel
helix deploy --platform vercel
```

## How It Works

1. **Parse** — Your prompt is analyzed to detect complexity and required features
2. **Blueprint** — The AI generates a `.helix` blueprint describing your data model
3. **Database** — Prisma schema is written and migrated
4. **Codegen** — API routes, UI pages, and tests are generated from the blueprint
5. **Verify** — The project is built and any errors are self-healed by the AI

Each generated project lives in the `builds/` directory and is a fully working Next.js project you can customize.
