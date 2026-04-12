/**
 * Helix Pre-flight Validator (Architect Agent)
 * Validates .helix blueprint files before generation to catch errors early.
 */

import { parseHelix, HelixAST, HelixStrand } from '../parser';

export interface PreflightIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  fix?: string;
}

export interface PreflightResult {
  passed: boolean;
  score: number;
  errors: PreflightIssue[];
  warnings: PreflightIssue[];
  info: PreflightIssue[];
}

const VALID_FIELD_TYPES = [
  'String', 'Int', 'Float', 'Boolean', 'DateTime',
  'Json', 'BigInt', 'Decimal', 'Bytes'
];

export function preflight(blueprintContent: string): PreflightResult {
  const result: PreflightResult = {
    passed: true,
    score: 100,
    errors: [],
    warnings: [],
    info: []
  };

  // 1. Try to parse
  let ast: HelixAST;
  try {
    ast = parseHelix(blueprintContent);
  } catch (e: any) {
    result.errors.push({
      severity: 'error',
      code: 'PARSE_FAILURE',
      message: `Blueprint failed to parse: ${e.message}`,
      fix: 'Check .helix syntax — ensure all strands use format: strand Name { field: Type }'
    });
    result.passed = false;
    result.score = 0;
    return result;
  }

  // 2. Check for empty strands
  if (ast.strands.length === 0) {
    result.errors.push({
      severity: 'error',
      code: 'NO_STRANDS',
      message: 'Blueprint contains no strands (data models)',
      fix: 'Add at least one strand: strand User { name: String, email: String }'
    });
    result.passed = false;
    result.score = 0;
    return result;
  }

  const strandNames = ast.strands.map(s => s.name);

  // 3. Check each strand
  for (const strand of ast.strands) {
    // Empty fields
    if (!strand.fields || strand.fields.length === 0) {
      result.errors.push({
        severity: 'error',
        code: 'EMPTY_STRAND',
        message: `Strand "${strand.name}" has no fields`,
        fix: `Add fields: strand ${strand.name} { name: String }`
      });
      result.score -= 20;
    }

    // Field type validation
    if (strand.fields) {
      for (const field of strand.fields) {
        if (!VALID_FIELD_TYPES.includes(field.type) && !strandNames.includes(field.type)) {
          result.warnings.push({
            severity: 'warning',
            code: 'UNKNOWN_TYPE',
            message: `Field "${field.name}" in strand "${strand.name}" has unknown type "${field.type}"`,
            fix: `Valid types: ${VALID_FIELD_TYPES.join(', ')} or another strand name`
          });
          result.score -= 5;
        }
      }

      // Duplicate fields
      const fieldNames = strand.fields.map(f => f.name);
      const duplicates = fieldNames.filter((name, i) => fieldNames.indexOf(name) !== i);
      if (duplicates.length > 0) {
        result.errors.push({
          severity: 'error',
          code: 'DUPLICATE_FIELD',
          message: `Strand "${strand.name}" has duplicate fields: ${[...new Set(duplicates)].join(', ')}`,
          fix: 'Remove or rename duplicate fields'
        });
        result.score -= 15;
      }
    }

    // Naming convention
    if (strand.name[0] !== strand.name[0].toUpperCase()) {
      result.warnings.push({
        severity: 'warning',
        code: 'NAMING_CONVENTION',
        message: `Strand "${strand.name}" should start with uppercase (PascalCase)`,
        fix: `Rename to "${strand.name[0].toUpperCase() + strand.name.slice(1)}"`
      });
      result.score -= 3;
    }

    // Orphaned relations
    if (strand.relations) {
      for (const rel of strand.relations) {
        const target = rel.target || rel.name;
        if (!strandNames.includes(target)) {
          result.errors.push({
            severity: 'error',
            code: 'ORPHAN_RELATION',
            message: `Strand "${strand.name}" has relation to non-existent strand "${target}"`,
            fix: `Create the "${target}" strand or remove the relation`
          });
          result.score -= 15;
        }
      }
    }
  }

  // 4. Duplicate strand names
  const dupStrands = strandNames.filter((name, i) => strandNames.indexOf(name) !== i);
  if (dupStrands.length > 0) {
    result.errors.push({
      severity: 'error',
      code: 'DUPLICATE_STRAND',
      message: `Duplicate strand names: ${[...new Set(dupStrands)].join(', ')}`,
      fix: 'Each strand must have a unique name'
    });
    result.score -= 20;
  }

  // 5. Stats
  const totalFields = ast.strands.reduce((sum, s) => sum + (s.fields?.length || 0), 0);
  const totalRelations = ast.strands.reduce((sum, s) => sum + (s.relations?.length || 0), 0);
  result.info.push({
    severity: 'info',
    code: 'BLUEPRINT_STATS',
    message: `${ast.strands.length} strand(s), ${totalFields} field(s), ${totalRelations} relation(s)`
  });

  // Complexity warnings
  if (ast.strands.length > 10) {
    result.warnings.push({
      severity: 'warning',
      code: 'HIGH_COMPLEXITY',
      message: `${ast.strands.length} strands is complex. Consider splitting into modules.`
    });
    result.score -= 5;
  }

  result.score = Math.max(0, Math.min(100, result.score));
  result.passed = result.errors.length === 0;

  return result;
}

export function formatPreflightResult(result: PreflightResult): string {
  const lines: string[] = [];

  if (result.passed) {
    lines.push(`  ✅ Pre-flight PASSED (confidence: ${result.score}%)`);
  } else {
    lines.push(`  ❌ Pre-flight FAILED (confidence: ${result.score}%)`);
  }
  lines.push('');

  if (result.errors.length > 0) {
    lines.push('  🔴 Errors:');
    for (const e of result.errors) {
      lines.push(`    [${e.code}] ${e.message}`);
      if (e.fix) lines.push(`      💡 Fix: ${e.fix}`);
    }
    lines.push('');
  }

  if (result.warnings.length > 0) {
    lines.push('  🟡 Warnings:');
    for (const w of result.warnings) {
      lines.push(`    [${w.code}] ${w.message}`);
      if (w.fix) lines.push(`      💡 Fix: ${w.fix}`);
    }
    lines.push('');
  }

  if (result.info.length > 0) {
    lines.push('  ℹ️  Info:');
    for (const i of result.info) {
      lines.push(`    ${i.message}`);
    }
  }

  return lines.join('\n');
}
