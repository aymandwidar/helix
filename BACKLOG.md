# Helix Sprint Backlog

> **Claude Code:** When asked to "build next item" or "build from backlog", pick the TOP item under 🔨 Next Up. Build it following the patterns in CLAUDE.md. When done, move the item to ✅ Done with the date.

---

## 🔨 Next Up (Build These)

- [ ] **`/teach`** — Persistent user corrections stored in CMM. When user says `/teach "always use const, never var"`, call CMM MCP `log_new_discovery` with `node_type="RULE"`, `confidence=1.0`. On every future session start, auto-inject all RULE nodes as system context. Implementation: `src/chat/commands/teach.ts` + `src/mcp/cmm_rules.ts`

- [ ] **`/inherit <project>`** — Cross-project learning from CMM. Queries CMM for all knowledge from a referenced project, injects relevant patterns (dead ends, solutions, rules) into current session. Implementation: `src/chat/commands/inherit.ts`

- [ ] **`--production-grade` flag** — Full 100% generation (not just the 80%). When flag is set, generation includes: error boundaries, input validation (zod), rate limiting, security headers, accessibility (ARIA), SEO meta, structured logging, health check endpoint, env validation, graceful shutdown, API docs. Implementation: enhance `src/architect.ts` with production-grade prompt additions when flag detected

- [ ] **`/regression-guard`** — Before any evolve/edit: snapshot test results. After change: re-run tests. If any NEW failures: auto-revert via checkpoint, report what broke. Implementation: `src/evolve/regression_guard.ts`

- [ ] **Block-based TUI** — Each tool call + result renders as a collapsible block with copy button (Warp Terminal style). Implementation: enhance `src/chat/display/tool_output.ts`

---

## 📋 Queued (From Feature Scout — Not Yet Prioritized)

- [ ] `/cost-predict` — Estimate tokens + cost before generation
- [ ] `/explain-diff` — Plain English explanation of each change
- [ ] `/loop <interval> <goal>` — Self-pacing interval mode
- [ ] `/review` — Multi-agent parallel code review (security, perf, a11y, types, tests)
- [ ] `/compress` — Summarize conversation so far to free context window
- [ ] `/model <name>` — Hot-swap models mid-session
- [ ] `/effort <level>` — Dial quality vs speed/cost
- [ ] `/monitor <command>` — Tail a process, inject events into agent loop
- [ ] `/background <task>` — Run task autonomously, notify on completion
- [ ] `/threads` — Multi-thread project view (parallel tasks)
- [ ] Sandboxed execution (optional Docker mode for shell_exec)
- [ ] Design-driven generation (`/from-design screenshot.png`)
- [ ] Visual verification (`/verify` — screenshot + vision model check)

---

## ✅ Done

- [x] **Sprint 7 (v14.0)** — Interactive agent mode, 10 tools, checkpointing, context-aware — May 29
- [x] **Sprint 8 (v14.1)** — MCP client, CMM auto-query, hooks, subagents, streaming — May 29
- [x] **Sprint 9 (v15.0)** — Evolve mode: scan → plan → apply → validate → self-heal — May 29
- [x] **Sprint 10 (v15.1)** — Council integration, auto-mode permissions, plugins v2 — May 29
- [x] **Sprint 11 (v15.2)** — [building now]

---

## How to Add Items

When the Helix Feature Scout delivers a daily report, tell Quick: "Add [feature] to the Helix backlog" — it will be appended to 📋 Queued. When you're ready to build, tell Quick: "Move [feature] to next up" — it moves to 🔨.
