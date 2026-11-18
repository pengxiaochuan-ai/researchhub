// Read-only local synthetic acceptance; auth POST only, no business writes.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {root,directoryLogin,directoryRequest,directoryPath} from './directory-runtime.mjs';
const phase=process.argv[2];assert(['before','after'].includes(phase));
const out=root+'researchhub/docs/testing/evidence/team-city-reference-2026-11-10/';mkdirSync(out,{recursive:true});
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex'),prefix='/api/hubs/lingshu-xinyu/',cookie=await directoryLogin('admin');
const list=await directoryRequest(cookie,prefix+'member/teams'),map=await directoryRequest(cookie,prefix+'member/teams/map');
async function fingerprints(ids){return Object.fromEntries(await Promise.all(ids.map(async id=>[id,{entity:hash(await directoryRequest(cookie,directoryPath+'entities/'+id)),workspace:hash(await directoryRequest(cookie,directoryPath+'team-workspaces/'+id))}])));}
if(phase==='before'){
 assert(!existsSync(out+'before-api.json'),'Preserve baseline');assert.equal(list.pagination.totalItems,3);assert.equal(map.regionMappedTeamCount,3);
 const ids=list.items.map(x=>x.id);writeFileSync(out+'before-api.json',JSON.stringify({at:new Date().toISOString(),ids,map,fingerprints:await fingerprints(ids)},null,2));
 console.log(JSON.stringify({phase,passed:true,matched:3,regions:3,businessWrites:0}));
}else{
 const before=JSON.parse(readFileSync(out+'before-api.json')),checks=[];
 assert.equal(map.matchedTeamCount,3);assert.equal(map.mappedTeamCount,3);assert.equal(map.unmappedTeamCount,0);assert.equal(map.regionMappedTeamCount,0);assert.deepEqual(map.regions,[]);
 assert.deepEqual(map.cities.map(p=>p.cityCode).sort(),['110000','210200','310000']);
 assert(map.cities.every(p=>p.coordinateKind==='CITY_REFERENCE'&&p.teamCount===1&&p.reference.coordinateSystem==='WGS84'&&p.reference.datasetVersion==='RH-CITY-REFERENCE-2026-11-10'));
 const dl=map.cities.find(p=>p.cityCode==='210200');assert.equal(dl.longitude,121.6);assert.equal(dl.latitude,38.9);assert.equal(dl.reference.referenceCount,0);assert.equal(dl.reference.precision,1/60);
 checks.push('three city reference points, original precision and provenance retained');
 assert.equal(map.dataRevision,before.map.dataRevision);assert.deepEqual(await fingerprints(before.ids),before.fingerprints);checks.push('all three entity/workspace fingerprints and directory revision unchanged');
 const region=await directoryRequest(cookie,prefix+'member/teams/map?region='+encodeURIComponent('辽宁省'));assert.equal(region.matchedTeamCount,1);assert.equal(region.cities[0].cityCode,'210200');
 const empty=await directoryRequest(cookie,prefix+'member/teams/map?q='+encodeURIComponent('本轮城市参考点无匹配验证'));assert.equal(empty.matchedTeamCount,0);assert.deepEqual(empty.cities,[]);assert.deepEqual(empty.regions,[]);checks.push('region filter and empty result respected');
 const owner=await directoryLogin('owner'),ownerMap=await directoryRequest(owner,prefix+'member/teams/map');assert.deepEqual(ownerMap,map);checks.push('original researcher and administrator read same tenant collection');
 const publicMap=await directoryRequest('',prefix+'teams/map');assert.equal(publicMap.matchedTeamCount,2);assert.equal(publicMap.mappedTeamCount,2);assert(!publicMap.cities.some(p=>p.cityCode==='110000'));checks.push('anonymous view excludes tenant-only Beijing');
 writeFileSync(out+'after-api.json',JSON.stringify({passed:true,at:new Date().toISOString(),map,publicMap,checks,businessWrites:0,modelCalls:0,professionalAcceptance:false},null,2));console.log(JSON.stringify({phase,passed:true,checks}));
}
