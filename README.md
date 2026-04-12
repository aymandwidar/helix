# Helix v11.0

**AI-Powered Full-Stack App Generator**

Generate complete, working applications from natural language. Helix transforms a single prompt into a Next.js app with database, API routes, styled UI, and tests -- in about 60 seconds.

```bash
helix spawn "A recipe manager with ingredients and cook time"
# -> Full app: database, API, React UI, tests, ready to run
```

---

## Features

- **Natural language to full-stack apps** -- Next.js + Prisma + Tailwind from a single prompt
- **Self-healing builds** -- AI detects and auto-fixes build errors during generation
- **Pre-flight validation** -- `helix preflight` catches blueprint issues before generation
- **Theme engine** -- `--theme glassmorphism|professional|minimal|vibrant`
- **API validation, rate limiting, pagination** -- built into every generated route
- **Auto-generated test suites** -- Vitest tests included out of the box
- **Docker support** -- `helix snapshot --docker` produces optimized multi-stage Dockerfiles
- **Drift detection** -- `helix drift` shows what changed since generation
- **Multi-page apps** -- PAGE DSL for multi-route applications
- **Component library** -- `helix install` to pull reusable components
- **Schema migrations** -- `helix evolve` to scan, suggest, and apply codebase changes
- **Cost tracking** -- `helix cost` shows per-generation token usage and spend
- **Flutter target** -- `helix spawn "..." --target flutter` for mobile apps

---

## Quick Start

### Install

```bash
npm install -g helix-lang
```

### Set up your API key

```bash
echo "OPENROUTER_API_KEY=sk-or-v1-..." > .env
```

### Generate an app

```bash
helix spawn "A project tracker with Tasks, Milestones, and Team Members"
cd builds/a-project-tracker && npm run dev
```

### Verify your setup

```bash
helix doctor
```

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `helix spawn <prompt>` | Generate a complete app from natural language |
| `helix new <name>` | Scaffold an empty Helix project |
| `helix generate <file.helix>` | Generate stack from an existing `.helix` blueprint |
| `helix run` | Start the dev server |
| `helix preview` | Hot-reload preview with `.helix` file watching |
| `helix deploy` | Deploy to Vercel, Firebase, or Netlify |
| `helix preflight <file>` | Validate a `.helix` blueprint before generation |
| `helix evolve [action]` | Scan, suggest, or apply codebase fixes and migrations |
| `helix drift [project]` | Detect manual changes since generation |
| `helix snapshot [project]` | Generate Dockerfile and docker-compose.yml |
| `helix install [component]` | Browse and install from the component library |
| `helix cost` | Show AI token usage and cost for the session |
| `helix doctor` | System health check (Node, API key, deps) |
| `helix list` | List all generated projects |
| `helix research <topic>` | Generate domain research context |
| `helix draft <idea>` | AI-draft a `.helix` blueprint from an idea |
| `helix build <file>` | Compile `.helix` to a React component |
| `helix pipeline <topic> <idea>` | Full pipeline: research, draft, build |
| `helix models` | List available AI models |
| `helix plugins` | List registered generator plugins |

### Key Flags for `spawn`

```
--target <platform>    web (default) or flutter
--theme <theme>        glassmorphism, professional, minimal, vibrant
--db <database>        postgres, mongodb, redis, or comma-separated
--constitution <file>  Provide a constitution.md for design guidance
--components <ids>     Include Helix Library components (comma-separated)
--ai-context           Enable AI context layer with Redis
--cache                Add Redis caching layer
--dry-run              Preview what would be generated without writing files
```

---

## .helix DSL

Helix blueprints use a declarative syntax with two core constructs: **STRAND** (data model) and **VIEW** (UI page).

```helix
STRAND Contact {
  name: String
  email: String
  company: String
  status: String    // Lead, Active, Churned
}

STRAND Deal {
  title: String
  value: Float
  stage: String     // Discovery, Proposal, Closed
  contact: Contact
}

VIEW Dashboard {
  list: Contact.all
  list: Deal.all
}

VIEW DealPipeline {
  list: Deal.where(stage: "Discovery")
  list: Deal.where(stage: "Proposal")
  list: Deal.where(stage: "Closed")
}
```

Each **STRAND** generates a Prisma model, full CRUD API routes, and a TypeScript interface. Each **VIEW** generates a React page with forms, lists, and delete confirmations.

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Database | SQLite + Prisma ORM (Postgres/Mongo optional) |
| Styling | Tailwind CSS |
| Testing | Vitest |
| AI | OpenRouter (Claude Sonnet) |
| Containers | Docker (multi-stage builds) |

---

## Example Prompts

```bash
helix spawn "A warehouse inventory with Products, Locations, and Stock Movements"
helix spawn "A course manager with Students, Courses, and Assignments"
helix spawn "An expense tracker for small businesses" --theme professional
helix spawn "A fitness app with Workouts and Exercises" --target flutter
helix spawn "A CRM with Contacts, Companies, and Deals" --db postgres
```

---

## License

MIT

---

> **"Describe it once, run it immediately."**
