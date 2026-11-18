import test from 'node:test';
import assert from 'node:assert/strict';
import {displayScore} from '../src/formal-capture-session.js';
const algorithm='fang-2023-table5-v1',fields=[{key:'menses',label:'月经不调'},{key:'tongue',label:'舌象类别是否成立'}];
test('unresolved table5 policies never expose a numeric total even when all fields were answered',()=>{
 for(const [processingStatus,text]of[['awaiting_policy','待规则确认，未计算总分'],['incomplete_data','资料不完整，未计算总分'],['review_required','脉象需复核，未计算总分']]){
  const value=displayScore({algorithm,complete:true,scoreComplete:false,processingStatus,total:30,classification:'positive'});
  assert.equal(value,text);assert(!value.includes('30'));assert(!value.includes('符合'));
 }
});
test('unscored N/A and uncertain items are traced by fixed source labels without raw keys or JSON',()=>{
 const value=displayScore({algorithm,complete:true,scoreComplete:false,total:null,classification:null,processingStatus:'incomplete_data',unresolvedItems:[{key:'menses',status:'not_applicable'},{key:'tongue',status:'uncertain'},{key:'unlisted_internal_key',status:'missing'}]},fields);
 assert.equal(value,'资料不完整，未计算总分；月经不调：不适用；舌象类别是否成立：无法判断');
 assert(!value.includes('unlisted_internal_key'));assert(!value.includes('not_applicable'));
});
test('a scored total does not override a negative server composition or classification',()=>{
 const value=displayScore({algorithm,complete:true,scoreComplete:true,processingStatus:'scored',total:30,classification:'negative',diagnosis:false,thresholdMet:true,composition:{primary:false,secondary:true,tongueOrPulse:true}});
 assert.equal(value,'总分30；达到20分阈值；主症组合：未满足；次症组合：满足；舌/脉类别：满足；本量表判定：不符合');
});
test('positive table5 output requires complete typed server results and is never computed from a total',()=>{
 const score={algorithm,complete:true,scoreComplete:true,processingStatus:'scored',total:24,classification:'positive',diagnosis:true,thresholdMet:true,composition:{primary:true,secondary:true,tongueOrPulse:true}};
 assert.match(displayScore(score),/本量表判定：符合$/);
 for(const bad of [{...score,scoreComplete:false},{...score,classification:null},{...score,composition:null},{...score,diagnosis:false},{...score,processingStatus:'unknown'},{...score,processingStatus:'toString'}])assert.equal(displayScore(bad),'计分结果暂不可核验');
});
test('legacy numeric sums retain their display and unknown algorithms never acquire table5 classification text',()=>{
 assert.equal(displayScore({algorithm:'numeric-sum-v1',total:0}),'0');assert.equal(displayScore(null),'未计分');
 assert.equal(displayScore({algorithm:'another-rule',total:30,classification:'positive',processingStatus:'scored'}),'30');
});
test('unavailable schema metadata cannot crash an unresolved score or expose internal field codes',()=>{
 assert.equal(displayScore({algorithm,processingStatus:'incomplete_data',unresolvedItems:[null,{key:'hidden',status:'not_applicable'}]},null),'资料不完整，未计算总分');
});
