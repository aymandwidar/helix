/**
 * Helix Parser - Parses .helix blueprint files into structured AST
 */

export interface HelixField {
    name: string;
    type: string;
    constraints?: string[];
}

export interface HelixRelation {
    name: string;
    target: string;
    isMany: boolean;
}

export interface HelixStrand {
    name: string;
    fields: HelixField[];
    relations: HelixRelation[];
    strategies: HelixStrategy[];
}

export interface HelixStrategy {
    name: string;
    action: string;
    condition?: string;
}

export interface HelixView {
    name: string;
    properties: Record<string, string>;
}

export interface HelixPage {
    name: string;
    route: string;
    layout?: string;
    strands: string[];
}

export interface HelixAST {
    strands: HelixStrand[];
    views: HelixView[];
    strategies: HelixStrategy[];
    pages: HelixPage[];
}

/**
 * Convert PascalCase model name to camelCase for Prisma client accessor.
 * e.g., "MaintenanceLog" -> "maintenanceLog", "Vehicle" -> "vehicle"
 */
function toPrismaAccessor(name: string): string {
    return name.charAt(0).toLowerCase() + name.slice(1);
}

/**
 * Parse a .helix file content into an AST
 */
export function parseHelix(content: string): HelixAST {
    const ast: HelixAST = {
        strands: [],
        views: [],
        strategies: [],
        pages: [],
    };

    // Remove comments
    const cleanContent = content
        .split('\n')
        .map(line => line.replace(/\/\/.*$/, '').trim())
        .join('\n');

    // Parse strands
    const strandRegex = /strand\s+(\w+)\s*\{([^}]+)\}/g;
    let match;

    while ((match = strandRegex.exec(cleanContent)) !== null) {
        const strandName = match[1];
        const strandBody = match[2];

        try {
            const strand: HelixStrand = {
                name: strandName,
                fields: [],
                relations: [],
                strategies: [],
            };

            // Parse fields
            const fieldRegex = /field\s+(\w+)\s*:\s*([^\n]+)/g;
            let fieldMatch;
            while ((fieldMatch = fieldRegex.exec(strandBody)) !== null) {
                const fieldName = fieldMatch[1];
                const fieldType = fieldMatch[2].trim();

                strand.fields.push({
                    name: fieldName,
                    type: parseFieldType(fieldType),
                });
            }

            // Parse relations: relation name: Target or relation name: Target[]
            const relationRegex = /relation\s+(\w+)\s*:\s*(\w+)(\[\])?\s*/g;
            let relMatch;
            while ((relMatch = relationRegex.exec(strandBody)) !== null) {
                strand.relations.push({
                    name: relMatch[1],
                    target: relMatch[2],
                    isMany: !!relMatch[3],
                });
            }

            // Parse strategies within strand
            const strategyRegex = /strategy\s+(\w+)\s*:\s*([^\n]+)/g;
            let stratMatch;
            while ((stratMatch = strategyRegex.exec(strandBody)) !== null) {
                strand.strategies.push({
                    name: stratMatch[1],
                    action: stratMatch[2].trim(),
                });
            }

            ast.strands.push(strand);
        } catch (err) {
            console.error(`Error parsing strand "${strandName}": ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    // Parse views
    const viewRegex = /view\s+(\w+)\s*\{([^}]+)\}/g;
    while ((match = viewRegex.exec(cleanContent)) !== null) {
        const viewName = match[1];
        const viewBody = match[2];

        const view: HelixView = {
            name: viewName,
            properties: {},
        };

        // Parse view properties
        const propRegex = /(\w+)\s*:\s*([^\n]+)/g;
        let propMatch;
        while ((propMatch = propRegex.exec(viewBody)) !== null) {
            view.properties[propMatch[1]] = propMatch[2].trim();
        }

        ast.views.push(view);
    }

    // Parse top-level strategies
    const topStrategyRegex = /^strategy\s+(\w+)\s*:\s*(.+)$/gm;
    while ((match = topStrategyRegex.exec(cleanContent)) !== null) {
        ast.strategies.push({
            name: match[1],
            action: match[2].trim(),
        });
    }

    // Parse pages: page Dashboard { route: /dashboard, layout: sidebar, strands: [User, Task] }
    const pageRegex = /page\s+(\w+)\s*\{([^}]+)\}/g;
    while ((match = pageRegex.exec(cleanContent)) !== null) {
        const pageName = match[1];
        const pageBody = match[2];

        const page: HelixPage = {
            name: pageName,
            route: `/${pageName.toLowerCase()}`,
            strands: [],
        };

        const routeMatch = pageBody.match(/route\s*:\s*([^\n,]+)/);
        if (routeMatch) page.route = routeMatch[1].trim();

        const layoutMatch = pageBody.match(/layout\s*:\s*([^\n,]+)/);
        if (layoutMatch) page.layout = layoutMatch[1].trim();

        const strandsMatch = pageBody.match(/strands\s*:\s*\[([^\]]+)\]/);
        if (strandsMatch) {
            page.strands = strandsMatch[1].split(',').map(s => s.trim()).filter(Boolean);
        }

        ast.pages.push(page);
    }

    if (ast.strands.length === 0) {
        console.warn('⚠️  Warning: No strands found in blueprint. Check your .helix syntax.');
    }

    return ast;
}

/**
 * Convert Helix types to Prisma types
 */
export function toPrismaType(helixType: string): string {
    const typeMap: Record<string, string> = {
        'String': 'String',
        'Int': 'Int',
        'Float': 'Float',
        'Boolean': 'Boolean',
        'DateTime': 'DateTime',
        'Date': 'DateTime',
    };

    // Handle List types
    if (helixType.startsWith('List<')) {
        return helixType; // Will need relation handling
    }

    // Handle Enum types
    if (helixType.startsWith('Enum(')) {
        return 'String'; // Simplified - could generate actual enums
    }

    return typeMap[helixType] || 'String';
}

/**
 * Parse field type and extract base type
 */
function parseFieldType(typeStr: string): string {
    // Remove constraints like (Limit: 3)
    const baseType = typeStr.replace(/\([^)]*\)/g, '').trim();
    return baseType;
}

/**
 * Generate Prisma schema from AST
 */
export function generatePrismaSchema(ast: HelixAST): string {
    let schema = `// Generated by Helix v11.0
// This is your Prisma schema file

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

`;

    // Build a lookup of all strand names for relation validation
    const strandNames = new Set(ast.strands.map(s => s.name));

    for (const strand of ast.strands) {
        schema += `model ${strand.name} {\n`;
        schema += `  id        String   @id @default(cuid())\n`;
        schema += `  createdAt DateTime @default(now())\n`;
        schema += `  updatedAt DateTime @updatedAt\n`;

        for (const field of strand.fields) {
            const prismaType = toPrismaType(field.type);
            const isOptional = field.type.includes('?') ? '?' : '';
            const defaultValue = getDefaultValue(field.type);

            schema += `  ${field.name} ${prismaType}${isOptional}${defaultValue}\n`;
        }

        // Generate relation fields
        for (const rel of strand.relations) {
            if (!strandNames.has(rel.target)) continue; // skip invalid targets

            if (rel.isMany) {
                // has-many: just the relation array, no FK on this side
                schema += `  ${rel.name} ${rel.target}[]\n`;
            } else {
                // belongs-to: FK field + relation
                const fkName = `${rel.name}Id`;
                schema += `  ${fkName} String?\n`;
                schema += `  ${rel.name} ${rel.target}? @relation(fields: [${fkName}], references: [id])\n`;
            }
        }

        schema += `}\n\n`;
    }

    return schema;
}

function getDefaultValue(type: string): string {
    if (type === 'Boolean') return ' @default(false)';
    return '';
}

/**
 * Generate API route handler from strand
 * v11.0 - With input validation, pagination, rate limiting, error handling
 */
export function generateAPIRoute(strand: HelixStrand): string {
    const modelName = strand.name;
    const prismaName = toPrismaAccessor(modelName);

    // Build include clause for relations
    const relations = strand.relations || [];
    const hasRelations = relations.length > 0;
    const includeClause = hasRelations
        ? `\n      include: { ${relations.map(r => `${r.name}: true`).join(', ')} },`
        : '';
    const includeOnCreate = hasRelations
        ? `\n      include: { ${relations.map(r => `${r.name}: true`).join(', ')} },`
        : '';

    // Build validation rules from fields
    const validationRules = strand.fields.map(f => {
        if (f.type === 'String') return `    if (body.${f.name} !== undefined && typeof body.${f.name} !== 'string') errors.push('${f.name} must be a string');`;
        if (f.type === 'Int') return `    if (body.${f.name} !== undefined && (typeof body.${f.name} !== 'number' || !Number.isInteger(body.${f.name}))) errors.push('${f.name} must be an integer');`;
        if (f.type === 'Float') return `    if (body.${f.name} !== undefined && typeof body.${f.name} !== 'number') errors.push('${f.name} must be a number');`;
        if (f.type === 'Boolean') return `    if (body.${f.name} !== undefined && typeof body.${f.name} !== 'boolean') errors.push('${f.name} must be a boolean');`;
        return `    // ${f.name}: ${f.type}`;
    }).join('\n');

    // Required fields check (first 3 string fields)
    const requiredChecks = strand.fields
        .filter(f => f.type === 'String')
        .slice(0, 3)
        .map(f => `    if (!body.${f.name} || (typeof body.${f.name} === 'string' && body.${f.name}.trim() === '')) errors.push('${f.name} is required');`)
        .join('\n');

    // Sanitize string fields (trim + max length)
    const sanitizeFields = strand.fields.map(f => {
        if (f.type === 'String') return `      ${f.name}: typeof body.${f.name} === 'string' ? body.${f.name}.trim().slice(0, 2000) : body.${f.name},`;
        return `      ${f.name}: body.${f.name},`;
    }).join('\n');

    return `// Generated by Helix v11.0 — Validation, Pagination, Rate Limiting
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ── Rate Limiting (in-memory, per-route) ─────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// Use x-real-ip (set by trusted reverse proxy) first, then x-forwarded-for, then fallback.
// NOTE: For production behind a trusted proxy (nginx/caddy), configure the proxy to set x-real-ip.
// In-memory rate limiting resets on restart; use Redis-backed limiter for production.
function getClientIP(req: NextRequest): string {
  return req.headers.get('x-real-ip')
    || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
}

// ── Validation ───────────────────────────────────────────────────────
function validate(body: Record<string, unknown>, isUpdate = false): string[] {
  const errors: string[] = [];
  if (!isUpdate) {
${requiredChecks}
  }
${validationRules}
  return errors;
}

function sanitize(body: Record<string, unknown>): Record<string, unknown> {
  return {
${sanitizeFields}
  };
}

// ── GET (with pagination) ────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const ip = getClientIP(request);
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.${prismaName}.findMany({
        orderBy: { createdAt: 'desc' },${includeClause}
        skip,
        take: limit,
      }),
      prisma.${prismaName}.count(),
    ]);

    return NextResponse.json({
      data: items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[${modelName}] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch ${modelName}s' }, { status: 500 });
  }
}

// ── POST ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request);
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    let body: Record<string, unknown>;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const errors = validate(body);
    if (errors.length > 0) {
      return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
    }

    const item = await prisma.${prismaName}.create({
      data: sanitize(body) as any,${includeOnCreate}
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error('[${modelName}] POST error:', error);
    return NextResponse.json({ error: 'Failed to create ${modelName}' }, { status: 500 });
  }
}

// ── PUT ──────────────────────────────────────────────────────────────
export async function PUT(request: NextRequest) {
  try {
    const ip = getClientIP(request);
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    let body: Record<string, unknown>;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const { id, ...data } = body;
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Valid ID is required' }, { status: 400 });
    }

    const errors = validate(data, true);
    if (errors.length > 0) {
      return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
    }

    const item = await prisma.${prismaName}.update({
      where: { id: id as string },
      data: sanitize(data) as any,${includeClause}
    });
    return NextResponse.json(item);
  } catch (error: any) {
    if (error?.code === 'P2025') return NextResponse.json({ error: '${modelName} not found' }, { status: 404 });
    console.error('[${modelName}] PUT error:', error);
    return NextResponse.json({ error: 'Failed to update ${modelName}' }, { status: 500 });
  }
}

// ── DELETE ───────────────────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const ip = getClientIP(request);
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    await prisma.${prismaName}.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.code === 'P2025') return NextResponse.json({ error: '${modelName} not found' }, { status: 404 });
    console.error('[${modelName}] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete ${modelName}' }, { status: 500 });
  }
}
`;
}

