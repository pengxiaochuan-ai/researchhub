import {test} from 'node:test';import assert from 'node:assert/strict';
import {normalizeDraft,operationPayload,canonicalContent} from './contract.mjs';
import {mutationHash} from './service.mjs';
test('shared operation payload is deterministic on normalized draft round trips and does not permit caller resource identities',()=>{
 const input={title:'最小草稿',resources:[{label:'资料',url:'https://example.org/view',rights:'已确认'}]},normalized=normalizeDraft(input);
 assert.deepEqual(normalizeDraft(normalized),normalized);
 assert.equal(mutationHash('save','content',{draft:input,requestKey:'same-key',baseRevision:1}),mutationHash('save','content',{requestKey:'same-key',baseRevision:1,draft:normalized}));
 assert.throws(()=>normalizeDraft({...normalized,resources:[{...normalized.resources[0],key:'different-version'}]}));
 assert.equal(operationPayload('create',null,{requestKey:'same-key',draft:input}).contentId,null);
 assert.equal(operationPayload('withdraw','content',{requestKey:'same-key',baseRevision:1,reason:' 核对 '}).body.reason,'核对');
 assert.equal(canonicalContent({b:2,a:{d:4,c:3}}),'{"a":{"c":3,"d":4},"b":2}');
});
