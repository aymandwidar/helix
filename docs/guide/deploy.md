# Deploy

Helix provides one-command deployment to Vercel, Railway, and Fly.io.

## Usage

```bash
helix deploy [options]
```

## Options

| Option | Description |
|---|---|
| `--platform` | `vercel` (default), `railway`, or `fly` |
| `--project` | Project name in builds/ directory |
| `--prod` | Deploy to production (Vercel) |

## Platforms

### Vercel (Recommended for Next.js)

```bash
helix deploy --platform vercel
```

**Prerequisites:**
- Vercel CLI installed: `npm install -g vercel`
- Run `vercel login` once

**What happens:**
1. Runs `vercel` in the project directory
2. Configures environment variables from `.env`
3. Returns the deployed URL

---

### Railway (Full-stack with Postgres)

```bash
helix deploy --platform railway
```

**Prerequisites:**
- Railway CLI installed: `npm install -g @railway/cli`
- Run `railway login` once

**What happens:**
1. Creates a Railway project
2. Auto-provisions a Postgres database if your app uses one
3. Sets DATABASE_URL environment variable
4. Deploys and returns the URL

---

### Fly.io (Containers + Postgres)

```bash
helix deploy --platform fly
```

**Prerequisites:**
- Fly CLI installed: `curl -L https://fly.io/install.sh | sh`
- Run `fly auth login` once

**What happens:**
1. Generates `fly.toml` configuration
2. Creates Postgres cluster and attaches it
3. Sets all secrets and deploys
4. Returns the app URL

## Database URLs

When deploying with a database, set your `DATABASE_URL` in the project's `.env`:

```bash
# PostgreSQL
DATABASE_URL="postgresql://user:password@host:5432/db"

# Supabase
DATABASE_URL="postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"
```

Or use the `--connection-string` flag during `helix spawn` to pre-configure it.
