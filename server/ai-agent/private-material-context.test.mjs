import test from'node:test';import assert from'node:assert/strict';import{privateMaterialContext,isPrivateMaterialSession,parsePrivateMaterialContext,privateMaterialLegacySession}from'./private-material-context.mjs';import{materialDigest}from'./session-material-contract.mjs';
const origin='hub:lingshu-xinyu:conversation:12345678-1234-4234-8234-123456789012';
test('private context binds real session and preserves a canonical original Hub context, never an article or external scope',()=>{
 const s={id:'session-1',channel:'knowledge',contextKey:privateMaterialContext('session-1',origin)};assert(isPrivateMaterialSession(s));assert.equal(parsePrivateMaterialContext(s).originalContextKey,origin);
 for(const v of[{...s,id:'other'},{...s,channel:'research'},{...s,contextKey:'hub:lingshu-xinyu'},{...s,contextKey:s.contextKey+':forged'}])assert.equal(isPrivateMaterialSession(v),false);
 for(const v of['../other','kb:private','hub-article:v1:source'])assert.throws(()=>privateMaterialContext('session-1',v));
 assert(isPrivateMaterialSession({...s,contextKey:privateMaterialContext(s.id,'hub:lingshu-xinyu')}));
});
test('only the unchanged historical context hash gets a read-only legacy view; new receipts and saved context remain intact',()=>{
 const s={id:'session',channel:'knowledge',contextKey:privateMaterialContext('session',origin)},stored={session:{id:s.id,contextHash:materialDigest(origin)}};
 const view=privateMaterialLegacySession(s,stored,materialDigest);assert.equal(view.contextKey,origin);assert.notEqual(view,s);assert(isPrivateMaterialSession(s));assert.equal(privateMaterialLegacySession(s,{session:{id:'other',contextHash:stored.session.contextHash}},materialDigest),s);
});
