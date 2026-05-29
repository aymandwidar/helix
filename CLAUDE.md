# Helix v14–v16 Requirements Specification
**Document Purpose:** Master blueprint for Claude Code implementation sessions.
**Last Updated:** May 29, 2026
**Owner:** AD AI Engine / Ayman Dwidar

---

## Current State: Helix v13.0.0 (Sprint 6 Complete)

### Existing Architecture
```
helix-lang/
├── src/
│   ├── bin/helix.ts              # CLI entry point (commander.ts)
│   ├── architect.ts              # Prompt → blueprint architect
│   ├── compiler.ts               # .helix DSL → code compiler
│   ├── parser.ts                 # Lexer + recursive descent parser for .helix
│   ├── page-generator.ts         # PAGE DSL → multi-route generation
│   ├── openrouter.ts             # OpenRouter API client
│   ├── researcher.ts             # Domain research via AI
│   ├── self-heal.ts              # Auto-fix build errors during generation
│   ├── test-generator.ts         # Vitest test suite generation
│   ├── commands/                 # CLI command handlers
│   ├── core/                     # Core utilities
│   ├── errors/                   # Error handling
│   ├── generators/               # Code generators (Next.js, Flutter)
│   ├── pipeline/                 # Generation pipeline stages
│   ├── prompts/                  # AI prompt templates
│   ├── services/                 # Service layer
│   ├── themes/                   # Theme engine (6 themes)
│   ├── types.ts                  # TypeScript interfaces
│   └── utils/                    # Utility functions
├── library/                      # Component library
├── templates/                    # App templates (blog, dashboard, ecommerce, saas, todo)
├── tests/                        # Vitest test suite
├── docs/                         # Documentation site (Sprint 6)
├── preview/                      # Hot-reload preview server
├── .github/workflows/            # CI (GitHub Actions)
├── package.json                  # helix-lang v13.0.0, MIT
├── tsconfig.json
├── vitest.config.ts
└── .npmignore
```

### Existing CLI Commands
| Command | Status | What it does |
|---------|--------|--------------|
| `helix spawn <prompt>` | ✅ Working | Generate full-stack app from natural language |
| `helix generate <file.helix>` | ✅ Working | Generate from .helix blueprint |
| `helix new <name>` | ✅ Working | Scaffold empty Helix project |
| `helix run` | ✅ Working | Start dev server |
| `helix preview` | ✅ Working | Hot-reload preview with .helix watching |
| `helix deploy` | ✅ Working | Deploy to Vercel/Firebase/Netlify |
| `helix preflight <file>` | ✅ Working | Validate .helix before generation |
| `helix evolve [action]` | ✅ Working | Scan, suggest, apply codebase changes |
| `helix drift [project]` | ✅ Working | Detect manual changes since generation |
| `helix snapshot [project]` | ✅ Working | Generate Dockerfile + docker-compose |
| `helix install [component]` | ✅ Working | Browse/install from component library |
| `helix cost` | ✅ Working | Show AI token usage and cost |
| `helix doctor` | ✅ Working | System health check |
| `helix list` | ✅ Working | List generated projects |
| `helix research <topic>` | ✅ Working | Generate domain research |
| `helix draft <idea>` | ✅ Working | AI-draft a .helix blueprint |
| `helix build <file>` | ✅ Working | Compile .helix to React component |
| `helix pipeline <topic> <idea>` | ✅ Working | Full: research → draft → build |
| `helix models` | ✅ Working | List available AI models |
| `helix plugins` | ✅ Working | List registered generator plugins |

### Existing .helix DSL
```helix
STRAND Contact {
  name: String
  email: String
  company: String
  status: String    // Lead, Active, Churned
}

VIEW Dashboard {
  list: Contact.all
}
```
- `STRAND` → Prisma model + CRUD API + TypeScript interface
- `VIEW` → React page with forms, lists, delete confirmations
- `PAGE` → Multi-route application pages

