import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createDirectoryService} from './commands.mjs';import {directoryRollback} from './test-support.mjs';
test('real PG preserves 100 history entries while save101 and review102 succeed with receipts and guards',async()=>directoryRollback(async({db,ctx,provenance,suffix,direct})=>{
 const service=createDirectoryService({db}),admin=ctx('admin'),input={data:{name:'操作次数回滚-'+suffix,organization:{name:'回滚机构'},members:[{key:'lead',name:'回滚负责人',role:'lead'}],evidence:[{reference:provenance[0],targets:['team','organization','member:lead']}]},requestKey:randomUUID()};
 const created=await service.createTeamWorkspace(admin,input);
 const [stored]=await direct(tx=>tx.$queryRaw`SELECT team_draft AS draft FROM rh_directory.entity WHERE tenant_id=${db.tenantId} AND id=${created.id}`);
 // Seed only rollback fixture history. Keep the real create receipt as entry 1.
 const prefix=[...stored.draft.operations,...Array.from({length:99},(_,i)=>({key:randomUUID(),actor:admin.user.accountId,operation:'save',hash:'0'.repeat(64),result:{id:created.id,version:i+2,savedAt:new Date().toISOString()}}))];
 const seeded={...stored.draft,version:100,operations:prefix};await direct(tx=>tx.$executeRaw`UPDATE rh_directory.entity SET team_draft=${JSON.stringify(seeded)}::jsonb WHERE tenant_id=${db.tenantId} AND id=${created.id}`);
 const w=await service.teamWorkspace(admin,created.id),body={expectedVersion:100,baseRevision:w.currentRevision,data:{...w.data,summary:'第101次仍可正常保存'},requestKey:randomUUID()};
 await assert.rejects(()=>service.saveTeamWorkspace(ctx('owner'),created.id,body),{status:403});
 const saved=await service.saveTeamWorkspace(admin,created.id,body);assert.equal(saved.version,101);assert.deepEqual(await service.saveTeamWorkspace(admin,created.id,body),saved);
 await assert.rejects(()=>service.saveTeamWorkspace(admin,created.id,{...body,requestKey:randomUUID()}),{code:'DIRECTORY_VERSION_CONFLICT'});
 const p=await service.previewTeamWorkspace(admin,created.id,'tenant');assert(p.canApprove,JSON.stringify(p.issues));const review={expectedVersion:101,planHash:p.planHash,audience:'tenant',reason:'合成PG回滚，不限制操作次数',requestKey:randomUUID()};
 const approved=await service.reviewTeamWorkspace(admin,created.id,review);assert.equal(approved.version,102);assert.deepEqual(await service.reviewTeamWorkspace(admin,created.id,review),approved);assert.equal((await service.teamWorkspaceReceipt(admin,created.id,input.requestKey)).result.version,1);
 const [after]=await direct(tx=>tx.$queryRaw`SELECT team_draft AS draft FROM rh_directory.entity WHERE tenant_id=${db.tenantId} AND id=${created.id}`);assert.deepEqual(after.draft.operations.slice(0,100),prefix);assert.equal(after.draft.operations.length,102);
 const last=await service.teamWorkspace(admin,created.id);
 // Above the application guard but below the independent 262144-byte DB guard.
 const largeHistory={...after.draft,operations:[...after.draft.operations,{key:randomUUID(),padding:''}]};largeHistory.operations.at(-1).padding='x'.repeat(250500-Buffer.byteLength(JSON.stringify(largeHistory)));await direct(tx=>tx.$executeRaw`UPDATE rh_directory.entity SET team_draft=${JSON.stringify(largeHistory)}::jsonb WHERE tenant_id=${db.tenantId} AND id=${created.id}`);
 await assert.rejects(()=>service.saveTeamWorkspace(admin,created.id,{expectedVersion:102,baseRevision:last.currentRevision,data:after.draft.data,requestKey:randomUUID()}),{code:'DIRECTORY_DRAFT_LIMIT'});
}));
