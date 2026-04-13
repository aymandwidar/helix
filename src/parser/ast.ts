/**
 * Helix AST — Type definitions for the .helix DSL abstract syntax tree
 */

export interface SourceLocation {
  line: number;
  column: number;
}

// ── Decorators ───────────────────────────────────────────────────────
export interface HelixDecorator {
  name: string;              // e.g. "unique", "email", "maxLength"
  args?: (string | number)[];  // e.g. [255] for @maxLength(255)
  loc: SourceLocation;
}

// ── Fields ───────────────────────────────────────────────────────────
export interface HelixField {
  name: string;
  type: string;              // "String", "Int", "Float", "Boolean", "DateTime", enum name, etc.
  isOptional: boolean;       // field bio: String?
  isList: boolean;           // field tags: String[]
  defaultValue?: string | number | boolean;
  decorators: HelixDecorator[];
  constraints?: string[];    // legacy compat
  loc: SourceLocation;
}

// ── Relations ────────────────────────────────────────────────────────
export interface HelixRelation {
  name: string;
  target: string;
  isMany: boolean;           // Target[]
  loc: SourceLocation;
}

// ── Strategies ───────────────────────────────────────────────────────
export interface HelixStrategy {
  name: string;
  action: string;
  when?: string;
  then?: string;
  condition?: string;
  fallback?: string;
  loc: SourceLocation;
}

// ── Enums ────────────────────────────────────────────────────────────
export interface HelixEnum {
  name: string;
  values: string[];
  loc: SourceLocation;
}

// ── Strands ──────────────────────────────────────────────────────────
export interface HelixStrand {
  name: string;
  fields: HelixField[];
  relations: HelixRelation[];
  strategies: HelixStrategy[];
  loc: SourceLocation;
}

// ── Views ────────────────────────────────────────────────────────────
export interface HelixView {
  name: string;
  properties: Record<string, string>;
  loc: SourceLocation;
}

// ── Pages ────────────────────────────────────────────────────────────
export interface HelixPage {
  name: string;
  route: string;
  layout?: string;
  strands: string[];
  loc: SourceLocation;
}

// ── Auth ─────────────────────────────────────────────────────────────
export interface HelixAuth {
  provider: string;          // "credentials", "google", "github"
  roles: string[];           // ["admin", "user"]
  loc: SourceLocation;
}

// ── Top-level AST ────────────────────────────────────────────────────
export interface HelixAST {
  strands: HelixStrand[];
  views: HelixView[];
  strategies: HelixStrategy[];
  pages: HelixPage[];
  enums: HelixEnum[];
  auth?: HelixAuth;
}

export function createEmptyAST(): HelixAST {
  return {
    strands: [],
    views: [],
    strategies: [],
    pages: [],
    enums: [],
  };
}
