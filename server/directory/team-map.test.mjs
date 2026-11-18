import test from 'node:test';
import assert from 'node:assert/strict';
import {mapDirectory,projectDirectory} from './read-model.mjs';

const query={page:1,pageSize:10,sort:'relevance'};
function team(id,name,region,provinceCode,cityCode){return {id,name,aliases:[],summary:'',directions:[],affiliations:[],leads:[],city:name,region,geo:{name,region,longitude:null,latitude:null,coordinateKind:null,division:{version:'MCA-2024-12-31',provinceCode,cityCode}}};}
const dalian=()=>team('dalian','大连市','辽宁省','210000','210200');
const beijing=()=>team('beijing','北京市','北京市','110000','110000');
const shanghai=()=>team('shanghai','上海市','上海市','310000','310000');
const shenyang=()=>team('shenyang','沈阳市','辽宁省','210000','210100');

test('reviewed division-only teams appear as province aggregates, never fabricated city coordinates',()=>{
 const items=[shenyang()],before=structuredClone(items),r=mapDirectory(items,query,'r1');
 assert.equal(r.matchedTeamCount,1);assert.equal(r.mappedTeamCount,1);assert.equal(r.unmappedTeamCount,0);assert.equal(r.regionMappedTeamCount,1);
 assert.deepEqual(r.cities,[]);assert.equal(r.regions.length,1);
 assert.deepEqual(r.regions.map(p=>[p.region,p.regionCode,p.coordinateKind,p.teamCount]),[['辽宁省','210000','REGION_ANCHOR',1]]);
 assert(r.regions.every(p=>Number.isFinite(p.longitude)&&Number.isFinite(p.latitude)&&!Object.hasOwn(p,'city')));
 assert.equal(r.mapReference.kind,'BUNDLED_BASEMAP');assert.match(r.mapReference.sha256,/^[a-f0-9]{64}$/);assert.deepEqual(items,before);
});
test('valid existing city coordinates retain their original path and are not counted a second time',()=>{
 const b=beijing();Object.assign(b.geo,{longitude:116.4,latitude:39.9,coordinateKind:'CITY_CENTROID'});
 const r=mapDirectory([b,shenyang()],query,'r');assert.equal(r.cities.length,1);assert.equal(r.cities[0].longitude,116.4);assert.equal(r.cities[0].city,'北京市');assert.equal(r.regionMappedTeamCount,1);assert.equal(r.mappedTeamCount,2);
});
test('province aggregation uses all matching teams, not one list page, and empty filters never restore markers',()=>{
 const items=Array.from({length:12},(_,i)=>({...shenyang(),id:'t'+i}));
 const r=mapDirectory(items,{...query,page:2},'r');assert.equal(r.regions.length,1);assert.equal(r.regions[0].teamCount,12);assert.equal(r.mappedTeamCount,12);
 const empty=mapDirectory(items,{...query,q:'不存在的团队'},'r');assert.equal(empty.matchedTeamCount,0);assert.equal(empty.mappedTeamCount,0);assert.deepEqual(empty.regions,[]);assert.deepEqual(empty.cities,[]);
});
test('unknown, inconsistent, text-only or partial coordinates remain unmapped without guessing',()=>{
 const changes=[x=>x.geo.division.version='future',x=>x.geo.division.provinceCode='110000',x=>x.geo.division.cityCode='999900',x=>x.geo.name='北京市',x=>x.geo.region='上海市',x=>delete x.geo.division,x=>x.geo.longitude=121,x=>x.geo.latitude=NaN,x=>x.geo.coordinateKind='SOURCE_LOCATION',x=>x.geo=null];
 const items=changes.map((change,i)=>{const x=dalian();x.id='invalid'+i;change(x);return x;});const r=mapDirectory(items,query,'r');
 assert.equal(r.mappedTeamCount,0);assert.equal(r.unmappedTeamCount,10);assert.deepEqual(r.regions,[]);
});
test('region filters constrain markers and scope of directory decisions still gates province counts',()=>{
 const r=mapDirectory([dalian(),beijing()],{...query,region:'辽宁省'},'r');assert.equal(r.matchedTeamCount,1);assert.equal(r.cities[0].region,'辽宁省');
 const entity={id:'t',kind:'team',archivedAt:null},payload={name:'租户团队',city:beijing().geo},profile={id:'p',entityId:'t',kind:'profile',assertionKey:'profile',revision:1,payload,hash:'p',sources:[{available:true,fingerprint:'s'}],decision:{version:1,decision:'approve',audience:'tenant'}};
 const graph={entities:[entity],heads:[profile]};assert.equal(mapDirectory(projectDirectory(graph,'public'),query,'r').matchedTeamCount,0);
 assert.equal(mapDirectory(projectDirectory(graph,'tenant'),query,'r').mappedTeamCount,1);
 profile.sources[0].available=false;assert.equal(mapDirectory(projectDirectory(graph,'tenant'),query,'r').mappedTeamCount,0);
});
test('expired review, newest pending revision and conflicting primary affiliations cannot manufacture region markers',()=>{
 const entities=[{id:'t',kind:'team',archivedAt:null},...['o1','o2'].map(id=>({id,kind:'organization',archivedAt:null}))];
 const fact=(id,entityId,kind,payload,relatedEntityId=null)=>({id,entityId,kind,assertionKey:kind==='profile'?'profile':'affiliation:'+relatedEntityId,revision:1,hash:id,payload,relatedEntityId,sources:[{available:true,fingerprint:'s'}],decision:{version:1,decision:'approve',audience:'public',expiresAt:null}});
 const profile=fact('p','t','profile',{name:'已审核团队',city:beijing().geo}),original={entities,heads:[profile]};
 assert.equal(mapDirectory(projectDirectory(original,'public'),query,'r').mappedTeamCount,1);
 const expired=structuredClone(original);expired.heads[0].decision.expiresAt='2000-01-01T00:00:00Z';assert.equal(mapDirectory(projectDirectory(expired,'public'),query,'r').matchedTeamCount,0);
 const pending=structuredClone(original);pending.heads.push({...pending.heads[0],id:'pending',revision:2,decision:null});assert.equal(mapDirectory(projectDirectory(pending,'public'),query,'r').matchedTeamCount,0);
 const conflicting=structuredClone(original);for(const id of ['o1','o2'])conflicting.heads.push(fact('p-'+id,id,'profile',{name:id}),fact('a-'+id,'t','affiliation',{current:true,isPrimaryForDisplay:true},id));
 const projected=projectDirectory(conflicting,'public');assert.equal(projected[0].projectionStatus,'CONFLICT');const r=mapDirectory(projected,query,'r');assert.equal(r.mappedTeamCount,0);assert.equal(r.unmappedTeamCount,1);assert.deepEqual(r.regions,[]);
});
