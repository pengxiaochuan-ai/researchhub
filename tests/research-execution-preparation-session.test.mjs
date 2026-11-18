import test from 'node:test';
import assert from 'node:assert/strict';
import {createKnowledgeClient} from '../src/knowledge-session.js';
import {diffDesignLines} from '../src/research-design-session.js';
let preparation={};try{preparation=await import('../src/research-execution-preparation-session.js');}catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;}
test('real preparation marker wins over demo, invalid or mixed scope never falls back',()=>{
 const {isPreparationRoute,readPreparationLocation,makePreparationUrl}=preparation;assert.equal(typeof isPreparationRoute,'function');
 const scope={studyGroupId:'g',researchProjectId:'p'},url=makePreparationUrl(scope,'own');assert.equal(isPreparationRoute('s11',new URL(url,'http://local').search),true);assert.deepEqual(readPreparationLocation('s11',new URL(url,'http://local').search),{scope,planId:'own'});
 for(const search of ['?executionPreparation=0','?executionPreparation=1&projectId=p','?executionPreparation=1&studyGroupId=g&researchProjectId=p&researchPlanId=a&researchPlanId=b','?executionPreparation=1&studyGroupId=g&researchProjectId=p&researchPlanId=a&designWorkspace=1']){assert(isPreparationRoute('s11',search));assert.throws(()=>readPreparationLocation('s11',search));}
});
test('empty configuration has two explicitly unconfirmed visits, no clinical numeric defaults',()=>{
 assert.equal(typeof preparation.emptyPreparationConfig,'function');const c=preparation.emptyPreparationConfig();assert.equal(c.visits.length,2);assert(c.visits.every(v=>v.targetDayOffset===null&&v.windowBeforeDays===null&&v.windowAfterDays===null));assert.equal(c.outcomes.length,0);assert.equal(c.form.schema.fields.length,0);assert.equal(preparation.nullableNumber(''),null);assert.equal(preparation.nullableNumber('0'),0);
});
test('duplicate mapping pairs and select values have field-addressed validation before any write',()=>{
 assert.equal(typeof preparation.preparationRelationErrors,'function');const c=preparation.emptyPreparationConfig();c.form.schema.fields=[{key:'choice',type:'select',label:'选项',options:[{value:'same',label:'甲'},{value:'same',label:'乙'}]}];c.mappings=[{outcomeKey:'result',fieldKey:'choice',visitKeys:[],unit:''},{outcomeKey:'result',fieldKey:'choice',visitKeys:[],unit:''}];const errors=preparation.preparationRelationErrors(c);assert(errors.some(e=>e.id==='option-0-1-value'));assert(errors.some(e=>e.id==='mapping-1-field'));
});
test('reverting exact draft values clears dirty, and empty opinion reasons never submit',()=>{
 assert.equal(typeof preparation.preparationDraftDirty,'function');const c=preparation.emptyPreparationConfig(),d=structuredClone(c);d.label='changed';assert(preparation.preparationDraftDirty(d,c));d.label=c.label;assert(!preparation.preparationDraftDirty(d,c));
 assert.equal(typeof preparation.preparationDecisionEdits,'function');const items=[{itemId:'a'},{itemId:'b',decision:{action:'acknowledge'}}],result=preparation.preparationDecisionEdits(items,{a:{action:'needs_revision',reason:' '},b:{action:'needs_revision',reason:'不应重用'}});assert.equal(result.valid,false);assert.equal(result.changes.length,1);assert(result.errors.a);assert.equal(preparation.preparationDecisionEdits(items,{a:{action:'acknowledge',reason:'本人核对完毕，非专业批准'}}).valid,true);
});
test('old_copy_promise_cannot_label_new_target; matching target gets truthful clipboard status',async()=>{
 assert.equal(typeof preparation.copyPreparationVersion,'function');let active=true,release;const pending=preparation.copyPreparationVersion({version:{version:2,config:{label:'old'}},write:()=>new Promise(resolve=>{release=resolve;}),isCurrent:()=>active});active=false;release();assert.equal(await pending,null);const ok=await preparation.copyPreparationVersion({version:{version:3,config:{label:'current'}},write:async()=>{},isCurrent:()=>true});assert.match(ok,/v3/);assert.match(await preparation.copyPreparationVersion({version:{version:3,config:{}},write:async()=>{throw Error('denied');},isCurrent:()=>true}),/复制失败/);
});
test('bounded configuration history may exceed plan body length without changing old default',()=>{const large='x'.repeat(24001);assert.throws(()=>diffDesignLines(large,large));assert.equal(diffDesignLines(large,large,{maxChars:131072})[0].text,large);assert.throws(()=>diffDesignLines('a','b',{maxChars:131073}));});
test('refresh preserves dirty input and CAS, restricted response clears every readable projection',()=>{
 assert.equal(typeof preparation.mergePreparationRead,'function');const current={version:3,config:{label:'saved'},basis:{versionNo:1}},draft={label:'unsaved'},previous={view:current,draft,dirty:true,history:{config:'history'},preview:{valid:true}},next={...current,version:4};
 const kept=preparation.mergePreparationRead(previous,next);assert.strictEqual(kept.view,current);assert.strictEqual(kept.draft,draft);assert(kept.notice.includes('新版本'));
 const lost=preparation.mergePreparationRead(previous,{sourceStatus:'restricted',message:'受限'});for(const k of ['view','draft','history','preview'])assert.equal(lost[k],null);assert.equal(lost.dirty,false);
 const unchanged=preparation.mergePreparationRead({...previous,dirty:false},current);assert.deepEqual(unchanged.preview,{valid:true});assert.strictEqual(unchanged.draft,draft);
 const clean=preparation.mergePreparationRead(previous,next,true);assert.equal(clean.dirty,false);assert.equal(clean.view.version,4);assert.equal(clean.preview,null);assert.equal(clean.history,null);
});
test('only scoped preparation read/save/history/preview transport is allowed, not governance or generic forms',async()=>{
 const calls=[],client=createKnowledgeClient({scope:()=>({studyGroupId:'g',researchProjectId:'p'}),fetchImpl:async(url,init)=>{calls.push([url,init.method]);return new Response('{}',{headers:{'Content-Type':'application/json'}});}}),base='/research-plan-drafts/own/execution-preparation';
 await client.get(base);await client.post(base+'/versions',{});await client.get(base+'/versions/12');await client.post(base+'/previews',{});await client.post(base+'/jobs',{});await client.post(base+'/decisions',{});await client.post(base+'/rebindings',{});assert.equal(calls.length,7);
 for(const path of [base+'/approve',base+'/export',base+'/versions/0','/study-forms/templates'])await assert.rejects(client.post(path,{}));assert.equal(calls.length,7);
});
