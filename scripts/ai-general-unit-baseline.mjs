import assert from 'node:assert/strict';import {existsSync} from 'node:fs';import {materialDigest} from '../server/ai-agent/session-material-contract.mjs';
import {openGeneralUnitHarness,root,dir,json,save} from './ai-general-unit-runtime.mjs';
assert.deepEqual(process.argv.slice(2),['--read-only']);const h=await openGeneralUnitHarness(),file=dir+'baseline.json',old=json(root+'researchhub/.tmp/ai-file-data-2026-11-12/p05-authorized-scope.json'),before=existsSync(file)?json(file):null;
const data=await h.read(async tx=>{
 const accounts=await tx.account.findMany({where:{id:{in:[h.ids.owner,h.ids.admin]},tenantId:h.ids.tenant},select:{id:true,role:true,isTenantAdmin:true,authVersion:true,status:true},orderBy:{id:'asc'}});
 const grants=await tx.$queryRawUnsafe('SELECT * FROM rh_ai.research_data_import_access WHERE id=$1',old.grantId);
 const scope={tenantId:h.ids.tenant,studyGroupId:h.ids.group,researchProjectId:old.target.executionProjectId};
 const records={};for(const model of ['subject','studyEnrollment','subjectVisit','formResponse','formResponseRevision','formVersion','studyProtocolVersion'])records[model]=await tx[model].findMany({where:scope,orderBy:{id:'asc'}});
 const sourceIds=before?.sources.map(x=>x.id),sources=await tx.$queryRawUnsafe(`SELECT id,source_sha256,state,version,storage_key FROM rh_ai.research_data_uploads WHERE tenant_id=$1 AND account_id=ANY($2::text[])${sourceIds?' AND id=ANY($3::text[])':''} ORDER BY id`,h.ids.tenant,[h.ids.owner,h.ids.admin],...(sourceIds?[sourceIds]:[]));
 const oldLedger=json(root+'researchhub/.tmp/ai-file-data-2026-11-12/p06-accounting-baseline.json');
 const reservations=await tx.tokenQuotaReservation.findMany({where:{tenantId:h.ids.tenant,id:{in:oldLedger.ids}},select:{id:true,status:true,reservedTokens:true,actualTokens:true,settledAt:true,expiresAt:true,usedMock:true},orderBy:{id:'asc'}});
 const normalized=JSON.parse(JSON.stringify({accounts,grants,records,sources,reservations},(_,x)=>typeof x==='bigint'?x.toString():x));
 return{...normalized,hash:materialDigest(normalized)};
});
if(before)assert.equal(data.hash,before.hash,'Existing records, roles, grant, source files and old ledger must remain unchanged');else{assert.equal(data.reservations.length,152);assert.equal(data.records.subject.length,4);save(file,data);}
console.log(JSON.stringify({passed:true,readOnly:true,reused:Boolean(before),oldSubjects:data.records.subject.length,oldReservations:data.reservations.length,rolesAndGrantUnchanged:Boolean(before),modelCalls:0}));
