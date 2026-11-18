import test from 'node:test';
import assert from 'node:assert/strict';
import {readLastAssetStudy,rememberAssetStudy,forgetAssetStudy,lastAssetStudyKey} from '../src/research-assets-study-memory.js';
const user={tenantId:'tenant-one',accountId:'owner'},a={studyGroupId:'group-a',researchProjectId:'study-a'},b={studyGroupId:'group-b',researchProjectId:'study-b'};
const store=()=>{const values=new Map();return{values,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};};
test('remembers only a successful current scope and restores it from current authorized scopes',()=>{
 const storage=store();assert.equal(readLastAssetStudy(storage,user,[a,b]),null);assert.equal(rememberAssetStudy(storage,user,a,[a,b]),true);assert.deepEqual(readLastAssetStudy(storage,user,[a,b]),a);
 assert.deepEqual(JSON.parse([...storage.values.values()][0]),{version:1,...a});
 assert.equal(rememberAssetStudy(storage,user,{...a,researchProjectId:'foreign'},[a,b]),false);assert.deepEqual(readLastAssetStudy(storage,user,[a,b]),a);
});
test('account and tenant keys cannot restore each other or share delimiters',()=>{
 const storage=store();rememberAssetStudy(storage,user,a,[a,b]);for(const actor of [{...user,accountId:'admin'},{...user,tenantId:'tenant-two'}])assert.equal(readLastAssetStudy(storage,actor,[a,b]),null);
 assert.equal(lastAssetStudyKey({tenantId:'a:b',accountId:'c'}),null);assert.equal(lastAssetStudyKey({tenantId:'a',accountId:'b:c'}),null);
});
test('withdrawn or malformed records are discarded, never used as authorization',()=>{
 const storage=store();rememberAssetStudy(storage,user,a,[a]);assert.equal(readLastAssetStudy(storage,user,[b]),null);assert.equal(storage.values.size,0);
 for(const raw of ['not-json','null','[]',JSON.stringify({version:99,...a}),JSON.stringify({version:1,...a,token:'unexpected'}),JSON.stringify({version:1,...a,studyGroupId:'../unsafe'})]){storage.setItem(lastAssetStudyKey(user),raw);assert.equal(readLastAssetStudy(storage,user,[a]),null);assert.equal(storage.values.size,0);}
});
test('storage read/write/remove errors do not block the original page',()=>{
 const broken={getItem(){throw Error('disabled');},setItem(){throw Error('quota');},removeItem(){throw Error('disabled');}};
 assert.equal(readLastAssetStudy(broken,user,[a]),null);assert.equal(rememberAssetStudy(broken,user,a,[a]),false);assert.doesNotThrow(()=>forgetAssetStudy(broken,user));assert.equal(readLastAssetStudy(null,user,[a]),null);
});
test('denial clears only the matching saved Study; explicit clear removes any saved choice',()=>{
 const storage=store();rememberAssetStudy(storage,user,a,[a,b]);forgetAssetStudy(storage,user,b);assert.deepEqual(readLastAssetStudy(storage,user,[a,b]),a);forgetAssetStudy(storage,user,a);assert.equal(readLastAssetStudy(storage,user,[a,b]),null);
 rememberAssetStudy(storage,user,b,[a,b]);forgetAssetStudy(storage,user);assert.equal(storage.values.size,0);
});
test('missing real identity never reads or writes a choice',()=>{
 const storage=store();for(const actor of [null,{}, {...user,accountId:''}]){assert.equal(lastAssetStudyKey(actor),null);assert.equal(readLastAssetStudy(storage,actor,[a]),null);assert.equal(rememberAssetStudy(storage,actor,a,[a]),false);}assert.equal(storage.values.size,0);
});
