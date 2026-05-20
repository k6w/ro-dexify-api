import { createReadStream } from 'node:fs';
import { Transform, type TransformCallback } from 'node:stream';
import { createGunzip } from 'node:zlib';
import { ALLOWED_TABLES } from './schema-map.js';

export interface InsertRow {
  table: string;
  values: (string | number | null)[];
}

export class MysqlInsertStream extends Transform {
  private buffer = '';
  private allowed: Set<string>;
  private columnMap: Map<string, string[]> = new Map();

  constructor(allowed: Set<string> = ALLOWED_TABLES) {
    super({ readableObjectMode: true });
    this.allowed = allowed;
  }

  override _transform(chunk: Buffer | string, _enc: BufferEncoding, cb: TransformCallback): void {
    this.buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    for (;;) {
      const idx = this.findStatementEnd(this.buffer);
      if (idx === -1) break;
      const stmt = this.buffer.slice(0, idx + 1).trim();
      this.buffer = this.buffer.slice(idx + 1);
      this.handleStatement(stmt);
    }
    cb();
  }

  override _flush(cb: TransformCallback): void {
    if (this.buffer.trim()) this.handleStatement(this.buffer.trim());
    this.buffer = '';
    cb();
  }

  private handleStatement(stmt: string): void {
    if (!stmt || stmt.startsWith('--') || stmt.startsWith('/*') || stmt.startsWith('SET ')) return;
    if (stmt.startsWith('LOCK ') || stmt.startsWith('UNLOCK ')) return;
    if (stmt.startsWith('DROP ')) return;

    if (stmt.startsWith('CREATE TABLE')) {
      this.captureCreateTableColumns(stmt);
      return;
    }
    if (!stmt.startsWith('INSERT INTO')) return;
    const table = this.extractTableName(stmt);
    if (!table || !this.allowed.has(table)) return;
    for (const values of iterateValuesTuples(stmt)) {
      this.push({ table, values } satisfies InsertRow);
    }
  }

  private captureCreateTableColumns(stmt: string): void {
    const tableMatch = stmt.match(/CREATE TABLE\s+`([^`]+)`/);
    if (!tableMatch?.[1]) return;
    const table = tableMatch[1];
    const cols: string[] = [];
    const colRe = /^\s*`([^`]+)`\s+[A-Z]/gim;
    for (const m of stmt.matchAll(colRe)) {
      if (m[1]) cols.push(m[1]);
    }
    this.columnMap.set(table, cols);
  }

  getColumns(table: string): string[] {
    return this.columnMap.get(table) ?? [];
  }

  private extractTableName(stmt: string): string | undefined {
    const m = stmt.match(/^INSERT INTO\s+`([^`]+)`/);
    return m?.[1];
  }

  private findStatementEnd(buf: string): number {
    let inSingle = false;
    let inBacktick = false;
    let i = 0;
    while (i < buf.length) {
      const ch = buf[i];
      if (ch === '\\' && (inSingle || inBacktick)) {
        i += 2;
        continue;
      }
      if (ch === "'" && !inBacktick) {
        if (inSingle && buf[i + 1] === "'") {
          i += 2;
          continue;
        }
        inSingle = !inSingle;
      } else if (ch === '`' && !inSingle) {
        inBacktick = !inBacktick;
      } else if (ch === ';' && !inSingle && !inBacktick) {
        return i;
      }
      i++;
    }
    return -1;
  }
}

export function iterateValuesTuples(stmt: string): Iterable<(string | number | null)[]> {
  return {
    [Symbol.iterator](): Iterator<(string | number | null)[]> {
      const valuesIdx = stmt.indexOf(' VALUES ');
      if (valuesIdx === -1) return { next: () => ({ done: true, value: undefined as never }) };
      let i = valuesIdx + ' VALUES '.length;
      while (i < stmt.length && stmt[i] === ' ') i++;
      return {
        next(): IteratorResult<(string | number | null)[]> {
          while (i < stmt.length && (stmt[i] === ',' || stmt[i] === ' ' || stmt[i] === '\n')) i++;
          if (i >= stmt.length || stmt[i] !== '(') return { done: true, value: undefined as never };
          const tuple = parseTuple(stmt, i);
          i = tuple.endIdx + 1;
          return { value: tuple.values, done: false };
        },
      };
    },
  };
}

function parseTuple(
  stmt: string,
  startIdx: number,
): { values: (string | number | null)[]; endIdx: number } {
  if (stmt[startIdx] !== '(') return { values: [], endIdx: startIdx };
  const values: (string | number | null)[] = [];
  let i = startIdx + 1;
  while (i < stmt.length) {
    while (stmt[i] === ' ' || stmt[i] === '\n') i++;
    if (stmt[i] === ')') return { values, endIdx: i };
    if (stmt[i] === "'") {
      const out = readQuoted(stmt, i);
      values.push(out.value);
      i = out.endIdx + 1;
    } else if (stmt.slice(i, i + 4).toUpperCase() === 'NULL' && !isIdentifierChar(stmt[i + 4])) {
      values.push(null);
      i += 4;
    } else {
      const start = i;
      while (i < stmt.length && stmt[i] !== ',' && stmt[i] !== ')') i++;
      const raw = stmt.slice(start, i).trim();
      const num = Number(raw);
      values.push(Number.isFinite(num) ? num : raw);
    }
    while (stmt[i] === ' ' || stmt[i] === '\n') i++;
    if (stmt[i] === ',') i++;
  }
  return { values, endIdx: i };
}

function readQuoted(stmt: string, startIdx: number): { value: string; endIdx: number } {
  let out = '';
  let i = startIdx + 1;
  while (i < stmt.length) {
    const ch = stmt[i];
    if (ch === '\\' && i + 1 < stmt.length) {
      const next = stmt[i + 1];
      if (next === 'n') out += '\n';
      else if (next === 'r') out += '\r';
      else if (next === 't') out += '\t';
      else if (next === '0') out += '\0';
      else if (next === '\\') out += '\\';
      else if (next === "'") out += "'";
      else if (next === '"') out += '"';
      else out += next ?? '';
      i += 2;
      continue;
    }
    if (ch === "'") {
      if (stmt[i + 1] === "'") {
        out += "'";
        i += 2;
        continue;
      }
      return { value: out, endIdx: i };
    }
    out += ch ?? '';
    i++;
  }
  return { value: out, endIdx: i };
}

function isIdentifierChar(ch: string | undefined): boolean {
  if (!ch) return false;
  return /[A-Za-z0-9_]/.test(ch);
}

export function readGzippedSqlDump(path: string): NodeJS.ReadableStream {
  return createReadStream(path).pipe(createGunzip());
}
