# Helix v14–v16 Requirements Specification
**Document Purpose:** Master blueprint for Claude Code implementation sessions. Incorporates best patterns from Claude Code (leaked architecture, March 31 2026), Gemini CLI, and AD AI Engine unique capabilities (CMM, Council, OpenClaw).
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

---

## Architecture Patterns from Claude Code (Leaked Source, March 31 2026)

**Context:** On March 31, 2026, Anthropic accidentally published 512,000 lines of Claude Code source (TypeScript) via npm source map. The community analyzed the architecture. Below are the patterns Helix MUST adopt — reimplemented fresh (not copied) to avoid legal risk.

### Core Architecture (from QueryEngine.ts)
Claude Code's heart is a unified reasoning loop:
```
User prompt → LLM reasoning → Tool selection → Permission check → Execution → Observe result → Loop
```
This is identical to what Sprint 7 built. ✅ Already implemented in `src/chat/agent.ts`.

### Patterns to Incorporate Across Sprints:

#### 1. Hooks System (Add in Sprint 8)
Pre/post execution hooks that fire around every tool call:
```typescript
// src/chat/hooks/index.ts
interface ToolHook {
  name: string;
  when: 'before' | 'after';
  tool: string | '*';  // '*' = all tools
  handler: (context: HookContext) => Promise<HookResult>;
}

// Example: CMM auto-log hook fires AFTER every session
const cmmAutoLog: ToolHook = {
  name: 'cmm-session-log',
  when: 'after',
  tool: '*',
  handler: async (ctx) => {
    if (ctx.sessionEnding) {
      await mcpClient.call('cognitive-memory', 'log_new_discovery', {
        session_id: ctx.sessionId,
        node_type: ctx.succeeded ? 'SOLUTION' : 'DEAD_END',
        content: ctx.summary,
        confidence: ctx.succeeded ? 0.8 : 0.6
      });
    }
    return { continue: true };
  }
};
```

#### 2. Subagent Spawning (Add in Sprint 9 — Evolve Mode)
Claude Code spawns child processes for parallel subtasks:
```typescript
// src/chat/subagent.ts
interface SubagentConfig {
  task: string;
  tools: string[];        // restricted tool set
  maxTurns: number;
  budget: number;         // token budget cap
  reportTo: 'parent' | 'user';
}

// Usage in evolve mode:
// "Add auth to all 5 routes" → spawn 5 subagents, each handles one route
const results = await Promise.all(
  routes.map(route => spawnSubagent({
    task: `Add NextAuth.js protection to ${route.path}`,
    tools: ['file_read', 'file_edit'],
    maxTurns: 10,
    budget: 5000,
    reportTo: 'parent'
  }))
);
```

#### 3. Streaming Output (Add in Sprint 8)
Tokens stream to terminal as they generate — feels instant:
```typescript
// src/chat/display/stream.ts
async function streamResponse(generator: AsyncGenerator<string>): Promise<string> {
  let full = '';
  for await (const chunk of generator) {
    process.stdout.write(chunk);  // immediate display
    full += chunk;
  }
  process.stdout.write('\n');
  return full;
}
```
Integrate with OpenRouter's streaming endpoint (`stream: true` in API call).

#### 4. Multi-turn Context Compression (Add in Sprint 11 — maps to v19 efficiency)
Claude Code prunes old turns when context gets long:
```typescript
// src/chat/context/compressor.ts
interface CompressionStrategy {
  maxTokens: number;       // trigger compression above this
  keepRecent: number;      // always keep last N turns
  summarizeOlder: boolean; // summarize older turns into one block
  preserveTools: boolean;  // keep tool calls/results (they're factual)
}

// Strategy: keep last 10 turns verbatim, summarize everything older
// Result: 100-turn session stays under 8K tokens
```

#### 5. Git-Aware Context (Add in Sprint 12)
Claude Code reads git state before every action:
```typescript
// src/chat/context/git.ts
interface GitContext {
  branch: string;
  uncommittedFiles: string[];
  recentCommits: { hash: string; message: string; date: string }[];
  hasStash: boolean;
  remoteStatus: 'ahead' | 'behind' | 'diverged' | 'up-to-date';
}

// Auto-injected into system prompt:
// "You are on branch `feature/auth`. 3 uncommitted files. Last commit: 'add login page' (2h ago)."
```

