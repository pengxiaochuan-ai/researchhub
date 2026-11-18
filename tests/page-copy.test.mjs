import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createKnowledgeClient} from '../src/knowledge-session.js';

test('legacy access error uses user language without changing access failure',async()=>{
 let lost;
 const client=createKnowledgeClient({scope:()=>({studyGroupId:'group',researchProjectId:'study'}),onAccessLost:e=>{lost=e;},fetchImpl:async()=>({ok:false,status:403,json:async()=>({message:'本轮本人资产核对目的授权不可用',code:'FORBIDDEN'})})});
 await assert.rejects(client.get('/asset-applicability-drafts?limit=1'),e=>e.status===403&&e.code==='FORBIDDEN'&&e.message==='当前账号没有此资产核对权限，请联系管理员。');
 assert.equal(lost.status,403);
});

test('researcher and admin interface copy avoids wiring/progress/budget narration',()=>{
 const cases={
  'pages/k01/main.jsx':['与本轮费用上限约束','真实知识库服务 · 与演示资产列表分开'],
  'pages/shared/HubAgentPanel.jsx':['当前接口仅提供','不会因恢复布局自动启用'],
  'pages/shared/RealEntryLayouts.jsx':['仍由原接口核验','不展示固定示例'],
  'pages/shared/ResearchDesignWorkspace.jsx':['有效报价门槛控制','本轮研究设计草稿权限','已保存到已保存','正在正在'],
  'pages/shared/ResearchPlanFlow.jsx':['已保存到已保存','已保存已保存'],
  'pages/shared/SyntheticAssetWorkspace.jsx':['服务未配置，不回退固定示例','请从Q01'],
  'pages/shared/CrfMethodsInterpretation.jsx':['关联存储规格待确认','本轮真实模型回答'],
  'pages/shared/WorkflowPages.jsx':['正式服务需后端契约与部署配置'],
  'pages/shared/StudyTaskConflict.jsx':['当前服务端为','仍由后端校验'],
  'pages/shared/CrfMethodAssetDetail.jsx':['原CAS基准','上次已读head'],
  'pages/shared/CrfMethodsReport.jsx':['原CAS基准'],
  'pages/shared/SyntheticEdcQuality.jsx':['旧表单纯校验','本片三类规则','不展示固定示例'],
  'pages/shared/SyntheticAssetWorkspace.jsx':['软件配方','软件输入快照'],
  'pages/shared/Q01Page.jsx':['本机检查'],
  'src/synthetic-quality-form.js':['仅软件测试范围'],
 };
 for(const[file,phrases]of Object.entries(cases)){const text=readFileSync(file,'utf8');for(const p of phrases)assert(!text.includes(p),file+':'+p);}
});

test('essential synthetic-data, permission, AI and mail-delivery boundaries remain visible in source',()=>{
 const kb=readFileSync('pages/k01/main.jsx','utf8'),mail=readFileSync('pages/shared/AccountAccess.jsx','utf8'),invite=readFileSync('pages/shared/MemberInvitations.jsx','utf8'),ai=readFileSync('pages/shared/ArticleAgentPanel.jsx','utf8');
 assert(kb.includes('仅上传合成材料'));assert(kb.includes('已审核'));assert(kb.includes('已授权'));
 assert(mail.includes('不向外发送'));assert(mail.includes('不代表专业资质认证'));assert(mail.includes('私有课题另按授权访问'));
 assert(invite.includes('不发送外部邮件')||invite.includes('不向外发送'));assert(invite.includes('明确接受')||invite.includes('接受邀请'));
 assert(ai.includes('非全文')||ai.includes('不是全文'));assert(ai.includes('article.execution.canStart'));assert(ai.includes('view.quota?.blocked'));
});
