import{readFileSync,writeFileSync,mkdirSync,existsSync,realpathSync,lstatSync}from'node:fs';import{join,dirname,resolve}from'node:path';import{createHash}from'node:crypto';import{execFileSync}from'node:child_process';
const sha=v=>createHash('sha256').update(v).digest('hex');
export const knowledgeAdminSources=Object.freeze({
 'src/common/guards/study-group.guard.ts':'504213ceb232232fe4ba1f9c79ce8f8b2f7d4dad4e52f75045957e686e64c651',
 'src/common/worker-authorization.ts':'4d6b47558eef285255947e3367bf64f93d9957803da03c29ea3246e89581a257',
 'src/knowledge/knowledge-import.service.ts':'43f60a54903fd32738464fba80dfc0373d6721a3e0a8f419725668b63d4e11ba',
 'src/knowledge/retrieval.service.ts':'44eb278c1d971f8d10ac7153fb1101a774801f253143fbb4558cec7b0467a06e',
 'src/knowledge/knowledge.service.ts':'95de776994a68a1bc0e01efef64292f17842995bea518660ed7126f5e4f9d31c'
});
function replace(text,from,to){if(text.split(from).length!==2)throw Error('CORE_KNOWLEDGE_ADAPTATION_DRIFT');return text.replace(from,to);}
export function knowledgeAdminTransform(path,source){
 if(!knowledgeAdminSources[path]||sha(source)!==knowledgeAdminSources[path])throw Error('CORE_KNOWLEDGE_ADAPTATION_DRIFT');
 if(path.endsWith('/study-group.guard.ts'))return replace(source,"import { JwtUser } from '../types';","import { JwtUser } from '../types';\nimport { authorizeHubKnowledgeAdminHttp } from '../hub-knowledge-admin';").replace('    const studyGroupId = requireStudyGroupHeader(',"    if (process.env.DEPLOYMENT_PRODUCT === 'researchhub' && ['KnowledgeController','HubChatController'].includes(ctx.getClass().name) && await authorizeHubKnowledgeAdminHttp(this.prisma, user, request.headers)) return true;\n\n    const studyGroupId = requireStudyGroupHeader(");
 if(path.endsWith('/worker-authorization.ts')){
  let next=replace(source,"import { scopedAssignmentEnabled } from './scoped-assignment';","import { scopedAssignmentEnabled } from './scoped-assignment';\nimport { authorizeHubKnowledgeAdminWorker, hubChatAdminToolPermissions } from './hub-knowledge-admin';");
  return replace(next,"    if (ref.kind === 'raw-processing' && account.role === 'tenant_admin') {","    if (await authorizeHubKnowledgeAdminWorker(tx, user, ref, scope, groupId, projectId)) {\n      // Hub-only current admin context. All original KB/source/claim checks remain.\n      if (ref.kind === 'knowledge-chat') {\n        if (requirements.toolKeys?.some(key => key !== 'knowledge.search')) return deny();\n        permissionGrant = hubChatAdminToolPermissions();\n      }\n    } else if (ref.kind === 'raw-processing' && account.role === 'tenant_admin') {");
 }
 if(path.endsWith('/retrieval.service.ts')){
  let next=replace(source,"import { hasRequiredPermissions } from '../common/permission-catalog';","import { hasRequiredPermissions } from '../common/permission-catalog';\nimport { authorizeHubKnowledgeAdminRead } from '../common/hub-knowledge-admin';");
  next=replace(next,'    const membership = platform ? null : await tx.studyGroupMembership.findFirst(',"    const hubAdmin = await authorizeHubKnowledgeAdminRead(tx, user, studyGroupId!, researchProjectId!);\n    const membership = (platform || hubAdmin) ? null : await tx.studyGroupMembership.findFirst(");
  next=replace(next,'    const member = platform ? null : await tx.researchProjectMembership.findFirst(','    const member = (platform || hubAdmin) ? null : await tx.researchProjectMembership.findFirst(');
  next=replace(next,'if (!platform && (!membership || !project || !member))','if (!platform && !hubAdmin && (!membership || !project || !member))');
  return replace(next,"    const fingerprint = createHash('sha256').update(JSON.stringify({","    const fingerprint = createHash('sha256').update(JSON.stringify({\n      ...(hubAdmin ? { adminAuthority: { isTenantAdmin: account.isTenantAdmin, studyGroupId, researchProjectId } } : {}),");
 }
 if(path.endsWith('/knowledge.service.ts')){
  let next=replace(source,"import { withCurrentKnowledgeRead } from './retrieval.service';","import { withCurrentKnowledgeRead } from './retrieval.service';\nimport { authorizeHubKnowledgeAdminRead } from '../common/hub-knowledge-admin';");
  next=replace(next,'return this.withMutation(user, async db => {\n      const current = await this.requireVisibleDoc(user, id, db);',"return this.withMutation(user, async db => {\n      const hubKnowledgeAdmin = process.env.DEPLOYMENT_PRODUCT === 'researchhub' && user.role === 'tenant_admin' && await authorizeHubKnowledgeAdminRead(db, user, requireStudyGroupId(user), requireResearchProjectId(user));\n      const current = await this.requireVisibleDoc(user, id, db);");
  return replace(next,"if (!group || !project || !hasRequiredPermissions(group.role.menuPermissions, ['knowledge']) || !hasRequiredPermissions(group.role.buttonPermissions, ['knowledge.edit']) ||\n            (actor!.role !== 'tenant_admin' && !owner)) denied();","if (!hubKnowledgeAdmin && (!group || !project || !hasRequiredPermissions(group.role.menuPermissions, ['knowledge']) || !hasRequiredPermissions(group.role.buttonPermissions, ['knowledge.edit']) ||\n            (actor!.role !== 'tenant_admin' && !owner))) denied();");
 }
 let next=replace(source,"import { withWorkerPublication } from '../common/worker-publication';","import { withWorkerPublication, lockAuthorizationMutation } from '../common/worker-publication';\nimport { assertWorkerAuthorized } from '../common/worker-authorization';");
 return replace(next,"ref = await this.prisma.elevated.$transaction(tx => claim(tx, this.scope, 'knowledge-import', taskId, this.workerId));",`ref = await this.prisma.elevated.$transaction(async tx => {
        if (this.scope.product === 'researchhub') {
          await lockAuthorizationMutation(tx, task.tenantId, { includeOfficial: true });
          await assertWorkerAuthorized(tx, this.scope, { kind: 'knowledge-import', taskId, tenantId: task.tenantId });
        }
        const claimed = await claim(tx, this.scope, 'knowledge-import', taskId, this.workerId);
        if (claimed && this.scope.product === 'researchhub') await assertWorkerAuthorized(tx, this.scope, claimed);
        return claimed;
      });`);
}
export function applyKnowledgeAdminAdaptation({source,output}){
 const sourceRoot=realpathSync(source),outputPath=resolve(output),outputRoot=realpathSync(outputPath);
 if(lstatSync(outputPath).isSymbolicLink()||sourceRoot===outputRoot||outputRoot.startsWith(sourceRoot+'/')||sourceRoot.startsWith(outputRoot+'/'))throw Error('CORE_KNOWLEDGE_ADAPTATION_TARGET_REJECTED');
 source=sourceRoot;output=outputRoot;
 const records=[];for(const[path,before]of Object.entries(knowledgeAdminSources)){
  const target=lstatSync(join(output,path));if(target.isSymbolicLink()||target.nlink!==1||realpathSync(join(output,path))!==join(output,path))throw Error('CORE_KNOWLEDGE_ADAPTATION_TARGET_REJECTED');
  const original=readFileSync(join(source,path),'utf8');if(readFileSync(join(output,path),'utf8')!==original)throw Error('CORE_KNOWLEDGE_ADAPTATION_DRIFT');const adapted=knowledgeAdminTransform(path,original);records.push({path,before,after:sha(adapted),content:adapted});
 }
 const helperPath='src/common/hub-knowledge-admin.ts';if(existsSync(join(output,helperPath)))throw Error('CORE_KNOWLEDGE_ADAPTATION_DRIFT');const helper=readFileSync(new URL('./runtime-adaptations/hub-knowledge-admin.ts',import.meta.url));
 const meta=join(output,'prisma/runtime-adaptations');mkdirSync(meta,{recursive:true});
 for(const row of records){writeFileSync(join(output,row.path),row.content,{mode:0o600});let diff;try{diff=execFileSync('diff',['-u','--label','source/'+row.path,'--label','adapted/'+row.path,join(source,row.path),join(output,row.path)],{encoding:'utf8',stdio:['ignore','pipe','pipe']});}catch(e){if(e.status!==1)throw e;diff=e.stdout;}writeFileSync(join(meta,row.path.replaceAll('/','_')+'.patch'),diff,{mode:0o600});}
 mkdirSync(dirname(join(output,helperPath)),{recursive:true});writeFileSync(join(output,helperPath),helper,{mode:0o600});const manifest={schemaVersion:2,kind:'researchhub-knowledge-and-chat-admin-compatibility',scope:{controllers:['KnowledgeController','HubChatController'],workers:['knowledge-import','knowledge-chat'],chatToolKeys:['knowledge.search']},changes:records.map(({content,...rest})=>rest),added:{path:helperPath,sha256:sha(helper)},sourceUnchanged:true};writeFileSync(join(meta,'knowledge-admin.json'),JSON.stringify(manifest,null,2)+'\n',{mode:0o600});return manifest;
}