#### 6. Permission Tiers (Enhance Sprint 7's existing approval)
Claude Code has 4 permission levels:
```typescript
type PermissionLevel = 
  | 'always_allow'    // file_read, list_dir, search — never asks
  | 'auto_approve'    // file_write in project dir — approves silently
  | 'ask_once'        // shell_exec — asks first time, remembers for session
  | 'always_ask';     // deploy, git push, destructive ops — always confirms

// Store per-session: { [toolName]: PermissionLevel }
// User can: /allow file_write, /deny shell_exec, /trust (allow all)
```

#### 7. HELIX.md Per-Project Instructions (Already implemented ✅)
Same as Claude's `CLAUDE.md` — project-level persistent instructions that customize behavior.

#### 8. Compact Tool Results (Token efficiency — integrates with v19)
Claude Code strips verbose tool output before feeding back to LLM:
```typescript
// src/chat/tools/compact.ts
function compactToolResult(tool: string, result: string, maxChars: number = 2000): string {
  if (result.length <= maxChars) return result;
  
  // For file reads: keep first 500 + last 500 + "...truncated N lines..."
  // For shell output: keep last 1000 chars (most relevant)
  // For search results: keep top 5 matches only
  // For web fetch: strip HTML, keep text, truncate
}
```

#### 9. Session Persistence + Resume (Add in Sprint 8)
Claude Code can resume interrupted sessions:
```typescript
// src/chat/session/persistence.ts
interface PersistedSession {
  id: string;
  startedAt: string;
  messages: Message[];
  checkpoints: Checkpoint[];
  toolApprovals: Record<string, PermissionLevel>;
  projectPath: string;
  model: string;
  totalCost: number;
}

// Commands: /save, /resume <session-id>, /sessions (list recent)
// Auto-save on exit (unless /exit --no-save)
```

#### 10. OpenClaw Integration (Post-v16 / Sprint 13+)
Route complex multi-step tasks to OpenClaw's agent swarm:
```typescript
// src/integrations/openclaw.ts
interface OpenClawConfig {
  host: string;              // "192.168.4.40"
  port: number;
  agents: {
    zain: { model: string; workspace: string };
    aden: { model: string; workspace: string };
  };
  routing: {
    primary: string;         // "minimax/minimax-m2.5"
    fallbacks: string[];     // ["deepseek/deepseek-chat", "meta-llama/llama-3.3-70b"]
  };
}

// In chat: "helix route 'research competitor pricing and generate a comparison table'"
// → delegates to Zain agent, returns structured result
```

---

### Legal Note (Original Leak)
DO NOT copy code from Claude Code forks (Claw Code, claude-code-rev, etc.). The source was accidentally published and remains proprietary Anthropic IP. We are reimplementing PATTERNS (architectural concepts, UX flows, interaction designs) — not copying source. All Helix code must be original TypeScript authored from scratch.

---

---

## Claude Code Latest Features (May 2026) — Additional Patterns for Helix

**Source:** Official Claude Code docs, changelog, and weekly digests (code.claude.com). These are PUBLIC features we can study and reimplement.

### HIGH-PRIORITY Features to Add (Unique, High-Impact)

#### 1. `/goal` — Persistent Goal Mode (Week 20, May 11-15)
Keeps Claude working across turns until a completion condition holds. No repeated prompting.
```
helix> /goal "All tests pass and the app builds clean"
# Helix keeps working autonomously until condition met
# Shows progress, asks questions only when blocked
```
**Add in:** Sprint 9 (Evolve mode) — perfect for "fix all linting errors" or "make all tests pass"

#### 2. `/loop` — Self-Pacing Interval Mode (Week 15, Apr 6-10)
Runs on an interval, checking/acting periodically. Like a cron for your agent.
```
helix> /loop 30s "watch for TypeScript errors and fix them"
# Every 30 seconds: check → fix → report
```
**Add in:** Sprint 11 (Quality audits) — continuous quality monitoring

