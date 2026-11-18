const allowedHosts = new Set(['eutils.ncbi.nlm.nih.gov', 'www.ncbi.nlm.nih.gov',
  'pmc.ncbi.nlm.nih.gov', 'www.ebi.ac.uk', 'www.europepmc.org', 'europepmc.org']);

export function assertPubmedEgress(input) {
  const url = new URL(input instanceof Request ? input.url : input);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !allowedHosts.has(url.hostname)) {
    throw new Error('HUB_PUBMED_EGRESS');
  }
  return url;
}

export function minimalMcpEnvironment(cwd, ambient = process.env) {
  return { PATH: ambient.PATH ?? '/usr/bin:/bin', LANG: 'en_US.UTF-8',
    NODE_ENV: 'production', MCP_TRANSPORT_TYPE: 'stdio', MCP_AUTH_MODE: 'none',
    MCP_LOG_LEVEL: 'error', LOGS_DIR: cwd + '/logs', STORAGE_PROVIDER_TYPE: 'in-memory',
    OTEL_ENABLED: 'false', LOG_TOOL_FAILURE_PAYLOADS: 'false',
    NCBI_ADMIN_EMAIL: 'cooperation@pengxc.com', NCBI_TOOL_IDENTIFIER: 'qiyan-hub',
    NCBI_REQUEST_DELAY_MS: '1100', NCBI_MAX_CONCURRENT: '1', NCBI_MAX_RETRIES: '0',
    NCBI_TIMEOUT_MS: '15000', NCBI_TOTAL_DEADLINE_MS: '20000',
    EUROPEPMC_ENABLED: 'true', EUROPEPMC_EMAIL: 'cooperation@pengxc.com',
    EUROPEPMC_MAX_RETRIES: '0', EUROPEPMC_TIMEOUT_MS: '15000' };
}

export function guardedPubmedFetch(fetchImpl, record = () => {}) {
  return async function guarded(input, init = {}) {
    let request = new Request(input, { ...init, redirect: 'manual' });
    let target = assertPubmedEgress(request);
    for (let redirects = 0; redirects <= 3; redirects++) {
      assertPubmedEgress(target);
      const startedAt = new Date().toISOString();
      record({ phase: 'started', url: target.href, method: request.method, startedAt });
      try {
        const response = await fetchImpl(request.clone());
        record({ url: target.href, method: request.method, status: response.status, startedAt, endedAt: new Date().toISOString() });
        if (![301, 302, 303, 307, 308].includes(response.status)) return response;
        const location = response.headers.get('location');
        if (!location) throw new Error('HUB_PUBMED_REDIRECT_INVALID');
        await response.body?.cancel();
        target = assertPubmedEgress(new URL(location, target));
        const method = response.status === 303 || ([301, 302].includes(response.status) && request.method === 'POST') ? 'GET' : request.method;
        request = new Request(target, { method, headers: request.headers, signal: request.signal, redirect: 'manual',
          ...(!['GET', 'HEAD'].includes(method) ? { body: await request.arrayBuffer() } : {}) });
      } catch (error) {
        record({ url: target.href, startedAt, endedAt: new Date().toISOString(), failed: true });
        throw error;
      }
    }
    throw new Error('HUB_PUBMED_REDIRECT_LIMIT');
  };
}
