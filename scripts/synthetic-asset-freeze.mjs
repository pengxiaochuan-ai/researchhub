// Local-only acceptance snapshot. No DB writes, service lifecycle changes or paid requests.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const out = root + 'docs/test/evidence/2026-10-22-researchhub-synthetic-asset/';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = path => JSON.parse(readFileSync(out + path));
assert.equal(existsSync(out + 'manifest.json'), false, 'Evidence already frozen');

function latest(prefix) {
  const dirs = readdirSync(out, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name.startsWith(prefix) && existsSync(out + d.name + '/result.json'))
    .sort((a, b) => statSync(out + b.name + '/result.json').mtimeMs - statSync(out + a.name + '/result.json').mtimeMs);
  assert.ok(dirs.length, prefix);
  const path = dirs[0].name + '/result.json';
  return { path, ...read(path) };
}

const selected = Object.fromEntries([
  ['owner', 'browser-owner-'], ['admin', 'browser-admin-'], ['api', 'api-'],
  ['keys', 'boundaries-keys-'], ['chunk', 'boundaries-chunk-'], ['pagination', 'pagination-'],
  ['security', 'security-'], ['restart', 'restart-'], ['shellSmoke', 'shell-smoke-'],
].map(([key, prefix]) => [key, latest(prefix)]));
for (const [key, result] of Object.entries(selected)) assert.equal(result.passed, true, key);
const preservation = read('preservation.json'), notion = read('notion-sync.json'), review = read('independent-review.json');
assert.equal(preservation.passed, true);
assert.equal(notion.passed, true);
assert.equal(notion.readbacks.length, 13);
for (const r of notion.readbacks) { assert.equal(r.missing.length, 0); assert.equal(r.priorContentPreserved, true); }
for (const p of notion.parents) assert.equal(p.missingChildReferences.length, 0);
assert.equal(review.importantFound, 3);
assert.equal(review.importantOpen, 0);
assert.equal(review.criticalOpen, 0);
for (const [name, count] of [['regression-final.log', 107], ['kernel-regression.log', 828]]) {
  const log = readFileSync(out + name, 'utf8');
  assert.ok(log.includes('pass ' + count) && log.includes('fail 0') && log.includes('skipped 0'), name);
}
assert.ok(readFileSync(out + 'build-final.log', 'utf8').includes('built in'));

const runtime = JSON.parse(execFileSync(process.execPath, [root + 'researchhub/scripts/local-knowledge.mjs', 'status'], { encoding: 'utf8' }));
assert.equal(runtime.owned, true);
assert.equal(runtime.services.length, 5);
assert.ok(runtime.services.every(s => s.ready));
assert.equal(runtime.pid, preservation.runtimePid);
writeFileSync(out + 'runtime-final.json', JSON.stringify(runtime, null, 2));
const ledger = JSON.parse(readFileSync(root + '.tmp/researchhub-knowledge-local/ai-budget-20261022.json'));
assert.deepEqual(ledger, preservation.ledger);
const spentMicroCny = ledger.records.reduce((n, r) => n + (r.costMicroCny ?? r.reservedMicroCny), 0);
assert.equal(ledger.records.length, 27);
assert.equal(spentMicroCny, 468522);
assert.equal(ledger.limitMicroCny, 5000000);

