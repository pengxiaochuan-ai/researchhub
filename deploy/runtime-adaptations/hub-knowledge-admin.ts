import { ForbiddenException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { JwtUser } from './types';
import { requireStudyGroupHeader } from './study-group-context';
import { requireResearchProjectHeader } from './research-project-context';
import { lockAuthorizationMutation } from './worker-publication';

const denied = (): never => { throw new ForbiddenException({ code: 'WORKER_AUTHORIZATION_REVOKED', message: '当前身份或知识资料所属研究已失效' }); };
type Anchor = { accountId: string; tenantId: string; authVersion: number; groupId: string; projectId: string };
const anchors = new WeakMap<object, Anchor>();
async function parents(tx: Prisma.TransactionClient, user: JwtUser, groupId: string, projectId: string) {
  if (!user.accountId || !user.tenantId || !Number.isInteger(user.authVersion) || user.role !== 'tenant_admin' || user.isTenantAdmin !== true) denied();
  const account = await tx.account.findFirst({ where: { id: user.accountId, tenantId: user.tenantId, authVersion: user.authVersion, role: 'tenant_admin', isTenantAdmin: true, status: 'active', tenant: { status: 'active' } }, select: { id: true } });
  const group = await tx.studyGroup.findFirst({ where: { id: groupId, tenantId: user.tenantId, status: 'active' }, select: { id: true } });
  const project = await tx.researchProject.findFirst({ where: { id: projectId, tenantId: user.tenantId, studyGroupId: groupId, status: 'active', studyGroup: { tenantId: user.tenantId, status: 'active' } }, select: { id: true } });
  if (!account || !group || !project) denied();
}
export async function authorizeHubKnowledgeAdminHttp(prisma: PrismaService, user: JwtUser, headers: Record<string, string | string[] | undefined>): Promise<boolean> {
  if (user.role !== 'tenant_admin') return false;
  const groupId = requireStudyGroupHeader(headers['x-study-group-id']);
  const projectId = requireResearchProjectHeader(headers['x-research-project-id']);
  await prisma.elevated.$transaction(async tx => {
    await lockAuthorizationMutation(tx, user.tenantId, { includeOfficial: true });
    await parents(tx, user, groupId, projectId);
  }, { maxWait: 5000, timeout: 10000 });
  user.studyGroupId = groupId; user.studyGroupRoleKey = 'tenant_admin';
  user.researchProjectId = projectId; user.researchProjectRoleKey = 'project_manager';
  return true;
}
export async function authorizeHubKnowledgeAdminRead(tx: Prisma.TransactionClient, user: JwtUser, groupId: string, projectId: string): Promise<boolean> {
  if (process.env.DEPLOYMENT_PRODUCT !== 'researchhub' || user.role !== 'tenant_admin') return false;
  await parents(tx, user, groupId, projectId);
  return true;
}
export function hubChatAdminToolPermissions() {
  return { menuPermissions: ['knowledge'], buttonPermissions: ['chat.use'] };
}
async function chatParent(tx: Prisma.TransactionClient, user: JwtUser, taskId: string | undefined, groupId: string, projectId: string) {
  if (!taskId) denied();
  const task = await tx.knowledgeChatJob.findUnique({ where: { id: taskId! } });
  if (!task || task.tenantId !== user.tenantId || task.studyGroupId !== groupId || task.researchProjectId !== projectId || task.accountId !== user.accountId) denied();
  const session = await tx.session.findUnique({ where: { id: task.sessionId } });
  const hub = session?.contextKey === 'hub:lingshu-xinyu' || /^hub:lingshu-xinyu:conversation:[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(session?.contextKey ?? '');
  const kbId = /^kb:([A-Za-z0-9_-]{1,160})$/.exec(session?.contextKey ?? '')?.[1];
  if (!session || session.tenantId !== user.tenantId || session.studyGroupId !== groupId || session.researchProjectId !== projectId || session.accountId !== user.accountId || session.deletedAt || session.channel !== 'knowledge' || (!hub && !kbId) || session.agentId !== user.tenantId + '-kb-research') denied();
  if (kbId) {
    // Same visibility branches as native RetrievalService. Tenant admin does
    // not acquire somebody else's unassigned private KB through this adapter.
    const kb = await tx.knowledgeBase.findFirst({ where: { id: kbId, OR: [
      { tenantId: user.tenantId, studyGroupId: groupId, researchProjectId: projectId, ownerAccountId: user.accountId },
      { tenantId: user.tenantId, studyGroupId: groupId, researchProjectId: projectId, visibility: 'tenant', ownerAccountId: null },
      { tenantId: null, studyGroupId: null, researchProjectId: null },
      { tenantId: user.tenantId, studyGroupId: groupId, researchProjectId: projectId,
        assignments: { some: { studyGroupId: groupId, OR: [{ accountId: user.accountId }, { accountId: null }] } } },
    ] }, select: { id: true } });
    if (!kb) denied();
  }
  const agent = await tx.agent.findFirst({ where: { id: session.agentId, tenantId: user.tenantId, status: 'active', type: 'research' }, select: { id: true } });
  const access = await tx.agentAccess.findFirst({ where: { tenantId: user.tenantId, agentId: session.agentId, accountId: user.accountId, scopeKey: user.accountId, enabled: true }, select: { id: true } });
  if (!agent || !access) denied();
  for (const [key, value] of [['app.tenant_id', user.tenantId], ['app.account_id', user.accountId], ['app.auth_version', String(user.authVersion)], ['app.hub_key', 'lingshu-xinyu']]) await tx.$executeRawUnsafe('SELECT set_config($1,$2,true)', key, value);
  const admission = await tx.$queryRawUnsafe<Array<{ status: string }>>('SELECT status FROM rh_admission.application WHERE tenant_id=$1 AND hub_key=$2 AND account_id=$3', user.tenantId, 'lingshu-xinyu', user.accountId);
  if (admission.length !== 1 || admission[0].status !== 'approved') denied();
}
export async function authorizeHubKnowledgeAdminWorker(tx: Prisma.TransactionClient, user: JwtUser, ref: object & { kind?: string; taskId?: string }, scope: { product: string }, groupId: string, projectId: string): Promise<boolean> {
  const previous = anchors.get(ref);
  if (previous && (user.role !== 'tenant_admin' || user.isTenantAdmin !== true || user.accountId !== previous.accountId || user.tenantId !== previous.tenantId || user.authVersion !== previous.authVersion || groupId !== previous.groupId || projectId !== previous.projectId)) denied();
  if (scope.product !== 'researchhub' || !['knowledge-import', 'knowledge-chat'].includes(ref.kind ?? '') || user.role !== 'tenant_admin') return false;
  await parents(tx, user, groupId, projectId);
  if (ref.kind === 'knowledge-chat') await chatParent(tx, user, ref.taskId, groupId, projectId);
  anchors.set(ref, { accountId: user.accountId, tenantId: user.tenantId, authVersion: user.authVersion!, groupId, projectId });
  user.studyGroupId = groupId; user.studyGroupRoleKey = 'tenant_admin';
  user.researchProjectId = projectId; user.researchProjectRoleKey = 'project_manager';
  return true;
}
