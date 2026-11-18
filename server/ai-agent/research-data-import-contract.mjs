import {materialDigest} from './session-material-contract.mjs';
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const positive=value=>Number.isSafeInteger(value)&&value>0;
const fail=()=>{throw Object.assign(Error('DATA_IMPORT_SNAPSHOT_INVALID'),{code:'DATA_IMPORT_SNAPSHOT_INVALID',status:400});};
function only(value,keys){if(!value||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value))||Object.keys(value).some(key=>!keys.includes(key)))fail();}
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
const compare=(a,b)=>a<b?-1:a>b?1:0;
/** Internal fixed-selection compiler only. It cannot grant access or commit.
 * The service must reload authorization, source and target facts before use. */
export function compileImportConfirmation(input){
 only(input,['mode','source','target','mapping','permissionRef','targetManifestHash']);const {mode,source,target,mapping,permissionRef,targetManifestHash}=input;
 if(!['subjects','visit_form'].includes(mode)||!hash(targetManifestHash))fail();
 only(source,['tenantId','accountId','authVersion','sessionId','studyGroupId','researchProjectId','preflightId','version','state','previewHash','files']);
 if(['tenantId','accountId','sessionId','studyGroupId','researchProjectId','preflightId'].some(key=>!id(source[key]))||!Number.isSafeInteger(source.authVersion)||source.authVersion<0||!positive(source.version)||source.state!=='previewed'||!hash(source.previewHash)||!Array.isArray(source.files)||!source.files.length||source.files.length>20)fail();
 for(const file of source.files){only(file,['id','version','sha256']);if(!id(file.id)||!positive(file.version)||!hash(file.sha256))fail();}
 if(new Set(source.files.map(file=>file.id)).size!==source.files.length)fail();
 const targetKeys=['tenantId','studyId','projectIntentId','studyGroupId','executionProjectId'],visitKeys=['protocolVersionId','protocolVersionNumber','protocolStatus','policyVersionId','policyHash','formVersionId','formStatus','formHash','requiredFormVersionId'];
 only(target,mode==='visit_form'?[...targetKeys,...visitKeys]:targetKeys);
 if(targetKeys.some(key=>!id(target[key]))||target.tenantId!==source.tenantId)fail();
 if(mode==='visit_form'&&(!id(target.protocolVersionId)||!positive(target.protocolVersionNumber)||target.protocolStatus!=='executing'||!id(target.policyVersionId)||!hash(target.policyHash)||!id(target.formVersionId)||!['published','locked'].includes(target.formStatus)||!hash(target.formHash)||target.requiredFormVersionId!==target.formVersionId))fail();
 only(permissionRef,['kind','id','version']);if(!['study_grant','native_admin'].includes(permissionRef.kind)||!id(permissionRef.id)||!Number.isSafeInteger(permissionRef.version)||permissionRef.version<0||permissionRef.kind==='study_grant'&&!positive(permissionRef.version)||permissionRef.kind==='native_admin'&&(permissionRef.id!==source.accountId||permissionRef.version!==source.authVersion))fail();
 if(!Array.isArray(mapping)||!mapping.length||mapping.length>10000)fail();
 const seen=new Set();for(const item of mapping){only(item,['fileId','sheet','column','targetKey']);if(!source.files.some(f=>f.id===item.fileId)||typeof item.sheet!=='string'||!item.sheet.trim()||item.sheet.length>128||!positive(item.column)||item.column>100||typeof item.targetKey!=='string'||!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(item.targetKey)||['constructor','prototype'].includes(item.targetKey))fail();const key=JSON.stringify([item.fileId,item.sheet,item.targetKey]);if(seen.has(key))fail();seen.add(key);}
 const value={schema:'hub-data-import-confirmation.v1',mode,source:{...source,files:source.files.map(f=>({...f})).sort((a,b)=>compare(a.id,b.id))},target:{...target},targetManifestHash,mapping:mapping.map(m=>({...m})).sort((a,b)=>compare(JSON.stringify([a.fileId,a.sheet,a.column,a.targetKey]),JSON.stringify([b.fileId,b.sheet,b.column,b.targetKey]))),permissionRef:{...permissionRef},requiresCurrentAuthorization:true,confirmationReady:false};
 if(Buffer.byteLength(JSON.stringify(value))>256*1024)fail();
 return freeze({...value,hash:materialDigest(value)});
}
