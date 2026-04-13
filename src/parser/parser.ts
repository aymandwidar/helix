/**
 * Helix Parser — Recursive descent parser producing a typed AST
 */

import { Token, TokenType } from './lexer.js';
import {
  HelixAST, HelixStrand, HelixField, HelixRelation, HelixStrategy,
  HelixView, HelixPage, HelixEnum, HelixAuth, HelixDecorator,
  SourceLocation, createEmptyAST,
} from './ast.js';
import { HelixParseError, HelixParseWarning } from './errors.js';

export class Parser {
  private tokens: Token[];
  private pos: number = 0;
  private errors: HelixParseError[] = [];
  private warnings: HelixParseWarning[] = [];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): { ast: HelixAST; errors: HelixParseError[]; warnings: HelixParseWarning[] } {
    const ast = createEmptyAST();

    while (!this.isAtEnd()) {
      this.skipNewlines();
      if (this.isAtEnd()) break;

      try {
        const token = this.current();

        switch (token.type) {
          case TokenType.STRAND:
            ast.strands.push(this.parseStrand());
            break;
          case TokenType.VIEW:
            ast.views.push(this.parseView());
            break;
          case TokenType.PAGE:
            ast.pages.push(this.parsePage());
            break;
          case TokenType.ENUM:
            ast.enums.push(this.parseEnum());
            break;
          case TokenType.AUTH:
            ast.auth = this.parseAuth();
            break;
          case TokenType.STRATEGY:
            ast.strategies.push(this.parseTopLevelStrategy());
            break;
          default:
            // Skip unknown tokens gracefully
            this.advance();
            break;
        }
      } catch (e) {
        if (e instanceof HelixParseError) {
          this.errors.push(e);
          this.recoverToNextBlock();
        } else {
          throw e;
        }
      }
    }

    if (ast.strands.length === 0) {
      this.warnings.push(new HelixParseWarning(
        'No strands found in blueprint. Check your .helix syntax.',
        { line: 1, column: 1 },
      ));
    }

    return { ast, errors: this.errors, warnings: this.warnings };
  }

  // ── Strand ───────────────────────────────────────────────────────────
  private parseStrand(): HelixStrand {
    const loc = this.current().loc;
    this.expect(TokenType.STRAND);
    const name = this.expectIdent('strand name');
    this.expect(TokenType.LBRACE, 'Expected { after strand name');
    this.skipNewlines();

    const strand: HelixStrand = { name, fields: [], relations: [], strategies: [], loc };

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      this.skipNewlines();
      if (this.check(TokenType.RBRACE)) break;

      const token = this.current();
      switch (token.type) {
        case TokenType.FIELD:
          strand.fields.push(this.parseField());
          break;
        case TokenType.RELATION:
          strand.relations.push(this.parseRelation());
          break;
        case TokenType.STRATEGY:
          strand.strategies.push(this.parseStrategy());
          break;
        default:
          // Try to parse as a bare field (name: Type) without keyword
          if (token.type === TokenType.IDENT && this.peekType(1) === TokenType.COLON) {
            strand.fields.push(this.parseBareField());
          } else {
            this.advance();
          }
          break;
      }
      this.skipNewlines();
    }

    this.expect(TokenType.RBRACE, `Expected } to close strand "${name}"`);
    return strand;
  }

  // ── Field ──────────────────────────────────────────────────────────
  private parseField(): HelixField {
    const loc = this.current().loc;
    this.expect(TokenType.FIELD);
    return this.parseFieldBody(loc);
  }

  private parseBareField(): HelixField {
    const loc = this.current().loc;
    return this.parseFieldBody(loc);
  }

  private parseFieldBody(loc: SourceLocation): HelixField {
    const name = this.expectIdent('field name');
    this.expect(TokenType.COLON, `Expected : after field name "${name}"`);

    // Parse type
    let isOptional = false;
    let isList = false;

    // Handle [Type] syntax
    let type: string;
    if (this.check(TokenType.LBRACKET)) {
      this.advance(); // skip [
      type = this.expectIdent('list item type');
      if (this.check(TokenType.RBRACKET)) this.advance();
      isList = true;
    } else {
      type = this.expectIdent('field type');
    }

    // Handle List<Type> or Type[]
    if (type === 'List' && this.check(TokenType.IDENT)) {
      // List<Type> — the < got consumed as part of something, handle gracefully
      isList = true;
      // Try to read the inner type
      if (this.currentValue() === '<') {
        this.advance();
        type = this.expectIdent('list inner type');
        if (this.currentValue() === '>') this.advance();
      }
    }

    // Handle Enum(...) inline
    if (type === 'Enum' && this.check(TokenType.LPAREN)) {
      this.advance(); // skip (
      const values: string[] = [];
      while (!this.check(TokenType.RPAREN) && !this.isAtEnd()) {
        if (this.check(TokenType.IDENT) || this.check(TokenType.STRING)) {
          values.push(this.current().value);
          this.advance();
        }
        if (this.check(TokenType.COMMA)) this.advance();
      }
      if (this.check(TokenType.RPAREN)) this.advance();
      // Store as Enum type with values encoded
      type = `Enum(${values.join(',')})`;
    }

    // Check for []
    if (this.check(TokenType.LBRACKET)) {
      this.advance();
      if (this.check(TokenType.RBRACKET)) this.advance();
      isList = true;
    }

    // Check for ?
    if (this.check(TokenType.QUESTION)) {
      this.advance();
      isOptional = true;
    }

    // Parse decorators (@unique, @email, @maxLength(255))
    const decorators = this.parseDecorators();

    // Parse default value (= "value" or = 123 or = true)
    let defaultValue: string | number | boolean | undefined;
    if (this.check(TokenType.EQUALS)) {
      this.advance();
      defaultValue = this.parseDefaultValue();
    }

    return {
      name,
      type,
      isOptional,
      isList,
      defaultValue,
      decorators,
      constraints: decorators.map(d => d.name), // legacy compat
      loc,
    };
  }

  private parseDecorators(): HelixDecorator[] {
    const decorators: HelixDecorator[] = [];
    while (this.check(TokenType.AT)) {
      const loc = this.current().loc;
      this.advance(); // skip @
      const name = this.expectIdent('decorator name');
      let args: (string | number)[] | undefined;

      if (this.check(TokenType.LPAREN)) {
        this.advance();
        args = [];
        while (!this.check(TokenType.RPAREN) && !this.isAtEnd()) {
          if (this.check(TokenType.NUMBER)) {
            args.push(parseFloat(this.current().value));
            this.advance();
          } else if (this.check(TokenType.STRING)) {
            args.push(this.current().value);
            this.advance();
          } else if (this.check(TokenType.IDENT)) {
            args.push(this.current().value);
            this.advance();
          }
          if (this.check(TokenType.COMMA)) this.advance();
        }
        if (this.check(TokenType.RPAREN)) this.advance();
      }

      decorators.push({ name, args, loc });
    }
    return decorators;
  }

  private parseDefaultValue(): string | number | boolean | undefined {
    if (this.check(TokenType.STRING)) {
      const val = this.current().value;
      this.advance();
      return val;
    }
    if (this.check(TokenType.NUMBER)) {
      const val = parseFloat(this.current().value);
      this.advance();
      return val;
    }
    if (this.check(TokenType.TRUE)) {
      this.advance();
      return true;
    }
    if (this.check(TokenType.FALSE)) {
      this.advance();
      return false;
    }
    return undefined;
  }

  // ── Relation ───────────────────────────────────────────────────────
  private parseRelation(): HelixRelation {
    const loc = this.current().loc;
    this.expect(TokenType.RELATION);
    const name = this.expectIdent('relation name');

    // Accept both "relation Post: hasMany" and "relation Post -> hasMany"
    if (this.check(TokenType.ARROW)) {
      this.advance();
    } else if (this.check(TokenType.COLON)) {
      this.advance();
    } else {
      throw new HelixParseError(
        `Expected : or -> after relation name "${name}"`,
        this.current().loc,
      );
    }

    const target = this.expectIdent('relation target');

    let isMany = false;
    if (this.check(TokenType.LBRACKET)) {
      this.advance();
      if (this.check(TokenType.RBRACKET)) this.advance();
      isMany = true;
    }

    return { name, target, isMany, loc };
  }

  // ── Strategy (inline, inside strand) ─────────────────────────────
  private parseStrategy(): HelixStrategy {
    const loc = this.current().loc;
    this.expect(TokenType.STRATEGY);
    const name = this.expectIdent('strategy name');

    // Accept both : and { for inline strategies
    if (this.check(TokenType.COLON)) {
      this.advance();
    } else if (this.check(TokenType.LBRACE)) {
      // Delegate to block parsing logic
      return this.parseStrategyBlock(name, loc);
    } else {
      throw new HelixParseError(
        `Expected : or { after strategy name "${name}"`,
        this.current().loc,
      );
    }

    const action = this.readToEndOfLine();
    let fallback: string | undefined;
    const arrowIdx = action.indexOf('->');
    let mainAction = action;
    if (arrowIdx !== -1) {
      mainAction = action.substring(0, arrowIdx).trim();
      fallback = action.substring(arrowIdx + 2).trim();
    }

    return { name, action: mainAction, fallback, loc };
  }

  private parseStrategyBlock(name: string, loc: SourceLocation): HelixStrategy {
    this.advance(); // skip {
    this.skipNewlines();

    let when = '';
    let then = '';
    let fallback: string | undefined;

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      this.skipNewlines();
      if (this.check(TokenType.RBRACE)) break;

      if (this.check(TokenType.IDENT)) {
        const key = this.current().value;
        this.advance();
        if (this.check(TokenType.COLON)) {
          this.advance();
          const value = this.readToEndOfLine().trim();
          if (key === 'when') when = value;
          else if (key === 'then') then = value;
          else if (key === 'fallback') fallback = value;
        }
      } else {
        this.advance();
      }
      this.skipNewlines();
    }

    this.expect(TokenType.RBRACE, `Expected } to close strategy "${name}"`);
    return { name, action: then || when, when, then, fallback, loc };
  }

  private parseTopLevelStrategy(): HelixStrategy {
    const loc = this.current().loc;
    this.expect(TokenType.STRATEGY);
    const name = this.expectIdent('strategy name');

    // Block syntax: strategy Name { when: "..." then: "..." fallback: "..." }
    if (this.check(TokenType.LBRACE)) {
      return this.parseStrategyBlock(name, loc);
    }

    // Inline syntax: strategy Name: action -> fallback
    this.expect(TokenType.COLON, `Expected { or : after strategy name "${name}"`);
    const action = this.readToEndOfLine();
    let fallback: string | undefined;
    const arrowIdx = action.indexOf('->');
    let mainAction = action;
    if (arrowIdx !== -1) {
      mainAction = action.substring(0, arrowIdx).trim();
      fallback = action.substring(arrowIdx + 2).trim();
    }
    return { name, action: mainAction, fallback, loc };
  }

  // ── Enum ───────────────────────────────────────────────────────────
  private parseEnum(): HelixEnum {
    const loc = this.current().loc;
    this.expect(TokenType.ENUM);
    const name = this.expectIdent('enum name');
    this.expect(TokenType.LBRACE, 'Expected { after enum name');
    this.skipNewlines();

    const values: string[] = [];
    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      this.skipNewlines();
      if (this.check(TokenType.RBRACE)) break;

      if (this.check(TokenType.IDENT) || this.check(TokenType.STRING)) {
        values.push(this.current().value);
        this.advance();
      }
      if (this.check(TokenType.COMMA)) this.advance();
      this.skipNewlines();
    }

    this.expect(TokenType.RBRACE, `Expected } to close enum "${name}"`);
    return { name, values, loc };
  }

  // ── View ───────────────────────────────────────────────────────────
  private parseView(): HelixView {
    const loc = this.current().loc;
    this.expect(TokenType.VIEW);
    const name = this.expectIdent('view name');
    this.expect(TokenType.LBRACE, 'Expected { after view name');
    this.skipNewlines();

    const properties: Record<string, string> = {};

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      this.skipNewlines();
      if (this.check(TokenType.RBRACE)) break;

      // Accept identifiers and keywords as property keys
      if (this.check(TokenType.IDENT) || this.isKeywordUsableAsIdent(this.current().type)) {
        const key = this.current().value;
        this.advance();
        if (this.check(TokenType.COLON)) {
          this.advance();
          properties[key] = this.readToEndOfLine().trim();
        }
      } else {
        this.advance();
      }
      this.skipNewlines();
    }

    this.expect(TokenType.RBRACE, `Expected } to close view "${name}"`);
    return { name, properties, loc };
  }

  // ── Page ───────────────────────────────────────────────────────────
  private parsePage(): HelixPage {
    const loc = this.current().loc;
    this.expect(TokenType.PAGE);
    const name = this.expectIdent('page name');
    this.expect(TokenType.LBRACE, 'Expected { after page name');
    this.skipNewlines();

    const page: HelixPage = {
      name,
      route: `/${name.toLowerCase()}`,
      strands: [],
      loc,
    };

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      this.skipNewlines();
      if (this.check(TokenType.RBRACE)) break;

      if (this.check(TokenType.IDENT)) {
        const key = this.current().value;
        this.advance();
        if (this.check(TokenType.COLON)) {
          this.advance();
          if (key === 'route') {
            page.route = this.readToEndOfLine().trim();
          } else if (key === 'layout') {
            page.layout = this.readToEndOfLine().trim();
          } else if (key === 'strands') {
            page.strands = this.parseIdentList();
          }
        }
      } else {
        this.advance();
      }
      this.skipNewlines();
    }

    this.expect(TokenType.RBRACE, `Expected } to close page "${name}"`);
    return page;
  }

  // ── Auth ───────────────────────────────────────────────────────────
  private parseAuth(): HelixAuth {
    const loc = this.current().loc;
    this.expect(TokenType.AUTH);
    this.expect(TokenType.LBRACE, 'Expected { after auth');
    this.skipNewlines();

    const auth: HelixAuth = { provider: 'credentials', roles: [], loc };

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      this.skipNewlines();
      if (this.check(TokenType.RBRACE)) break;

      if (this.check(TokenType.IDENT)) {
        const key = this.current().value;
        this.advance();
        if (this.check(TokenType.COLON)) {
          this.advance();
          if (key === 'provider') {
            auth.provider = this.readToEndOfLine().trim();
          } else if (key === 'roles') {
            auth.roles = this.parseIdentList();
          }
        }
      } else {
        this.advance();
      }
      this.skipNewlines();
    }

    this.expect(TokenType.RBRACE, 'Expected } to close auth block');
    return auth;
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private parseIdentList(): string[] {
    const items: string[] = [];
    if (this.check(TokenType.LBRACKET)) {
      this.advance();
      while (!this.check(TokenType.RBRACKET) && !this.isAtEnd()) {
        if (this.check(TokenType.IDENT) || this.check(TokenType.STRING)) {
          items.push(this.current().value);
          this.advance();
        }
        if (this.check(TokenType.COMMA)) this.advance();
        this.skipNewlines();
      }
      if (this.check(TokenType.RBRACKET)) this.advance();
    } else if (this.check(TokenType.IDENT)) {
      // Single value without brackets
      items.push(this.current().value);
      this.advance();
    }
    return items;
  }

  private readToEndOfLine(): string {
    let value = '';
    while (!this.isAtEnd() && !this.check(TokenType.NEWLINE) && !this.check(TokenType.RBRACE)) {
      value += (value ? ' ' : '') + this.current().value;
      this.advance();
    }
    return value;
  }

  private current(): Token {
    return this.tokens[this.pos] || { type: TokenType.EOF, value: '', loc: { line: 0, column: 0 } };
  }

  private currentValue(): string {
    return this.current().value;
  }

  private peekType(offset: number): TokenType | undefined {
    const token = this.tokens[this.pos + offset];
    return token?.type;
  }

  private advance(): Token {
    const token = this.current();
    if (!this.isAtEnd()) this.pos++;
    return token;
  }

  private check(type: TokenType): boolean {
    return this.current().type === type;
  }

  private isAtEnd(): boolean {
    return this.current().type === TokenType.EOF;
  }

  private expect(type: TokenType, message?: string): Token {
    if (this.check(type)) {
      return this.advance();
    }
    const loc = this.current().loc;
    const msg = message || `Expected ${type} but got ${this.current().type} ("${this.current().value}")`;
    throw new HelixParseError(msg, loc);
  }

  private expectIdent(context: string): string {
    const token = this.current();
    // Accept keywords as identifiers in certain contexts (e.g., field named "status")
    if (token.type === TokenType.IDENT || this.isKeywordUsableAsIdent(token.type)) {
      this.advance();
      return token.value;
    }
    throw new HelixParseError(
      `Expected ${context} but got ${token.type} ("${token.value}")`,
      token.loc,
      `Did you forget to name your ${context}?`,
    );
  }

  private isKeywordUsableAsIdent(type: TokenType): boolean {
    // Allow keywords to be used as names in certain positions
    return [
      TokenType.STRAND, TokenType.FIELD, TokenType.RELATION,
      TokenType.STRATEGY, TokenType.VIEW, TokenType.PAGE,
      TokenType.AUTH, TokenType.ENUM,
    ].includes(type);
  }

  private skipNewlines() {
    while (this.check(TokenType.NEWLINE)) {
      this.advance();
    }
  }

  private recoverToNextBlock() {
    // Skip tokens until we find a keyword or closing brace at a reasonable position
    while (!this.isAtEnd()) {
      const type = this.current().type;
      if (type === TokenType.STRAND || type === TokenType.VIEW ||
          type === TokenType.PAGE || type === TokenType.ENUM ||
          type === TokenType.AUTH || type === TokenType.STRATEGY) {
        return;
      }
      if (type === TokenType.RBRACE) {
        this.advance();
        return;
      }
      this.advance();
    }
  }
}
