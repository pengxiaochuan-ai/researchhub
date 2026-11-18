import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,symlinkSync,unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createUiFreezeGuard} from './research-t18-ui-freeze-guard.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
function fixture(fn){const root=mkdtempSync(join(tmpdir(),'rh-t18-ui-proof-'));try{mkdirSync(join(root,'researchhub'));const source=join(root,'researchhub','one.js'),manifest=join(root,'researchhub','manifest.json');writeFileSync(source,'original');const value={syntheticOnly:true,businessWriteWindowClosed:true,sources:[{path:'one.js',sha256:hash('original')}]},bytes=JSON.stringify(value);writeFileSync(manifest,bytes);return fn({root,source,manifest,value,options:{workspaceRoot:root,manifestFile:manifest,manifestSha256:hash(bytes)}});}finally{rmSync(root,{recursive:true,force:true});}}
test('reviewed bytes pass; a later source edit stops and is never adopted',()=>fixture(({source,options})=>{const guard=createUiFreezeGuard(options);assert(guard());writeFileSync(source,'changed');assert.throws(guard,/UI_SOURCE_CHANGED_STOP_BEFORE_WRITE/);assert.throws(guard,/UI_SOURCE_CHANGED_STOP_BEFORE_WRITE/);}));
test('changing proof after construction stops before any source can be adopted',()=>fixture(({manifest,value,options})=>{const guard=createUiFreezeGuard(options);writeFileSync(manifest,JSON.stringify({...value,extra:true}));assert.throws(guard,/UI_FREEZE_PROOF_CHANGED/);}));
test('proof hash must match before construction',()=>fixture(({options})=>{assert.throws(()=>createUiFreezeGuard({...options,manifestSha256:'0'.repeat(64)}),/UI_FREEZE_PROOF_CHANGED/);}));
test('source paths cannot read another workspace subtree',()=>fixture(({manifest,value,options})=>{value.sources[0].path='../outside.js';const bytes=JSON.stringify(value);writeFileSync(manifest,bytes);assert.throws(()=>createUiFreezeGuard({...options,manifestSha256:hash(bytes)}),/UI_FREEZE_SOURCE_OUTSIDE_PROJECT/);}));
test('source symlinks cannot escape the Hub project',()=>fixture(({root,source,options})=>{const other=join(root,'outside.js');writeFileSync(other,'original');unlinkSync(source);symlinkSync(other,source);assert.throws(()=>createUiFreezeGuard(options),/UI_FREEZE_SOURCE_OUTSIDE_PROJECT/);}));
test('manifest symlinks cannot escape the Hub project',()=>fixture(({root,manifest,options})=>{const other=join(root,'outside.json');writeFileSync(other,'{}');unlinkSync(manifest);symlinkSync(other,manifest);assert.throws(()=>createUiFreezeGuard(options),/UI_FREEZE_OUTSIDE_PROJECT/);}));
test('a new symlink after construction also stops before reading bytes',()=>fixture(({root,source,options})=>{const guard=createUiFreezeGuard(options),other=join(root,'outside.js');writeFileSync(other,'original');unlinkSync(source);symlinkSync(other,source);assert.throws(guard,/UI_FREEZE_SOURCE_PATH_CHANGED/);}));
