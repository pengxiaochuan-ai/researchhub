// This island receives only the verified /auth/me presentation, never tokens or demo identity.
export const session: { user: any; scope: any } = { user: null, scope: null };
export function useAuth() { return { user: session.user, scope: session.scope }; }
export function isAdmin(value?: string | { role?: string }) { const role = typeof value === 'object' ? value?.role : value; return role === 'tenant_admin' || role === 'platform_admin'; }
