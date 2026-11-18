import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {normalizeTeamData,planTeamChanges} from './team-contract.mjs';
import {normalizeAssertion} from './contract.mjs';
import {createDirectoryService} from './commands.mjs';import {directoryRollback} from './test-support.mjs';
const location={version:'MCA-2024-12-31',provinceCode:'130000',cityCode:'130100'};
test('new city codes extend private drafts without adding fields or changing old text-only normalization',()=>{
 const old=normalizeTeamData({name:'旧团队',city:'北京',region:'北京'});assert(!Object.hasOwn(old,'location'));
 const next=normalizeTeamData({...old,city:'石家庄市',region:'河北省',location});assert.deepEqual(next.location,location);
});
test('profile city accepts optional division codes while old scientific coordinates remain unchanged',()=>{
 const ref={kind:'source_record',sourceId:'s',rowId:'r',sourceHash:'a'.repeat(64),locator:'原文',fieldNames:['title']};
 const c={name:'石家庄市',region:'河北省',longitude:null,latitude:null,coordinateKind:null,division:location};
 const a=normalizeAssertion({kind:'profile',assertionKey:'profile',expectedRevision:0,payload:{name:'团队',city:c},provenance:[ref],requestKey:randomUUID()},'team');assert.deepEqual(a.payload.city,c);
});
test('real PG rejects mismatched city name/parent and round-trips valid optional codes with old source gates',async()=>directoryRollback(async({db,ctx,suffix})=>{
 const s=createDirectoryService({db}),admin=ctx('admin');
 await assert.rejects(()=>s.createTeamWorkspace(admin,{data:{name:'非法省市-'+suffix,city:'北京市',region:'河北省',location},requestKey:randomUUID()}),{status:400});
 const created=await s.createTeamWorkspace(admin,{data:{name:'合法省市-'+suffix,city:'石家庄市',region:'河北省',location},requestKey:randomUUID()}),w=await s.teamWorkspace(admin,created.id);assert.deepEqual(w.data.location,location);assert.equal((await s.previewTeamWorkspace(admin,created.id)).canApprove,false);
}));
test('advanced append cannot bypass dictionary validation on the newly added optional profile codes',async()=>directoryRollback(async({db,ctx,suffix,provenance})=>{
 const s=createDirectoryService({db}),admin=ctx('admin'),e=await s.createEntity(admin,{kind:'team',stableKey:'division-boundary-'+suffix,requestKey:randomUUID()});
 await assert.rejects(()=>s.appendAssertion(admin,e.id,{kind:'profile',assertionKey:'profile',expectedRevision:0,payload:{name:'非法代码',city:{name:'北京市',region:'河北省',longitude:null,latitude:null,coordinateKind:null,division:location}},provenance,requestKey:randomUUID()}),{status:400});
}));