### Tech Stack
- Language: TypeScript (strict)
- CLI Framework: commander.ts
- AI: OpenRouter (model-agnostic)
- Generated output: Next.js (App Router) + Prisma + Tailwind + Vitest
- Alternative target: Flutter (--target flutter)
- Build: tsc
- Tests: vitest
- Package: npm (helix-lang)

---

## What to Borrow from Gemini CLI

Based on analysis of `google-gemini/gemini-cli` (105K ⭐, TypeScript, Apache 2.0):

### BORROW — Interaction Patterns
| Pattern | What it is | How to adapt for Helix |
|---------|-----------|----------------------|
| **Interactive REPL** | `gemini` enters a chat loop with the AI agent | `helix chat` enters interactive mode |
| **Tool use architecture** | Agent has file_read, file_write, shell_exec, web_fetch as tools | Helix agent gets same tools + generation tools |
| **Checkpointing** | Auto-saves file state before modifications, `/restore` reverts | `helix chat` auto-checkpoints before evolve/file changes |
| **Context files** | `GEMINI.md` provides persistent project context | `HELIX.md` provides project context (replaces constitution) |
| **Headless mode** | `gemini -p "prompt"` for scripting/CI | `helix ask "prompt"` for scripting |
| **Non-interactive output** | `--output-format json` for programmatic use | Same flag on `helix ask` |
| **Session management** | Conversation history saved, resumable | Helix sessions auto-log to CMM |
| **MCP client** | `~/.gemini/settings.json` configures MCP servers | `~/.helix/settings.json` configures MCP servers |
| **@ mentions for MCP** | `@github list PRs` routes to specific MCP server | `@memory search "prisma"` routes to CMM |
| **Include directories** | `--include-directories ../lib` adds context | Same flag for Helix |
| **Rich TUI** | Markdown rendering, progress spinners, diff views | Same using `ink` or `blessed` |
| **Sandboxing** | Controlled shell execution with approval | Tool approval flow before destructive actions |

### DO NOT BORROW
- Google auth / OAuth flows
- Vertex AI integration
- Gemini-specific prompt engineering
- Google Search grounding (use web_fetch tool instead)
- The monorepo structure (packages/core, packages/cli split)
- SEA (single executable application) bundling
- evals/ framework (overkill for now)

---

## Integration Points (AD AI Engine Ecosystem)

### CMM (Cognitive Memory Manager)
- **Location:** MCP server at `/Users/dwidarad/Ai Studio/Cortex Memory`
- **Run script:** `/Users/dwidarad/Ai Studio/Cortex Memory/run_cmm.sh`
- **Store:** `/Users/dwidarad/.cognitive-memory/store`
- **Tools available via MCP:**
  - `get_cognitive_profile` — load project knowledge at session start
  - `search_memory` — find relevant past reasoning
  - `get_pitfalls` — known traps for this domain
  - `get_diagnostic_strategy` — proven debugging approaches
- **Integration:** Before generating or evolving, Helix queries CMM for relevant dead ends and pitfalls. After sessions, Helix logs discoveries/dead ends to CMM.

### Council (Multi-Model Deliberation)
- **Location:** MCP server at `/Users/dwidarad/Ai Studio/Council`
- **Command:** `/Users/dwidarad/Ai Studio/Council/.venv/bin/python /Users/dwidarad/Ai Studio/Council/mcp_server.py`
- **Tools available via MCP:**
  - `deliberate` — send question to multiple models, get synthesized verdict
  - `list_models` — show available council members
  - `get_history` — past deliberations
  - `get_presets` — pre-configured council compositions
  - `get_guide` — usage guide
- **Integration:** `helix council "Should I use Postgres or MongoDB for this schema?"` triggers multi-model deliberation for architecture decisions.

### OpenClaw (Multi-Agent Routing)
- **Location:** Ubuntu server at `dwidar@192.168.4.40`
- **Agents:** Zain (main), Aden (secondary)
- **Model routing:** minimax-m2.5 primary → deepseek/llama-3.3-70b fallbacks
- **Memory:** Felix memory system (local embeddings, all-MiniLM-L6-v2)
- **Integration:** `helix route "complex task"` can delegate to OpenClaw agents for multi-step autonomous work.

