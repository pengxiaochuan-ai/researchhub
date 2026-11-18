// Offline helpers for this one explicitly authorized synthetic QA. No import-time I/O except fixed source profiles.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {getSourceFormProfile} from '../server/research-capture/source-profiles.mjs';
export const purpose='visit-capture-review-flow-2026-11-16',workspace='/Users/mac/aisciencesys/',repo=workspace+'researchhub/',privateDir=workspace+'.tmp/'+purpose+'/',evidenceDir=repo+'docs/testing/evidence/'+purpose+'/',base='http://127.0.0.1:19501';
export const json=p=>JSON.parse(readFileSync(p,'utf8'));
export const sha=value=>createHash('sha256').update(value).digest('hex');
export const normalize=value=>JSON.parse(JSON.stringify(value));
export const save=(path,value,exclusive=false)=>{mkdirSync(path.slice(0,path.lastIndexOf('/')),{recursive:true,mode:0o700});writeFileSync(path,JSON.stringify(value,null,2)+'\n',{mode:0o600,...(exclusive?{flag:'wx'}:{})});};
export function requireQAWindow(args,env=process.env){assert.equal(args.length,2);assert.equal(args[0],'--local-synthetic');assert(['--prepare','--preserve','--h5','--api','--browser'].includes(args[1]));assert.equal(env.VISIT_WORKFLOW_QA_WINDOW,'explicit','ROOT_IO_WINDOW_REQUIRED');return args[1].slice(2);}
// Match the real server session cookie Path exactly; a root-path test cookie duplicates it on renewal.
export function browserSessionCookie(cookie){assert(typeof cookie==='string'&&!cookie.includes(';'));const i=cookie.indexOf('=');assert(i>0&&i<cookie.length-1);return{name:cookie.slice(0,i),value:cookie.slice(i+1),domain:new URL(base).hostname,path:'/api',httpOnly:true,sameSite:'Lax',secure:false};}
export async function loginBrowserContext(context,{tenantSlug,username,password,expectedActorId}){requireQAWindow(['--local-synthetic','--browser']);const response=await context.request.post(base+'/api/auth/login',{headers:{Origin:base,'X-ResearchHub-Request':'session-v1'},data:{tenantSlug,username,password}});assert.equal(response.status(),201,'BROWSER_NATIVE_LOGIN_FAILED');const value=await response.json();assert.equal(value.user.accountId,expectedActorId);const name=response.headers()['set-cookie']?.split('=')[0];assert(name,'BROWSER_SESSION_COOKIE_REQUIRED');const cookies=(await context.cookies(base+'/api')).filter(c=>c.name===name);assert.equal(cookies.length,1,'BROWSER_DUPLICATE_SESSION_COOKIE');assert.equal(cookies[0].path,'/api','BROWSER_SESSION_COOKIE_PATH_MUST_MATCH_NATIVE');return{actorId:expectedActorId,cookieMetadata:cookies.map(({name,path,domain,expires,httpOnly,sameSite,secure})=>({name,path,domain,expires,httpOnly,sameSite,secure}))};}
export function sourceProfiles(){return{phq:getSourceFormProfile('phq9-zh-CN-v1'),fang:getSourceFormProfile('fang-2023-table5-v1'),hamd:getSourceFormProfile('hamd17-crf-simulation-v1')};}
export function makeVisitPlans(refs,profiles){
 const req=(name,modes=['researcher'])=>({kind:'form_response',code:name.toUpperCase(),name:profiles[name].name,required:true,config:{formVersionId:refs[name],allowedCaptureModes:modes}});
 const common={anchor:'enrollment',targetDayOffset:0,windowBeforeDays:1,windowAfterDays:2};
 return[{...common,code:'BASELINE',name:'合成访视 · 三量表集中审阅',sequence:1,requirements:[req('phq'),req('fang'),req('hamd'),{kind:'form_response',code:'OPTIONAL',name:'合成选采观察记录',required:false,config:{formVersionId:refs.legacy,allowedCaptureModes:['researcher']}}]},
 {...common,code:'CHANNEL',name:'合成访视 · 双渠道与文件门禁',sequence:2,requirements:[req('phq',['researcher','patient_h5']),req('fang'),req('hamd'),{kind:'modality_file',code:'TONGUE_FILE',name:'合成舌象预处理文件',required:true,config:{modality:'tongue',sourceKind:'synthetic_preprocessed_features',rawExtractionClaim:false}}]}];
}
export function makePolicySections(){
 const na={status:'not_applicable',source:'访视流程独立合成软件用例',reason:'无真实受试者或临床用途'},configured=rules=>({status:'configured',source:'访视流程独立合成软件用例',reason:'明确的合成规则，不作为临床方案',rules});
 return{ethics:na,safety:na,blinding:na,screening:configured({criteria:'有权人员人工核对软件合成编号',decisionMethod:'manual'}),researchConsent:configured({textVersion:'synthetic-visit-workflow-consent-v1',evidenceRequirement:'本轮合成确认记录'}),dataUse:configured({purposes:'访视软件操作流程验证',scope:'synthetic-visit-workflow-only'}),withdrawal:configured({effectiveRule:'停止新采集',retentionRule:'保留合成历史',futureUseRule:'限制新使用'}),site:{status:'configured',source:'本轮合成用例',reason:'新研究范围',mode:'study_wide'},captureReview:configured({correction:'保留原修订和更正原因',locking:'当前修订审阅通过后锁定',unlocking:'有权人员填写原因',reviewResponsibility:'本研究有权审阅者',reviewIndependence:'required'})};
}
export function syntheticAnswers(p=sourceProfiles()){
 const phq=Object.fromEntries(p.phq.schema.fields.map((f,i)=>[f.key,i<9?i%4:'difficulty_1']));
 const selected=new Set(['main_distension_pain','main_depressed_emotion','secondary_globus','secondary_emotional_trigger','tongue_pale_red','pulse_wiry']);
 const fang=Object.fromEntries(p.fang.schema.fields.map(f=>[f.key,f.key.endsWith('_category')?'met':selected.has(f.key)?'present':'absent']));
 const hamd=Object.fromEntries(p.hamd.schema.fields.map((f,i)=>[f.key,f.choices.filter(c=>c.value!==9)[i%f.choices.filter(c=>c.value!==9).length].value]));
 return{phq,fang,hamd,hamd9:{...hamd,hamd17_q14:9},fangConflict:{...fang,pulse_deep_wiry:'present'},fangNA:{...fang,secondary_irregular_menses:'not_applicable'},legacy:{value:0,completed:false}};
}
export function validateFixture(f){assert(f?.syntheticOnly===true&&f.purpose===purpose);assert.match(f.runId,/^rh-visit-qa-[a-f0-9]{8}$/);assert(f.study?.id&&f.study.id!=='rh-study-645de1e7-52ea-4aa5-b4d7-c46cab722b25');assert.equal(f.scope?.tenantId,'rh-kb-local-b0e2af9d-tenant');assert.equal(f.scope.studyGroupId,f.runId+'-group');assert(typeof f.scope.researchProjectId==='string');return true;}
export function localMailerTarget(f,message){assert.match(f.runId,/^rh-visit-qa-[a-f0-9]{8}$/);assert(f.study?.id&&f.study.id!=='rh-study-645de1e7-52ea-4aa5-b4d7-c46cab722b25');assert.equal(message.studyId,f.study.id);assert(message.address.startsWith(f.runId+'-')&&/^[-a-z0-9._]+@example\.test$/.test(message.address));const u=new URL(message.invitationUrl);assert.equal(u.origin,base);assert(/^\/h5\/questionnaire\/[A-Za-z0-9_-]+$/.test(u.pathname)&&!u.search&&!u.hash);return true;}
