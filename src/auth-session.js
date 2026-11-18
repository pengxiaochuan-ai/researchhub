const messages = {
  AUTH_NOT_CONFIGURED: '认证服务尚未配置，未发送登录请求。',
  AUTH_INVALID_CREDENTIALS: '账号或密码不正确，或账号当前不可用。',
  AUTH_FORBIDDEN: '当前账号无权执行此操作。',
  AUTH_ORIGIN_REJECTED: '登录请求来源无法核验，请刷新当前站点后重试；账号权限未变更。',
  AUTH_RATE_LIMITED: '请求过于频繁，请稍后重试。',
  AUTH_UNAVAILABLE: '认证服务暂时不可用，请稍后重试。',
  AUTH_NETWORK: '无法连接认证服务，请检查连接后重试。',
  AUTH_TIMEOUT: '请求超时，操作结果尚未确认；请先刷新会话。',
  AUTH_RESPONSE_INVALID: '认证响应无法确认，请刷新会话后重试。',
};
function failure(code) {
  return Object.assign(new Error(messages[code]), { code });
}
function profile(value) {
  if (!value || ['accountId', 'tenantId', 'username'].some(key => typeof value[key] !== 'string' || !value[key]) ||
      typeof value.displayName !== 'string' ||
      (Object.hasOwn(value, 'isTenantAdmin') && typeof value.isTenantAdmin !== 'boolean') ||
      ['tenantName', 'role'].some(key => Object.hasOwn(value, key) && typeof value[key] !== 'string') ||
      !Array.isArray(value.studyGroups) || value.studyGroups.some(group =>
        !group || typeof group.id !== 'string' || typeof group.name !== 'string' || !Array.isArray(group.researchProjects) ||
        group.researchProjects.some(project => !project || typeof project.id !== 'string' || typeof project.name !== 'string'))) {
    throw failure('AUTH_RESPONSE_INVALID');
  }
  // Only presentation fields leave this adapter. A returned token is never a browser credential.
  return {
    ...(Number.isSafeInteger(value.authVersion)&&value.authVersion>=0?{authVersion:value.authVersion}:{}),
    ...Object.fromEntries(['accountId', 'tenantId', 'tenantName', 'username', 'displayName', 'role', 'isTenantAdmin']
      .filter(key => Object.hasOwn(value, key)).map(key => [key, value[key]])),
    studyGroups: value.studyGroups.map(group => ({ id: group.id, name: group.name,
      ...(group.role&&typeof group.role.name==='string'&&typeof group.role.key==='string'?{role:{name:group.role.name,key:group.role.key}}:{}),
      researchProjects: group.researchProjects.map(project => ({ id: project.id, name: project.name,
        ...(['project_manager','researcher'].includes(project.roleKey)?{roleKey:project.roleKey}:{}) })) })),
  };
}

export function createAuthClient({ tenantSlug, fetchImpl = globalThis.fetch, locks=globalThis.navigator?.locks } = {}) {
  const configured = typeof tenantSlug === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(tenantSlug);
  async function request(action, method = 'GET', body) {
    if (!configured) throw failure('AUTH_NOT_CONFIGURED');
    let response;
    try {
      response = await fetchImpl('/api/auth/' + action, {
        method, mode:'same-origin', credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json','X-ResearchHub-Request':'session-v1' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch (error) {
      throw failure(['AbortError', 'TimeoutError'].includes(error?.name) ? 'AUTH_TIMEOUT' : 'AUTH_NETWORK');
    }
    if (action === 'me' && response.status === 401) {
      // No profile body is needed for anonymous readers. Close the stream now
      // rather than leaving a fetch open until its 15-second timeout fires.
      try { await response.body?.cancel(); } catch { /* It may already be closed. */ }
      return null;
    }
    if(response.status===403){let code;try{code=(await response.json())?.code;}catch{}throw failure(code==='AUTH_ORIGIN_REJECTED'?code:'AUTH_FORBIDDEN');}
    if (!response.ok) throw failure(({ 401: 'AUTH_INVALID_CREDENTIALS', 403: 'AUTH_FORBIDDEN', 429: 'AUTH_RATE_LIMITED' })[response.status] || 'AUTH_UNAVAILABLE');
    try { return await response.json(); } catch { throw failure('AUTH_RESPONSE_INVALID'); }
  }
  return Object.freeze({
    configured,
    async login({ username, password }) {
      if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || !password) throw failure('AUTH_INVALID_CREDENTIALS');
      const operation=async()=>profile((await request('login', 'POST', { tenantSlug, username: username.trim(), password }))?.user);
      return locks?locks.request('researchhub-session-write',operation):operation();
    },
    async me() { const value = await request('me'); return value === null ? null : profile(value); },
    async renew() {const operation=async()=>{const r=await request('renew','POST',{});if(r?.ok!==true||!Number.isFinite(r.expiresAt))throw failure('AUTH_RESPONSE_INVALID');return r.expiresAt;};return locks?locks.request('researchhub-session-write',operation):operation();},
    async logout() {const operation=async()=>{if ((await request('logout', 'POST',{}))?.ok !== true) throw failure('AUTH_RESPONSE_INVALID');};return locks?locks.request('researchhub-session-write',operation):operation();},
  });
}
