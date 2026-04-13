/**
 * Helix Parser Module — Public API
 *
 * Backward-compatible: parseHelix() returns the same HelixAST shape as before,
 * but now uses a proper lexer + recursive descent parser under the hood.
 */

import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { HelixParseError, HelixParseWarning } from './errors.js';
import type {
  HelixAST, HelixStrand, HelixField, HelixRelation, HelixStrategy,
  HelixView, HelixPage, HelixEnum, HelixAuth, HelixDecorator, SourceLocation,
} from './ast.js';

// Re-export everything
export { Lexer } from './lexer.js';
export { Parser } from './parser.js';
export { HelixParseError, HelixParseWarning } from './errors.js';
export type {
  HelixAST, HelixStrand, HelixField, HelixRelation, HelixStrategy,
  HelixView, HelixPage, HelixEnum, HelixAuth, HelixDecorator, SourceLocation,
} from './ast.js';
export { TokenType } from './lexer.js';
export type { Token } from './lexer.js';

/**
 * Parse a .helix file content into an AST.
 * Drop-in replacement for the legacy regex parser.
 *
 * Returns the AST. Errors are logged to console (legacy behavior).
 * For structured errors, use parseHelixDetailed() instead.
 */
export function parseHelix(content: string): HelixAST {
  const result = parseHelixDetailed(content);

  // Legacy behavior: log errors and warnings
  for (const err of result.errors) {
    console.error(`Parse error: ${err.format(content)}`);
  }
  for (const warn of result.warnings) {
    console.warn(`⚠️  ${warn.message}`);
  }

  // Ensure backward compatibility: fields without loc still work
  return normalizeAST(result.ast);
}

/**
 * Parse with full error reporting — no console output.
 */
export function parseHelixDetailed(content: string): {
  ast: HelixAST;
  errors: HelixParseError[];
  warnings: HelixParseWarning[];
} {
  const lexer = new Lexer(content);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

/**
 * Normalize AST for backward compatibility.
 * Ensures fields have the shape legacy code expects.
 */
function normalizeAST(ast: HelixAST): HelixAST {
  for (const strand of ast.strands) {
    for (const field of strand.fields) {
      // Legacy code expects constraints as string[]
      if (!field.constraints) {
        field.constraints = field.decorators?.map(d => d.name) || [];
      }
      // Legacy code checks field.type for "?" suffix
      if (field.isOptional && !field.type.endsWith('?')) {
        // Keep isOptional as the source of truth; legacy code can check both
      }
    }
  }

  // Ensure pages array exists (legacy code expects it)
  if (!ast.pages) ast.pages = [];
  if (!ast.enums) ast.enums = [];

  return ast;
}