---

## Sprint 7: Interactive Agent Mode (`helix chat`)
**Version target:** v14.0.0
**Goal:** Transform Helix from a one-shot generator into an interactive terminal agent

### New Commands
| Command | Description |
|---------|-------------|
| `helix chat` | Enter interactive REPL agent mode |
| `helix ask "prompt"` | One-shot question (headless mode) |
| `/help` | Show available slash commands in chat |
| `/clear` | Clear conversation history |
| `/exit` | Exit chat mode |
| `/checkpoint` | Manually save current state |
| `/restore` | Restore from a checkpoint |
| `/context` | Show loaded context (files, MCP servers) |
| `/cost` | Show token usage for current session |

### Architecture Changes

#### New files to create:
```
src/
├── chat/
│   ├── index.ts              # Chat mode entry point
│   ├── repl.ts               # REPL loop (readline + rich display)
│   ├── agent.ts              # Agent loop: think → act → observe
│   ├── tools/
│   │   ├── index.ts          # Tool registry
│   │   ├── file_read.ts      # Read file contents
│   │   ├── file_write.ts     # Write/create files (with checkpoint)
│   │   ├── file_edit.ts      # Edit files with diff (with checkpoint)
│   │   ├── shell_exec.ts     # Execute shell commands (sandboxed)
│   │   ├── web_fetch.ts      # Fetch URL content
│   │   ├── list_dir.ts       # List directory contents
│   │   ├── search_files.ts   # Ripgrep-style file search
│   │   ├── spawn_app.ts      # Generate app (existing helix spawn)
│   │   ├── evolve_app.ts     # Modify app (existing helix evolve)
│   │   └── deploy_app.ts     # Deploy app (existing helix deploy)
│   ├── context/
│   │   ├── index.ts          # Context manager
│   │   ├── project.ts        # Auto-detect project structure
│   │   ├── helix_md.ts       # Load HELIX.md context file
│   │   └── history.ts        # Conversation history
│   ├── checkpoints/
│   │   ├── index.ts          # Checkpoint manager
│   │   ├── git_shadow.ts     # Shadow git repo for file snapshots
│   │   └── restore.ts        # Restore logic
│   └── display/
│       ├── index.ts          # TUI renderer
│       ├── markdown.ts       # Terminal markdown rendering
│       ├── diff.ts           # Colored diff display
│       ├── spinner.ts        # Progress indicators
│       └── tool_output.ts    # Format tool outputs
```

#### Files to modify:
- `src/bin/helix.ts` — Add `chat` and `ask` commands to commander
- `src/openrouter.ts` — Add streaming support + tool-use API format
- `package.json` — Add deps: `ink`, `chalk`, `marked-terminal`, `diff`

### Tool Use Architecture

The agent loop follows the standard ReAct pattern:
```typescript
interface Tool {
  name: string;
  description: string;
  parameters: Record<string, ToolParam>;
  execute(args: Record<string, unknown>): Promise<ToolResult>;
  requiresApproval?: boolean;  // true for file_write, shell_exec
}

interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

// Agent loop
async function agentLoop(userMessage: string, context: Context): Promise<void> {
  const messages = [...context.history, { role: 'user', content: userMessage }];
  
  while (true) {
    const response = await openrouter.chat({
      messages,
      tools: toolRegistry.getToolSchemas(),
      stream: true,
    });
    
    if (response.type === 'text') {
      display.renderMarkdown(response.content);
      break;
    }
    
    if (response.type === 'tool_call') {
      const tool = toolRegistry.get(response.toolName);
      if (tool.requiresApproval) {
        const approved = await display.confirmToolUse(response);
        if (!approved) { messages.push(refusalMessage); continue; }
      }
      if (tool.name.startsWith('file_')) checkpoint.save();
      const result = await tool.execute(response.args);
      messages.push(toolResultMessage(result));
    }
  }
}
```

