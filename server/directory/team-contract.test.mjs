import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeTeamData,planTeamChanges,teamSeed} from './team-contract.mjs';
const g={entities:[{id:'team',kind:'team'}],heads:[]};
test('name-only draft is accepted, unknown fields and duplicate member keys rejected',()=>{
 const d=normalizeTeamData({name:'  甲团队  '});assert.equal(d.name,'甲团队');assert.deepEqual(d.members,[]);
 for(const input of [{name:''},{name:'甲',accountId:'x'},{name:'甲',members:[{key:'a',name:'乙'},{key:'a',name:'丙'}]},{name:'甲',members:[{key:'a',role:'pi'}]}])assert.throws(()=>normalizeTeamData(input),{status:400});
});
test('partially entered proof may be saved as draft but cannot become an approved assertion',()=>{
 const ref={kind:'source_record',sourceId:'s',rowId:'r',versionId:null,sourceHash:'a'.repeat(64),locator:'',fieldNames:[]};
 const d=normalizeTeamData({name:'未完稿',evidence:[{reference:ref,targets:['team']}]});assert.equal(d.evidence[0].reference.locator,'');assert.deepEqual(d.evidence[0].reference.fieldNames,[]);assert(planTeamChanges(g,'team',d,'tenant').issues.some(x=>x.includes('依据')));
});
test('incomplete drafts cannot approve, same-name people remain distinct, shared existing profiles are not rewritten',()=>{
 const d=normalizeTeamData({name:'甲'});const p=planTeamChanges(g,'team',d,'tenant');assert(p.issues.some(x=>x.includes('所属机构')));assert(p.issues.some(x=>x.includes('负责人')));assert(p.issues.some(x=>x.includes('依据')));
 const graph={entities:[...g.entities,{id:'person',kind:'researcher'}],heads:[{id:'profile1',entityId:'person',kind:'profile',assertionKey:'profile',revision:1,payload:{name:'张某',rank:'教授'},provenance:[],decision:{decision:'approve',audience:'public'},sources:[{available:true}]}]};
 assert.throws(()=>planTeamChanges(graph,'team',normalizeTeamData({name:'甲',members:[{key:'a',entityId:'person',name:'另一个名字',rank:'教授',role:'lead'}]}),'tenant'),{status:409});
 const plan=planTeamChanges(graph,'team',normalizeTeamData({name:'甲',members:[{key:'a',name:'同名',role:'lead'},{key:'b',name:'同名'}]}),'tenant');assert.equal(plan.creates.filter(x=>x.kind==='researcher').length,2);
});
test('seed includes incoming members and retained proof once with multiple supported items',()=>{
 const proof={kind:'source_record',sourceId:'s',rowId:'row',versionId:null,sourceHash:'a'.repeat(64),locator:'第1段',fieldNames:['abstract']};
 const graph={entities:[...g.entities,{id:'person',kind:'researcher'}],heads:[{id:'tp',entityId:'team',kind:'profile',assertionKey:'profile',payload:{name:'团队',directions:[]},provenance:[proof]},{id:'pp',entityId:'person',kind:'profile',assertionKey:'profile',payload:{name:'负责人'},provenance:[proof]},{id:'rel',entityId:'person',relatedEntityId:'team',assertionKey:'team_member:one',kind:'team_member',payload:{current:true,memberRole:'lead',isPrimary:false},provenance:[proof]}]};
 const d=teamSeed(graph,'team');assert.equal(d.members[0].entityId,'person');assert.equal(d.evidence.length,1);assert(d.evidence[0].targets.includes('team'));assert(d.evidence[0].targets.includes('member:person'));
});
test('reusing a proof for more form items does not create meaningless revisions of unchanged approved facts',()=>{
 const a={kind:'source_record',sourceId:'s',rowId:'row',versionId:null,sourceHash:'a'.repeat(64),locator:'第1段',fieldNames:['abstract']},b={...a,locator:'第2段'};
 const normalized={name:'甲',summary:'',directions:[],aliases:[],city:null,organizationType:null,teamType:null,rank:null,researchRole:null,photo:null,hubMatch:{status:'UNVERIFIED',tier:null,reason:null}};
 const graph={entities:[...g.entities],heads:[{id:'p',entityId:'team',kind:'profile',assertionKey:'profile',revision:1,payload:normalized,provenance:[a],decision:{decision:'approve',audience:'public'},sources:[{available:true}]}]};
 const p=planTeamChanges(graph,'team',normalizeTeamData({name:'甲',evidence:[{reference:a,targets:['team']},{reference:b,targets:['team']}]}),'public');assert(!p.facts.some(f=>f.kind==='profile'));
});
