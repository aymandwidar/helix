# Templates

Templates give you a fast starting point without writing a prompt. Each template includes a pre-crafted Helix blueprint tuned for a specific use case.

## Listing Templates

```bash
helix init
```

## Available Templates

| Template | Description | Theme | Database |
|---|---|---|---|
| `todo` | Simple task manager with priorities and due dates | glassmorphism | SQLite |
| `blog` | Blog with posts, categories, authors, and comments | professional | SQLite |
| `saas` | SaaS starter with users, teams, subscriptions, and billing | midnight | PostgreSQL |
| `ecommerce` | E-commerce store with products, orders, and inventory | vibrant | PostgreSQL |
| `dashboard` | Analytics dashboard with metrics and activity feed | midnight | SQLite |

## Using a Template

```bash
# Initialize with a template (uses default project name)
helix init saas

# With a custom project name
helix init blog my-blog-site

# List all templates first
helix init
```

## What Happens

1. Helix reads the template's `blueprint.helix`
2. Runs `helix spawn` with the template's configured theme and database
3. Generates the full application as if you had written the prompt yourself

The generated project appears in `builds/<project-name>/`.

## Creating Custom Templates

Add a directory to `templates/` with:

```
templates/my-template/
├── config.json       # Template metadata
└── blueprint.helix   # The Helix blueprint
```

**config.json format:**
```json
{
  "name": "my-template",
  "title": "My Template",
  "description": "What this template generates",
  "theme": "glassmorphism",
  "db": "sqlite",
  "tags": ["tag1", "tag2"]
}
```

The template will appear in `helix init` and the web dashboard's Templates tab automatically.