### Context File: HELIX.md
```markdown
# Project Context for Helix

This file provides persistent context to Helix's interactive agent.
Place it at the root of your project (like GEMINI.md or CLAUDE.md).

## Architecture Decisions
- Using Prisma with PostgreSQL
- Following repository pattern for data access
- All API routes require authentication

## Coding Style
- Use functional components with hooks
- Prefer named exports
- Error handling with custom AppError class

## Known Constraints
- Must support Node 18+
- No server-side rendering for dashboard pages
- Redis required for real-time features
```

### Dependencies to Add
```json
{
  "ink": "^5.0.0",
  "ink-text-input": "^6.0.0",
  "marked": "^14.0.0",
  "marked-terminal": "^7.0.0",
  "diff": "^7.0.0",
  "ora": "^8.0.0",
  "simple-git": "^3.25.0"
}
```

### Tests to Write
- `tests/chat/repl.test.ts` — REPL handles input/output correctly
- `tests/chat/agent.test.ts` — Agent loop handles tool calls
- `tests/chat/tools/file_read.test.ts` — File reading works
- `tests/chat/tools/shell_exec.test.ts` — Shell execution sandboxed
- `tests/chat/checkpoint.test.ts` — Checkpoint save/restore works
- `tests/chat/context.test.ts` — Project context detection works

### Definition of Done (Sprint 7)
- [ ] `helix chat` enters interactive mode
- [ ] Agent can read files, write files, execute commands
- [ ] Tool approval flow works (asks before destructive actions)
- [ ] Checkpoints auto-created before file modifications
- [ ] `/restore` reverts to previous checkpoint
- [ ] HELIX.md loaded as context when present
- [ ] `helix ask "prompt"` works in headless mode
- [ ] Token cost displayed at end of session
- [ ] All tests pass

---

## Sprint 8: MCP Client Integration
**Version target:** v14.1.0
**Goal:** Helix connects to MCP servers natively (CMM, Council, any MCP)

### New Commands
| Command | Description |
|---------|-------------|
| `helix mcp list` | List configured MCP servers |
| `helix mcp status` | Show connection status of all servers |
| `helix mcp add <name>` | Add a new MCP server config |
| `@memory <query>` | Route to CMM in chat mode |
| `@council <question>` | Route to Council in chat mode |
| `@<server> <command>` | Route to any configured MCP server |

### Architecture Changes

#### New files to create:
```
src/
├── mcp/
│   ├── index.ts              # MCP client manager
│   ├── client.ts             # MCP client (stdio transport)
│   ├── registry.ts           # Server registry (from settings)
│   ├── tool_bridge.ts        # Bridge MCP tools → agent tools
│   └── config.ts             # Settings file management
```

#### Configuration: `~/.helix/settings.json`
```json
{
  "mcpServers": {
    "cognitive-memory": {
      "command": "/Users/dwidarad/Ai Studio/Cortex Memory/run_cmm.sh",
      "args": [],
      "autoConnect": true
    },
    "council": {
      "command": "/Users/dwidarad/Ai Studio/Council/.venv/bin/python",
      "args": ["/Users/dwidarad/Ai Studio/Council/mcp_server.py"],
      "autoConnect": false
    }
  },
  "defaultModel": "anthropic/claude-sonnet-4",
  "fallbackModels": ["deepseek/deepseek-chat", "meta-llama/llama-3.3-70b-instruct"]
}
```

#### Auto-behaviors with CMM:
```typescript
// Before generation (Sprint 9 evolve, existing spawn):
async function preGenerateCheck(prompt: string) {
  const pitfalls = await mcpClient.call('cognitive-memory', 'get_pitfalls', {
    project_id: currentProject,
  });
  const deadEnds = await mcpClient.call('cognitive-memory', 'search_memory', {
    query: prompt,
    project_id: currentProject,
  });
  if (deadEnds.length > 0) {
    display.warn(`⚠️ CMM found ${deadEnds.length} relevant past dead ends:`);
    deadEnds.forEach(d => display.renderDeadEnd(d));
  }
  return { pitfalls, deadEnds };  // Injected into generation prompt
}

// After session (auto):
async function postSessionLog(session: Session) {
  // Auto-log significant findings to CMM
  // (Only if session had errors → resolutions or notable discoveries)
}
```

