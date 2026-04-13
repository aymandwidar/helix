/**
 * Home Page Generator — Smart view detection (gallery, kanban, feed, grid)
 */

import type { HelixAST } from '../parser/index.js';
import { getThemeClasses } from '../themes/index.js';

export function generateSpawnHomePage(prompt: string, ast: HelixAST, themeClasses?: ReturnType<typeof getThemeClasses>): string {
  const tc = themeClasses || getThemeClasses();
  const appTitle = prompt.split(' ').slice(0, 5).join(' ');
  if (ast.strands.length === 0) {
    return `// Spawned by Helix v11.1 - Clean Factory\nexport default function Home() { return (<main className="min-h-screen p-8 flex items-center justify-center"><div className="text-center"><h1 className="text-4xl font-bold ${tc.heading} mb-4">🧬 ${appTitle}</h1><p className="${tc.textMuted}">No strands</p></div></main>); }`;
  }

  const interfaces = ast.strands.map(s => {
    const f = s.fields.map(f => `${f.name}: ${f.type === 'String' ? 'string' : f.type === 'Int' || f.type === 'Float' ? 'number' : 'string'}`).join('; ');
    return `interface ${s.name} { id: string; ${f}; createdAt: string; }`;
  }).join('\n');

  const states = ast.strands.map(s => {
    const l = s.name.toLowerCase();
    const init = s.fields.map(f => `${f.name}: ${f.type === 'Int' || f.type === 'Float' ? '0' : "''"}`).join(', ');
    return `const [${l}s, set${s.name}s] = useState<${s.name}[]>([]);
  const [show${s.name}Form, setShow${s.name}Form] = useState(false);
  const [${l}Form, set${s.name}Form] = useState({ ${init} });`;
  }).join('\n  ');

  const funcs = ast.strands.map(s => {
    const l = s.name.toLowerCase();
    const resetForm = s.fields.map(ff => `${ff.name}: ${ff.type === 'Int' || ff.type === 'Float' ? '0' : "''"}`).join(', ');
    return `const fetch${s.name}s = async () => { try { const r = await fetch('/api/${l}'); const j = await r.json(); set${s.name}s(j.data || j); } catch { setError('Failed to load ${l}s'); } };
  const submit${s.name} = async (e: React.FormEvent) => { e.preventDefault(); try { const r = await fetch('/api/${l}', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(${l}Form) }); if (!r.ok) { const err = await r.json(); setError(err.details?.join(', ') || err.error || 'Failed'); return; } setShow${s.name}Form(false); set${s.name}Form({ ${resetForm} }); fetch${s.name}s(); } catch { setError('Failed to create ${l}'); } };
  const del${s.name} = async (id: string) => { if (!confirm('Delete?')) return; try { await fetch('/api/${l}?id=' + id, { method: 'DELETE' }); fetch${s.name}s(); } catch { setError('Failed to delete ${l}'); } };`;
  }).join('\n  ');

  const fetchAll = ast.strands.map(s => `fetch${s.name}s()`).join('; ');

  const detectViewType = (fields: Array<{ name: string, type: string }>): 'gallery' | 'kanban' | 'feed' | 'grid' => {
    const fieldNames = fields.map(f => f.name.toLowerCase());
    if (fieldNames.some(n => ['image', 'photo', 'avatar', 'thumbnail', 'cover', 'picture', 'img'].includes(n))) return 'gallery';
    if (fieldNames.some(n => ['status', 'stage', 'phase', 'state', 'progress'].includes(n))) return 'kanban';
    const hasTitle = fieldNames.some(n => ['title', 'name', 'headline'].includes(n));
    const hasContent = fieldNames.some(n => ['body', 'content', 'description', 'message', 'text', 'note'].includes(n));
    if (hasTitle && hasContent) return 'feed';
    return 'grid';
  };

  const sections = ast.strands.map(s => {
    const l = s.name.toLowerCase();
    const viewType = detectViewType(s.fields);
    const inputs = s.fields.map(f => {
      const t = f.type === 'Int' || f.type === 'Float' ? 'number' : 'text';
      return `<div className="mb-3"><label className="block ${tc.textMuted} text-sm mb-1">${f.name}</label><input type="${t}" value={${l}Form.${f.name} || ''} onChange={e => set${s.name}Form({...${l}Form, ${f.name}: ${t === 'number' ? 'Number(e.target.value)' : 'e.target.value'}})} className="w-full rounded-md p-3 transition-colors" /></div>`;
    }).join('\n            ');

    const titleField = s.fields.find(f => ['title', 'name', 'headline', 'codename'].includes(f.name.toLowerCase()))?.name || s.fields[0]?.name || 'id';
    const statusField = s.fields.find(f => ['status', 'stage', 'phase', 'state', 'progress'].includes(f.name.toLowerCase()))?.name;
    const contentField = s.fields.find(f => ['body', 'content', 'description', 'message', 'text', 'note'].includes(f.name.toLowerCase()))?.name;

    let itemsLayout = '';

    if (viewType === 'kanban' && statusField) {
      itemsLayout = `<div className="flex gap-4 overflow-x-auto pb-4">
            {['Todo', 'In Progress', 'Done', 'Pending', 'Active', 'Complete'].filter(status => ${l}s.some(i => i.${statusField}?.toLowerCase().includes(status.toLowerCase()))).map(status => (
              <div key={status} className="min-w-[280px] glass rounded-xl p-4">
                <h4 className="${tc.heading} font-bold mb-3 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{background: status === 'Done' || status === 'Complete' ? '${tc.statusColors.success}' : status === 'In Progress' || status === 'Active' ? '${tc.statusColors.warning}' : '${tc.statusColors.info}'}}></span>
                  {status}
                </h4>
                <div className="space-y-2">
                  {${l}s.filter(i => i.${statusField}?.toLowerCase().includes(status.toLowerCase())).map(item => (
                    <div key={item.id} className="bg-white/5 rounded-lg p-3 group">
                      <div className="${tc.text} text-sm font-medium">{item.${titleField}}</div>
                      <button onClick={() => del${s.name}(item.id)} className="opacity-0 group-hover:opacity-100 text-red-400 text-xs mt-1">Delete</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>`;
    } else if (viewType === 'feed' && contentField) {
      itemsLayout = `<div className="space-y-4">
            {${l}s.map(item => (
              <article key={item.id} className="glass rounded-xl p-5 group">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-xl font-bold ${tc.heading}">{item.${titleField}}</h3>
                  <button onClick={() => del${s.name}(item.id)} className="opacity-0 group-hover:opacity-100 text-red-400">🗑️</button>
                </div>
                <p className="${tc.textMuted} leading-relaxed">{item.${contentField}}</p>
                <div className="mt-3 ${tc.textMuted} text-sm">{new Date(item.createdAt).toLocaleString()}</div>
              </article>
            ))}
          </div>`;
    } else {
      const display = s.fields.slice(0, 4).map(f => `<div><span className="${tc.textMuted} text-xs">${f.name}</span><div className="${tc.text} text-sm">{String(item.${f.name})}</div></div>`).join('\n                ');
      itemsLayout = `<div className="space-y-2">
            {${l}s.map(item => (
              <div key={item.id} className="glass rounded-lg p-4 group flex justify-between hover:bg-white/5">
                <div className="grid grid-cols-4 gap-4 flex-1">${display}</div>
                <button onClick={() => del${s.name}(item.id)} className="opacity-0 group-hover:opacity-100 text-red-400">🗑️</button>
              </div>
            ))}
          </div>`;
    }

    const viewLabel = viewType === 'gallery' ? '🖼️ Gallery' : viewType === 'kanban' ? '📋 Board' : viewType === 'feed' ? '📰 Feed' : '📊 Grid';

    return `
        <section className="mb-10">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-2xl font-bold ${tc.heading}">${s.name}s</h2>
              <span className="text-xs ${tc.textMuted}">${viewLabel}</span>
            </div>
            <button onClick={() => setShow${s.name}Form(true)} className="${tc.primaryButton} px-4 py-2 rounded-lg">+ Add</button>
          </div>
          {show${s.name}Form && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-gray-900 border border-white/10 rounded-xl p-6 w-full max-w-md">
                <h3 className="text-xl font-bold ${tc.heading} mb-4">Add ${s.name}</h3>
                <form onSubmit={submit${s.name}}>
            ${inputs}
                  <div className="flex gap-3 mt-4">
                    <button type="button" onClick={() => setShow${s.name}Form(false)} className="flex-1 ${tc.secondaryButton} py-2 rounded-lg">Cancel</button>
                    <button type="submit" className="flex-1 ${tc.primaryButton} py-2 rounded-lg">Create</button>
                  </div>
                </form>
              </div>
            </div>
          )}
          {${l}s.length === 0 ? <div className="glass rounded-lg p-6 text-center ${tc.textMuted}">No ${l}s yet</div> : ${itemsLayout}}
        </section>`;
  }).join('\n');

  return `// Spawned by Helix v11.1 — With error handling, loading states, pagination support
'use client';
import { useState, useEffect } from 'react';
${interfaces}

// Error Boundary Component
function ErrorBoundaryFallback({ error, reset }: { error: string; reset: () => void }) {
  return (
    <div className="glass rounded-xl p-6 text-center">
      <p className="text-red-400 mb-4">{error}</p>
      <button onClick={reset} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg">Try Again</button>
    </div>
  );
}

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  ${states}
  ${funcs}
  useEffect(() => { ${fetchAll}; setLoading(false); }, []);

  // Auto-dismiss error toast after 5 seconds
  useEffect(() => { if (error) { const t = setTimeout(() => setError(null), 5000); return () => clearTimeout(t); } }, [error]);

  if (loading) return (
    <main className="min-h-screen p-8 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="${tc.textMuted}">Loading...</p>
      </div>
    </main>
  );

  return (
    <main className="min-h-screen p-8">
      {/* Error Toast */}
      {error && (
        <div className="fixed top-4 right-4 z-50 bg-red-900/90 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-in">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">✕</button>
        </div>
      )}
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <span className="text-sm text-indigo-400 font-mono">🧬 Helix v11.1</span>
          <h1 className="text-4xl font-bold ${tc.heading} mt-1">${appTitle}</h1>
          <p className="${tc.textMuted}">${ast.strands.length} data types</p>
        </div>
${sections}
      </div>
    </main>
  );
}
`;
}
