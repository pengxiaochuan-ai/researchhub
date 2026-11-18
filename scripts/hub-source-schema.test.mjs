import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { splitSchemaStatements } from './hub-source-schema.mjs';

test('schema only adds ResearchHub-scoped objects with forced tenant RLS', () => {
  const sql = readFileSync(new URL('../server/hub-sources/schema.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(sql, /(?:ALTER|DROP|TRUNCATE)\s+TABLE\s+(?:public\.|"?(?:Account|KnowledgeBase|knowledge_))/i);
  for (const table of ['source_registry', 'import_batch', 'source_record',
    'canonical_publication', 'canonical_source', 'review_decision']) {
    assert.match(sql, new RegExp(`CREATE TABLE rh_source\\.${table}\\b`, 'i'));
    assert.match(sql, new RegExp(`ALTER TABLE rh_source\\.${table} FORCE ROW LEVEL SECURITY`, 'i'));
  }
  const statements = splitSchemaStatements(sql);
  assert.ok(statements.length >= 20);
  assert.ok(statements.every(s => !s.includes('-- statement')));
  assert.match(sql, /display_allowed\s+BOOLEAN\s+NOT NULL\s+DEFAULT\s+FALSE/i);
  assert.match(sql, /ai_allowed\s+BOOLEAN\s+NOT NULL\s+DEFAULT\s+FALSE/i);
});
