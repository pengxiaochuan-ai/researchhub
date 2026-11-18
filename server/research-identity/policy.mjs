import {createHash} from 'node:crypto';

export const identityError=(code,status,message,fieldErrors)=>Object.assign(new Error(message),{code,status,...(fieldErrors?{fieldErrors}:{})});
const invalid=()=>{throw identityError('IDENTITY_INVALID_INPUT',400,'资料字段或请求格式不正确。');};
const field=(name,message)=>{throw identityError('IDENTITY_VALIDATION_FAILED',422,'请核对科研资料。',{[name]:message});};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function keys(value,allowed){if(!object(value)||Object.keys(value).some(k=>!allowed.includes(k)))invalid();}
function text(value,max,name,{required=false}={}){if(value===null&&!required)return '';if(typeof value!=='string')field(name,'请填写文字。');const s=value.trim();if([...s].length>max||(required&&!s))field(name,`请填写${required?'1–':''}${max}字符以内的文字。`);return s;}
function list(value,max,name,parse){if(!Array.isArray(value)||value.length>max)field(name,`最多填写${max}项。`);return value.map((v,i)=>parse(v,`${name}.${i}`));}
function texts(value,max,length,name){const rows=list(value,max,name,(v,p)=>text(v,length,p,{required:true}));if(new Set(rows).size!==rows.length)field(name,'请移除重复内容。');return rows;}
function publicLink(value,name){const s=text(value,2048,name,{required:true});let u;try{u=new URL(s);}catch{field(name,'请填写HTTPS公开链接。');}if(u.protocol!=='https:'||u.username||u.password||!u.hostname||/^(localhost|127\.|10\.|192\.168\.|0\.|\[)/i.test(u.hostname)||u.hostname.endsWith('.local'))field(name,'请填写不含账号密码的HTTPS公开链接。');return u.href;}
function month(value,name){if(value===null||value==='')return null;if(typeof value!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(value))field(name,'请填写YYYY-MM年月。');return value;}
function claims(value,name,education=false){const rows=list(value,10,name,(v,path)=>{
  const allowed=education?['claimId','organizationName','qualification','startMonth','endMonth']:['claimId','organizationName','department','positionTitle','startMonth','endMonth'];keys(v,allowed);
  const claimId=text(v.claimId,100,path+'.claimId',{required:true});if(!/^[A-Za-z0-9_-]+$/.test(claimId))field(path+'.claimId','资料条目标识无效。');
  const startMonth=month(v.startMonth??null,path+'.startMonth'),endMonth=month(v.endMonth??null,path+'.endMonth');if(startMonth&&endMonth&&startMonth>endMonth)field(path+'.endMonth','结束年月不能早于开始年月。');
  const base={claimId,organizationName:text(v.organizationName,200,path+'.organizationName',{required:true}),startMonth,endMonth};
  return education?{...base,qualification:text(v.qualification??'',120,path+'.qualification')}:{...base,department:text(v.department??'',120,path+'.department'),positionTitle:text(v.positionTitle??'',120,path+'.positionTitle')};
 });if(new Set(rows.map(x=>x.claimId)).size!==rows.length)field(name,'资料条目标识不能重复。');return rows;}
function orcid(value){if(value===null||value==='')return null;const s=text(value,19,'orcid');if(!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(s))field('orcid','ORCID格式不正确。');const digits=s.replaceAll('-','');let total=0;for(const n of digits.slice(0,15))total=(total+Number(n))*2;const result=(12-total%11)%11;if(digits[15]!==String(result===10?'X':result))field('orcid','ORCID校验位不正确。');return s;}
export function emptyResearchProfile(){return {schemaVersion:1,researchName:'',researchDirections:[],biography:'',orcid:null,publicHomepages:[],affiliationClaims:[],educationClaims:[],verificationPreparation:{professionalStatement:'',publicEvidenceLinks:[]}};}
export function normalizeProfileChanges(changes,current){
  const allowed=['researchName','researchDirections','biography','orcid','publicHomepages','affiliationClaims','educationClaims','verificationPreparation'];keys(changes,allowed);
  const result=structuredClone(current??emptyResearchProfile());
  if(result.schemaVersion!==1)throw identityError('IDENTITY_PROFILE_VERSION_UNSUPPORTED',409,'资料格式已变化，请重新核对。');
  for(const [k,v]of Object.entries(changes)){
    if(k==='researchName')result[k]=text(v,80,k);
    if(k==='researchDirections')result[k]=texts(v,10,40,k);
    if(k==='biography')result[k]=text(v,2000,k);
    if(k==='orcid')result[k]=orcid(v);
    if(k==='publicHomepages')result[k]=list(v,3,k,publicLink);
    if(k==='affiliationClaims'||k==='educationClaims')result[k]=claims(v,k,k==='educationClaims');
    if(k==='verificationPreparation'){
      keys(v,['professionalStatement','publicEvidenceLinks']);result[k]={...result[k]};
      if(Object.hasOwn(v,'professionalStatement'))result[k].professionalStatement=text(v.professionalStatement,2000,k+'.professionalStatement');
      if(Object.hasOwn(v,'publicEvidenceLinks'))result[k].publicEvidenceLinks=list(v.publicEvidenceLinks,5,k+'.publicEvidenceLinks',publicLink);
    }
  }
  if(Buffer.byteLength(JSON.stringify(result))>32768)field('profile','资料整体不能超过32KiB，请精简经历或链接。');
  return result;
}
export function assertEstablishable(profile){const errors={};if(!profile.researchName)errors.researchName='建立科研身份前请填写科研展示姓名。';if(!profile.researchDirections.length)errors.researchDirections='建立科研身份前请填写至少一个研究方向。';if(Object.keys(errors).length)throw identityError('IDENTITY_PROFILE_INCOMPLETE',422,'建立L1前请补齐姓名和研究方向。',errors);}
export function parseProfileCommand(action,body){
  if(!['save','establish'].includes(action))invalid();keys(body,action==='save'?['expectedVersion','requestKey','changes']:['expectedVersion','requestKey']);
  if(!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion<0||typeof body.requestKey!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(body.requestKey))invalid();
  if(action==='save'&&!object(body.changes))invalid();return structuredClone(body);
}
export function profileRequestHash(action,input){
  const canonical=v=>Array.isArray(v)?v.map(canonical):object(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
  return createHash('sha256').update(JSON.stringify(canonical({action,...input}))).digest('hex');
}
