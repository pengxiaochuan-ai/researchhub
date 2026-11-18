import {historyActionAllowed} from './session-history-actions.js';
import {reportQaRequestAllowed} from './report-asset-qa.js';
import {reportAssetRequestAllowed} from './report-asset-context.js';
import {assetDetailAiRequestAllowed} from './research-assets-detail-ai.js';
import {assetReuseRequestAllowed} from './research-assets-reuse.js';
import {assetFileRequestAllowed} from './research-assets-detail-files.js';
import {commentRequestAllowed} from './research-assets-comments.js';
// Existing knowledge HTTP contracts, with ResearchHub-only transport/scope presentation.
import {crfMethodsRequestAllowed} from './crf-methods-session.js';
import {crfMethodAssetRequestAllowed} from './crf-method-assets-session.js';
import {assetApplicabilityRequestAllowed} from './asset-applicability-session.js';
import {guidanceCitationRequestAllowed} from './guidance-plan-citation.js';
import {researchAssetRequestAllowed} from './research-assets-session.js';
import {catalogRequestAllowed} from './research-assets-catalog-session.js';
import {assetRegistrationRequestAllowed} from './research-assets-registration.js';
import {assetUsageRequestAllowed} from './research-assets-usage.js';
import {assetGovernanceRequestAllowed} from './research-assets-governance.js';
import {assetViewRequestAllowed} from './research-assets-views.js';
import {assetLifecycleRequestAllowed} from './research-assets-lifecycle.js';
import {assetDetailRequestAllowed} from './research-assets-detail.js';
import {researchDataRequestAllowed,DATA_REQUEST_MARKER} from './research-data-session.js';
import {sessionMediaRequestAllowed,MEDIA_REQUEST_MARKER} from './session-media-session.js';
export const conversationCommandRequestAllowed=(method,path)=>
 ['GET','POST'].includes(method)&&/^\/sessions\/[A-Za-z0-9_-]+\/commands$/.test(path)||
 method==='PATCH'&&/^\/sessions\/[A-Za-z0-9_-]+\/commands\/[A-Za-z0-9_-]+$/.test(path)||
 method==='POST'&&/^\/sessions\/[A-Za-z0-9_-]+\/commands\/(?:resumption|[A-Za-z0-9_-]+\/cancellation)$/.test(path);
export const sessionMaterialRequestAllowed=(method,path)=>
 method==='POST'&&/^\/sessions\/[A-Za-z0-9_-]+\/materials$/.test(path)||
 method==='GET'&&(/^\/sessions\/[A-Za-z0-9_-]+\/materials(?:\?limit=(?:[1-9]|[1-4][0-9]|50)(?:&cursor=[A-Za-z0-9_-]+)?)?$/.test(path)||/^\/sessions\/[A-Za-z0-9_-]+\/materials\/receipts\/[A-Za-z0-9_-]+$/.test(path));
