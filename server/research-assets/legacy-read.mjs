import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {loadCatalogRecords} from '../../scripts/local-research-assets-catalog-read.mjs';
import {catalogError} from '../../scripts/research-assets-catalog-contract.mjs';

const tenant='rh-kb-local-b0e2af9d-tenant',accounts=[tenant.replace('-tenant','-admin'),tenant.replace('-tenant','-owner')];
const fail=()=>{throw Error('HUB_LEGACY_ASSET_ADMISSION_REJECTED');};
export function legacyRecordFingerprint(r){
 const p=r.parent,g=r.registry;
 return createHash('sha256').update(JSON.stringify([g.assetId,p.idempotencyKey,g.tenantId,g.studyGroupId,g.researchProjectId,g.ownerAccountId,g.kind,g.revision,g.workingVersionNo,g.approvedVersionNo,g.releaseState,r.policies.map(x=>[x.version,x.contentHash,x.policyHash,x.artifactVersionId])])).digest('hex');
}
export function createLegacyAssetReader({env,tenantId,loader=loadCatalogRecords}){
 if(!env.HUB_LEGACY_ASSET_ADMISSION_SHA256&&!env.HUB_LEGACY_ASSET_ADMISSION_FILE)return null;
 if(tenantId!==tenant||env.HUB_LEGACY_ASSET_ADMISSION_FILE!=='/run/researchhub-admission/legacy-assets.json'||!/^[a-f0-9]{64}$/.test(env.HUB_LEGACY_ASSET_ADMISSION_SHA256??''))fail();
 const file=env.HUB_LEGACY_ASSET_ADMISSION_FILE,st=fs.lstatSync(file);if(!st.isFile()||st.isSymbolicLink()||st.size>65536)fail();
 const raw=fs.readFileSync(file);if(createHash('sha256').update(raw).digest('hex')!==env.HUB_LEGACY_ASSET_ADMISSION_SHA256)fail();
 const a=JSON.parse(raw);if(a.schema!=='hub-legacy-asset-read.v1'||a.tenantId!==tenant||a.readOnly!==true||a.syntheticOnly!==true||!Array.isArray(a.accounts)||a.accounts.length!==2||!accounts.every(id=>a.accounts.includes(id))||!Array.isArray(a.assets)||a.assets.length>27||new Set(a.assets.map(x=>x.id)).size!==a.assets.length||a.assets.some(x=>!/^[A-Za-z0-9_-]{1,160}$/.test(x.id??'')||x.id.startsWith('rhab-')||!/^[a-f0-9]{64}$/.test(x.fingerprint??'')))fail();
 const ids=new Set(a.assets.map(x=>x.id));
 return{
  has:id=>ids.has(id),
  assertReadRequest(user,req,id){const path=(req.route?.path??req.path??req.url??'').split('?')[0].toLowerCase(),key=req.route?.path?':id':id.toLowerCase(),v=req.route?.path?':version':'[1-9][0-9]*',allowed=new RegExp('/research-assets/(?:catalog/'+key+'(?:/versions/'+v+')?|'+key+'/preview|'+key+'/versions/'+v+'/(?:activity|compare))$').test(path);if(!ids.has(id)||!accounts.includes(user.accountId)||user.tenantId!==tenant||req.method!=='GET'||!allowed)throw catalogError('LEGACY_READ_ONLY',403,'此合成资料仅供阅读固定版本。');},
  async read(tx,p){
   if(p.tenantId!==tenant||!accounts.includes(p.accountId))return[];
   const principal={...p,catalogActors:{admin:accounts[0],owner:accounts[1]}};
   const records=await loader(tx,principal,async()=>false,{family:'legacy'});
   return records.filter(r=>{const admitted=a.assets.find(x=>x.id===r.registry.assetId);return admitted&&legacyRecordFingerprint(r)===admitted.fingerprint&&r.policies.every(v=>v.sourceKind==='author'&&Array.isArray(v.sourceBindings)&&v.sourceBindings.length===0&&v.sourceValid===true);}).map(r=>({...r,availableActions:['read','versions'],aiAvailability:'unavailable'}));
  },
 };
}