### Dependencies to Add
```json
{
  "@modelcontextprotocol/sdk": "^1.27.0"
}
```

### Tests to Write
- `tests/mcp/client.test.ts` — MCP client connects/disconnects
- `tests/mcp/registry.test.ts` — Server registry loads from settings
- `tests/mcp/tool_bridge.test.ts` — MCP tools exposed to agent correctly
- `tests/mcp/cmm_integration.test.ts` — CMM pre-generate check works

### Definition of Done (Sprint 8)
- [ ] `~/.helix/settings.json` manages MCP server configs
- [ ] `helix mcp list/status` shows configured servers
- [ ] `@memory` and `@council` routing works in chat mode
- [ ] CMM auto-queried before app generation (pitfalls/dead ends)
- [ ] MCP tools appear as available tools in the agent loop
- [ ] All tests pass

---

## Sprint 9: Evolve Mode (Modify Existing Apps)
**Version target:** v15.0.0
**Goal:** Helix modifies existing projects — not just generates new ones

### Enhanced Commands
| Command | Description |
|---------|-------------|
| `helix evolve add-feature "user auth with Google"` | Add feature to existing project |
| `helix evolve refactor "split into microservices"` | Refactor existing code |
| `helix evolve fix "the login page crashes on mobile"` | Fix a bug with AI |
| `helix evolve migrate "upgrade to Next.js 15"` | Framework migration |

### Architecture Changes

#### New files:
```
src/
├── evolve/
│   ├── index.ts              # Evolve engine entry
│   ├── scanner.ts            # Scan existing project structure
│   ├── planner.ts            # Plan changes (diff preview)
│   ├── applier.ts            # Apply changes with checkpoints
│   ├── validator.ts          # Validate changes (build + test)
│   └── strategies/
│       ├── add_feature.ts    # Add new functionality
│       ├── refactor.ts       # Restructure existing code
│       ├── fix.ts            # Bug fixing
│       ├── migrate.ts        # Version/framework migration
│       └── optimize.ts       # Performance/a11y/SEO optimization
```

#### How Evolve Works:
```
User: helix evolve add-feature "user auth with Google OAuth"
  1. Scanner reads project structure (package.json, routes, models)
  2. CMM queried: "any dead ends with Google OAuth in Next.js?"
  3. Planner generates a change plan (which files, what changes)
  4. Display shows diff preview → user approves
  5. Checkpoint created
  6. Applier makes changes
  7. Validator runs: npm run build && npm test
  8. If build fails → self-heal loop (existing infrastructure)
  9. If tests fail → iterate or revert
  10. Log outcome to CMM (success or dead end)
```

### Key Design Decision
The evolve scanner MUST understand:
- Package.json → deps, scripts, framework version
- Prisma schema → existing data models
- App router structure → existing pages/routes
- Existing API routes → current endpoints
- Tailwind config → design tokens
- Environment variables → configured services

This is project-context-aware generation — the biggest gap in v13.

### Tests to Write
- `tests/evolve/scanner.test.ts` — Detects project structure correctly
- `tests/evolve/planner.test.ts` — Generates valid change plans
- `tests/evolve/validator.test.ts` — Build/test validation works
- `tests/evolve/strategies/*.test.ts` — Each strategy generates correct output

### Definition of Done (Sprint 9)
- [ ] `helix evolve add-feature "..."` adds features to existing projects
- [ ] Scanner correctly identifies project structure (Next.js, Prisma, etc.)
- [ ] Diff preview shown before changes applied
- [ ] Checkpoint created before modifications
- [ ] Self-heal loop handles build failures
- [ ] CMM queried before and logged after evolve operations
- [ ] All tests pass

---

## Sprint 10: Council Integration + Architecture Decisions
**Version target:** v15.1.0
**Goal:** Multi-model deliberation for significant architecture decisions

