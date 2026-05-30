# Helix v16.0

[![npm version](https://img.shields.io/npm/v/helix-lang.svg?label=helix-lang&color=cyan)](https://www.npmjs.com/package/helix-lang)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**AI-Native Development Platform — generate, evolve, deploy, and chat with your codebase from the terminal.**

Helix transforms a single prompt into a Next.js app with database, API routes, styled UI, and tests in about 60 seconds — and as of v16, it's also a fully interactive agent that can read your code, evolve existing apps, run multi-model deliberations, and ship to Vercel/Netlify/Railway one-click.

```bash
helix spawn "A recipe manager with ingredients and cook time"
# → Full app: database, API, React UI, tests, ready to run

helix chat
# → Interactive agent with file_read/file_write/shell_exec, MCP tools, hooks

helix evolve add-feature "user auth with Google OAuth"
# → Scan project → AI plan → preview diff → checkpoint → apply → validate → self-heal
```

---

## What's new in v16

| Capability | Sprint | Command(s) |
|---|---|---|
| Interactive agent REPL with tool use | 7 | `helix chat`, `helix ask "..."` |
| File / shell / web tools + checkpointing | 7 | 11 built-in tools, `/restore` |
| MCP client (CMM, Council, any MCP server) | 8 | `helix mcp list/status/add`, `@memory ...` |
| Hooks (pre/post tool, pre/post prompt) | 8 | `~/.helix/settings.json` `hooks[]` |
| Subagent spawning for parallel tasks | 8 | `spawn_subagent` tool |
| Streaming model output | 8 | on by default in `helix chat` |
| CMM auto-query before generation | 8 | runs automatically when configured |
| Evolve mode (modify existing apps) | 9 | `helix evolve add-feature/refactor/fix/migrate/optimize` |
| Council multi-model deliberation | 10 | `helix council "..."`, `/council` |
| Auto-mode permissions engine | 10 | `helix permissions`, `--trust`/`--yolo`/`--manual` |
| Plugins v2 (chat tool plugins) | 10 | `helix plugin chat-add helix-tool-*` |
| Quality audits (a11y/perf/SEO/security) | 11 | `helix audit`, `--production-grade` |
| Regression guard | 11 | `helix regression-guard capture/check` |
| `/teach`, `/inherit` (HELIX.md learned rules) | 11 | slash commands |
| `/loop`, `/review`, `/explain-diff`, `/compress`, `/cost-predict` | 11 | slash commands |
| Block TUI (boxed output) | 11 | `/blocks on` |
| One-click deploy to Vercel / Netlify / Railway | 12 | `helix deploy --vercel/--netlify/--railway` |
| Git workflows (`pr create/review`, `changelog`, `branch-protect`) | 12 | `helix pr create`, `helix changelog` |
| Custom themes | 12 | `helix theme use monokai`, `/theme` |
| `/verify-visual` (optional screenshot diff) | 12 | requires puppeteer + pixelmatch |
| `/usage` dashboard + session recap | 12 | `/usage`, `/recap [--save]` |

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

### Try the agent

```bash
helix chat
# you ▸ explain this codebase, then add a /health endpoint
```

### Verify your setup

```bash
helix doctor
```

---

## CLI Commands

### Generation

| Command | Description |
|---------|-------------|
| `helix spawn <prompt>` | Generate a complete app from natural language |
| `helix spawn ... --production-grade` | Apply strict-quality policy + post-generate audit |
| `helix new <name>` | Scaffold an empty Helix project |
| `helix generate <file.helix>` | Generate stack from a `.helix` blueprint |
| `helix preflight <file>` | Validate a `.helix` blueprint before generation |
| `helix research <topic>` | Generate domain research context |
| `helix draft <idea>` | AI-draft a `.helix` blueprint from an idea |
| `helix build <file>` | Compile `.helix` to a React component |
| `helix pipeline <topic> <idea>` | Full pipeline: research → draft → build |

### Interactive agent (v14)

| Command | Description |
|---------|-------------|
| `helix chat` | Enter interactive REPL agent (tool use, streaming, MCP) |
| `helix chat --trust` / `--yolo` / `--manual` | Set permission mode for the session |
| `helix ask "<prompt>"` | One-shot headless query (`--output-format json` for scripts) |
| `helix permissions list/mode/allow/deny/ask/remove` | Manage chat-mode permissions |

### MCP + Council (v14.1, v15.1)

| Command | Description |
|---------|-------------|
| `helix mcp list/status/add/remove/tools <name>` | Manage MCP servers (CMM, Council, etc.) |
| `helix council "<question>"` | Multi-model deliberation via Council |
| `helix council --list-presets/--list-models/--history` | Inspect Council |

### Evolve (v15)

| Command | Description |
|---------|-------------|
| `helix evolve scan/suggest/apply/security-audit` | Codebase health analysis (Sprint 4) |
| `helix evolve add-feature "..."` | Add a feature to an existing project |
| `helix evolve refactor "..."` | Restructure existing code |
| `helix evolve fix "..."` | AI bug fix with self-heal loop |
| `helix evolve migrate "..."` | Framework / dependency migration |
| `helix evolve optimize "..."` | Perf / a11y / SEO / DX improvements |

Flags: `--dry-run` (plan only), `--yes` (skip confirmation), `--skip-validation`, `--max-heal N`, `--model <m>`.

### Quality (v15.2)

| Command | Description |
|---------|-------------|
| `helix audit [project] [--category a11y,security] [--json]` | Run quality audits |
| `helix regression-guard capture/check` | Snapshot file checksums + validation, compare later |
| `helix explain-diff [--range <ref>]` | AI-explain the current git diff |
| `helix review [--range <ref>]` | AI code review of current diff |
| `helix cost-predict [completion-tokens] --model X` | Estimate cost of upcoming agent turn |

### Git workflows (v16)

| Command | Description |
|---------|-------------|
| `helix pr create [--base <branch>] [--print-only]` | AI-generated PR title + body, opens via `gh` |
| `helix pr review [--base <branch>]` | AI code review on the branch's diff vs base |
| `helix changelog [--since <ref>] [--style conventional|semver]` | Generate / merge `CHANGELOG.md` |
| `helix branch-protect [--branch] [--checks ...]` | Print recommended branch-protection JSON + `gh api` command |

### Deploy & ops (v16)

| Command | Description |
|---------|-------------|
| `helix deploy --vercel` / `--netlify` / `--railway` | One-click deploy with `.env` sync |
| `helix deploy --dry-run` | Show what would happen without deploying |
| `helix verify-visual [--url ...] [--threshold ...]` | Screenshot baseline / diff (optional) |
| `helix theme list/use <name>` | Switch chat output theme |
| `helix usage` | Show usage stats from latest chat session |
| `helix recap [-n N]` | Print recent session recap files |

### Plugins (v15.1)

| Command | Description |
|---------|-------------|
| `helix plugin list/install <name>` | Generator plugins (v1) |
| `helix plugin chat-list/chat-add/chat-remove <pkg>` | Chat tool plugins (v2 — `helix-tool-*`) |

### Misc

| Command | Description |
|---------|-------------|
| `helix run` | Start the dev server |
| `helix preview` | Hot-reload preview with `.helix` file watching |
| `helix drift [project]` | Detect manual changes since generation |
| `helix snapshot [project]` | Generate Dockerfile + docker-compose.yml |
| `helix install [component]` | Browse and install from the component library |
| `helix cost` | Session AI token usage and spend |
| `helix doctor` | System health check |
| `helix list` | List all generated projects |
| `helix models` | List available AI models |

---

## Slash commands in `helix chat`

```
/help          /clear         /exit
/checkpoint    /restore       /context
/cost          /tools         /mcp
/remember      /recall        /council
/perm          /yolo          /manual            /trusted
/audit         /regression-guard
/explain-diff  /review        /cost-predict
/compress      /loop          /teach             /inherit
/blocks        /usage         /recap
/theme         /pr            /changelog         /verify-visual
@<server> <tool>             # route directly to an MCP server
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

Each **STRAND** generates a Prisma model, full CRUD API routes, and a TypeScript interface. Each **VIEW** generates a React page with forms, lists, and delete confirmations. **PAGE** scopes multi-route applications.

---

## Configuration

Helix reads `~/.helix/settings.json` for MCP servers, permissions, hooks, themes, and chat plugins:

```json
{
  "mcpServers": {
    "cognitive-memory": {
      "command": "/path/to/run_cmm.sh",
      "autoConnect": true
    },
    "council": {
      "command": "/path/to/python",
      "args": ["/path/to/council/mcp_server.py"]
    }
  },
  "permissions": {
    "mode": "normal",
    "rules": [
      { "tool": "shell_exec", "action": "ask" },
      { "tool": "file_*", "action": "allow" }
    ]
  },
  "hooks": [
    { "event": "pre_tool", "match": "^shell_exec$", "command": "audit-shell --json" }
  ],
  "chatPlugins": ["helix-tool-jira", "helix-tool-github"],
  "chatTheme": "monokai"
}
```

A project-level `HELIX.md` is loaded as persistent context (similar to `CLAUDE.md` / `GEMINI.md`). Use `/teach <lesson>` in chat to append to its `## Learned conventions` section, and `/inherit <path>` to merge another project's `HELIX.md` into the current one.

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js (App Router) |
| Language | TypeScript (strict) |
| Database | SQLite + Prisma ORM (Postgres / Supabase / Mongo / Redis optional) |
| Styling | Tailwind CSS |
| Testing | Vitest |
| AI | OpenRouter (model-agnostic; Claude / DeepSeek / GPT-4o / etc.) |
| Containers | Docker (multi-stage builds) |
| MCP | `@modelcontextprotocol/sdk` (stdio transport) |

---

## Example Prompts

```bash
helix spawn "A warehouse inventory with Products, Locations, and Stock Movements"
helix spawn "A course manager with Students, Courses, and Assignments" --production-grade
helix spawn "An expense tracker for small businesses" --theme professional
helix spawn "A fitness app with Workouts and Exercises" --target flutter
helix spawn "A CRM with Contacts, Companies, and Deals" --db postgres

helix evolve add-feature "magic-link auth via email" --dry-run
helix evolve fix "the dashboard crashes on mobile when there are zero deals"
helix evolve migrate "upgrade Next.js to v15 and switch to React 19"

helix council "Should we use Postgres or MongoDB for this schema?"
helix audit my-project --category security,a11y
helix deploy --vercel --skip-env-sync
helix pr create --print-only
helix changelog --since v15.0.0 --style conventional
```

---

## License

MIT

---

> **"Describe it once, run it immediately. Then evolve it forever."**
