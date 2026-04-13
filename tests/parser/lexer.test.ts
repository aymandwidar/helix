import { describe, it, expect } from 'vitest';
import { Lexer, TokenType } from '../../src/parser/lexer.js';

function tokenTypes(source: string): TokenType[] {
  return new Lexer(source).tokenize().map(t => t.type);
}

function tokenValues(source: string): string[] {
  return new Lexer(source).tokenize().map(t => t.value);
}

describe('Lexer', () => {
  describe('keywords', () => {
    it('recognizes all keywords', () => {
      const tokens = new Lexer('strand field relation strategy view page enum auth').tokenize();
      const types = tokens.map(t => t.type).filter(t => t !== TokenType.EOF);
      expect(types).toEqual([
        TokenType.STRAND, TokenType.FIELD, TokenType.RELATION,
        TokenType.STRATEGY, TokenType.VIEW, TokenType.PAGE,
        TokenType.ENUM, TokenType.AUTH,
      ]);
    });

    it('recognizes true and false', () => {
      const types = tokenTypes('true false');
      expect(types).toContain(TokenType.TRUE);
      expect(types).toContain(TokenType.FALSE);
    });
  });

  describe('identifiers', () => {
    it('tokenizes simple identifiers', () => {
      const tokens = new Lexer('User Post myField').tokenize();
      expect(tokens[0]).toMatchObject({ type: TokenType.IDENT, value: 'User' });
      expect(tokens[1]).toMatchObject({ type: TokenType.IDENT, value: 'Post' });
      expect(tokens[2]).toMatchObject({ type: TokenType.IDENT, value: 'myField' });
    });

    it('allows hyphens in identifiers', () => {
      const tokens = new Lexer('my-field').tokenize();
      expect(tokens[0]).toMatchObject({ type: TokenType.IDENT, value: 'my-field' });
    });

    it('allows underscores in identifiers', () => {
      const tokens = new Lexer('my_field _private').tokenize();
      expect(tokens[0].value).toBe('my_field');
      expect(tokens[1].value).toBe('_private');
    });
  });

  describe('strings', () => {
    it('tokenizes double-quoted strings', () => {
      const tokens = new Lexer('"hello world"').tokenize();
      expect(tokens[0]).toMatchObject({ type: TokenType.STRING, value: 'hello world' });
    });

    it('tokenizes single-quoted strings', () => {
      const tokens = new Lexer("'hello'").tokenize();
      expect(tokens[0]).toMatchObject({ type: TokenType.STRING, value: 'hello' });
    });

    it('handles escaped characters', () => {
      const tokens = new Lexer('"say \\"hello\\""').tokenize();
      expect(tokens[0].type).toBe(TokenType.STRING);
      expect(tokens[0].value).toContain('"');
    });
  });

  describe('numbers', () => {
    it('tokenizes integers', () => {
      const tokens = new Lexer('42').tokenize();
      expect(tokens[0]).toMatchObject({ type: TokenType.NUMBER, value: '42' });
    });

    it('tokenizes floats', () => {
      const tokens = new Lexer('3.14').tokenize();
      expect(tokens[0]).toMatchObject({ type: TokenType.NUMBER, value: '3.14' });
    });

    it('tokenizes negative numbers', () => {
      const tokens = new Lexer('-5').tokenize();
      expect(tokens[0]).toMatchObject({ type: TokenType.NUMBER, value: '-5' });
    });
  });

  describe('symbols', () => {
    it('tokenizes all single-char symbols', () => {
      const types = tokenTypes('{ } [ ] ( ) : , @ = ?');
      expect(types.filter(t => t !== TokenType.EOF)).toEqual([
        TokenType.LBRACE, TokenType.RBRACE,
        TokenType.LBRACKET, TokenType.RBRACKET,
        TokenType.LPAREN, TokenType.RPAREN,
        TokenType.COLON, TokenType.COMMA, TokenType.AT,
        TokenType.EQUALS, TokenType.QUESTION,
      ]);
    });

    it('tokenizes arrow ->', () => {
      const tokens = new Lexer('->').tokenize();
      expect(tokens[0]).toMatchObject({ type: TokenType.ARROW, value: '->' });
    });
  });

  describe('comments', () => {
    it('skips line comments', () => {
      const tokens = new Lexer('// this is a comment\nstrand').tokenize();
      const types = tokens.map(t => t.type).filter(t => t !== TokenType.EOF && t !== TokenType.NEWLINE);
      expect(types).toEqual([TokenType.STRAND]);
    });
  });

  describe('newlines', () => {
    it('emits NEWLINE tokens', () => {
      const types = tokenTypes('a\nb');
      expect(types).toContain(TokenType.NEWLINE);
    });

    it('handles \\r\\n', () => {
      const tokens = new Lexer('a\r\nb').tokenize();
      const values = tokens.filter(t => t.type === TokenType.IDENT).map(t => t.value);
      expect(values).toEqual(['a', 'b']);
    });
  });

  describe('paths', () => {
    it('tokenizes route paths as single tokens', () => {
      const tokens = new Lexer('/dashboard').tokenize();
      expect(tokens[0]).toMatchObject({ type: TokenType.IDENT, value: '/dashboard' });
    });

    it('tokenizes nested paths', () => {
      const tokens = new Lexer('/settings/profile').tokenize();
      expect(tokens[0]).toMatchObject({ type: TokenType.IDENT, value: '/settings/profile' });
    });

    it('stops path at whitespace', () => {
      const tokens = new Lexer('/dashboard sidebar').tokenize();
      expect(tokens[0].value).toBe('/dashboard');
      expect(tokens[1].value).toBe('sidebar');
    });

    it('stops path at closing brace', () => {
      const tokens = new Lexer('/dashboard}').tokenize();
      expect(tokens[0].value).toBe('/dashboard');
      expect(tokens[1].type).toBe(TokenType.RBRACE);
    });
  });

  describe('source locations', () => {
    it('tracks line and column', () => {
      const tokens = new Lexer('strand User {\n  field id: Int\n}').tokenize();
      expect(tokens[0].loc).toEqual({ line: 1, column: 1 });
      // "User" starts at column 8
      expect(tokens[1].loc).toEqual({ line: 1, column: 8 });
      // "field" on line 2 at column 3
      const fieldToken = tokens.find(t => t.type === TokenType.FIELD);
      expect(fieldToken?.loc.line).toBe(2);
    });
  });

  describe('full construct', () => {
    it('tokenizes a strand declaration', () => {
      const source = 'strand User {\n  field email: String @unique\n}';
      const types = tokenTypes(source).filter(t => t !== TokenType.NEWLINE && t !== TokenType.EOF);
      expect(types).toEqual([
        TokenType.STRAND, TokenType.IDENT, TokenType.LBRACE,
        TokenType.FIELD, TokenType.IDENT, TokenType.COLON, TokenType.IDENT,
        TokenType.AT, TokenType.IDENT,
        TokenType.RBRACE,
      ]);
    });
  });
});