#### 3. Monitor Tool (Week 15, Apr 6-10)
Streams background events into the conversation (tail logs, watch build output, react live).
```typescript
// src/chat/tools/monitor.ts
// Tails a file or process output, injects events into the agent loop
// Example: monitor the dev server while making changes
helix> /monitor "npm run dev"
# Agent sees build errors in real-time as it edits files
```
**Add in:** Sprint 11 or Sprint 12

#### 4. Auto Mode — Permission Classifier (Week 13, Mar 23-27)
A classifier handles permission prompts: safe actions run without interruption, risky ones get blocked. Middle ground between "approve everything" and "ask every time."
```typescript
// src/chat/permissions/auto_classifier.ts
interface AutoModeConfig {
  safe: string[];      // ['file_read', 'list_dir', 'search_files'] — never ask
  risky: string[];     // ['shell_exec', 'deploy_app'] — always ask
  classify: string[];  // ['file_write', 'file_edit'] — AI decides based on context
}
```
**Add in:** Sprint 10 (enhances Sprint 7's permission system)

#### 5. Plugin System — Full Component Model (Week 19, May 4-8)
Claude Code plugins are shareable packages containing: skills, agents, hooks, MCP servers, LSP servers, monitors, themes.
```
helix-plugin/
├── manifest.json           # Plugin metadata + component declarations
├── skills/                 # Custom slash commands
├── agents/                 # Subagent definitions
├── hooks/                  # Pre/post execution hooks
├── mcp-servers/            # Bundled MCP servers
├── monitors/               # Background watchers
└── themes/                 # UI themes
```
**Add in:** Sprint 10 or Sprint 11 — Helix's Sprint 6 plugin system is simpler (generator plugins only). Expand to match Claude Code's full component model.

#### 6. Ultrareview — Cloud Multi-Agent Code Review (Week 17-18, Apr 20-May 1)
A fleet of bug-hunting agents runs in parallel, findings land back in CLI.
```
helix> /review
# Spawns N subagents, each checks different aspect:
#   - Security vulnerabilities
#   - Performance issues
#   - Accessibility gaps
#   - Type safety
#   - Test coverage gaps
# Results aggregated and presented
```
**Add in:** Sprint 11 (Quality audits) — leverages the subagent system from Sprint 8

#### 7. Ultraplan — Cloud Planning (Week 15, Apr 6-10)
Draft a plan, review/comment in web editor, then execute remotely or locally.
```
helix> /plan "Add user authentication to the recipe app"
# Generates structured plan with steps
# User can edit/approve each step
# Then: /plan execute — runs the plan step by step
```
**Add in:** Sprint 9 (Evolve mode) — plan before modifying existing apps

#### 8. Context Compression — "Summarize up to here" (Week 20, May 11-15)
Rewind menu can compress earlier context. Keeps sessions cheap.
```
helix> /compress
# Summarizes conversation so far into ~500 tokens
# Frees context window for new work
# Original context still in checkpoints if needed
```
**Add in:** Sprint 11 (Token efficiency / v19 prep)

#### 9. Agent View — Session Dashboard (Week 20, May 11-15)
One screen for every session: what's running, what's blocked, what's done.
```
helix> /agents
# Shows all active subagents, their status, results
# Click to inspect, cancel, or steer
```
**Add in:** Sprint 10 or Sprint 12 — once subagents are working (Sprint 8)

#### 10. Computer Use — GUI Interaction (Week 14, Mar 30-Apr 3)
Claude can open native apps, click through UI, verify changes visually.
```
helix> /verify-visual
# Opens the generated app in browser
# Takes screenshot, analyzes layout
# Reports visual issues (overlapping elements, broken responsive)
```
**Add in:** v17+ (Desktop app phase) — requires Tauri shell access

### MEDIUM-PRIORITY (Nice-to-Have)

| Feature | What it does | Sprint |
|---|---|---|
| `/usage` | Shows what's driving token costs | Sprint 11 |
| Custom themes (`/theme`) | Terminal color palettes | Sprint 12 |
| Session recap | Shows what happened while unfocused | Sprint 10 |
| Conditional `if` hooks | Hooks fire only when condition met | Sprint 10 |
| Effort levels (`/effort`) | Dial quality vs speed | Sprint 11 |
| Native binaries | Faster startup (no Node bootstrap) | v18+ (Rust rewrite) |
| Mobile push notifications | Alert when task finishes | v17 (mobile companion) |


### Updated Sprint Map with New Features

| Sprint | Version | Core Goal | + Claude Code Features |
|---|---|---|---|
| 7 | v14.0 | Interactive agent mode | ✅ Done |
| 8 | v14.1 | MCP + CMM + Hooks + Streaming + Subagents | ✅ Done |
| 9 | v15.0 | Evolve mode (modify existing apps) | + /goal, /plan |
| 10 | v15.1 | Council + Auto-mode permissions + Plugins v2 | + Auto classifier, agent view, session recap |
| 11 | v15.2 | Quality audits + Token efficiency | + /loop, /review (ultrareview), /compress, /effort, monitors |
| 12 | v16.0 | Deploy + Git workflows + Themes | + Git-aware context, themes, /usage |

---

---

## OpenAI Codex Architecture Patterns — What Makes It Great

**Source:** Official docs (developers.openai.com/codex), Ars Technica deep dive, ai-rockstars.com architecture analysis. Codex is OpenAI's competing coding agent ($200/mo Pro plan).

### Key Patterns to Adopt

#### 1. The "Think-Act-Observe" Loop (Codex's Core)
Codex doesn't just respond — it runs a continuous cycle:
```
Context Retrieval → Reasoning & Decision → Tool Execution → Feedback Loop → Repeat
```
- **State persistence between commands** — remembers what ran, what exit codes were, what files changed
- **stderr as input, not failure** — error messages become new context for self-correction
- **Constraint decoding** — forces model to emit ONLY valid shell/code (no prose, no markdown explanations during execution)

**For Helix:** The agent loop in Sprint 7 already does this. Enhance with:
- Strict output mode during tool execution (no explanations, just code)
- stderr capture → automatic retry with corrected command
- Session state persists across `helix chat` restarts (Sprint 8 session persistence covers this)

#### 2. Self-Healing Capabilities
When a command fails, Codex reads the error, understands it, and generates a corrected version automatically. No human intervention.
```typescript
// src/chat/self_heal.ts (enhance existing self-heal.ts)
interface SelfHealConfig {
  maxRetries: number;        // default: 3
  backoffStrategy: 'none' | 'linear';
  captureStderr: boolean;    // feed errors back to model
  autoFix: boolean;          // attempt fix without asking user
}

// In agent loop: if tool returns error → inject error into next prompt → retry
// "The command failed with: Permission denied. Adjusting to use sudo..."
```
**For Helix:** Already have self-heal for BUILD errors (Sprint 3). Extend to ALL tool execution — shell commands, deploys, file operations. Any error → auto-retry with fix.

#### 3. Token Economy — Sliding Window + Output Truncation
Codex keeps only last 3-5 interactions in active memory. Long outputs get truncated with `head`/`tail`.
```typescript
// src/chat/context/sliding_window.ts
interface SlidingWindowConfig {
  keepLastN: number;          // keep last N turns verbatim
  truncateOutputAt: number;   // max chars per tool result
  truncateStrategy: 'head' | 'tail' | 'head+tail';
  totalBudget: number;        // max tokens in context
}
```
**For Helix:** Maps to v19 token efficiency sprint + Sprint 11 context compression.

#### 4. Sandboxed Execution
Codex runs inside Docker containers for safety. The host system is never at risk.
```typescript
// src/chat/sandbox/index.ts
interface SandboxConfig {
  mode: 'native' | 'docker' | 'none';
  allowNetwork: boolean;
  allowFileWrite: boolean;
  mountPaths: string[];      // whitelist of accessible dirs
  timeout: number;           // max execution time per command
}
```
**For Helix:** Add optional sandboxing for `shell_exec` tool. Default to 'native' (user's machine), offer 'docker' mode for untrusted operations. Sprint 10 or Sprint 12.

#### 5. Multi-Thread Project View (Codex App)
The Codex app runs agents in separate threads organized by projects — seamless switching without losing context.
```
helix> /threads
# Active threads:
#   1. [recipe-app] Adding auth (3 turns, running)
#   2. [fleet-daemon] Fix BLE scanning (paused)
#   3. [helix-core] Sprint 9 evolve mode (done)
```
**For Helix:** Maps to Sprint 10 agent view + v17 desktop app.

#### 6. Background Mode
Codex can run tasks in the background, notify when done.
```
helix> /background "run all tests and fix failures"
# → runs autonomously, notifies on completion
# → results stored in /threads view
```
**For Helix:** Combine with `/goal` (from Claude Code) and subagents (Sprint 8). Sprint 11+.

---

## Cursor Composer 2.5 Architecture Patterns — What Developers Love

**Source:** Cursor 3 release (Apr 2 2026), Composer 2.5 (May 18 2026). Cursor = $29.3B valuation, $2B ARR. Agent users outnumber autocomplete users 2:1.

### Key Patterns to Adopt

#### 1. Multi-File Simultaneous Editing with Reviewable Diffs
Cursor edits multiple files at once, shows all changes as a unified diff view before applying.
```typescript
// src/chat/display/multi_diff.ts
interface MultiFileDiff {
  files: { path: string; hunks: DiffHunk[] }[];
  summary: string;           // "3 files changed: added auth middleware, updated 2 routes"
  reviewMode: boolean;       // if true, user approves before applying
}

// In evolve mode: "Add auth to all routes"
// → generates diffs for 5 files → shows unified view → user approves → applies all
```
**For Helix:** Sprint 9 (Evolve mode) — show all proposed changes before applying.

#### 2. Parallel Agents with Per-Task Scope (Cursor 3 "Agents Window")
Multiple agents run in parallel, each scoped to a specific task, sharing the same codebase but with isolated context.
```
helix> /parallel "fix tests" "add error handling" "update docs"
# 3 subagents spawn, work simultaneously
# Results merge when all complete
# Conflicts detected and surfaced for user resolution
```
**For Helix:** Already have subagent spawning (Sprint 8). Add the parallel command interface + conflict resolution in Sprint 10.

#### 3. Design-Driven Workflows (Composer)
Paste a screenshot/design → Cursor generates matching component code. References (images, URLs, Figma links) become generation context.
```
helix> /from-design screenshot.png "Make this responsive"
# Analyzes the screenshot → generates matching React/Tailwind code
# Uses vision model for layout understanding
```
**For Helix:** v17+ (requires vision model integration). Could be Sprint 12 if using OpenRouter's vision models.

#### 4. Effort Calibration
Composer 2.5 has effort levels — dial between quick/cheap vs thorough/expensive:
```
helix> /effort high
# All subsequent actions use more tokens, more thorough reasoning
helix> /effort low  
# Quick mode — fast, cheap, less thorough
```
**For Helix:** Sprint 11 (maps to Claude Code's `/effort` slider too).

#### 5. Integrated Browser
Cursor 3 has a built-in browser for testing generated web apps without leaving the IDE.
**For Helix:** Consider `helix preview` enhancement — open generated app in a browser pane from CLI. Already partially exists.

---

## SYNTHESIS: Helix's Unique Combination

After studying Claude Code, Codex, Cursor Composer, and Gemini CLI — Helix v16's moat is clear:

| Feature | Claude Code | Codex | Cursor | Helix v16 |
|---|---|---|---|---|
| Interactive terminal agent | ✅ | ✅ | ❌ (IDE) | ✅ |
| App generation from prompt | ❌ | ❌ | ❌ | ✅ |
| .helix DSL (declarative) | ❌ | ❌ | ❌ | ✅ |
| Persistent reasoning memory | ❌ | ❌ | ❌ | ✅ (CMM) |
| Multi-model deliberation | ❌ | ❌ | ❌ | ✅ (Council) |
| Self-healing builds | ❌ | Partial | Partial | ✅ (full) |
| Plugin ecosystem | ✅ | ❌ | ✅ | ✅ |
| Multi-agent routing | ❌ | ❌ | ❌ | ✅ (OpenClaw) |
| Free + open source | ❌ ($20/mo) | ❌ ($200/mo) | ❌ ($20/mo) | ✅ (MIT) |
| Deploy from CLI | ❌ | ❌ | ❌ | ✅ |

**Nobody else combines: generation + memory + deliberation + agents + free.** That's the moat. Build on it.

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
