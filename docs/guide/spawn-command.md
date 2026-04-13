# The spawn Command

`helix spawn` is Helix's flagship command — it generates a complete full-stack application from a natural language prompt.

## Usage

```bash
helix spawn "<prompt>" [options]
```

## Options

| Option | Default | Description |
|---|---|---|
| `-t, --target` | `web` | Target platform: `web` (Next.js) or `flutter` |
| `--theme` | `glassmorphism` | UI theme |
| `--db` | `sqlite` | Database: `sqlite`, `postgres`, `supabase` |
| `--connection-string` | — | Supabase/Postgres connection string |
| `--dry-run` | — | Preview blueprint without generating code |
| `--model` | DeepSeek V3 | AI model to use |

## Examples

```bash
# Basic app
helix spawn "A todo app with categories and due dates"

# With theme and database
helix spawn "An e-commerce store" --theme midnight --db postgres

# With Supabase
helix spawn "A blog platform" --db supabase --connection-string "postgresql://..."

# Preview only
helix spawn "A CRM system" --dry-run

# Flutter mobile app
helix spawn "A fitness tracker" --target flutter
```

## What Gets Generated

After running `helix spawn`, you'll find a complete project in `builds/<project-name>/`:

```
builds/my-project/
├── app/
│   ├── api/           # REST API routes
│   ├── (auth)/        # Auth pages (if auth block present)
│   └── [model]/       # CRUD pages for each strand
├── prisma/
│   └── schema.prisma  # Generated from .helix blueprint
├── components/        # UI components
├── blueprint.helix    # The generated blueprint
├── helix.config.json  # Project metadata
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## Prompt Tips

**Be specific about what data you need:**
> "A project management tool with Projects (name, description, status), Tasks (title, priority, due date, assignee), and Users with team roles"

**Mention relationships:**
> "A blog where Authors have many Posts, Posts have many Comments, and Comments can be liked by Users"

**Request specific features:**
> "An e-commerce store with Products, Orders, and Stripe-ready payment flow, admin dashboard"

**The AI handles the rest** — Helix generates the full blueprint, Prisma schema, API routes, and UI pages automatically.
