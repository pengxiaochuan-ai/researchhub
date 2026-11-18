import assert from 'node:assert/strict';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { loadSkillCatalog } from '../server/ai-agent/skill-catalog.mjs';
import { prepareHubWorkspace, startHubPreflightRuntime } from '../server/ai-agent/opencode-runtime.mjs';
import { createPubmedMcp } from '../server/ai-agent/pubmed-mcp.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const evidence = join(root, '.superpowers/sdd/qiyan-ai-nine-skills-2026-11-06/evidence', randomUUID());
await mkdir(evidence, { recursive: true, mode: 0o700 });
const catalog = await loadSkillCatalog(root);
await writeFile(join(evidence, 'skill-source-catalog.json'), JSON.stringify(catalog, null, 2), { mode: 0o600 });
const query = '(acupuncture[Title/Abstract]) AND (depression[Title/Abstract])';
const paths = await prepareHubWorkspace({ root, deploymentId: 'hub-skills-preflight', tenantId: 'synthetic-pubmed-check',
  mode: 'preflight', provider: { baseURL: 'http://127.0.0.1:9/v1', model: 'deepseek-v4-pro', apiKey: 'not-a-provider-key' },
  mcp: { hub_pubmed: { type: 'local', command: [process.execPath, fileURLToPath(new URL('../integrations/pubmed-mcp/launch.mjs', import.meta.url))], enabled: true, timeout: 25000 } } });
const summary = { schema: 'hub-nine-skills-preflight.v1', startedAt: new Date().toISOString(), evidence,
  skillCount: catalog.skills.length, modelCalls: 0, phase: 'assembly', connectedTo: 'ResearchHub-backend-only',
  packageVersion: '2.11.1', sdkVersion: '1.32.2' };
let runtime, mcp;
try {
  runtime = await startHubPreflightRuntime({ bin: '/Users/mac/.opencode/bin/opencode.real', paths,
    oldServerRoot: fileURLToPath(new URL('../../app/server/', import.meta.url)) });
  summary.runtime = { pid: runtime.pid, port: runtime.port, workspace: runtime.workspace };
  const response = await fetch(`http://127.0.0.1:${runtime.port}/mcp`, { signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200);
  summary.opencodeMcp = await response.json();
  assert.equal(summary.opencodeMcp.hub_pubmed?.status, 'connected');
  summary.phase = 'mcp-discovery';
  mcp = await createPubmedMcp({ cwd: join(evidence, 'mcp'),
    authorize: async request => {
      assert.equal(request.sourceScope, 'public-literature');
      if (request.operation !== 'connect') assert.ok(request.tool.startsWith('pubmed_'));
      return true;
    }, record: event => appendFile(join(evidence, 'tool-calls.jsonl'), JSON.stringify(event) + '\n', { mode: 0o600 }) });
  summary.server = mcp.server;
  summary.tools = mcp.tools.map(t => t.name);
  await writeFile(join(evidence, 'tool-input-contracts.json'), JSON.stringify(mcp.tools.map(t => ({ name: t.name, inputSchema: t.inputSchema })), null, 2), { mode: 0o600 });
  // Discovery is free and does not execute any Provider or query. Inspect actual schemas before smoke calls.
  if (process.argv.includes('--discover-only')) summary.status = 'discovery-complete';
  else {
    summary.phase = 'pubmed-search';
    const search = await mcp.call('pubmed_search_articles', { query, maxResults: 1 });
    await writeFile(join(evidence, 'search-result.json'), JSON.stringify(search, null, 2), { mode: 0o600 });
    const pmid = search.structuredContent?.pmids?.[0];
    assert.match(pmid, /^\d+$/);
    summary.search = { query, totalCount: search.structuredContent.totalCount, returned: 1, pmid };
    summary.phase = 'metadata';
    const metadata = await mcp.call('pubmed_fetch_articles', { pmids: [pmid] });
    await writeFile(join(evidence, 'metadata-result.json'), JSON.stringify(metadata, null, 2), { mode: 0o600 });
    assert.equal(metadata.structuredContent?.articles?.[0]?.pmid, pmid);
    summary.phase = 'identifier-conversion';
    const conversion = await mcp.call('pubmed_convert_ids', { ids: [pmid], idType: 'pmid' });
    await writeFile(join(evidence, 'conversion-result.json'), JSON.stringify(conversion, null, 2), { mode: 0o600 });
    summary.identifiers = conversion.structuredContent?.records;
    summary.phase = 'fulltext';
    const fulltext = await mcp.call('pubmed_fetch_fulltext', { pmids: [pmid], maxCharacters: 12000, includeTables: true, includeAssets: true });
    await writeFile(join(evidence, 'fulltext-result.json'), JSON.stringify(fulltext, null, 2), { mode: 0o600 });
    const truncation = fulltext.structuredContent?.truncation;
    summary.fulltext = { returned: fulltext.structuredContent?.articles?.length ?? 0,
      unavailable: fulltext.structuredContent?.unavailable,
      ...(truncation ? { truncation: { mode: truncation.mode, originalCharacters: truncation.originalCharacters,
        returnedCharacters: truncation.returnedCharacters, omittedSections: truncation.omittedSections,
        omittedTables: truncation.omittedTables, omittedAssets: truncation.omittedAssets } } : {}) };
    summary.status = summary.fulltext.returned > 0 ? 'read-chain-complete' : 'fulltext-unavailable';
    if (summary.fulltext.returned === 0) process.exitCode = 1;
  }
} catch (error) {
  summary.status = 'failed'; summary.error = { name: error.name, message: error.message.slice(0, 300) };
  process.exitCode = 1;
} finally {
  await mcp?.close(); await runtime?.stop();
  summary.endedAt = new Date().toISOString();
  await writeFile(join(evidence, 'summary.json'), JSON.stringify(summary, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(summary, null, 2));
}
