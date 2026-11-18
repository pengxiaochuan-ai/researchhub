import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { test } from 'node:test';
import { prepareHubWorkspace, startHubPreflightRuntime } from './opencode-runtime.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const bin = '/Users/mac/.opencode/bin/opencode.real';

test('actual OpenCode uses Hub isolated state and old client without a model call', { timeout: 55000 }, async () => {
  assert.equal(existsSync(bin), true, 'OpenCode binary must be installed for this integration check');
  const paths = await prepareHubWorkspace({ root, deploymentId: 'hub-skills-preflight',
    tenantId: 'synthetic-runtime-check', mode: 'preflight', mcp: {},
    provider: { model: 'deepseek-v4-pro', baseURL: 'http://127.0.0.1:9/v1', apiKey: 'not-a-provider-key' } });
  const runtime = await startHubPreflightRuntime({ bin, paths, oldServerRoot: fileURLToPath(new URL('../../../app/server/', import.meta.url)) });
  try {
    const session = await runtime.client.createSession('Hub isolated assembly; no provider execution');
    assert.match(session.id, /^ses_/);
    assert.deepEqual(await runtime.client.listMessages(session.id), []);
    const config = await fetch(`http://127.0.0.1:${runtime.port}/config`).then(r => r.json());
    assert.equal(config.default_agent, 'qiyan');
    assert.equal(config.provider.deepseek.options.baseURL, 'http://127.0.0.1:9/v1');
    assert.equal(config.permission['*'], 'deny');
    const actual = await runtime.client.getPath();
    assert.equal(actual.directory, paths.workspace);
    assert.equal(existsSync(join(paths.data, 'opencode', 'opencode.db')), true);
  } finally { await runtime.stop(); }
});

test('native OpenCode MCP child uses the same declared contact and request policy as Hub SDK calls', { timeout: 55000 }, async () => {
  const paths = await prepareHubWorkspace({ root, deploymentId: 'hub-skills-preflight', tenantId: 'native-mcp-policy', mode: 'preflight',
    provider: { model: 'deepseek-v4-pro', baseURL: 'http://127.0.0.1:9/v1', apiKey: 'not-a-provider-key' },
    mcp: { hub_pubmed: { type: 'local', command: [process.execPath, fileURLToPath(new URL('../../integrations/pubmed-mcp/launch.mjs', import.meta.url))], enabled: true, timeout: 25000 } } });
  const runtime = await startHubPreflightRuntime({ bin, paths, oldServerRoot: fileURLToPath(new URL('../../../app/server/', import.meta.url)) });
  try {
    const status = await fetch(`http://127.0.0.1:${runtime.port}/mcp`).then(r => r.json());
    assert.equal(status.hub_pubmed.status, 'connected');
    const trace = readFileSync(join(paths.workspace, 'egress.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    const policy = trace.find(e => e.phase === 'configuration');
    assert.equal(policy.contact, 'cooperation@pengxc.com');
    assert.equal(policy.maxRetries, 0);
    assert.equal(policy.maxConcurrent, 1);
  } finally { await runtime.stop(); }
});

test('two actual Hub tenants can hold different OpenCode ports simultaneously', { timeout: 55000 }, async () => {
  const input = { root, deploymentId: 'hub-skills-preflight', mode: 'preflight', mcp: {},
    provider: { model: 'deepseek-v4-pro', baseURL: 'http://127.0.0.1:9/v1', apiKey: 'not-a-provider-key' } };
  const oldServerRoot = fileURLToPath(new URL('../../../app/server/', import.meta.url));
  const first = await startHubPreflightRuntime({ bin, paths: await prepareHubWorkspace({ ...input, tenantId: 'parallel-one' }), oldServerRoot });
  let second;
  try {
    second = await startHubPreflightRuntime({ bin, paths: await prepareHubWorkspace({ ...input, tenantId: 'parallel-two' }), oldServerRoot });
    assert.notEqual(first.port, second.port);
    assert.notEqual((await first.client.getPath()).directory, (await second.client.getPath()).directory);
  } finally { await second?.stop(); await first.stop(); }
});
