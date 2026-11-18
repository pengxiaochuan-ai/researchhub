import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createPubmedMcp } from './pubmed-mcp.mjs';

test('real MCP client rejects cancellation and unlisted tools without upstream traffic', { timeout: 30000 }, async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'hub-mcp-negative-'));
  const mcp = await createPubmedMcp({ cwd, authorize: async () => true });
  try {
    const controller = new AbortController(); controller.abort();
    await assert.rejects(mcp.call('pubmed_search_articles', { query: 'acupuncture', maxResults: 0 }, { signal: controller.signal }), error => error.name === 'AbortError');
    await assert.rejects(mcp.call('pubmed_fetch_citation_metrics', { pmids: ['35168522'] }), /HUB_MCP_TOOL_NOT_ALLOWED/);
    const trace = (await readFile(join(cwd, 'egress.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
    assert.equal(trace.every(event => event.phase === 'configuration'), true);
  } finally { await mcp.close(); }
  await assert.rejects(mcp.call('pubmed_search_articles', { query: 'acupuncture' }), /HUB_MCP_CLOSED/);
});

test('cancellation during delivery recording cannot return a late public result', { timeout: 35000 }, async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'hub-mcp-late-'));
  const controller = new AbortController();
  const mcp = await createPubmedMcp({ cwd, authorize: async () => true,
    record: async event => { if (event.status === 'complete') controller.abort(); } });
  try {
    await assert.rejects(mcp.call('pubmed_search_articles', { query: 'acupuncture[Title/Abstract]', maxResults: 0 }, { signal: controller.signal }));
  } finally { await mcp.close(); }
});

test('cancelling an actually started upstream request closes its dedicated MCP process', { timeout: 35000 }, async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'hub-mcp-inflight-'));
  const events = [], controller = new AbortController();
  const mcp = await createPubmedMcp({ cwd, authorize: async () => true, record: async event => { events.push(event); } });
  try {
    const pending = mcp.call('pubmed_search_articles', { query: 'depression[Title/Abstract]', maxResults: 0 }, { signal: controller.signal });
    const rejection = assert.rejects(pending);
    const deadline = Date.now() + 5000;
    let started = false;
    while (Date.now() < deadline) {
      const trace = await readFile(join(cwd, 'egress.jsonl'), 'utf8').catch(() => '');
      if (trace.includes('"phase":"started"')) { started = true; break; }
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.equal(started, true, 'cancellation must follow an actual upstream request start');
    controller.abort(); await rejection;
    assert.equal(events.at(-1).status, 'failed');
    await assert.rejects(mcp.call('pubmed_search_articles', { query: 'acupuncture' }), /HUB_MCP_CLOSED/);
  } finally { await mcp.close(); }
});

test('a real public result is not delivered after authorization is revoked', { timeout: 35000 }, async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'hub-mcp-revoke-'));
  const events = [], stages = [];
  const mcp = await createPubmedMcp({ cwd,
    authorize: async request => { stages.push(request.operation); return request.operation !== 'deliver'; },
    record: async event => { events.push(event); } });
  try {
    await assert.rejects(mcp.call('pubmed_search_articles', { query: 'acupuncture[Title/Abstract]', maxResults: 0 }), /HUB_MCP_ACCESS_DENIED/);
    assert.deepEqual(stages, ['connect', 'call', 'deliver']);
    assert.equal(events.at(-1).status, 'failed');
    assert.equal(events.some(event => Object.hasOwn(event, 'result')), false);
    const network = (await readFile(join(cwd, 'egress.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
    assert.ok(network.some(event => event.status === 200));
  } finally { await mcp.close(); }
});