### New Commands
| Command | Description |
|---------|-------------|
| `helix council "question"` | Ask Council for architecture advice |
| `helix council --preset technical` | Use a pre-configured council composition |

### Architecture Changes

#### New files:
```
src/
├── council/
│   ├── index.ts              # Council integration
│   ├── triggers.ts           # Auto-detect when to invoke Council
│   └── formatter.ts          # Format Council verdicts for terminal
```

#### Auto-triggers for Council:
Council is automatically invoked when the agent encounters:
- Database choice ambiguity ("Should I use Postgres or MongoDB?")
- Architecture pattern decisions ("Monolith vs microservices?")
- Framework version conflicts ("Upgrade to React 19 or stay on 18?")
- Security-sensitive choices ("How to handle JWT refresh?")

The agent recognizes these via prompt engineering and routes to Council transparently.

### Definition of Done (Sprint 10)
- [ ] `helix council "question"` triggers deliberation
- [ ] Council verdict displayed with per-model reasoning
- [ ] Auto-trigger detects architecture decisions in chat mode
- [ ] Council results logged to CMM as decision precedents
- [ ] All tests pass

---

## Sprint 11: Style Learning + Quality Audits
**Version target:** v15.2.0
**Goal:** Helix learns YOUR coding style and generates increasingly personalized code

### New Features
- `~/.helix/style.json` — learned preferences (auto-updated)
- `helix style show` — display current learned preferences
- `helix style reset` — clear learned preferences
- `helix audit <project>` — run quality audit (a11y, perf, SEO, security)

### Architecture Changes

#### New files:
```
src/
├── style/
│   ├── index.ts              # Style engine
│   ├── learner.ts            # Extract patterns from user's code
│   ├── preferences.ts        # Preference storage + retrieval
│   └── injector.ts           # Inject style into generation prompts
├── audit/
│   ├── index.ts              # Audit engine
│   ├── accessibility.ts      # a11y audit
│   ├── performance.ts        # Performance audit
│   ├── seo.ts                # SEO audit
│   └── security.ts           # Security audit
```

#### How Style Learning Works:
```
1. When user has existing code in the project:
   - Scan for patterns: naming conventions, component structure,
     import style, error handling patterns, test patterns
   - Store as ~/.helix/style.json

2. When generating/evolving:
   - Inject style preferences into AI prompts
   - "The user prefers: functional components, named exports,
     camelCase variables, Zod for validation, custom error classes"

3. Over time:
   - Track which generated code the user keeps vs. modifies
   - Update preferences based on observed behavior
```

### Definition of Done (Sprint 11)
- [ ] Style learner extracts patterns from existing code
- [ ] Generated code matches detected preferences
- [ ] `helix audit` produces actionable quality report
- [ ] Quality issues auto-suggested during evolve operations
- [ ] All tests pass

---

## Sprint 12: Deploy + Monitor + Git Workflows
**Version target:** v16.0.0 🎉
**Goal:** Full development loop — generate → deploy → monitor → iterate

### Enhanced Commands
| Command | Description |
|---------|-------------|
| `helix deploy --vercel` | Deploy to Vercel (enhanced) |
| `helix deploy --railway` | Deploy to Railway |
| `helix deploy --netlify` | Deploy to Netlify |
| `helix monitor <url>` | Basic uptime + error monitoring |
| `helix pr create` | Create GitHub PR from current changes |
| `helix pr review` | AI-review of current branch diff |
| `helix changelog` | Generate changelog from git history |

### Architecture Changes

#### New files:
```
src/
├── deploy/
│   ├── index.ts              # Deploy orchestrator
│   ├── vercel.ts             # Vercel CLI integration
│   ├── railway.ts            # Railway CLI integration
│   ├── netlify.ts            # Netlify CLI integration
│   └── env_sync.ts           # Sync .env → provider env vars
├── git/
│   ├── index.ts              # Git workflow engine
│   ├── pr.ts                 # PR creation + review
│   ├── changelog.ts          # Changelog generation
│   └── branch.ts             # Branch management
├── monitor/
│   ├── index.ts              # Monitor engine
│   └── uptime.ts             # Basic uptime check
```

