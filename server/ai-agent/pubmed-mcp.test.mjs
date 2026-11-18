import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPubmedMcp } from './pubmed-mcp.mjs';

test('an absent authorization callback cannot start an external connector', async () => {
  await assert.rejects(createPubmedMcp({}), /HUB_MCP_AUTHORIZATION_REQUIRED/);
});

test('a false authorization result is denial, not an implicit grant', async () => {
  await assert.rejects(createPubmedMcp({ authorize: async () => false }), /HUB_MCP_ACCESS_DENIED/);
});

test('current denial prevents discovery and process launch', async () => {
  let checked = false;
  await assert.rejects(createPubmedMcp({ authorize: async () => {
    checked = true; throw new Error('CURRENT_ACCESS_DENIED');
  } }), /CURRENT_ACCESS_DENIED/);
  assert.equal(checked, true);
});
