import test from 'node:test';
import assert from 'node:assert/strict';
import {studyDataHref,subjectDataHref,studyDataAiHref,studyDataReturnHref,studyDataHistoryHref,acceptStudyDataContext,selectMediaDataContext} from '../src/study-data-navigation.js';
import {readArticleAiRoute,hubAiHref} from '../src/article-ai-session.js';
import {safeAuthenticatedReturnTo} from '../src/route-context.js';
import {safeSessionReturn} from '../src/session-lifecycle.js';
import {requiresStudyUpload} from '../src/research-data-upload-intent.js';
const context={studyId:'study',subjectId:'subject',visitId:'visit'};
test('study data uses existing protected pages with hash-only data anchors',()=>{
 assert.equal(studyDataHref('study'),'/pages/s03/?formalSubjects=1&studyId=study#study-data');
 assert.equal(subjectDataHref('study','subject'),'/pages/s04/?formalSubjects=1&studyId=study&subjectId=subject#subject-data');
 assert.equal(studyDataReturnHref(context),'/pages/s09/?formalCapture=1&studyId=study&visitId=visit#capture-files');
 for(const href of [studyDataHref('study'),subjectDataHref('study','subject'),studyDataReturnHref(context)]){assert.equal(safeAuthenticatedReturnTo(href),href);assert.equal(safeSessionReturn(href),href);assert(!safeSessionReturn(href.replace(/#.*$/,'#untrusted-token')).includes('#'));}
 for(const bad of [{subjectId:'subject'},{studyId:'study',visitId:'visit'},{...context,studyId:'../other'},{...context,returnTo:'https://other.test'}])assert.throws(()=>studyDataAiHref(bad));
});
test('AI acquisition hierarchy survives login/session expiry/new session without accepting foreign modes',()=>{
 const href=studyDataAiHref(context),expected='/pages/ai01/?uploadStudyId=study&uploadSubjectId=subject&uploadVisitId=visit';
 assert.equal(href,expected);assert.deepEqual(readArticleAiRoute(new URL(href,'http://local').search),{kind:'hub',uploadStudyId:'study',uploadSubjectId:'subject',uploadVisitId:'visit'});
 assert.equal(safeAuthenticatedReturnTo(href),href);assert.equal(safeSessionReturn(href),href);
 const next=hubAiHref('session','study',{uploadSubjectId:'subject',uploadVisitId:'visit'});assert.equal(safeSessionReturn(next),next);
 for(const q of ['?uploadSubjectId=subject','?uploadStudyId=study&uploadVisitId=visit','?uploadStudyId=study&uploadSubjectId=subject&uploadSubjectId=other','?uploadStudyId=study&articleId=pmc-PMC1','?uploadStudyId=study&returnTo=https://evil.test'])assert.equal(readArticleAiRoute(q).kind,'invalid',q);
});
test('navigation IDs become current context only after Study/subject/visit parents are rechecked',()=>{
 const study={item:{study:{id:'study'},project:{title:'合成研究'}}},subject={subject:{id:'subject',subjectId:'SYNTH-1'},visits:[{id:'visit',visitPlan:{name:'V1'}}]};
 assert.deepEqual(acceptStudyDataContext(context,study,subject),{...context,studyName:'合成研究',subjectCode:'SYNTH-1',visitName:'V1'});
 for(const [s,p]of [[{item:{study:{id:'other'},project:{title:'other'}}},subject],[study,{...subject,subject:{id:'other'}}],[study,{...subject,visits:[]}],[study.item,subject]] )assert.throws(()=>acceptStudyDataContext(context,s,p));
});
test('reopening this session retains acquisition context; selecting another history does not inherit it',()=>{
 const route={kind:'hub',sessionId:'same',uploadStudyId:'study',uploadSubjectId:'subject',uploadVisitId:'visit'};
 assert.equal(studyDataHistoryHref('same',route),hubAiHref('same','study',{uploadSubjectId:'subject',uploadVisitId:'visit'}));
 assert.equal(studyDataHistoryHref('another',route),'/pages/ai01/?sessionId=another');
});
test('media defaults use current native targets and never silently fall back from an explicit lost parent',()=>{
 const targets=[{id:'study',subjects:[{id:'subject',visits:[{id:'visit'}]},{id:'another',visits:[]}]}];
 assert.deepEqual(selectMediaDataContext(targets,context),context);
 assert.deepEqual(selectMediaDataContext(targets,null),{studyId:'study',subjectId:'',visitId:''});
 for(const c of [{...context,studyId:'other'},{...context,subjectId:'another'},{...context,visitId:'other'}])assert.throws(()=>selectMediaDataContext(targets,c));
});
test('research-entry CSV keeps the checked Study upload intent while ordinary CSV and documents retain their behavior',()=>{
 assert.equal(requiresStudyUpload([{name:'observations.csv'}],null,'study'),true);
 assert.equal(requiresStudyUpload([{name:'observations.csv'}],null),false);
 assert.equal(requiresStudyUpload([{name:'notes.pdf'}],null,'study'),false);
});
