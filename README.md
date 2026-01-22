# 🧬 HELIX

**One-Shot Full-Stack Application Generator**

Transform natural language descriptions into fully functional Next.js applications with a single command.

```bash
helix spawn "A recipe manager with ingredients and cook time"
# → Complete app with database, API, and styled UI in ~60 seconds
```

---

## ✨ What is Helix?

Helix is an AI-powered application generator that creates complete, production-ready Next.js applications from plain English descriptions. Unlike traditional scaffolding tools that produce empty boilerplates, Helix generates **working applications** with:

- 🗃️ **SQLite Database** (Prisma ORM)
- 🔌 **REST API Routes** (GET, POST, PUT, DELETE)
- 🎨 **React Components** with full CRUD interfaces
- 🌙 **Dark Mode Theme** with glassmorphism effects

---

## 🚀 Quick Start

### Installation

```bash
npm install -g helix-lang
```

### Generate Your First App

```bash
helix spawn "A task manager with projects and deadlines"
```

That's it. Open `localhost:3000` and you have a working app.

---

## 📋 Commands

| Command | Description |
|---------|-------------|
| `helix spawn "prompt"` | Generate complete app from description |
| `helix spawn "prompt" --context file.md` | Use constitution file for guidance |
| `helix generate blueprint.helix` | Regenerate from existing blueprint |
| `helix run` | Start the development server |
| `helix new project-name` | Create empty Helix project |

---

## 🧬 The Helix DSL

Helix uses a simple blueprint language (`.helix` files):

```helix
STRAND Agent {
  name: String
  callsign: String
  rank: String        // Rookie, Veteran, Elite
  status: String      // Active, KIA
}

STRAND Mission {
  codename: String
  region: String
  priority: String    // Alpha, Bravo, Omega
}

VIEW Dashboard {
  list: Agent.all
  list: Mission.all
}
```

**Strand** = Data model → Prisma schema + API route + TypeScript interface  
**View** = UI component → React page with forms and lists

---

## 🎯 Key Features

### Multi-Strand Dashboards
Define multiple data types → Get multiple sections, each with its own Add/List/Delete UI.

```bash
helix spawn "A CRM with Contacts, Companies, and Deals"
# → Dashboard with 3 sections, 3 Add buttons, 3 data lists
```

### CRUD-by-Default
Every app includes data mutation capabilities:
- ➕ Add buttons with modal forms
- ✏️ Inline editing support
- 🗑️ Delete with confirmation

### Constitution Support
Influence generation with context files:
```bash
helix spawn "..." --context "my-design-system.md"
```

### Dark Mode Tactical Theme
Premium "Deep Void" aesthetic:
- Gradient backgrounds
- Glassmorphism effects
- Translucent dark inputs
- Amber focus accents

---

## 🛠️ Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16+ (App Router) |
| Language | TypeScript |
| Database | SQLite + Prisma ORM |
| Styling | Tailwind CSS |
| AI | OpenRouter (Claude 3.5 Sonnet) |

---

## 📦 Example Prompts

```bash
# Project Management
helix spawn "A project tracker with Tasks, Milestones, and Team Members"

# Inventory System
helix spawn "A warehouse inventory with Products, Locations, and Stock Movements"

# Game Development
helix spawn "A tactical command system with Agents, Missions, and Intel"

# Education
helix spawn "A course manager with Students, Courses, and Assignments"
```

---

## ⚡ Helix vs Traditional Tools

| Aspect | Traditional | Helix |
|--------|-------------|-------|
| Output | Empty boilerplate | Working app |
| Setup time | Hours | ~60 seconds |
| Database | Manual config | Auto-generated |
| API routes | Manual coding | Auto-generated |
| UI components | Manual coding | Auto-generated |
| Multi-model | Manual wiring | Automatic |

---

## 📖 Environment Setup

Create a `.env` file with your API key:

```env
OPENROUTER_API_KEY=your_key_here
```

---

## 🧬 Version

**v4.2** - Multi-strand dashboards, dark mode inputs, CRUD-by-default

---

## 📜 License

MIT

---

> **"Describe it once, run it immediately."**
