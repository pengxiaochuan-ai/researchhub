import test from 'node:test';import assert from 'node:assert/strict';
const api=await import('./ai-research-data-general-scope.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const ids={tenant:'t',group:'g',owner:'o',admin:'a'},config=()=>({schema:'hub-general-unit-local-scope.v1',scopeKey:'general-unit-20261113',accounts:{owner:'o',admin:'a'},target:{studyId:'new-study',studyGroupId:'g',executionProjectId:'new-project'},sessions:{o:'cmwevnq180005lu2arv5lqab9',a:'cmwevnzrb000dlu2a2qm8k5ao'},expiresAt:'2026-11-20T07:36:52.684Z',registeredObjects:{o:{subjectIds:['os1','os2'],visitIds:['ov1','ov2']},a:{subjectIds:['as1','as2'],visitIds:['av1','av2']}}});
test('new unit scope accepts only the two named sources and four disjoint objects',()=>{
 assert.equal(typeof api.validateGeneralUnitScope,'function');assert.equal(api.validateGeneralUnitScope(config(),ids).target.studyId,'new-study');
 for(const edit of [c=>c.sessions.o='other',c=>c.registeredObjects.o.subjectIds.push('extra'),c=>c.registeredObjects.a.subjectIds[0]='os1',c=>c.expiresAt='2026-11-21T00:00:00Z',c=>c.target.studyGroupId='foreign']){const c=config();edit(c);assert.throws(()=>api.validateGeneralUnitScope(c,ids));}
});
test('new scope import adapter cannot create extra subjects or write another actor object',()=>{
 const c=config(),base={mode:'visit_form',rows:[{subjectCode:'GENERAL-UNIT-OWNER-A'}]};
 assert.doesNotThrow(()=>api.assertGeneralUnitRows(c,{accountId:'o'},base));
 c.sessions={a:c.sessions.a,o:c.sessions.o};assert.doesNotThrow(()=>api.assertGeneralUnitRows(c,{accountId:'o'},base));
 for(const m of [{...base,mode:'subjects'},{...base,rows:[{subjectCode:'GENERAL-UNIT-ADMIN-A'}]},{...base,rows:[{subjectCode:'GENERAL-UNIT-OWNER-C'}]}])assert.throws(()=>api.assertGeneralUnitRows(c,{accountId:'o'},m));
});
test('a syntactically valid replacement Study or registered object cannot replace the installed registry',()=>{
 const c=config(),m={purpose:'general-unit-write-2026-11-13',syntheticOnly:true,scopeKey:c.scopeKey,target:c.target,config:structuredClone(c)};
 assert.doesNotThrow(()=>api.assertGeneralUnitManifest(c,m));
 for(const edit of [x=>x.target.studyId='another-study',x=>x.target.executionProjectId='another-project',x=>x.registeredObjects.o.subjectIds[0]='another-subject']){const x=structuredClone(c);edit(x);assert.throws(()=>api.assertGeneralUnitManifest(x,m));}
});
