import test from 'node:test';
import assert from 'node:assert/strict';
import {File} from 'node:buffer';
import {createEeglabEnvelope,validEeglabName} from '../src/eeglab-envelope.js';
const file=(name,text='synthetic')=>new File([text],name);
test('envelope is deterministic STORE ZIP with unchanged member names and bytes',async()=>{
 const a=await createEeglabEnvelope([file('sample.fdt','float-data'),file('sample.set','mat-data')]);
 const b=await createEeglabEnvelope([file('sample.set','mat-data'),file('sample.fdt','float-data')]);
 assert.equal(a.name,'eeglab-originals.eeglab');assert.equal(a.type,'application/zip');
 const bytes=Buffer.from(await a.arrayBuffer());assert.deepEqual(bytes,Buffer.from(await b.arrayBuffer()));
 let offset=0;for(const [name,value]of[['sample.set','mat-data'],['sample.fdt','float-data']]){
  assert.equal(bytes.readUInt32LE(offset),0x04034b50);assert.equal(bytes.readUInt16LE(offset+8),0);
  const n=bytes.readUInt16LE(offset+26),size=bytes.readUInt32LE(offset+18);
  assert.equal(bytes.subarray(offset+30,offset+30+n).toString(),name);
  assert.equal(bytes.subarray(offset+30+n,offset+30+n+size).toString(),value);offset+=30+n+size;
 }assert.equal(bytes.readUInt32LE(offset),0x02014b50);
});
test('one SET works; missing, duplicate, arbitrary zip and unsafe members fail before reads',async()=>{
 assert.equal((await createEeglabEnvelope([file('合成.SET')])).type,'application/zip');
 for(const files of [[file('x.fdt')],[file('x.set'),file('y.set')],[file('x.zip')],[file('../x.set')],[file('x.set'),file('x.fdt'),file('y.fdt')],[file('x.set'),file('a.txt')]])await assert.rejects(createEeglabEnvelope(files));
 for(const name of ['../x.set','a\\b.fdt','a..b.set','x:1.set','x\u0000.set',' x.set','x.set ','CON.set'])assert.equal(validEeglabName(name),false,name);
});
test('resource bounds and identity/permission cancellation block packaging',async()=>{
 await assert.rejects(createEeglabEnvelope([{name:'x.set',size:100*1024*1024+1}]));
 await assert.rejects(createEeglabEnvelope([{name:'x.set',size:1},{name:'x.fdt',size:500*1024*1024}]));
 let calls=0;await assert.rejects(createEeglabEnvelope([file('x.set')],{current:async()=>++calls<2}),/会话|权限/);
});
