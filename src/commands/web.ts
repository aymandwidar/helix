/**
 * Helix Command: web
 * Browser-based dashboard for managing Helix projects
 */

import chalk from 'chalk';
import * as http from 'http';
import * as fs from 'fs-extra';
import * as path from 'path';

const HELIX_ROOT = path.resolve(__dirname, '..', '..');
const BUILDS_DIR = path.join(HELIX_ROOT, 'builds');
const TEMPLATES_DIR = path.join(HELIX_ROOT, 'templates');

export async function startWebDashboard(port: number = 4000): Promise<void> {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${port}`);

    // CORS for local dev
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

    try {
      // API Routes
      if (url.pathname === '/api/projects') {
        return await handleProjects(req, res);
      }
      if (url.pathname.startsWith('/api/project/')) {
        return await handleProjectDetail(req, res, url.pathname.split('/').pop()!);
      }
      if (url.pathname === '/api/templates') {
        return await handleTemplates(res);
      }
      if (url.pathname === '/api/models') {
        return await handleModels(res);
      }
      if (url.pathname === '/api/status') {
        return json(res, { status: 'ok', version: '12.1.0', builds: BUILDS_DIR });
      }

      // Serve dashboard UI
      return serveDashboard(res);
    } catch (err: any) {
      json(res, { error: err.message }, 500);
    }
  });

  server.listen(port, () => {
    console.log(chalk.cyan(`\n🌐 Helix Dashboard running at ${chalk.bold(`http://localhost:${port}`)}\n`));
    console.log(chalk.gray('  Press Ctrl+C to stop\n'));
  });
}

// ── API Handlers ─────────────────────────────────────────────────────

async function handleProjects(_req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (!fs.existsSync(BUILDS_DIR)) {
    return json(res, { projects: [] });
  }

  const dirs = await fs.readdir(BUILDS_DIR, { withFileTypes: true });
  const projects = [];

  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const projectPath = path.join(BUILDS_DIR, dir.name);
    const configPath = path.join(projectPath, 'helix.config.json');

    let config: any = {};
    if (fs.existsSync(configPath)) {
      try { config = await fs.readJSON(configPath); } catch {}
    }

    const stat = await fs.stat(projectPath);
    const hasBlueprint = fs.existsSync(path.join(projectPath, 'blueprint.helix'));
    const hasPrisma = fs.existsSync(path.join(projectPath, 'prisma', 'schema.prisma'));

    projects.push({
      name: dir.name,
      path: projectPath,
      prompt: config.prompt || '',
      generatedAt: config.generatedAt || stat.birthtime.toISOString(),
      hasBlueprint,
      hasPrisma,
    });
  }

  json(res, { projects: projects.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)) });
}

async function handleProjectDetail(_req: http.IncomingMessage, res: http.ServerResponse, name: string): Promise<void> {
  const projectPath = path.join(BUILDS_DIR, name);
  if (!fs.existsSync(projectPath)) {
    return json(res, { error: 'Project not found' }, 404);
  }

  let config: any = {};
  const configPath = path.join(projectPath, 'helix.config.json');
  if (fs.existsSync(configPath)) {
    try { config = await fs.readJSON(configPath); } catch {}
  }

  let blueprint = '';
  const bpPath = path.join(projectPath, 'blueprint.helix');
  if (fs.existsSync(bpPath)) {
    blueprint = await fs.readFile(bpPath, 'utf-8');
  }

  let prismaSchema = '';
  const prismaPath = path.join(projectPath, 'prisma', 'schema.prisma');
  if (fs.existsSync(prismaPath)) {
    prismaSchema = await fs.readFile(prismaPath, 'utf-8');
  }

  json(res, { name, path: projectPath, config, blueprint, prismaSchema });
}

async function handleTemplates(res: http.ServerResponse): Promise<void> {
  if (!fs.existsSync(TEMPLATES_DIR)) {
    return json(res, { templates: [] });
  }

  const dirs = await fs.readdir(TEMPLATES_DIR, { withFileTypes: true });
  const templates = [];

  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const configPath = path.join(TEMPLATES_DIR, dir.name, 'config.json');
    if (!fs.existsSync(configPath)) continue;
    try {
      templates.push(await fs.readJSON(configPath));
    } catch {}
  }

  json(res, { templates });
}

async function handleModels(res: http.ServerResponse): Promise<void> {
  const models = [
    { id: 'deepseek/deepseek-chat-v3-0324', name: 'DeepSeek V3', type: 'primary' },
    { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', type: 'fallback' },
    { id: 'qwen/qwen3-235b-a22b', name: 'Qwen 235B', type: 'research' },
  ];

  // Check Ollama
  try {
    const response = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) });
    if (response.ok) {
      const data = await response.json() as { models?: Array<{ name: string }> };
      if (data.models) {
        for (const m of data.models) {
          models.push({ id: `ollama/${m.name}`, name: m.name, type: 'local' });
        }
      }
    }
  } catch {}

  json(res, { models });
}

// ── Dashboard UI ─────────────────────────────────────────────────────

function serveDashboard(res: http.ServerResponse): void {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(DASHBOARD_HTML);
}

function json(res: http.ServerResponse, data: any, status: number = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Helix Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; background: linear-gradient(135deg, #0f0f1a, #1a0a2e, #0d1117); color: #e2e8f0; min-height: 100vh; }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1); }
    header h1 { font-size: 1.5rem; color: #fff; }
    header h1 span { color: #6366f1; }
    .badge { background: rgba(99,102,241,0.2); color: #a5b4fc; padding: 0.25rem 0.75rem; border-radius: 1rem; font-size: 0.75rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 1.5rem; }
    .card { background: rgba(255,255,255,0.05); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); border-radius: 0.75rem; padding: 1.5rem; transition: border-color 0.2s; cursor: pointer; }
    .card:hover { border-color: rgba(99,102,241,0.4); }
    .card h3 { font-size: 1.1rem; color: #fff; margin-bottom: 0.5rem; }
    .card p { color: #94a3b8; font-size: 0.875rem; line-height: 1.5; }
    .card .meta { display: flex; gap: 0.75rem; margin-top: 0.75rem; font-size: 0.75rem; color: #64748b; }
    .card .meta span { display: flex; align-items: center; gap: 0.25rem; }
    .tabs { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; }
    .tab { padding: 0.5rem 1rem; border-radius: 0.5rem; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: #94a3b8; cursor: pointer; font-size: 0.875rem; }
    .tab.active { background: rgba(99,102,241,0.2); color: #a5b4fc; border-color: rgba(99,102,241,0.3); }
    .empty { text-align: center; padding: 4rem; color: #64748b; }
    .empty h2 { font-size: 1.25rem; color: #94a3b8; margin-bottom: 0.5rem; }
    .detail { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 0.75rem; padding: 1.5rem; margin-top: 1.5rem; }
    .detail h2 { color: #fff; margin-bottom: 1rem; }
    pre { background: rgba(0,0,0,0.3); padding: 1rem; border-radius: 0.5rem; overflow-x: auto; font-size: 0.8rem; line-height: 1.6; color: #a5b4fc; }
    .back { color: #6366f1; cursor: pointer; font-size: 0.875rem; margin-bottom: 1rem; display: inline-block; }
    .back:hover { text-decoration: underline; }
    .status { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 0.5rem; }
    .status.green { background: #10b981; }
    .status.blue { background: #6366f1; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1><span>Helix</span> Dashboard</h1>
      <span class="badge">v12.1.0</span>
    </header>
    <div class="tabs">
      <button class="tab active" onclick="showTab('projects')">Projects</button>
      <button class="tab" onclick="showTab('templates')">Templates</button>
      <button class="tab" onclick="showTab('models')">AI Models</button>
    </div>
    <div id="content">Loading...</div>
  </div>
  <script>
    let currentTab = 'projects';
    let projectDetail = null;

    async function api(path) {
      const res = await fetch('/api/' + path);
      return res.json();
    }

    function showTab(tab) {
      currentTab = tab;
      projectDetail = null;
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelector('.tab:nth-child(' + ({projects:1,templates:2,models:3}[tab]) + ')').classList.add('active');
      render();
    }

    async function render() {
      const el = document.getElementById('content');

      if (projectDetail) {
        const data = await api('project/' + projectDetail);
        el.innerHTML = '<span class="back" onclick="projectDetail=null;render()">← Back to projects</span>' +
          '<div class="detail"><h2>' + data.name + '</h2>' +
          '<p style="color:#94a3b8;margin-bottom:1rem">' + (data.config.prompt || 'No prompt') + '</p>' +
          (data.blueprint ? '<h3 style="color:#a5b4fc;margin:1rem 0 0.5rem">Blueprint</h3><pre>' + esc(data.blueprint) + '</pre>' : '') +
          (data.prismaSchema ? '<h3 style="color:#a5b4fc;margin:1rem 0 0.5rem">Prisma Schema</h3><pre>' + esc(data.prismaSchema) + '</pre>' : '') +
          '</div>';
        return;
      }

      if (currentTab === 'projects') {
        const data = await api('projects');
        if (data.projects.length === 0) {
          el.innerHTML = '<div class="empty"><h2>No projects yet</h2><p>Run <code>helix spawn "your idea"</code> to create one</p></div>';
        } else {
          el.innerHTML = '<div class="grid">' + data.projects.map(p =>
            '<div class="card" onclick="projectDetail=\\'' + p.name + '\\';render()">' +
            '<h3>' + p.name + '</h3>' +
            '<p>' + (p.prompt ? p.prompt.substring(0, 100) : 'No prompt') + '</p>' +
            '<div class="meta">' +
            '<span><span class="status green"></span>' + (p.hasBlueprint ? 'Blueprint' : 'No blueprint') + '</span>' +
            '<span><span class="status blue"></span>' + (p.hasPrisma ? 'Database' : 'No DB') + '</span>' +
            '<span>' + new Date(p.generatedAt).toLocaleDateString() + '</span>' +
            '</div></div>'
          ).join('') + '</div>';
        }
      } else if (currentTab === 'templates') {
        const data = await api('templates');
        el.innerHTML = '<div class="grid">' + data.templates.map(t =>
          '<div class="card">' +
          '<h3>' + t.title + '</h3>' +
          '<p>' + t.description + '</p>' +
          '<div class="meta"><span>Theme: ' + t.theme + '</span><span>DB: ' + t.db + '</span><span>' + t.tags.join(', ') + '</span></div>' +
          '<p style="margin-top:0.75rem;font-size:0.75rem;color:#6366f1">helix init ' + t.name + '</p>' +
          '</div>'
        ).join('') + '</div>';
      } else if (currentTab === 'models') {
        const data = await api('models');
        el.innerHTML = '<div class="grid">' + data.models.map(m =>
          '<div class="card">' +
          '<h3>' + m.name + '</h3>' +
          '<p style="font-family:monospace;font-size:0.8rem">' + m.id + '</p>' +
          '<div class="meta"><span class="badge">' + m.type + '</span></div>' +
          '</div>'
        ).join('') + '</div>';
      }
    }

    function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    render();
  </script>
</body>
</html>`;
