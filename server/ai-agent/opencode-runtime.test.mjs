import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, symlink, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { prepareHubWorkspace, hubChildEnvironment, isOwnedOpenCodeRequest } from './opencode-runtime.mjs';

test('no unowned loopback, cloud or arbitrary API is allowed by the runtime registry',()=>{
 for(const url of ['http://127.0.0.1:8200/path','http://127.0.0.1:12345/session','http://169.254.169.254/path','https://api.deepseek.com'])assert.equal(isOwnedOpenCodeRequest(url),false);
});

async function options() {
  const root = await mkdtemp(join(tmpdir(), 'hub-opencode-'));
  return { root, deploymentId: 'hub-local', tenantId: 'synthetic-one',
    provider: { baseURL: 'http://127.0.0.1:9/v1', model: 'deepseek-v4-pro', apiKey: 'not-a-provider-key' },
    mode: 'preflight', mcp: {} };
}

test('workspace partitions deployment and tenant without using an old project workspace', async () => {
  const input = await options();
  const one = await prepareHubWorkspace(input);
  const other = await prepareHubWorkspace({ ...input, tenantId: 'synthetic-two' });
  assert.notEqual(one.workspace, other.workspace);
  const config = JSON.parse(await readFile(one.configPath, 'utf8'));
  assert.deepEqual(config.enabled_providers, ['deepseek']);
  assert.equal(config.default_agent, 'qiyan');
  assert.equal(config.permission['*'], 'deny');
  assert.equal(config.agent.qiyan.permission['*'], 'deny');
  assert.equal(config.agent.qiyan.mode, 'primary');
  assert.equal(config.share, 'disabled');
  assert.equal((await stat(one.configPath)).mode & 0o777, 0o600);
});

test('preflight cannot point a dummy credential at a real model provider', async () => {
  const input = await options();
  await assert.rejects(prepareHubWorkspace({ ...input, provider: { ...input.provider, baseURL: 'https://api.deepseek.com' } }), /HUB_PREFLIGHT_PROVIDER/);
});
test('literature runtime accepts only an ephemeral loopback capability, never a provider key or external endpoint',async()=>{
 const input=await options();const config={...input,mode:'literature',instruction:'Only explain the supplied public evidence.',provider:{...input.provider,apiKey:'a'.repeat(64)}};
 const paths=await prepareHubWorkspace(config);assert.equal(JSON.parse(await readFile(paths.configPath,'utf8')).agent.qiyan.prompt,config.instruction);
 await assert.rejects(prepareHubWorkspace({...config,provider:{...config.provider,baseURL:'https://api.deepseek.com'}}));
 await assert.rejects(prepareHubWorkspace({...config,provider:{...config.provider,apiKey:'real-provider-key'}}));
});

test('rejects traversal and existing symlinked runtime roots before writing configuration', async () => {
  const input = await options();
  await assert.rejects(prepareHubWorkspace({ ...input, tenantId: '../old' }), /HUB_RUNTIME_SCOPE/);
  await mkdir(join(input.root, '.superpowers'), { recursive: true });
  const outside = await mkdtemp(join(tmpdir(), 'hub-outside-'));
  await symlink(outside, join(input.root, '.superpowers', 'sdd'));
  await assert.rejects(prepareHubWorkspace(input), /HUB_RUNTIME_SYMLINK/);
});

test('OpenCode child does not inherit database, provider or desktop credentials', async () => {
  const paths = await prepareHubWorkspace(await options());
  const env = hubChildEnvironment(paths, { PATH: '/usr/bin', DATABASE_URL: 'private',
    DEEPSEEK_API_KEY: 'private', ANTHROPIC_API_KEY: 'private', CODEX_HOME: '/private',
    OPENCODE_CONFIG_CONTENT: 'malicious', NODE_OPTIONS: '--require evil', HTTPS_PROXY: 'http://secret' });
  assert.equal(env.DATABASE_URL, undefined);
  assert.equal(env.DEEPSEEK_API_KEY, undefined);
  assert.equal(env.ANTHROPIC_API_KEY, undefined);
  assert.equal(env.NODE_OPTIONS, undefined);
  assert.equal(env.CODEX_HOME, undefined);
  assert.equal(env.HTTPS_PROXY, undefined);
  assert.equal(env.OPENCODE_CONFIG, paths.configPath);
  assert.ok(env.XDG_DATA_HOME.startsWith(paths.workspace));
});
