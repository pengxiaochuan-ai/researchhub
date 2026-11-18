export const POLICY_SECTIONS=[
 {key:'ethics',label:'伦理依据',fields:[['approvalReference','伦理批准或豁免依据'],['scope','适用范围']]},
 {key:'screening',label:'筛选与纳排',fields:[['criteria','筛选及纳排标准'],['decisionMethod','判断与记录方式']]},
 {key:'researchConsent',label:'研究参与同意',fields:[['textVersion','同意书版本或豁免依据'],['evidenceRequirement','同意记录要求']]},
 {key:'dataUse',label:'数据使用',fields:[['purposes','使用目的'],['scope','使用范围']]},
 {key:'withdrawal',label:'撤回与退出',fields:[['effectiveRule','撤回生效规则'],['retentionRule','历史资料保留规则'],['futureUseRule','后续使用规则']]},
 {key:'safety',label:'安全处理',fields:[['workflow','安全事件处理流程'],['responsibility','处理责任']]},
 {key:'site',label:'研究中心',fields:[]},
 {key:'blinding',label:'盲态',fields:[]},
 {key:'captureReview',label:'采集更正与审阅',fields:[['correction','更正规则'],['locking','锁定规则'],['unlocking','解锁规则'],['reviewResponsibility','审阅责任'],['reviewIndependence','独立审核要求']]},
];
export function policySectionsForEdit(policy){return Object.fromEntries(POLICY_SECTIONS.map(({key,fields})=>{const s=policy?.sections?.[key]??{};return[key,{status:['missing','configured','not_applicable'].includes(s.status)?s.status:'missing',source:s.source??'',reason:s.reason??'',...(key==='site'?{mode:s.mode??''}:{}),rules:Object.fromEntries(fields.map(([name])=>[name,s.rules?.[name]??'']))}];}));}
export function policySectionsForSave(sections){return Object.fromEntries(POLICY_SECTIONS.map(({key,label,fields})=>{const s=sections[key];if(!s||!['missing','configured','not_applicable'].includes(s.status))throw Error('请核对'+label+'状态。');if(s.status==='missing')return[key,{status:'missing'}];if(s.status==='not_applicable'&&(!s.reason.trim()||!s.source.trim()))throw Error(label+'选择不适用时，请填写理由和依据。');return[key,{status:s.status,source:s.source,reason:s.reason,...(key==='site'&&s.mode?{mode:s.mode}:{}),rules:Object.fromEntries(fields.map(([name])=>[name,s.rules[name]??'']))}];}));}
export function policyMissing(sections){return POLICY_SECTIONS.filter(({key})=>sections[key]?.status==='missing').map(({key,label})=>({key,label}));}
export function policyDraftBody(policy,sections){return{expectedPolicyId:policy?.id??null,sections:policySectionsForSave(sections)};}
export function validPolicyPending(value,expectedPath){
 const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(v),keys=(x,allowed)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).every(k=>allowed.includes(k));
 if(!keys(value,['path','method','body'])||typeof expectedPath!=='string'||!expectedPath.startsWith('/research-studies/')||value.path!==expectedPath||value.method!=='PUT'||!keys(value.body,['requestKey','expectedPolicyId','sections'])||!id(value.body.requestKey)||value.body.expectedPolicyId!==null&&!id(value.body.expectedPolicyId))return false;
 const sections=value.body.sections;if(!keys(sections,POLICY_SECTIONS.map(x=>x.key))||Object.keys(sections).length!==POLICY_SECTIONS.length)return false;
 return POLICY_SECTIONS.every(({key,fields})=>{const s=sections[key];if(!keys(s,['status','source','reason','mode','rules'])||!['missing','configured','not_applicable'].includes(s.status))return false;if(s.status==='missing')return Object.keys(s).length===1;if(typeof s.source!=='string'||typeof s.reason!=='string'||s.status==='not_applicable'&&(!s.source.trim()||!s.reason.trim())||s.mode!==undefined&&(key!=='site'||typeof s.mode!=='string')||!keys(s.rules,fields.map(([name])=>name)))return false;return Object.values(s.rules).every(v=>typeof v==='string'&&v.length<=5000)&&s.source.length<=5000&&s.reason.length<=5000;});
}