/**
 * Generate UI page component from view
 * FIX: Uses camelCase for Prisma, adapts to model fields instead of hardcoding is_completed
 */
export function generateUIPage(view: HelixView, strand: HelixStrand, allStrands?: HelixStrand[], themeClasses?: { primaryButton: string; secondaryButton: string; card: string; text: string; textMuted: string; heading: string; badge: string; statusColors: { success: string; warning: string; info: string } }): string {
    const viewName = view.name;
    const modelName = strand.name;
    const lowerName = modelName.toLowerCase();

    // Theme-aware classes with fallbacks to glassmorphism defaults
    const tc = themeClasses || {
        primaryButton: 'bg-indigo-600 hover:bg-indigo-500 text-white',
        secondaryButton: 'bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300',
        card: 'glass',
        text: 'text-white',
        textMuted: 'text-gray-400',
        heading: 'text-white',
        badge: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
        statusColors: { success: '#10b981', warning: '#f59e0b', info: '#6366f1' },
    };

    const fields = strand.fields.map(f => f.name);
    const relations = strand.relations || [];
    const belongsToRelations = relations.filter(r => !r.isMany);
    const hasManyRelations = relations.filter(r => r.isMany);

    const booleanField = strand.fields.find(f => f.type === 'Boolean' && (f.name.includes('complet') || f.name.includes('done') || f.name.includes('active') || f.name.includes('finished')));
    const hasBooleanToggle = !!booleanField;
    const toggleFieldName = booleanField?.name || '';

    const toggleFunction = hasBooleanToggle ? `
  const toggleItem = async (item: ${modelName}) => {
    try {
      await fetch('/api/${lowerName}', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          ${toggleFieldName}: !item.${toggleFieldName}
        }),
      });
      fetchItems();
    } catch (error) {
      console.error('Failed to update item:', error);
    }
  };` : '';

    const toggleButton = hasBooleanToggle ? `
              <button
                onClick={() => toggleItem(item)}
                className={\`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors \${
                  item.${toggleFieldName}
                    ? 'bg-green-500 border-green-500'
                    : 'border-gray-400 hover:border-indigo-500'
                }\`}
              >
                {item.${toggleFieldName} && <Check size={14} className="text-white" />}
              </button>` : '';

    const itemTextClass = hasBooleanToggle
        ? `\`flex-1 ${tc.text} \${item.${toggleFieldName} ? 'line-through opacity-50' : ''}\``
        : `"flex-1 ${tc.text}"`;

    const lucideImports = hasBooleanToggle
        ? `import { Plus, Trash2, Check, X } from 'lucide-react';`
        : `import { Plus, Trash2 } from 'lucide-react';`;

    // Generate relation interfaces and state for belongs-to dropdowns
    const relatedInterfaces = belongsToRelations.map(rel => {
        const targetStrand = allStrands?.find(s => s.name === rel.target);
        const targetFirstField = targetStrand?.fields[0]?.name || 'name';
        return `interface ${rel.target}Option { id: string; ${targetFirstField}: string; }`;
    }).join('\n');

    const relatedState = belongsToRelations.map(rel => {
        return `  const [${rel.name}Options, set${capitalize(rel.name)}Options] = useState<${rel.target}Option[]>([]);`;
    }).join('\n');

    const relatedFetches = belongsToRelations.map(rel => {
        const targetLower = rel.target.toLowerCase();
        return `
    fetch('/api/${targetLower}').then(r => r.json()).then(d => set${capitalize(rel.name)}Options(d.data || d)).catch(() => {});`;
    }).join('');

    const relatedFormState = belongsToRelations.map(rel => {
        return `  const [selected${capitalize(rel.name)}, setSelected${capitalize(rel.name)}] = useState('');`;
    }).join('\n');

    const relatedFormFields = belongsToRelations.map(rel => {
        const targetStrand = allStrands?.find(s => s.name === rel.target);
        const targetFirstField = targetStrand?.fields[0]?.name || 'name';
        return `
          <select
            value={selected${capitalize(rel.name)}}
            onChange={(e) => setSelected${capitalize(rel.name)}(e.target.value)}
            className="rounded-lg px-4 py-3 focus:outline-none focus:ring-2"
          >
            <option value="">Select ${rel.name}...</option>
            {${rel.name}Options.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.${targetFirstField}}</option>
            ))}
          </select>`;
    }).join('');

    const relatedCreateData = belongsToRelations.map(rel => {
        return `${rel.name}Id: selected${capitalize(rel.name)} || undefined, `;
    }).join('');

    const relatedResetState = belongsToRelations.map(rel => {
        return `\n        setSelected${capitalize(rel.name)}('');`;
    }).join('');

    // Display related data in list items
    const relatedDisplayBelongsTo = belongsToRelations.map(rel => {
        const targetStrand = allStrands?.find(s => s.name === rel.target);
        const targetFirstField = targetStrand?.fields[0]?.name || 'name';
        return `
              {item.${rel.name} && (
                <span className="text-xs ${tc.badge} px-2 py-1 rounded">
                  {item.${rel.name}.${targetFirstField}}
                </span>
              )}`;
    }).join('');

    const relatedDisplayHasMany = hasManyRelations.map(rel => {
        return `
              {item.${rel.name} && item.${rel.name}.length > 0 && (
                <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded">
                  {item.${rel.name}.length} ${rel.name}
                </span>
              )}`;
    }).join('');

    // Build interface with relations
    const relatedInterfaceFields = belongsToRelations.map(rel => {
        const targetStrand = allStrands?.find(s => s.name === rel.target);
        const targetFirstField = targetStrand?.fields[0]?.name || 'name';
        return `  ${rel.name}Id?: string;\n  ${rel.name}?: { id: string; ${targetFirstField}: string };`;
    }).join('\n');

    const hasManyInterfaceFields = hasManyRelations.map(rel => {
        return `  ${rel.name}?: { id: string }[];`;
    }).join('\n');

    return `// Generated by Helix v11.0
'use client';

import { useState, useEffect } from 'react';
${lucideImports}

interface ${modelName} {
  id: string;
${strand.fields.map(f => `  ${f.name}: ${tsType(f.type)};`).join('\n')}
${relatedInterfaceFields}
${hasManyInterfaceFields}
  createdAt: string;
}
${relatedInterfaces}

export default function ${viewName}Page() {
  const [items, setItems] = useState<${modelName}[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState('');
${relatedState}
${relatedFormState}

  useEffect(() => {
    fetchItems();${relatedFetches}
  }, []);

  const fetchItems = async () => {
    try {
      const res = await fetch('/api/${lowerName}');
      const json = await res.json();
      setItems(json.data || json);
    } catch (error) {
      console.error('Failed to fetch items:', error);
    } finally {
      setLoading(false);
    }
  };

  const createItem = async () => {
    if (!newItem.trim()) return;

    try {
      const res = await fetch('/api/${lowerName}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ${fields[0]}: newItem, ${relatedCreateData}}),
      });

      if (res.ok) {
        setNewItem('');${relatedResetState}
        fetchItems();
      }
    } catch (error) {
      console.error('Failed to create item:', error);
    }
  };

  const deleteItem = async (id: string) => {
    try {
      await fetch(\`/api/${lowerName}?id=\${id}\`, { method: 'DELETE' });
      fetchItems();
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };
${toggleFunction}

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 ${tc.heading}">${viewName}</h1>

        {/* Add New Item */}
        <div className="flex gap-4 mb-8 flex-wrap">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createItem()}
            placeholder="Add new ${lowerName}..."
            className="flex-1 min-w-[200px]"
          />${relatedFormFields}
          <button
            onClick={createItem}
            className="${tc.primaryButton} px-6 py-3 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus size={20} />
            Add
          </button>
        </div>

        {/* Items List */}
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="glass p-4 flex items-center gap-4 group hover:opacity-90 transition-all"
            >${toggleButton}

              <span className={${itemTextClass}}>
                {item.${fields[0]}}
              </span>
${relatedDisplayBelongsTo}${relatedDisplayHasMany}

              <button
                onClick={() => deleteItem(item.id)}
                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}

          {items.length === 0 && (
            <div className="text-center opacity-50 py-12 ${tc.textMuted}">
              No items yet. Add your first ${lowerName}!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
`;
}

function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function tsType(helixType: string): string {
    const typeMap: Record<string, string> = {
        'String': 'string',
        'Int': 'number',
        'Float': 'number',
        'Boolean': 'boolean',
        'DateTime': 'string',
        'Date': 'string',
    };
    return typeMap[helixType] || 'string';
}
