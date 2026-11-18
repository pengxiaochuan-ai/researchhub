import test from 'node:test';
import assert from 'node:assert/strict';
import {createH5Client} from '../src/questionnaire-h5-session.js';

test('all H5 POSTs provide the existing local browser proof without the invitation referrer',async()=>{
 const previousLocation=globalThis.location;
 globalThis.location=new URL('http://127.0.0.1:19501/h5/questionnaire/'+'z'.repeat(43));
 const calls=[];
 const client=createH5Client({fetchImpl:async(url,options)=>{
  calls.push({url,options});
  return {ok:true,json:async()=>({assignmentId:'synthetic-assignment'})};
 }});
 try{
  await client.start('z'.repeat(43));
  await client.write('draft',{assignmentId:'synthetic-assignment',requestKey:'synthetic-draft',expectedVersion:0,answers:{value:0}});
  await client.write('submit',{assignmentId:'synthetic-assignment',requestKey:'synthetic-submit',expectedVersion:0,answers:{value:0}});
  assert.equal(calls.length,3);
  for(const {options} of calls){
   assert.equal(options.mode,'same-origin');
   assert.equal(options.headers['X-ResearchHub-Request'],'session-v1');
   assert.equal(options.referrer,'/');
   assert.equal(options.referrerPolicy,'same-origin');
   assert(!options.referrer.includes('/h5/questionnaire/'));
  }
 }finally{
  client.invalidate();
  globalThis.location=previousLocation;
 }
});
