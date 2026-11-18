import { createKnowledgeClient, ApiError } from '../../knowledge-session.js';
import { session } from '../store/auth';
export { ApiError };
export type UploadProgress = { loaded: number; total: number; percent: number | null };
export const api = createKnowledgeClient({ scope: () => session.scope,
  onAccessLost: (error: Error) => window.dispatchEvent(new CustomEvent('knowledge-access-lost', { detail: error.message })),
});
