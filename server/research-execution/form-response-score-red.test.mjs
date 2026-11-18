import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));
require('ts-node').register({project:new URL('../../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});
const {scorePublishedFormResponse}=require('./src/study-operations/study-forms-policy.ts');

test('an unscored boolean response is unscored, never a manufactured zero',()=>{
 const schema={fields:[{key:'consent',label:'Consent',type:'boolean',required:true,score:false}]};
 const result=scorePublishedFormResponse(schema,null,{consent:false});
 assert.equal(result.complete,true);assert.equal(result.total,null);assert.equal(result.scoredCount,0);
});
test('missing optional scored values cannot become a numeric zero',()=>{
 const schema={fields:[{key:'value',label:'Value',type:'number',score:true,required:false}]};
 const result=scorePublishedFormResponse(schema,{algorithm:'numeric-sum-v1'},{});
 assert.equal(result.total,null);assert.equal(result.scoredCount,0);
});
test('an observed numeric zero is retained as zero',()=>{
 const schema={fields:[{key:'value',label:'Value',type:'number',score:true,required:true}]};
 const result=scorePublishedFormResponse(schema,{algorithm:'numeric-sum-v1'},{value:0});
 assert.equal(result.total,0);assert.equal(result.scoredCount,1);assert.equal(result.complete,true);
});

test('an unrecognized published rule remains unscored',()=>{
 const schema={fields:[{key:'v',label:'Value',type:'number',score:true,required:true}]};
 const result=scorePublishedFormResponse(schema,{algorithm:'unknown-v1'},{v:7});
 assert.equal(result.complete,true);assert.equal(result.total,null);assert.equal(result.algorithm,null);
});
test('overflow is rejected instead of converting an invalid numeric total to null',()=>{
 const schema={fields:[{key:'a',label:'A',type:'number',score:true},{key:'b',label:'B',type:'number',score:true}]};
 assert.throws(()=>scorePublishedFormResponse(schema,{algorithm:'numeric-sum-v1'},{a:1e308,b:1e308}),/FORM_SCORE_INVALID_NUMBER/);
});
test('a partial numeric sum is not presented as complete without a missing-data rule',()=>{
 const schema={fields:[{key:'a',label:'A',type:'number',score:true,required:true},{key:'b',label:'B',type:'number',score:true,required:false}]};
 const result=scorePublishedFormResponse(schema,{algorithm:'numeric-sum-v1'},{a:0});
 assert.equal(result.complete,true);assert.equal(result.total,null);assert.equal(result.scoredCount,1);
});
