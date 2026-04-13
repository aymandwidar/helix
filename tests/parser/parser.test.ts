import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Lexer } from '../../src/parser/lexer.js';
import { Parser } from '../../src/parser/parser.js';
import { parseHelix, parseHelixDetailed } from '../../src/parser/index.js';

function parse(source: string) {
  const tokens = new Lexer(source).tokenize();
  return new Parser(tokens).parse();
}

describe('Parser', () => {
  describe('strands', () => {
    it('parses a simple strand', () => {
      const { ast, errors } = parse('strand Task {\n  field id: Int\n  field title: String\n}');
      expect(errors).toHaveLength(0);
      expect(ast.strands).toHaveLength(1);
      expect(ast.strands[0].name).toBe('Task');
      expect(ast.strands[0].fields).toHaveLength(2);
    });

    it('parses multiple strands', () => {
      const { ast, errors } = parse(`
        strand User {
          field id: Int
          field name: String
        }
        strand Post {
          field id: Int
          field title: String
        }
      `);
      expect(errors).toHaveLength(0);
      expect(ast.strands).toHaveLength(2);
      expect(ast.strands[0].name).toBe('User');
      expect(ast.strands[1].name).toBe('Post');
    });
  });

  describe('fields', () => {
    it('parses basic field types', () => {
      const { ast } = parse('strand T {\n  field a: String\n  field b: Int\n  field c: Boolean\n  field d: Float\n  field e: DateTime\n}');
      const types = ast.strands[0].fields.map(f => f.type);
      expect(types).toEqual(['String', 'Int', 'Boolean', 'Float', 'DateTime']);
    });

    it('parses optional fields with ?', () => {
      const { ast } = parse('strand T {\n  field bio: String?\n}');
      const field = ast.strands[0].fields[0];
      expect(field.name).toBe('bio');
      expect(field.isOptional).toBe(true);
    });

    it('parses list fields with [Type]', () => {
      const { ast } = parse('strand T {\n  field tags: [String]\n}');
      const field = ast.strands[0].fields[0];
      expect(field.isList).toBe(true);
      expect(field.type).toBe('String');
    });

    it('parses list fields with Type[]', () => {
      const { ast } = parse('strand T {\n  field tags: String[]\n}');
      const field = ast.strands[0].fields[0];
      expect(field.isList).toBe(true);
    });

    it('parses default string values', () => {
      const { ast } = parse('strand T {\n  field status: String = "active"\n}');
      expect(ast.strands[0].fields[0].defaultValue).toBe('active');
    });

    it('parses default numeric values', () => {
      const { ast } = parse('strand T {\n  field views: Int = 0\n}');
      expect(ast.strands[0].fields[0].defaultValue).toBe(0);
    });

    it('parses default boolean values', () => {
      const { ast } = parse('strand T {\n  field published: Boolean = false\n}');
      expect(ast.strands[0].fields[0].defaultValue).toBe(false);
    });

    it('parses inline Enum() type', () => {
      const { ast } = parse('strand T {\n  field role: Enum(admin, user, mod)\n}');
      expect(ast.strands[0].fields[0].type).toBe('Enum(admin,user,mod)');
    });

    it('parses inline Enum() with default', () => {
      const { ast } = parse('strand T {\n  field role: Enum(admin, user) = "user"\n}');
      const field = ast.strands[0].fields[0];
      expect(field.type).toBe('Enum(admin,user)');
      expect(field.defaultValue).toBe('user');
    });
  });

  describe('decorators', () => {
    it('parses simple decorators', () => {
      const { ast } = parse('strand T {\n  field email: String @unique @email\n}');
      const decs = ast.strands[0].fields[0].decorators;
      expect(decs).toHaveLength(2);
      expect(decs[0].name).toBe('unique');
      expect(decs[1].name).toBe('email');
    });

    it('parses decorators with args', () => {
      const { ast } = parse('strand T {\n  field name: String @maxLength(255)\n}');
      const dec = ast.strands[0].fields[0].decorators[0];
      expect(dec.name).toBe('maxLength');
      expect(dec.args).toEqual([255]);
    });

    it('populates legacy constraints array', () => {
      const { ast } = parse('strand T {\n  field x: String @unique @email\n}');
      expect(ast.strands[0].fields[0].constraints).toEqual(['unique', 'email']);
    });
  });

  describe('relations', () => {
    it('parses arrow syntax', () => {
      const { ast, errors } = parse('strand T {\n  relation Post -> hasMany\n}');
      expect(errors).toHaveLength(0);
      expect(ast.strands[0].relations[0]).toMatchObject({ name: 'Post', target: 'hasMany' });
    });

    it('parses colon syntax', () => {
      const { ast, errors } = parse('strand T {\n  relation Post: hasMany\n}');
      expect(errors).toHaveLength(0);
      expect(ast.strands[0].relations[0]).toMatchObject({ name: 'Post', target: 'hasMany' });
    });
  });

  describe('strategies', () => {
    it('parses inline strategy', () => {
      const { ast } = parse('strand T {\n  strategy Validate: Check email format\n}');
      const s = ast.strands[0].strategies[0];
      expect(s.name).toBe('Validate');
      expect(s.action).toBe('Check email format');
    });

    it('parses top-level block strategy', () => {
      const { ast, errors } = parse(`
        strategy Moderate {
          when: "User posts content"
          then: "Run content filter"
          fallback: "Flag for review"
        }
      `);
      expect(errors).toHaveLength(0);
      expect(ast.strategies).toHaveLength(1);
      const s = ast.strategies[0];
      expect(s.name).toBe('Moderate');
      expect(s.when).toBe('User posts content');
      expect(s.then).toBe('Run content filter');
      expect(s.fallback).toBe('Flag for review');
    });

    it('parses inline strategy with fallback arrow', () => {
      const { ast } = parse('strand T {\n  strategy Guard: Check auth -> Deny access\n}');
      const s = ast.strands[0].strategies[0];
      expect(s.action).toBe('Check auth');
      expect(s.fallback).toBe('Deny access');
    });
  });

  describe('enums', () => {
    it('parses enum with newline-separated values', () => {
      const { ast, errors } = parse('enum Status {\n  ACTIVE\n  PAUSED\n  DONE\n}');
      expect(errors).toHaveLength(0);
      expect(ast.enums[0]).toMatchObject({ name: 'Status', values: ['ACTIVE', 'PAUSED', 'DONE'] });
    });

    it('parses enum with comma-separated values', () => {
      const { ast } = parse('enum Priority { LOW, MEDIUM, HIGH }');
      expect(ast.enums[0].values).toEqual(['LOW', 'MEDIUM', 'HIGH']);
    });
  });

  describe('views', () => {
    it('parses view with properties', () => {
      const { ast, errors } = parse(`
        view Dashboard {
          strand: User
          layout: table
          fields: [name, email]
        }
      `);
      expect(errors).toHaveLength(0);
      expect(ast.views[0].name).toBe('Dashboard');
      expect(ast.views[0].properties['strand']).toBe('User');
      expect(ast.views[0].properties['layout']).toBe('table');
    });
  });

  describe('pages', () => {
    it('parses page with route and layout', () => {
      const { ast, errors } = parse(`
        page Home {
          route: /dashboard
          layout: sidebar
          strands: [User, Post]
        }
      `);
      expect(errors).toHaveLength(0);
      const page = ast.pages[0];
      expect(page.name).toBe('Home');
      expect(page.route).toBe('/dashboard');
      expect(page.layout).toBe('sidebar');
      expect(page.strands).toEqual(['User', 'Post']);
    });

    it('parses nested route paths', () => {
      const { ast } = parse('page Settings {\n  route: /settings/profile\n}');
      expect(ast.pages[0].route).toBe('/settings/profile');
    });

    it('defaults route to lowercase name', () => {
      const { ast } = parse('page About {\n  strands: [Info]\n}');
      expect(ast.pages[0].route).toBe('/about');
    });
  });

  describe('auth', () => {
    it('parses auth block', () => {
      const { ast, errors } = parse(`
        auth {
          provider: credentials
          roles: [admin, user]
        }
      `);
      expect(errors).toHaveLength(0);
      expect(ast.auth).toBeDefined();
      expect(ast.auth!.provider).toBe('credentials');
      expect(ast.auth!.roles).toEqual(['admin', 'user']);
    });
  });

  describe('error recovery', () => {
    it('recovers from missing closing brace and parses next strand', () => {
      const { ast } = parse(`
        strand Broken {
          field id: Int

        strand Good {
          field id: Int
        }
      `);
      // Parser should recover and parse at least one strand
      expect(ast.strands.length).toBeGreaterThanOrEqual(1);
    });

    it('produces warning when no strands found', () => {
      const { warnings } = parse('enum Foo { A, B }');
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].message).toContain('No strands');
    });
  });

  describe('comments', () => {
    it('ignores line comments', () => {
      const { ast, errors } = parse(`
        // This is a comment
        strand Task {
          // Another comment
          field id: Int
        }
      `);
      expect(errors).toHaveLength(0);
      expect(ast.strands).toHaveLength(1);
    });
  });

  describe('fixture files', () => {
    it('parses simple.helix', () => {
      const source = readFileSync(join(__dirname, '../fixtures/simple.helix'), 'utf-8');
      const { ast, errors } = parseHelixDetailed(source);
      expect(errors).toHaveLength(0);
      expect(ast.strands).toHaveLength(1);
      expect(ast.strands[0].name).toBe('Task');
      expect(ast.strands[0].fields).toHaveLength(3);
      expect(ast.strands[0].fields[2].defaultValue).toBe(false);
    });

    it('parses complex.helix without errors', () => {
      const source = readFileSync(join(__dirname, '../fixtures/complex.helix'), 'utf-8');
      const { ast, errors } = parseHelixDetailed(source);
      expect(errors).toHaveLength(0);
      expect(ast.strands).toHaveLength(2);
      expect(ast.enums).toHaveLength(2);
      expect(ast.strategies).toHaveLength(2);
      expect(ast.views).toHaveLength(2);
      expect(ast.pages).toHaveLength(2);
      expect(ast.auth).toBeDefined();
    });

    it('reports errors for malformed.helix', () => {
      const source = readFileSync(join(__dirname, '../fixtures/malformed.helix'), 'utf-8');
      const { errors } = parseHelixDetailed(source);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('parseHelix backward compatibility', () => {
    it('returns HelixAST with pages and enums arrays', () => {
      const ast = parseHelix('strand T {\n  field id: Int\n}');
      expect(ast.pages).toBeInstanceOf(Array);
      expect(ast.enums).toBeInstanceOf(Array);
      expect(ast.strands).toHaveLength(1);
    });
  });
});
