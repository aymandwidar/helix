/**
 * Helix Lexer — Tokenizes .helix source into a token stream
 */

import { SourceLocation } from './ast.js';

export enum TokenType {
  // Keywords
  STRAND = 'STRAND',
  FIELD = 'FIELD',
  RELATION = 'RELATION',
  STRATEGY = 'STRATEGY',
  VIEW = 'VIEW',
  PAGE = 'PAGE',
  ENUM = 'ENUM',
  AUTH = 'AUTH',

  // Identifiers & literals
  IDENT = 'IDENT',
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  TRUE = 'TRUE',
  FALSE = 'FALSE',

  // Symbols
  LBRACE = 'LBRACE',       // {
  RBRACE = 'RBRACE',       // }
  LBRACKET = 'LBRACKET',   // [
  RBRACKET = 'RBRACKET',   // ]
  LPAREN = 'LPAREN',       // (
  RPAREN = 'RPAREN',       // )
  COLON = 'COLON',         // :
  COMMA = 'COMMA',         // ,
  AT = 'AT',               // @
  EQUALS = 'EQUALS',       // =
  QUESTION = 'QUESTION',   // ?
  ARROW = 'ARROW',         // ->

  // Control
  NEWLINE = 'NEWLINE',
  EOF = 'EOF',
}

export interface Token {
  type: TokenType;
  value: string;
  loc: SourceLocation;
}

const KEYWORDS: Record<string, TokenType> = {
  strand: TokenType.STRAND,
  field: TokenType.FIELD,
  relation: TokenType.RELATION,
  strategy: TokenType.STRATEGY,
  view: TokenType.VIEW,
  page: TokenType.PAGE,
  enum: TokenType.ENUM,
  auth: TokenType.AUTH,
  true: TokenType.TRUE,
  false: TokenType.FALSE,
};

export class Lexer {
  private source: string;
  private pos: number = 0;
  private line: number = 1;
  private col: number = 1;
  private tokens: Token[] = [];

  constructor(source: string) {
    this.source = source;
  }

  tokenize(): Token[] {
    while (this.pos < this.source.length) {
      this.skipWhitespace();
      if (this.pos >= this.source.length) break;

      const ch = this.source[this.pos];

      // Comments
      if (ch === '/' && this.peek(1) === '/') {
        this.skipLineComment();
        continue;
      }

      // Newlines (significant for statement separation)
      if (ch === '\n') {
        this.emit(TokenType.NEWLINE, '\n');
        this.pos++;
        this.line++;
        this.col = 1;
        continue;
      }

      if (ch === '\r') {
        this.pos++;
        continue;
      }

      // Arrow ->
      if (ch === '-' && this.peek(1) === '>') {
        this.emit(TokenType.ARROW, '->');
        this.pos += 2;
        this.col += 2;
        continue;
      }

      // Single-char symbols
      const symbolMap: Record<string, TokenType> = {
        '{': TokenType.LBRACE,
        '}': TokenType.RBRACE,
        '[': TokenType.LBRACKET,
        ']': TokenType.RBRACKET,
        '(': TokenType.LPAREN,
        ')': TokenType.RPAREN,
        ':': TokenType.COLON,
        ',': TokenType.COMMA,
        '@': TokenType.AT,
        '=': TokenType.EQUALS,
        '?': TokenType.QUESTION,
      };

      if (symbolMap[ch]) {
        this.emit(symbolMap[ch], ch);
        this.pos++;
        this.col++;
        continue;
      }

      // String literals
      if (ch === '"' || ch === "'") {
        this.readString(ch);
        continue;
      }

      // Numbers (including negative)
      if (this.isDigit(ch) || (ch === '-' && this.peek(1) !== undefined && this.isDigit(this.peek(1)!))) {
        this.readNumber();
        continue;
      }

      // Identifiers & keywords
      if (this.isIdentStart(ch)) {
        this.readIdent();
        continue;
      }

      // Path-like values: /route/path
      if (ch === '/') {
        this.readPath();
        continue;
      }

      // Unknown character — emit as IDENT so it's preserved in readToEndOfLine
      this.emit(TokenType.IDENT, ch);
      this.pos++;
      this.col++;
    }

    this.emit(TokenType.EOF, '');
    return this.tokens;
  }

  private emit(type: TokenType, value: string) {
    this.tokens.push({ type, value, loc: { line: this.line, column: this.col } });
  }

  private peek(offset: number = 0): string | undefined {
    return this.source[this.pos + offset];
  }

  private skipWhitespace() {
    while (this.pos < this.source.length) {
      const ch = this.source[this.pos];
      if (ch === ' ' || ch === '\t') {
        this.pos++;
        this.col++;
      } else {
        break;
      }
    }
  }

  private skipLineComment() {
    while (this.pos < this.source.length && this.source[this.pos] !== '\n') {
      this.pos++;
    }
  }

  private readString(quote: string) {
    const startCol = this.col;
    this.pos++; // skip opening quote
    this.col++;
    let value = '';
    while (this.pos < this.source.length && this.source[this.pos] !== quote) {
      if (this.source[this.pos] === '\\') {
        this.pos++;
        this.col++;
      }
      value += this.source[this.pos];
      this.pos++;
      this.col++;
    }
    if (this.pos < this.source.length) {
      this.pos++; // skip closing quote
      this.col++;
    }
    this.tokens.push({ type: TokenType.STRING, value, loc: { line: this.line, column: startCol } });
  }

  private readNumber() {
    const startCol = this.col;
    let value = '';
    if (this.source[this.pos] === '-') {
      value += '-';
      this.pos++;
      this.col++;
    }
    while (this.pos < this.source.length && (this.isDigit(this.source[this.pos]) || this.source[this.pos] === '.')) {
      value += this.source[this.pos];
      this.pos++;
      this.col++;
    }
    this.tokens.push({ type: TokenType.NUMBER, value, loc: { line: this.line, column: startCol } });
  }

  private readIdent() {
    const startCol = this.col;
    let value = '';
    while (this.pos < this.source.length && this.isIdentPart(this.source[this.pos])) {
      value += this.source[this.pos];
      this.pos++;
      this.col++;
    }
    const type = KEYWORDS[value] || TokenType.IDENT;
    this.tokens.push({ type, value, loc: { line: this.line, column: startCol } });
  }

  private readPath() {
    const startCol = this.col;
    let value = '';
    while (this.pos < this.source.length && !this.isWhitespace(this.source[this.pos]) && this.source[this.pos] !== '\n' && this.source[this.pos] !== '\r' && this.source[this.pos] !== '}' && this.source[this.pos] !== ',') {
      value += this.source[this.pos];
      this.pos++;
      this.col++;
    }
    this.tokens.push({ type: TokenType.IDENT, value, loc: { line: this.line, column: startCol } });
  }

  private isWhitespace(ch: string): boolean {
    return ch === ' ' || ch === '\t';
  }

  private isDigit(ch: string): boolean {
    return ch >= '0' && ch <= '9';
  }

  private isIdentStart(ch: string): boolean {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
  }

  private isIdentPart(ch: string): boolean {
    return this.isIdentStart(ch) || this.isDigit(ch) || ch === '-';
  }
}
