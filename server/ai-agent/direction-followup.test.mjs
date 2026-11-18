import test from 'node:test';import assert from 'node:assert/strict';
import {buildDirectionFacts,checkDirectionText} from './direction-consistency.mjs';
const fact=text=>buildDirectionFacts([{id:'P1',title:'Completed intervention study',text}]);
const check=(text,facts)=>checkDirectionText(text,{facts,sourceIds:['P1'],sourceLabels:new Map([['P1','文献一']])});
test('survey timepoints are recognized without turning a future protocol into observed assessments',()=>{
 const text='Healthcare professionals were invited to complete an online survey 1 week before the workshop and 3 months afterwards.';
 const f=fact(text);assert.equal(f.sources[0].followUp.state,'reported');assert(f.sources[0].quotes.some(q=>q.text===text));
 assert.equal(fact('Participants will be invited to complete an online survey at baseline and 3 months afterwards.').sources[0].followUp.state,'not-mentioned');
 assert.equal(fact('Participants attended a three-month program. An online survey was available.').sources[0].followUp.state,'not-mentioned');
 for(const text of ['Participants did not complete an online survey at baseline and three months after treatment.','Participants were not invited to complete an online survey at baseline and three months after treatment.','No participants completed a survey at baseline and three months after treatment.','Participants might complete an online survey at baseline and three months after treatment.'])assert.equal(fact(text).sources[0].followUp.state,'not-mentioned',text);
});
test('decimal points never discard the original assessment sentence or its location',()=>{
 for(const p of ['P < .001','P < 0.001','P = 0.05']){
  const sentence='Perceived stress, measured with a validated scale, decreased from baseline to 1 and 3 months ('+p+').';
  const text='BACKGROUND: Context. '+sentence+' Results were discussed.';
  const f=fact(text);assert.equal(f.sources[0].followUp.state,'reported');const q=f.sources[0].quotes.find(q=>q.text.includes('Perceived stress'));assert(q);assert.equal(q.text.trim(),sentence);assert.equal(text.slice(q.offset,q.offset+q.text.length),q.text);assert(q.hash);
 }
});
test('not-mentioned synonyms conflict with real assessment times, while caution and missing duration remain possible',()=>{
 const f=fact('Outcomes were assessed at baseline and three months after treatment.');
 for(const text of ['未提及随访。','未提到随访时间。','摘要未提及随访评估。']){const x=check(text,f);assert.equal(x.text,'');assert(x.issues.some(i=>i.code==='FOLLOW_UP_OVERGENERALIZED'));}
 assert.equal(check('不能断言未提及随访。建议核对全文。',f).text,'不能断言未提及随访。建议核对全文。');
 const unknown=fact('Outcomes improved during the follow-up period.');assert.equal(check('当前摘要未提及具体随访时长。',unknown).text,'当前摘要未提及具体随访时长。');
 assert.equal(check('当前摘要不足以判断干预结束后的随访安排。',f).text,'当前摘要不足以判断干预结束后的随访安排。');
});
