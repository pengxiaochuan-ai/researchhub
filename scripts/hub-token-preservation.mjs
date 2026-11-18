// Read-only comparison of protected historical accounting; never settles a row.
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const root=new URL('../../',import.meta.url).pathname,out=root+'researchhub/docs/testing/evidence/hub-token-accounting-2026-11-11/';mkdirSync(out,{recursive:true});
const hash=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v,(_k,x)=>typeof x==='bigint'?x.toString():x)).digest('hex');
const r=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json')),{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const old=JSON.parse(readFileSync(root+'researchhub/docs/testing/evidence/token-reconciliation-owner-2026-11-11/readback-result.json')).rows.map(x=>x.reservationId);
const unknown='cmvn90m6x001elu7zahvpnrqd',ids=[...old,unknown];
const current=await withFixtureTransaction(env,'direct',async tx=>{
 const where={tenantId:r.ids.tenant},rows=await tx.tokenQuotaReservation.findMany({where:{...where,id:{in:ids}},orderBy:{id:'asc'}});
 if(rows.length!==16)throw Error('HISTORICAL_ACCOUNTING_COUNT_CHANGED');
 return{
  reservations:hash(rows),usage:hash(await tx.usageRecord.findMany({where:{...where,id:{in:rows.map(x=>x.reconciliationUsageRecordId).filter(Boolean)}},orderBy:{id:'asc'}})),
  audits:hash(await tx.auditLog.findMany({where:{...where,target:{in:ids}},orderBy:{id:'asc'}})),
  grants:hash(await tx.tokenQuotaGrant.findMany({where,orderBy:{id:'asc'}})),
  accounts:hash(await tx.account.findMany({where:{...where,id:{in:[r.ids.owner,r.ids.admin]}},select:{id:true,role:true,isTenantAdmin:true,status:true,authVersion:true},orderBy:{id:'asc'}})),
 };
},{readOnly:true});
current.oldSources=Object.fromEntries(['billing/billing.service.ts','sessions/sessions.service.ts','orchestrator/deepseek.provider.ts'].map(p=>[p,hash(readFileSync(root+'app/server/src/'+p,'utf8'))]));
current.legacyLedgers=Object.fromEntries(readdirSync(root+'.tmp/researchhub-knowledge-local/').filter(p=>/ledger.*\.json$/.test(p)).map(p=>[p,hash(readFileSync(root+'.tmp/researchhub-knowledge-local/'+p,'utf8'))]));
const file=out+'preservation-before.json';
if(process.argv[2]==='capture'){try{readFileSync(file);throw Error('BASELINE_EXISTS_DO_NOT_OVERWRITE');}catch(e){if(e.code!=='ENOENT')throw e;}writeFileSync(file,JSON.stringify({at:new Date(),current},null,2));console.log('Protected 16 historical reservations, grants, identities, old sources and legacy ledgers captured.');}
else{const before=JSON.parse(readFileSync(file));if(hash(before.current)!==hash(current))throw Error('PROTECTED_HISTORY_CHANGED');writeFileSync(out+'preservation-after.json',JSON.stringify({passed:true,at:new Date(),current},null,2));console.log('Protected history unchanged.');}