const paths = [
  'scripts/local-knowledge.mjs', 'scripts/local-knowledge-ai.mjs', 'scripts/local-research-plans.mjs',
  'scripts/local-synthetic-quality.mjs', 'scripts/local-synthetic-reports.mjs', 'scripts/local-synthetic-assets.mjs',
  ...readdirSync(root + 'researchhub/scripts').filter(p => p.startsWith('synthetic-asset-')).map(p => 'scripts/' + p),
  'src/knowledge-session.js', 'src/platform-shell.js', 'src/platform-frontend.js', 'src/synthetic-asset-route.js',
  'tests/synthetic-asset-session.test.mjs', 'tests/synthetic-asset-route.test.mjs',
  'pages/shared/SyntheticQualityPanel.jsx', 'pages/shared/SyntheticReportPanel.jsx',
  'pages/shared/SyntheticAssetWorkspace.jsx', 'pages/shared/synthetic-asset.css', 'pages/shared/missing-main.jsx',
  'docs/product/synthetic-asset-slice-2026-10-22.md', 'docs/testing/synthetic-asset-2026-10-22.md',
  'docs/product/product-baseline.md', 'docs/product/product-changes.md', 'docs/product/使用说明书.md',
  'docs/technical/frontend-architecture.md', 'docs/technical/local-knowledge-runtime.md', 'docs/README.md',
  'docs/planning/synthetic-asset-2026-10-22/task_plan.md', 'docs/planning/synthetic-asset-2026-10-22/findings.md',
  'docs/planning/synthetic-asset-2026-10-22/progress.md',
].map(p => 'researchhub/' + p);
paths.push('docs/product/06-版本更新记录.md');
const sources = [...new Set(paths)].map(path => ({ path, sha256: sha(readFileSync(root + path)) }));
writeFileSync(out + 'tested-source-fingerprints.json', JSON.stringify({ at: new Date().toISOString(), sources }, null, 2));
writeFileSync(out + 'acceptance-summary.json', JSON.stringify({
  at: new Date().toISOString(),
  code: 'implemented-and-tested-local-only',
  configured: 'original-two-synthetic-accounts-own-current-study-private-candidates-only',
  executed: 'actual-original-artifact-version-Source-audit-transaction-services; no new model or numeric calculation',
  business: 'synthetic-flow-verified; professional-acceptance-pending-user',
  tests: { contracts: 107, existingCompiledKernel: 828, api: selected.api.checks.length,
    owner: selected.owner.checks.length, admin: selected.admin.checks.length,
    keyBinding: selected.keys.checks.length, chunkWithdrawal: selected.chunk.checks.length,
    paginationLoaded: selected.pagination.loaded, security: selected.security.checks.length,
    restart: selected.restart.checks.length, shellSmokeRoutes: selected.shellSmoke.results.length },
  selectedEvidence: Object.fromEntries(Object.entries(selected).map(([key, r]) => [key, r.path])),
  independentReview: { importantFound: 3, importantOpen: 0, criticalOpen: 0 },
  fees: { newCalls: 0, newFee: 0, existingCalls: ledger.records.length, spentMicroCny,
    limitMicroCny: ledger.limitMicroCny, originalLedgerUnchanged: true },
  oldSourceFiles: preservation.sources.length, otherHistoryTables: Object.keys(preservation.history).length,
  protectedOwnRuns: preservation.own.runDigest[0].count, protectedOwnArtifacts: preservation.own.existingArtifacts.length,
  oldProcesses: 8, frozenPreviousEntries: preservation.frozen.reduce((n, f) => n + f.entries, 0),
  notionReadbacks: notion.readbacks.length, runtimePid: runtime.pid,
  ownerUrl: selected.owner.url, adminUrl: selected.admin.url,
  formalAsset: false, clinicalData: false, shared: false, approvalLockReleaseExport: false,
  newStudyOrCalculation: false, productionPublished: false,
}, null, 2));

const files = [];
function walk(path, prefix = '') {
  for (const e of readdirSync(path, { withFileTypes: true })) {
    if (e.isDirectory()) walk(path + e.name + '/', prefix + e.name + '/');
    else if (e.name !== 'manifest.json') {
      const bytes = readFileSync(path + e.name);
      files.push({ path: prefix + e.name, bytes: bytes.length, sha256: sha(bytes) });
    }
  }
}
walk(out);
const privateDir = root + '.tmp/researchhub-knowledge-local/';
const r = JSON.parse(readFileSync(privateDir + 'runtime.json'));
const secrets = [r.password, r.secret, JSON.parse(readFileSync(privateDir + 'quality-worker.json')).token,
  ...readFileSync(root + 'app/server/.env', 'utf8').split(/\r?\n/)
    .filter(s => /^\s*DEEPSEEK_API_KEY\s*=/.test(s))
    .map(s => s.slice(s.indexOf('=') + 1).trim().replace(/^["']|["']$/g, ''))].filter(Boolean);
for (const f of files) for (const secret of secrets)
  assert.ok(!readFileSync(out + f.path).includes(Buffer.from(secret)), 'Private value in evidence');
writeFileSync(out + 'manifest.json', JSON.stringify({
  at: new Date().toISOString(), immutableEvidence: true, privateValueScanPassed: true,
  entries: files.sort((a, b) => a.path.localeCompare(b.path)),
}, null, 2), { flag: 'wx' });
for (const f of files) assert.equal(sha(readFileSync(out + f.path)), f.sha256);
for (const s of sources) assert.equal(sha(readFileSync(root + s.path)), s.sha256);
console.log(JSON.stringify({ frozen: true, files: files.length, testedSources: sources.length,
  paidCalls: 0, spentMicroCny, professionalAcceptance: 'pending-user', runtimePid: r.pid,
  ownerUrl: selected.owner.url, adminUrl: selected.admin.url }));
