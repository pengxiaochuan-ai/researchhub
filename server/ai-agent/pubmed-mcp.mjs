import { fileURLToPath } from 'node:url';
import { mkdir, open, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { SKILL_DEFINITIONS } from './skill-catalog.mjs';
import { minimalMcpEnvironment } from '../../integrations/pubmed-mcp/egress.mjs';

const integration = new URL('../../integrations/pubmed-mcp/', import.meta.url);
const expectedTools = SKILL_DEFINITIONS.find(s => s.key === 'pubmed-medical-literature').requiredTools;

export async function createPubmedMcp({ authorize, cwd, record = async () => {}, signal } = {}) {
  if (typeof authorize !== 'function') throw new Error('HUB_MCP_AUTHORIZATION_REQUIRED');
  const assertAuthorized = async request => {
    if (await authorize(request) !== true) throw new Error('HUB_MCP_ACCESS_DENIED');
  };
  await assertAuthorized({ operation: 'connect', sourceScope: 'public-literature' });
  if (!cwd) throw new Error('HUB_MCP_PRIVATE_DIRECTORY_REQUIRED');
  signal?.throwIfAborted();
  await mkdir(cwd, { recursive: true, mode: 0o700 });
  const { Client } = await import(new URL('node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js', integration));
  const { StdioClientTransport } = await import(new URL('node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js', integration));
  const transport = new StdioClientTransport({ command: process.execPath,
    args: [fileURLToPath(new URL('launch.mjs', integration))], cwd,
    env: minimalMcpEnvironment(cwd), stderr: 'pipe' });
  const stderr = await open(join(cwd, 'mcp.stderr.log'), 'a', 0o600);
  transport.stderr.on('data', chunk => { void stderr.write(chunk).catch(() => {}); });
  const client = new Client({ name: 'qiyan-hub-backend', version: '0.1.0' }, { capabilities: {} });
  let closed = false, closing;
  const close = () => {
    if (!closing) {
      closed = true;
      closing = (async () => { try { await client.close(); } finally { await stderr.close(); } })();
    }
    return closing;
  };
  try {
    await client.connect(transport, { signal, timeout: 25000 });
    const discovered = [];
    let cursor;
    do {
      const page = await client.listTools(cursor ? { cursor } : undefined, { signal, timeout: 15000 });
      discovered.push(...page.tools); cursor = page.nextCursor;
      if (discovered.length > 100) throw new Error('HUB_MCP_CATALOG_LIMIT');
    } while (cursor);
    const missing = expectedTools.filter(name => !discovered.some(t => t.name === name));
    if (missing.length) throw new Error('HUB_MCP_MISSING_TOOLS:' + missing.join(','));
    const tools = discovered.filter(t => expectedTools.includes(t.name));
    await writeFile(join(cwd, 'tool-catalog.json'), JSON.stringify({ server: client.getServerVersion(), tools,
      ignoredTools: discovered.filter(t => !expectedTools.includes(t.name)).map(t => t.name) }, null, 2), { mode: 0o600 });
    return { tools, server: client.getServerVersion(), close,
      async call(name, args, { signal: callSignal = signal } = {}) {
        if (closed) throw new Error('HUB_MCP_CLOSED');
        if (!expectedTools.includes(name)) throw new Error('HUB_MCP_TOOL_NOT_ALLOWED');
        callSignal?.throwIfAborted();
        await assertAuthorized({ operation: 'call', tool: name, args, sourceScope: 'public-literature' });
        callSignal?.throwIfAborted();
        const onAbort = () => { void close().catch(() => {}); };
        callSignal?.addEventListener('abort', onAbort, { once: true });
        const event = { callId: randomUUID(), tool: name, args, startedAt: new Date().toISOString(), runtime: 'hub-backend-mcp',
          serverVersion: client.getServerVersion(), status: 'running' };
        try {
          const result = await client.callTool({ name, arguments: args }, undefined, { signal: callSignal, timeout: 25000 });
          callSignal?.throwIfAborted();
          event.status = result.isError ? 'tool-error' : 'complete';
          event.resultHash = createHash('sha256').update(JSON.stringify(result)).digest('hex');
          event.endedAt = new Date().toISOString();
          // Revalidate current authorization before delivering even a completed external response.
          await assertAuthorized({ operation: 'deliver', tool: name, args, sourceScope: 'public-literature' });
          callSignal?.throwIfAborted();
          await record({ ...event, result });
          if (result.isError) throw new Error('HUB_PUBMED_TOOL_FAILED');
          await assertAuthorized({ operation: 'deliver', tool: name, args, sourceScope: 'public-literature' });
          callSignal?.throwIfAborted();
          return result;
        } catch (error) {
          if (callSignal?.aborted) await close();
          await record({ ...event, endedAt: new Date().toISOString(), status: 'failed', code: error.code ?? error.name });
          throw error;
        } finally { callSignal?.removeEventListener('abort', onAbort); }
      } };
  } catch (error) { await close(); throw error; }
}