### Definition of Done (Sprint 12 = v16.0.0)
- [ ] Deploy to Vercel/Railway/Netlify works from CLI
- [ ] Environment variables synced to deploy target
- [ ] `helix pr create` generates PR with AI-written description
- [ ] `helix pr review` produces code review of current diff
- [ ] `helix changelog` generates structured changelog
- [ ] `helix monitor` does basic health checks
- [ ] All tests pass
- [ ] README updated with all v14-v16 features
- [ ] npm publish v16.0.0

---

## Expanded .helix DSL (Cumulative across sprints)

### Current (v13):
```helix
STRAND, VIEW, PAGE
```

### Additions for v15-v16:
```helix
// Agent definition (v15.1)
AGENT CustomerSupport {
  model: "anthropic/claude-sonnet-4"
  tools: [search_faq, create_ticket, escalate]
  memory: "session"          // or "persistent" for CMM-backed
  trigger: "webhook:/support"
}

// Workflow definition (v15.2)
WORKFLOW OnboardingFlow {
  step: CreateAccount -> VerifyEmail -> SetupProfile -> Welcome
  retry: 3
  timeout: "5m"
}

// Integration definition (v16)
INTEGRATION Stripe {
  webhooks: [checkout.session.completed, invoice.paid]
  actions: [create_customer, create_subscription]
}

// Deploy target (v16)
DEPLOY Production {
  target: vercel
  env: .env.production
  branch: main
  auto: true  // deploy on push to main
}
```

---

## OpenClaw Integration (Optional Sprint — post v16)

### What it enables:
- `helix route "build and deploy the new landing page"` → delegates to Zain agent
- Multi-step autonomous tasks that exceed a single CLI session
- Model routing through OpenClaw's intelligence layer (minimax → deepseek → llama)

### Configuration:
```json
// ~/.helix/settings.json
{
  "openclaw": {
    "host": "192.168.4.40",
    "port": 3000,
    "agents": ["zain", "aden"],
    "defaultAgent": "zain"
  }
}
```

### Implementation approach:
- OpenClaw exposes a REST API
- Helix sends tasks via HTTP
- Responses streamed back to terminal
- Long-running tasks run on Ubuntu server, Helix polls for completion

---

## Non-Functional Requirements

### Performance
- Chat mode: first response in < 3 seconds
- Tool execution: < 500ms for file ops, < 2s for shell commands
- MCP connection: < 1s cold start per server
- Checkpoint creation: < 200ms

### Security
- Shell commands require explicit approval (except in `--trust` mode)
- File writes show diff before applying
- No API keys stored in plain text (use .env or system keychain)
- MCP servers only connect to locally-configured paths

### Compatibility
- Node.js 18+
- macOS, Linux, Windows (WSL)
- Works alongside Claude Code, Cursor, etc. (no conflicts)
- MCP servers compatible with any MCP host

---

## Implementation Notes for Claude Code

### Session Strategy
Each sprint = 1 Claude Code session. Start each session by:
1. Reading this document as context
2. Running `npm test` to verify current state
3. Implementing the sprint's features
4. Running `npm test` after implementation
5. Running `npm run build` to verify TypeScript compiles
6. Committing with: `git commit -m "feat: vX.Y — Sprint N description"`

### Key Principles
- Keep existing commands working (don't break spawn, generate, evolve)
- New features as plugins where possible (Sprint 6 plugin system)
- TypeScript strict mode — no `any` types
- Every new file has a corresponding test file
- Use existing `openrouter.ts` for AI calls — don't create new clients
- Error messages should be actionable ("Try X" not just "Failed")
- Streaming responses by default in chat mode

### Testing Strategy
```bash
npm test                    # All tests pass
npm run build               # TypeScript compiles clean
helix doctor                # Health check passes
helix spawn "test app"      # Existing generation still works
helix chat                  # New chat mode works
```
