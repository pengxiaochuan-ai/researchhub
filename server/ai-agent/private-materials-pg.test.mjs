import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';import {readFileSync,mkdtempSync,writeFileSync,unlinkSync,rmdirSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {loadFixtureInput} from '../../../app/server/scripts/wp01/local-config.mjs';import {withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import {createLocalMaterialAccess,materialNativeOperations} from '../../scripts/local-session-materials.mjs';
import {createSessionMaterials} from './session-materials.mjs';import {createPrivateMaterialReader} from './private-materials.mjs';
import {createPrivateMaterialSelection} from './private-material-selection.mjs';import {createConversationCommands} from './conversation-commands.mjs';
const {env}=loadFixtureInput('/Users/mac/aisciencesys/.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const {ids}=JSON.parse(readFileSync(new URL('../../../.tmp/researchhub-knowledge-local/runtime.json',import.meta.url),'utf8'));
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));require('ts-node').register({project:new URL('../../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});
const load=(path,name)=>require(new URL('../../../app/server/src/'+path+'.ts',import.meta.url).pathname)[name],rollback=Symbol('private-material-rollback');
test('real application PG: owner private draft fragments, current parents and source versions, all rolled back',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'rh-private-pack-')),path=dir+'/synthetic.txt';
 const lines=Array.from({length:2000},(_,i)=>`synthetic section ${i} 😀 zero=0 false=false.`);lines[0]='P03-HEAD: synthetic only.';lines[1000]='P03-MIDDLE: preserve missing observations.';lines[1999]='P03-TAIL: no treatment effect claimed.';const text=lines.join('\n');writeFileSync(path,text,{mode:0o600});
 try{await assert.rejects(withFixtureTransaction(env,'app',async tx=>{
  await tx.$queryRawUnsafe(`SELECT set_config('app.tenant_id',$1,true),set_config('app.study_group_id',$2,true),set_config('app.research_project_id',$3,true)`,ids.tenant,ids.group,ids.project);
  const account=await tx.account.findUnique({where:{id:ids.owner}}),user={tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:ids.owner,authVersion:account.authVersion,role:account.role};
  const session='rh-private-session-'+randomUUID(),other='rh-private-other-'+randomUUID();
  for(const id of [session,other])await tx.session.create({data:{id,tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:ids.owner,agentId:ids.tenant+'-kb-research',channel:'knowledge',contextKey:'hub:lingshu-xinyu:conversation:'+randomUUID(),title:'P03回滚材料读取'}});
  const base=await tx.knowledgeBase.create({data:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,ownerAccountId:ids.owner,visibility:'private',name:'P03具名回滚私有库'}});
  const access=createLocalMaterialAccess({env,ids,load,transaction:(_u,fn)=>fn(tx)});
  const scope=load('common/deployment-scope','parseDeploymentScope')({DEPLOYMENT_ID:'rh-private-read-test',DEPLOYMENT_PRODUCT:'researchhub',ALLOWED_TENANT_IDS:ids.tenant,DEFAULT_TENANT_ID:ids.tenant,ENABLED_WORKER_KINDS:'knowledge-import'});
  const materials=createSessionMaterials({access,inspectFile:load('knowledge/knowledge-file-policy','inspectKnowledgeImportFile'),startImport:()=>{},createOperations:(db,current)=>({...materialNativeOperations({tx:db,user:current,load,storage:{putFile:async()=>{},remove:async()=>{}},scope}),privateBase:async()=>base})});
  const key='rh-private-key-'+randomUUID(),uploaded=await materials.upload(user,session,{requestKey:key,file:{path,originalname:'synthetic.txt',mimetype:'text/plain',size:Buffer.byteLength(text)}});
  const reader=createPrivateMaterialReader({access}),selection=createPrivateMaterialSelection({access,refreshInTx:materials.refreshInTx,reader});
  const scheduled=[],prepared=[],consumer='p03-rollback-'+randomUUID();
  const commands=createConversationCommands({tenantId:ids.tenant,consumerKey:consumer,transaction:fn=>fn(tx),authorize:async(_db,actor,sid)=>{await access.transaction(actor,sid,()=>{});return actor;},
   admit:async(db,actor,sid)=>({hubPrivateSelection:await selection.captureInTx(db,actor,sid)}),
   stage:async(db,actor,j)=>{const pack=await selection.prepareInTx(db,actor,j.sessionId,j.payload.hubPrivateSelection);prepared.push(pack);return{...j.payload,hubPrivateEvidence:pack};},schedule:async(...args)=>scheduled.push(args)});
  const body={text:'汇总本会话已上传资料并说明实际阅读范围',kbIds:[],requestKey:'p03-command-'+randomUUID()};let queued;
  await t.test('enqueue freezes only current uploads; parsing waits without a job, reservation or manual resume',async()=>{
   queued=await commands.submit(user,session,body);
   await commands.tick(user,session);await commands.tick(user,session);
   const view=await commands.list(user,session);assert.equal(view.items[0].status,'waiting',JSON.stringify({pauseCode:view.items[0].pauseCode,errorMessage:view.items[0].errorMessage}));assert.equal(view.paused,false);assert.equal(view.items[0].pauseCode,'HUB_PRIVATE_MATERIAL_PARSING');
   assert.equal(await tx.knowledgeChatJob.count({where:{sessionId:session}}),0);assert.equal(scheduled.length,0);assert.equal(prepared.length,0);
   const m=await tx.message.findUnique({where:{id:queued.id}});assert.equal(m.meta.hubCommand.hubPrivateSelection.materials[0].sourceFileId.length>0,true);
   const empty=await commands.submit(user,other,{...body,requestKey:'p03-empty-'+randomUUID()});
   assert.deepEqual((await tx.message.findUnique({where:{id:empty.id}})).meta.hubCommand.hubPrivateSelection.materials,[]);
  });
  const [row]=await tx.$queryRawUnsafe('SELECT * FROM rh_ai.session_materials WHERE id=$1',uploaded.id);
  const doc=await tx.knowledgeDoc.create({data:{tenantId:ids.tenant,studyGroupId:ids.group,kbId:base.id,title:'P03合成私人未审长文',contentMd:text,status:'draft',reviewed:false,safetyLevel:'allow'}});
  await tx.knowledgeSourceFile.update({where:{id:row.source_file_id},data:{docId:doc.id}});
  await tx.knowledgeImportTask.update({where:{id:row.import_task_id},data:{docId:doc.id,status:'complete',stage:'complete',safetyLevel:'allow',progress:100}});
  const ready=(await materials.receipt(user,session,key)).item,refs=[{materialId:ready.id,version:ready.version}];
  const pack=await reader.prepare(user,session,refs);
  await t.test('selection, source binding and evidence survive real JSONB round trips without changing identity',async()=>{
   const [roundtrip]=await tx.$queryRawUnsafe('SELECT $1::jsonb AS value',JSON.stringify(pack));
   assert.equal(await reader.assertCurrent(user,session,roundtrip.value),true);
  });
  await t.test('ready sources dispatch automatically and retry/edit cannot append a later uploaded file',async()=>{
   const later=await materials.upload(user,session,{requestKey:'p03-later-'+randomUUID(),file:{path,originalname:'later.txt',mimetype:'text/plain',size:Buffer.byteLength(text)}});
   assert.notEqual(later.id,ready.id);assert.equal((await commands.submit(user,session,body)).id,queued.id);
   const current=(await commands.list(user,session)).items[0];await commands.edit(user,session,queued.id,{version:current.version,text:'仅汇总发送问题时的资料，不能混入后续上传'});
   await commands.tick(user,session);assert.equal(scheduled.length,1);assert.equal(prepared.length,1);
   const job=await tx.knowledgeChatJob.findFirst({where:{userMessageId:queued.id}});assert.equal(job.status,'queued');assert.equal(job.payload.hubPrivateEvidence.packHash,pack.packHash);assert.equal(job.payload.hubPrivateSelection.materials.length,1);
  });
  await t.test('unreviewed draft is explicitly private, with real Unicode and head/middle/tail positions',async()=>{
   assert.equal(pack.sources.length,1);const source=pack.sources[0];assert.equal(source.reviewed,false);assert.equal(source.sourceType,'owner-uploaded-draft');assert.equal(source.coverage.complete,false);
   const quotes=source.fragments.map(f=>f.text).join('\n');for(const marker of ['P03-HEAD','P03-MIDDLE','P03-TAIL','😀','zero=0','false=false'])assert(quotes.includes(marker),marker);
   const points=Array.from(text);for(const f of source.fragments){assert.equal(f.text,points.slice(f.start,f.end).join(''));assert.equal(f.lineStart,points.slice(0,f.start).join('').split('\n').length);}
   assert.equal(await reader.assertCurrent(user,session,pack),true);assert.equal((await tx.knowledgeDoc.findUnique({where:{id:doc.id}})).reviewed,false);
  });
  await t.test('admin, stale login, another owned session and stale material version cannot read the pack',async()=>{
   const admin=await tx.account.findUnique({where:{id:ids.admin}});
   await assert.rejects(reader.prepare({...user,accountId:ids.admin,authVersion:admin.authVersion,role:'tenant_admin'},session,refs),e=>e.code==='HUB_MATERIAL_ACCESS_REJECTED');
   await assert.rejects(reader.prepare({...user,authVersion:user.authVersion+1},session,refs),e=>e.code==='HUB_MATERIAL_ACCESS_REJECTED');
   await assert.rejects(reader.prepare(user,other,refs),e=>e.code==='HUB_MATERIAL_UNAVAILABLE');
   await assert.rejects(reader.prepare(user,session,[{...refs[0],version:refs[0].version-1}]),e=>e.code==='HUB_MATERIAL_UNAVAILABLE');
  });
  const invalid=async(name,mutate)=>t.test(name,async()=>{await tx.$executeRawUnsafe('SAVEPOINT changed_private_source');try{await mutate();await assert.rejects(reader.assertCurrent(user,session,pack),e=>e.code?.startsWith('HUB_'));}finally{await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT changed_private_source');}});
  await invalid('same-length tampering outside the excerpts is detected by the whole-document hash',()=>{
   const points=Array.from(text);let position=pack.sources[0].fragments[0].end+5;while(points[position]==='\n')position++;
   assert(!pack.sources[0].fragments.some(f=>position>=f.start&&position<f.end));
   points[position]=points[position]==='Z'?'Q':'Z';return tx.knowledgeDoc.update({where:{id:doc.id},data:{contentMd:points.join('')}});
  });
  await invalid('a later document revision does not replace the fixed evidence',()=>tx.knowledgeDoc.update({where:{id:doc.id},data:{version:{increment:1}}}));
  await invalid('safety warning cannot be read as allow',()=>tx.knowledgeDoc.update({where:{id:doc.id},data:{safetyLevel:'warning'}}));
  await invalid('private ownership and visibility are rechecked',()=>tx.knowledgeBase.update({where:{id:base.id},data:{visibility:'tenant',ownerAccountId:null}}));
  await invalid('removed native source parents make the historical material unavailable',()=>tx.knowledgeSourceFile.delete({where:{id:row.source_file_id}}));
  throw rollback;
 }),e=>e===rollback);}finally{unlinkSync(path);rmdirSync(dir);}
});
