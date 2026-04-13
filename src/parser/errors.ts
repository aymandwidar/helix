/**
 * Helix Parser Errors — Structured errors with source locations and suggestions
 */

import { SourceLocation } from './ast.js';

export class HelixParseError extends Error {
  loc: SourceLocation;
  suggestion?: string;

  constructor(message: string, loc: SourceLocation, suggestion?: string) {
    super(message);
    this.name = 'HelixParseError';
    this.loc = loc;
    this.suggestion = suggestion;
  }

  format(source?: string): string {
    let output = `Parse error at line ${this.loc.line}, column ${this.loc.column}: ${this.message}`;

    if (source) {
      const lines = source.split('\n');
      const lineContent = lines[this.loc.line - 1];
      if (lineContent !== undefined) {
        output += `\n\n  ${this.loc.line} | ${lineContent}`;
        output += `\n  ${' '.repeat(String(this.loc.line).length)} | ${' '.repeat(Math.max(0, this.loc.column - 1))}^`;
      }
    }

    if (this.suggestion) {
      output += `\n\n  Suggestion: ${this.suggestion}`;
    }

    return output;
  }
}

export class HelixParseWarning {
  message: string;
  loc: SourceLocation;

  constructor(message: string, loc: SourceLocation) {
    this.message = message;
    this.loc = loc;
  }
}

export interface ParseResult<T> {
  value: T;
  errors: HelixParseError[];
  warnings: HelixParseWarning[];
}
