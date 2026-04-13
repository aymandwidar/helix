import { describe, it, expect } from 'vitest';
import { parseHelix, generatePrismaSchema } from '../../src/parser.js';

describe('generatePrismaSchema', () => {
  const blueprint = `
strand Task {
  field title: String
  field completed: Boolean
  field priority: Int
}
`;

  it('generates SQLite schema by default', () => {
    const ast = parseHelix(blueprint);
    const schema = generatePrismaSchema(ast);
    expect(schema).toContain('provider = "sqlite"');
    expect(schema).toContain('model Task');
    expect(schema).toContain('title');
    expect(schema).toContain('String');
  });

  it('generates PostgreSQL schema with postgres option', () => {
    const ast = parseHelix(blueprint);
    const schema = generatePrismaSchema(ast, 'postgres');
    expect(schema).toContain('provider = "postgresql"');
    expect(schema).toContain('model Task');
  });

  it('generates PostgreSQL schema with supabase option', () => {
    const ast = parseHelix(blueprint);
    const schema = generatePrismaSchema(ast, 'supabase');
    expect(schema).toContain('provider = "postgresql"');
  });

  it('includes id, createdAt, updatedAt fields', () => {
    const ast = parseHelix(blueprint);
    const schema = generatePrismaSchema(ast);
    expect(schema).toContain('@id @default(cuid())');
    expect(schema).toContain('createdAt DateTime @default(now())');
    expect(schema).toContain('updatedAt DateTime @updatedAt');
  });

  it('handles relations', () => {
    const ast = parseHelix(`
strand User {
  field name: String
  relation Post -> hasMany
}
strand Post {
  field title: String
  relation User -> belongsTo
}
`);
    const schema = generatePrismaSchema(ast);
    expect(schema).toContain('model User');
    expect(schema).toContain('model Post');
  });
});
