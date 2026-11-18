import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertPubmedEgress, minimalMcpEnvironment, guardedPubmedFetch } from './egress.mjs';

test('allows only declared public literature HTTPS origins', () => {
  for (const url of ['https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi',
    'https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/',
    'https://pmc.ncbi.nlm.nih.gov/articles/PMC1/',
    'https://www.ebi.ac.uk/europepmc/webservices/rest/search']) assertPubmedEgress(url);
  for (const url of ['http://eutils.ncbi.nlm.nih.gov/a', 'https://evil.example/a',
    'http://127.0.0.1:19502/api/private', 'https://api.deepseek.com/chat/completions',
    'https://api.openalex.org/works', 'https://www.ncbi.nlm.nih.gov.evil.example/',
    'https://user:secret@www.ncbi.nlm.nih.gov/']) {
    assert.throws(() => assertPubmedEgress(url), /HUB_PUBMED_EGRESS/);
  }
});

test('request objects preserve method and body, and an off-source redirect is never fetched', async () => {
  const seen = [];
  const guarded = guardedPubmedFetch(async (input, init) => {
    const request = new Request(input, init);
    seen.push({ method: request.method, body: await request.text(), redirect: request.redirect });
    return new Response(null, { status: 302, headers: { location: 'https://evil.example/collect' } });
  });
  const request = new Request('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi', { method: 'POST', body: 'id=123' });
  await assert.rejects(guarded(request), /HUB_PUBMED_EGRESS/);
  assert.deepEqual(seen, [{ method: 'POST', body: 'id=123', redirect: 'manual' }]);
});

test('MCP configuration never copies provider or database credentials', () => {
  const env = minimalMcpEnvironment('/private/owned', { PATH: '/usr/bin',
    DEEPSEEK_API_KEY: 'secret', NCBI_API_KEY: 'unapproved', DATABASE_URL: 'secret',
    ANTHROPIC_API_KEY: 'secret', UNPAYWALL_EMAIL: 'unexpected@example.org' });
  assert.equal(env.DEEPSEEK_API_KEY, undefined);
  assert.equal(env.DATABASE_URL, undefined);
  assert.equal(env.ANTHROPIC_API_KEY, undefined);
  assert.equal(env.NCBI_API_KEY, undefined);
  assert.equal(env.UNPAYWALL_EMAIL, undefined);
  assert.equal(env.NCBI_ADMIN_EMAIL, 'cooperation@pengxc.com');
  assert.equal(env.NCBI_TOOL_IDENTIFIER, 'qiyan-hub');
  assert.equal(env.OTEL_ENABLED, 'false');
});