export class ApiError extends Error {
  constructor(message, status = 0, code = '') { super(message); this.status = status; this.code = code; }
}
export function canUseKnowledgeAi(user, scope) {
  if (!scope) return false;
  const authorized = resolveKnowledgeScope(user, scope.studyGroupId, scope.researchProjectId);
  const role = user?.studyGroups?.find(item => item.id === scope.studyGroupId)?.role;
  return authorized?.studyGroupId === scope.studyGroupId && authorized?.researchProjectId === scope.researchProjectId &&
    ['knowledge', 'workbench'].every(key => role?.menuPermissions?.some(p => p === '*' || p === key)) &&
    role?.buttonPermissions?.some(p => p === '*' || p === 'chat.use') === true;
}
export function canUseResearchPlans(user, scope) {
  if (!canUseKnowledgeAi(user, scope)) return false;
  const role = user.studyGroups.find(item => item.id === scope.studyGroupId)?.role;
  return role?.menuPermissions?.some(p => p === '*' || p === 'artifacts') === true &&
    ['artifact.read', 'artifact.create', 'artifact.edit'].every(key => role?.buttonPermissions?.some(p => p === '*' || p === key));
}
export function canEditKnowledgeScope(user, scope) {
  if (!scope) return false;
  const authorized = resolveKnowledgeScope(user, scope.studyGroupId, scope.researchProjectId);
  const group = user?.studyGroups?.find(item => item.id === scope.studyGroupId);
  return authorized?.studyGroupId === scope.studyGroupId && authorized?.researchProjectId === scope.researchProjectId &&
    group?.role?.buttonPermissions?.some(permission => ['*', 'knowledge.edit'].includes(permission)) === true;
}
export function resolveKnowledgeScope(user, groupId, projectId) {
  const groups = (user?.studyGroups || []).filter(group => group.role?.menuPermissions?.some(p => p === 'knowledge' || p === '*'));
  const group = groups.find(item => item.id === groupId) || groups[0];
  const project = group?.researchProjects?.find(item => item.id === projectId) || group?.researchProjects?.[0];
  return group && project ? { studyGroupId: group.id, researchProjectId: project.id } : null;
}
export function createKnowledgeClient({ scope, fetchImpl = globalThis.fetch, onAccessLost = () => {} } = {}) {
  const pendingMutations = new Map();
  function headers(path, json, method = 'GET') {
    const aiRoute = (method === 'GET' && (path === '/agents' || /^\/sessions\/hub-source\/history\?page=[1-9][0-9]*&limit=(?:[1-9]|[1-4][0-9]|50)$/.test(path) || /^\/hub-sources\/article-context\/pmc-PMC[1-9][0-9]{0,10}(?:\?requestKey=[A-Za-z0-9_-]{8,160})?$/.test(path) || /^\/sessions\/[A-Za-z0-9_-]+\/knowledge-state(?:\?[A-Za-z0-9_=&%.-]+)?$/.test(path) || /^\/sessions\/[A-Za-z0-9_-]+\/knowledge-sources\/[A-Za-z0-9_-]+\/[1-9][0-9]*$/.test(path))) ||
      (method === 'POST' && (path === '/sessions/knowledge' || path === '/sessions/hub-source' || /^\/sessions\/[A-Za-z0-9_-]+\/knowledge-messages$/.test(path)));
    const planRoute = (method === 'POST' && (path === '/research-plan-drafts' || /^\/research-plan-drafts\/[A-Za-z0-9_-]+\/(jobs|pico-confirmations|versions)$/.test(path))) ||
      (method === 'GET' && (/^\/research-plan-drafts\/[A-Za-z0-9_-]+(?:\/versions\/[1-9][0-9]{0,5})?$/.test(path) || /^\/research-plan-drafts\?limit=(?:[1-9]|[12][0-9]|30)(?:&before=[A-Za-z0-9_-]+)?$/.test(path)));
    const designRoute=(method==='GET'&&/^\/research-plan-drafts\/[A-Za-z0-9_-]+\/design$/.test(path))||(method==='POST'&&/^\/research-plan-drafts\/[A-Za-z0-9_-]+\/design\/(jobs|evidence-decisions|decisions)$/.test(path));
    const trialRoute=(method==='POST'&&/^\/research-plan-drafts\/[A-Za-z0-9_-]+\/synthetic-trials(?:\/[A-Za-z0-9_-]+\/revisions)?$/.test(path))||
      (method==='GET'&&/^\/research-plan-drafts\/[A-Za-z0-9_-]+\/synthetic-trials(?:\/[A-Za-z0-9_-]+|\?limit=(?:[1-9]|1[0-9]|20)(?:&before=[A-Za-z0-9_-]+)?)$/.test(path));
    const reportRoute=(method==='GET'&&/^\/research-plan-drafts\/[A-Za-z0-9_-]+\/synthetic-trials\/[A-Za-z0-9_-]+\/report-draft(?:\/versions\/[1-9][0-9]?)?$/.test(path))||(method==='POST'&&/^\/research-plan-drafts\/[A-Za-z0-9_-]+\/synthetic-trials\/[A-Za-z0-9_-]+\/report-draft(?:\/versions)?$/.test(path));
    const assetRoute=(method==='GET'&&/^\/research-asset-drafts(?:\?limit=(?:[1-9]|1[0-9]|20)(?:&before=[A-Za-z0-9_-]+)?|\/[A-Za-z0-9_-]+(?:\/versions\/[1-9][0-9]?)?)$/.test(path))||(method==='POST'&&(/^\/research-asset-drafts\/[A-Za-z0-9_-]+\/(versions|derivations)$/.test(path)||/^\/research-plan-drafts\/[A-Za-z0-9_-]+\/synthetic-trials\/[A-Za-z0-9_-]+\/report-draft\/asset-drafts$/.test(path)));
    const preparationRoute=(method==='GET'&&/^\/research-plan-drafts\/[A-Za-z0-9_-]+\/execution-preparation(?:\/versions\/[1-9][0-9]{0,5})?$/.test(path))||(method==='POST'&&/^\/research-plan-drafts\/[A-Za-z0-9_-]+\/execution-preparation\/(versions|previews|jobs|decisions|rebindings)$/.test(path));
    const edcRoute=(method==='GET'&&/^\/research-plan-drafts\/[A-Za-z0-9_-]+\/synthetic-collections(?:\?limit=(?:[1-9]|1[0-9]|20)(?:&cursor=[A-Za-z0-9_-]+)?|\/[A-Za-z0-9_-]+(?:\/versions\/[1-9][0-9]{0,5}|\?versionsBefore=[1-9][0-9]{0,5})?)?$/.test(path))||(method==='POST'&&/^\/research-plan-drafts\/[A-Za-z0-9_-]+\/synthetic-collections(?:\/[A-Za-z0-9_-]+\/(?:records\/[A-Za-z0-9_-]+\/(?:drafts|completions|corrections)|quality-snapshots|explanation-jobs))?$/.test(path));
    const edcReportRoute=(method==='GET'&&/^\/research-plan-drafts\/[A-Za-z0-9_-]+\/synthetic-collections\/[A-Za-z0-9_-]+\/report-drafts\/[A-Za-z0-9_-]+(?:\/versions\/[1-9][0-9]?)?$/.test(path))||(method==='POST'&&/^\/research-plan-drafts\/[A-Za-z0-9_-]+\/synthetic-collections\/[A-Za-z0-9_-]+\/report-drafts(?:\/[A-Za-z0-9_-]+\/notes)?$/.test(path));
    if ((!historyActionAllowed(method,path)&&!reportQaRequestAllowed(method,path)&&!reportAssetRequestAllowed(method,path)&&!assetDetailAiRequestAllowed(method,path)&&!/^\/knowledge\/[A-Za-z0-9_/?=&.%:-]+$/.test(path) && !aiRoute && !planRoute && !designRoute && !preparationRoute && !trialRoute && !reportRoute && !assetRoute && !edcRoute && !edcReportRoute && !crfMethodsRequestAllowed(method,path) && !crfMethodAssetRequestAllowed(method,path) && !assetApplicabilityRequestAllowed(method,path) && !guidanceCitationRequestAllowed(method,path) && !conversationCommandRequestAllowed(method,path) && !sessionMediaRequestAllowed(method,path) && !sessionMaterialRequestAllowed(method,path) && !researchDataRequestAllowed(method,path) && !researchAssetRequestAllowed(method,path) && !catalogRequestAllowed(method,path) && !assetRegistrationRequestAllowed(method,path) && !assetGovernanceRequestAllowed(method,path) && !assetUsageRequestAllowed(method,path) && !assetViewRequestAllowed(method,path) && !assetLifecycleRequestAllowed(method,path) && !assetDetailRequestAllowed(method,path)&&!commentRequestAllowed(method,path)&&!assetFileRequestAllowed(method,path)&&!assetReuseRequestAllowed(method,path)) || path.includes('..')) throw new ApiError('无效的知识资料路径');
    const current = scope?.();
    if (!current?.studyGroupId || !current?.researchProjectId) throw new ApiError('请先取得课题组和研究项目邀请授权', 403);
    return { Accept: 'application/json', ...(json ? { 'Content-Type': 'application/json' } : {}),
      ...(method==='POST'&&sessionMediaRequestAllowed(method,path)?{'X-ResearchHub-Request':MEDIA_REQUEST_MARKER}:{}),
      ...(method==='POST'&&researchDataRequestAllowed(method,path)?{'X-ResearchHub-Request':DATA_REQUEST_MARKER}:{}),
      'X-Study-Group-Id': current.studyGroupId, 'X-Research-Project-Id': current.researchProjectId };
  }
  function rejected(status, value) {
    const raw = value?.message === '本轮本人资产核对目的授权不可用' ? '当前账号没有此资产核对权限，请联系管理员。' : value?.message;
    const message = Array.isArray(raw) ? raw.join('；') : typeof raw === 'string' ? raw :
      ({ 401: '会话已失效，请重新登录；未保存草稿仍保留在当前页。', 403: '当前授权不足或已变更，请核对研究项目。', 409: '文档版本冲突，当前草稿未丢弃。' })[status] || '知识服务暂时不可用，请重试。';
    const error = new ApiError(message, status, value?.code || '');
    if ([401, 403].includes(status)) onAccessLost(error);
    return error;
  }
  async function perform(method, path, data, download = false) {
    const init = { method, headers: headers(path, data !== undefined, method), credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(120000) };
    if(method==='POST'&&sessionMediaRequestAllowed(method,path))init.mode='same-origin';
    if(method==='POST'&&researchDataRequestAllowed(method,path))init.mode='same-origin';
    if (data !== undefined) init.body = JSON.stringify(data);
    let response;
    try { response = await fetchImpl('/api' + path, init); }
    catch { throw new ApiError('知识服务连接失败或超时，结果未确认；请先刷新确认，不要重复提交。'); }
    if (!response.ok) throw rejected(response.status, await response.json().catch(() => null));
    if (download) return { blob: await response.blob(), filename: '' };
    if (!(response.headers.get('Content-Type') || '').includes('application/json')) throw new ApiError('服务响应异常，结果尚未确认；请先刷新核对状态，不要重复提交。');
    try { return await response.json(); } catch { throw new ApiError('知识服务响应无法解析。'); }
  }
  function request(method, path, data, download = false) {
    if (method === 'GET') return perform(method, path, data, download);
    const key = JSON.stringify([scope?.(), method, path, data]);
    if (pendingMutations.has(key)) return pendingMutations.get(key);
    const operation = perform(method, path, data, download).finally(() => pendingMutations.delete(key));
    pendingMutations.set(key, operation);
    return operation;
  }
  return {
    get: path => request('GET', path), post: (path, data) => request('POST', path, data),
    patch: (path, data) => request('PATCH', path, data), put: (path, data) => request('PUT', path, data),
    del: path => request('DELETE', path), download: path => request('GET', path, undefined, true),
    upload(path, form, { onProgress, contentType } = {}) {
      if(researchDataRequestAllowed('POST',path)&&/\/research-data$/.test(path))return(async()=>{
        const response=await fetchImpl('/api'+path,{method:'POST',mode:'same-origin',credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(120000),headers:headers(path,false,'POST'),body:form}).catch(()=>{throw new ApiError('上传连接失败或超时，结果未确认；请先核对原上传。');});
        if(!response.ok)throw rejected(response.status,await response.json().catch(()=>null));
        if(!response.headers.get('Content-Type')?.includes('application/json'))throw new ApiError('上传响应无效；请先核对原上传，不自动重试。');
        try{return await response.json();}catch{throw new ApiError('上传响应无法解析；请先核对原上传，不自动重试。');}
      })();
      if(contentType)return(async()=>{
        const requestHeaders=headers(path,false,'POST');
        if(contentType!=='application/octet-stream'||!/^\/sessions\/[A-Za-z0-9_-]+\/media-uploads\/[a-f0-9-]+\/chunks\/[0-9]+$/i.test(path))throw new ApiError('无效的视频上传路径');
        let response;
        try{response=await fetchImpl('/api'+path,{method:'POST',mode:'same-origin',credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(120000),headers:{...requestHeaders,'Content-Type':contentType},body:form});}
        catch{throw new ApiError('上传连接失败或超时，结果未确认；请先查询任务再重试。');}
        if(!response.ok)throw rejected(response.status,await response.json().catch(()=>null));
        if(!response.headers.get('Content-Type')?.includes('application/json'))throw new ApiError('上传响应无效；请先查询任务，不自动重试。');
        let value;try{value=await response.json();}catch{throw new ApiError('上传响应无效；请先查询任务，不自动重试。');}
        onProgress?.({loaded:form.size,total:form.size,percent:100});return value;
      })();
      return new Promise((resolve, reject) => {
        let requestHeaders;
        try {
          requestHeaders = headers(path, false, 'POST');
        } catch (error) { reject(error); return; }
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api' + path); xhr.withCredentials = true; xhr.timeout = 120000;
        for (const [key, value] of Object.entries(requestHeaders)) xhr.setRequestHeader(key, value);
        xhr.upload.onprogress = event => onProgress?.({ loaded: event.loaded, total: event.total, percent: event.lengthComputable ? Math.round(100 * event.loaded / event.total) : null });
        xhr.onerror = xhr.ontimeout = () => reject(new ApiError('上传连接失败或超时，结果未确认；请先查询任务再重试。'));
        xhr.onload = () => {
          let value; try { value = JSON.parse(xhr.responseText); } catch { reject(new ApiError('上传响应无效；请先查询任务，不自动重试。')); return; }
          if (xhr.status < 200 || xhr.status >= 300) reject(rejected(xhr.status, value)); else resolve(value);
        };
        xhr.send(form);
      });
    },
  };
}
