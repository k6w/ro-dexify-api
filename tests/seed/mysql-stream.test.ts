import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { MysqlInsertStream } from '../../src/seed/mysql-stream.js';

describe('MysqlInsertStream', () => {
  it('parses INSERT statements for allowlisted tables only', async () => {
    const sql = `
      CREATE TABLE \`Lexem\` (\`id\` int NOT NULL, \`formNoAccent\` varchar, \`description\` text);
      CREATE TABLE \`Junk\` (\`a\` int);
      INSERT INTO \`Lexem\` VALUES (1,'casă','noun'),(2,'merge','verb');
      INSERT INTO \`Junk\` VALUES (1);
      INSERT INTO \`Definition\` VALUES (10, 1, 'A house', 'a house', 0, 'main');
    `;
    const out: { table: string; values: (string | number | null)[] }[] = [];
    const stream = Readable.from([sql]).pipe(new MysqlInsertStream());
    for await (const obj of stream) out.push(obj as (typeof out)[number]);
    expect(out.find((r) => r.table === 'Lexem' && r.values[1] === 'casă')).toBeTruthy();
    expect(out.find((r) => r.table === 'Lexem' && r.values[1] === 'merge')).toBeTruthy();
    expect(out.find((r) => r.table === 'Junk')).toBeUndefined();
    expect(out.find((r) => r.table === 'Definition' && r.values[2] === 'A house')).toBeTruthy();
  });

  it('handles escaped quotes in strings', async () => {
    const sql = `INSERT INTO \`Lexem\` VALUES (1, 'O\\'Brien', NULL);`;
    const stream = Readable.from([sql]).pipe(new MysqlInsertStream());
    const rows: { table: string; values: (string | number | null)[] }[] = [];
    for await (const obj of stream) rows.push(obj as (typeof rows)[number]);
    expect(rows[0]?.values[1]).toBe("O'Brien");
    expect(rows[0]?.values[2]).toBeNull();
  });
});
