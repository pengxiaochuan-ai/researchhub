import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateDirectorySourceLock,directorySourceLockHash} from '../../scripts/directory-source-lock-schema.mjs';
test('source-lock extension rejects missing, changed, public-executable and overloaded functions',()=>{
 assert.equal(evaluateDirectorySourceLock({functions:[],receipt:null},directorySourceLockHash),'new');
 const s={functions:[{name:'hold_source_for_commit',signature:'text, text, text, text, text',definer:true,publicExecute:false,appExecute:true}],fingerprint:'f',receipt:{version:1,sha256:directorySourceLockHash,fingerprint:'f'}};assert.equal(evaluateDirectorySourceLock(s,directorySourceLockHash),'existing');
 for(const bad of [{...s,receipt:null},{...s,fingerprint:'x'},{...s,functions:[{...s.functions[0],publicExecute:true}]},{...s,functions:[...s.functions,...s.functions]}])assert.throws(()=>evaluateDirectorySourceLock(bad,directorySourceLockHash));
});
