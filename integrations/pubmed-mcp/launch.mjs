import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { guardedPubmedFetch, minimalMcpEnvironment } from './egress.mjs';

// Both native OpenCode and Hub SDK launch this entry. Never inherit either host's credentials.
process.env = minimalMcpEnvironment(process.cwd(), process.env);
const traceFile = join(process.cwd(), 'egress.jsonl');
appendFileSync(traceFile, JSON.stringify({ phase: 'configuration', contact: process.env.NCBI_ADMIN_EMAIL,
  maxRetries: Number(process.env.NCBI_MAX_RETRIES), maxConcurrent: Number(process.env.NCBI_MAX_CONCURRENT),
  tool: process.env.NCBI_TOOL_IDENTIFIER, at: new Date().toISOString() }) + '\n', { mode: 0o600 });
// Only the dedicated MCP child is patched; the Hub/old service global fetch is untouched.
globalThis.fetch = guardedPubmedFetch(globalThis.fetch, event => {
  appendFileSync(traceFile, JSON.stringify(event) + '\n', { mode: 0o600 });
});
await import('./node_modules/@cyanheads/pubmed-mcp-server/dist/index.js');
