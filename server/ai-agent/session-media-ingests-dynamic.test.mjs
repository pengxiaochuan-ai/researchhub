import test from 'node:test';
import assert from 'node:assert/strict';
import {createSessionMediaIngests,mediaIngestTargetQuery} from './session-media-ingests.mjs';
const user={tenantId:'tenant',accountId:'owner',authVersion:1,studyGroupId:'source-group',researchProjectId:'source-project'};
function fixture({dynamic=true,sourceFails=false,inspectionState='complete'}={}){
 let sourceChecks=0;const visits=[],restored=[];
 const media={id:'media',version:1,source_sha256:'a'.repeat(64),byte_size:10,archive_state:'archived',inspection_state:inspectionState,inspection_classification:'valid',inspection:{hasVideo:true,hasAudio:false}};
 const tx={$queryRawUnsafe:async(sql,...args)=>{if(sql.includes('set_config')){restored.push(args);return[];}if(sql.includes('session_media_uploads')){assert.equal(args[3],'source-group');assert.equal(args[4],'source-project');return[media];}return[];}};
 const sourceAccess={transaction:async(_u,_s,run)=>run(tx,user),inTransaction:async(_tx,u,_sid,run)=>{sourceChecks++;if(sourceFails)throw Object.assign(Error('source revoked'),{status:403,code:'HUB_MATERIAL_ACCESS_REJECTED'});assert.equal(u.studyGroupId,'source-group');return run(tx,user);}};
 const service=createSessionMediaIngests({studies:{withResearchStudyTransaction:async(_u,id,_op,run)=>{visits.push(id);return run(tx,{studyId:id,studyGroupId:'target-group',executionProjectId:'target-project'});}},sourceAccess,native:{currentInTx:async()=>({permissionRef:{kind:'native',id:'owner',version:1}}),candidatesInTx:async(_tx,_u,c)=>({id:c.studyId,name:'Study',subjects:[{id:'subject',subjectId:'S01',visits:[]}]})},storage:{},scopeKey:'original-scope',sourceScope:dynamic?{studyGroupId:'old-group',researchProjectId:'old-project'}:{studyGroupId:'source-group',researchProjectId:'source-project'},allowedStudyIds:['old-study'],...(dynamic?{resolveTargetIds:async()=>['new-study','old-study'],resolveSourceScope:(u)=>({studyGroupId:u.studyGroupId,researchProjectId:u.researchProjectId})}:{})});
 return{service,visits,restored,get checks(){return sourceChecks;}};
}
test('dynamic target enumeration validates each own source and restores target context',async()=>{
 const f=fixture(),r=await f.service.targets(user,'new-session','media');assert.deepEqual(r.items.map(x=>x.id),['old-study','new-study']);assert.equal(f.checks,2);assert(f.restored.every(x=>x[0]==='target-group'&&x[1]==='target-project'));
});
test('source authorization failures never become a successful empty candidate list',async()=>{
 const f=fixture({sourceFails:true});await assert.rejects(f.service.targets(user,'new-session','media'),e=>e.code==='HUB_MATERIAL_ACCESS_REJECTED');
 await assert.rejects(fixture({inspectionState:'running'}).service.targets(user,'new-session','media'),e=>e.code==='MEDIA_INGEST_SOURCE_UNAVAILABLE');
});
test('a selected Study checks only that target and strictly rejects duplicate/foreign selectors',async()=>{
 const f=fixture(),r=await f.service.targets(user,'new-session','media',{studyId:'new-study'});assert.deepEqual(r.items.map(x=>x.id),['new-study']);assert.deepEqual(f.visits,['new-study']);
 for(const [q,url]of [[{studyId:['a','b']},undefined],[{studyId:'a'},'/ingest-targets?studyId=a&studyId=a'],[{studyId:'a'},'/ingest-targets?studyId=a&extra=1'],[{studyId:'a'},'/ingest-targets?studyId=b']])assert.throws(()=>mediaIngestTargetQuery(q,url),e=>e.code==='MEDIA_INGEST_INPUT');
 assert.deepEqual(mediaIngestTargetQuery({studyId:'a'},'/ingest-targets?studyId=a'),{studyId:'a'});
});
test('without resolvers the old fixed target contract remains in force',async()=>{
 const f=fixture({dynamic:false});assert.deepEqual((await f.service.targets(user,'new-session','media')).items.map(x=>x.id),['old-study']);await assert.rejects(f.service.targets(user,'new-session','media',{studyId:'other-study'}),e=>e.code==='MEDIA_INGEST_PERMISSION');
});
