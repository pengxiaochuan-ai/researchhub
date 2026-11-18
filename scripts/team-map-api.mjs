// Local synthetic read-only map verification. Only authentication POSTs; never
// save/review directory content, change accounts, or call a model/map provider.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {root,directoryLogin,directoryRequest,directoryPath} from './directory-runtime.mjs';
const phase=process.argv[2];assert(['before','after'].includes(phase));
const out=root+'researchhub/docs/testing/evidence/team-map-2026-11-10/';mkdirSync(out,{recursive:true});
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex'),prefix='/api/hubs/lingshu-xinyu/',cookie=await directoryLogin('admin');
const list=await directoryRequest(cookie,prefix+'member/teams'),map=await directoryRequest(cookie,prefix+'member/teams/map');
async function fingerprints(ids){return Object.fromEntries(await Promise.all(ids.map(async id=>[id,{entity:hash(await directoryRequest(cookie,directoryPath+'entities/'+id)),workspace:hash(await directoryRequest(cookie,directoryPath+'team-workspaces/'+id))}])));}
if(phase==='before'){
 assert(!existsSync(out+'before-api.json'),'Preserve existing baseline; do not overwrite');assert.equal(list.pagination.totalItems,3);assert.equal(map.mappedTeamCount,0);assert.equal(map.unmappedTeamCount,3);
 const ids=list.items.map(x=>x.id);writeFileSync(out+'before-api.json',JSON.stringify({at:new Date().toISOString(),ids,map,locations:list.items.map(({id,geo})=>({id,geo})),fingerprints:await fingerprints(ids)},null,2));
 console.log(JSON.stringify({phase,passed:true,matched:3,mapped:0,businessWrites:0,evidence:out}));
}else{
 const before=JSON.parse(readFileSync(out+'before-api.json')),checks=[];
 assert.equal(map.matchedTeamCount,3);assert.equal(map.mappedTeamCount,3);assert.equal(map.regionMappedTeamCount,3);assert.equal(map.unmappedTeamCount,0);assert.deepEqual(map.cities,[]);
 assert.deepEqual(map.regions.map(p=>p.regionCode).sort(),['110000','210000','310000']);assert(map.regions.every(p=>p.coordinateKind==='REGION_ANCHOR'&&p.teamCount===1));checks.push('three reviewed division-only teams mapped without city/address invention');
 assert.equal(map.dataRevision,before.map.dataRevision);assert.deepEqual(await fingerprints(before.ids),before.fingerprints);checks.push('all three user team workspaces, current facts, decisions and source metadata unchanged');
 const region=await directoryRequest(cookie,prefix+'member/teams/map?region='+encodeURIComponent('辽宁省'));assert.equal(region.matchedTeamCount,1);assert.equal(region.regions[0].regionCode,'210000');
 const empty=await directoryRequest(cookie,prefix+'member/teams/map?q='+encodeURIComponent('本轮地图无匹配验证'));assert.equal(empty.matchedTeamCount,0);assert.deepEqual(empty.regions,[]);assert.deepEqual(empty.cities,[]);checks.push('active filters and empty result constrain all markers');
 const owner=await directoryLogin('owner'),ownerMap=await directoryRequest(owner,prefix+'member/teams/map');assert.equal(ownerMap.mappedTeamCount,3);checks.push('researcher and administrator use the same current visible tenant collection');
 const publicMap=await directoryRequest('',prefix+'teams/map');assert.equal(publicMap.matchedTeamCount,2);assert.equal(publicMap.mappedTeamCount,2);assert(!publicMap.regions.some(p=>p.regionCode==='110000'));checks.push('anonymous read retains only two public teams; tenant-only Beijing absent');
 writeFileSync(out+'after-api.json',JSON.stringify({passed:true,at:new Date().toISOString(),map,publicMap,checks,businessWrites:0,modelCalls:0,professionalAcceptance:false},null,2));console.log(JSON.stringify({phase,passed:true,checks,evidence:out}));
}
