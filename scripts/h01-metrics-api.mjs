// Local synthetic, read-only business verification. Auth POST issues existing
// sessions only; no source decisions, accounts or entitlements are changed.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {root,directoryLogin,directoryRequest,directoryPath} from './directory-runtime.mjs';
const out=root+'researchhub/docs/testing/evidence/h01-metrics-2026-11-10/';
const overview='/api/hubs/lingshu-xinyu/overview';
const data=await directoryRequest('',overview);
assert.deepEqual(Object.values(data.metrics).map(m=>m.value),[2,null,3,3,3]);
const roles={anonymous:data.metrics};
for(const actor of ['owner','admin'])roles[actor]=(await directoryRequest(await directoryLogin(actor),overview)).metrics;
assert.deepEqual(roles.owner,roles.anonymous);assert.deepEqual(roles.admin,roles.anonymous);
const clinical=await directoryRequest('','/api/hub-sources/clinical-registries'),guidance=await directoryRequest('','/api/hub-sources/guidance-documents');
assert.deepEqual(clinical.items.map(i=>i.externalKey).sort(),['ChiCTR2300073486','ChiCTR2300077209']);assert.equal(guidance.items.length,3);
const admin=await directoryLogin('admin'),before=JSON.parse(readFileSync(root+'researchhub/docs/testing/evidence/team-city-reference-2026-11-10/before-api.json'));
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fingerprints={};for(const id of before.ids)fingerprints[id]={entity:hash(await directoryRequest(admin,directoryPath+'entities/'+id)),workspace:hash(await directoryRequest(admin,directoryPath+'team-workspaces/'+id))};
assert.deepEqual(fingerprints,before.fingerprints);
const map=await directoryRequest(admin,'/api/hubs/lingshu-xinyu/member/teams/map');assert.equal(map.dataRevision,before.map.dataRevision);
writeFileSync(out+'api-verification.json',JSON.stringify({at:new Date().toISOString(),passed:true,overview:data,roles,clinical:clinical.items,guidance:guidance.items,originalDirectoryFingerprintsUnchanged:true,directoryRevision:map.dataRevision,businessWrites:0,modelCalls:0,fees:0},null,2));
console.log(JSON.stringify({passed:true,values:Object.values(data.metrics).map(m=>m.value),roles:['anonymous','owner','admin'],originalDirectoryFingerprintsUnchanged:true,businessWrites:0,modelCalls:0}));
