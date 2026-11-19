import test from 'node:test';
import assert from 'node:assert/strict';
import {HELP_ARTICLES,HELP_CATEGORIES,HELP_STATUS,getHelpArticle,searchHelpArticles} from '../pages/shared/help-content.js';
import {readResearchProjectRoute} from '../src/research-projects-session.js';
import {readAcademicRoute} from '../src/academic-content-route.js';

test('help retains legacy article links and provides explicit availability for every topic',()=>{
 assert.equal(HELP_ARTICLES.length,26);
 assert.equal(new Set(HELP_ARTICLES.map(a=>a.id)).size,HELP_ARTICLES.length);
 for(const id of ['start','account','draft','asset','ai','team'])assert.ok(getHelpArticle(id),id);
 for(const a of HELP_ARTICLES){assert.ok(HELP_CATEGORIES.includes(a.category));assert.ok(HELP_STATUS[a.status]);assert.ok(a.summary&&a.audience);assert.ok(a.sections.length);}
});
test('search includes keywords and full steps, supports case and combined terms',()=>{
 assert.ok(searchHelpArticles('  pico  ').some(a=>a.id==='draft'));
 assert.deepEqual(searchHelpArticles('Word 更正').map(a=>a.id),['reports']);
 assert.ok(searchHelpArticles('入会').some(a=>a.id==='account'));
 assert.ok(searchHelpArticles('被试').some(a=>a.id==='capture'));
 assert.equal(searchHelpArticles('    ').length,HELP_ARTICLES.length);
 assert.deepEqual(searchHelpArticles('[.*'),[]);
});
test('category and query intersect rather than ignoring either filter',()=>{
 const result=searchHelpArticles('审核','管理与治理');
 assert.ok(result.length);assert.ok(result.every(a=>a.category==='管理与治理'));
 assert.equal(searchHelpArticles('Word','功能规划').length,0);
 assert.equal(searchHelpArticles('','不存在').length,0);
 assert.equal(searchHelpArticles('尚未开放').length,3);
});
test('planned topics remain informational and never offer an execution action',()=>{
 const planned=HELP_ARTICLES.filter(a=>a.status==='planned');assert.equal(planned.length,3);
 for(const a of planned){assert.equal(a.category,'功能规划');assert.equal(a.action,undefined);}
 assert.equal(getHelpArticle('unknown'),undefined);
});
test('task actions use existing station routes without fixed research or test identifiers',()=>{
 for(const a of HELP_ARTICLES){if(!a.action)continue;assert.match(a.action.href,/^\/pages\/[a-z0-9]+\//);assert.ok(!/[<>\\]/.test(a.action.href));assert.ok(!/studyId=|researchProjectId=|studyGroupId=|recordId=|contentId=/.test(a.action.href));}
 const creation=new URL(getHelpArticle('draft').action.href,'http://help.local');assert.equal(readResearchProjectRoute('q01',creation.search).kind,'creation');
 const publish=new URL(getHelpArticle('publish').action.href,'http://help.local');assert.equal(readAcademicRoute('g02',publish.search).management,true);
});
