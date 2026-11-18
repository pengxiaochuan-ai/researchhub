import {test} from 'node:test';import assert from 'node:assert/strict';
import {syntheticRunUrl} from '../src/synthetic-quality-form.js';
import * as nav from '../src/synthetic-quality-form.js';
test('a new saved plan version clears only obsolete run/report selection and never rebinds historical results',()=>{assert.equal(typeof nav.reconcileSyntheticPlan,'function');const href='http://127.0.0.1:19501/pages/q01/?researchPlanId=p&studyGroupId=g&researchProjectId=r&syntheticRunId=old&syntheticReportVersion=2#quality';const same=nav.reconcileSyntheticPlan(href,7,7);assert.equal(same.changed,false);const moved=nav.reconcileSyntheticPlan(href,7,8);assert.equal(moved.changed,true);const url=new URL(moved.href);assert.equal(url.searchParams.has('syntheticRunId'),false);assert.equal(url.searchParams.has('syntheticReportVersion'),false);assert.equal(url.searchParams.get('researchPlanId'),'p');assert.equal(url.hash,'#quality');});
test('new or selected synthetic run drops only the previous report version and keeps study/plan context',()=>{
 const href='http://127.0.0.1:19501/pages/q01/?researchPlanId=p&studyGroupId=g&researchProjectId=r&syntheticRunId=old&syntheticReportVersion=2#quality';
 const url=syntheticRunUrl(href,'next');
 assert.equal(url.searchParams.get('syntheticRunId'),'next');assert.equal(url.searchParams.has('syntheticReportVersion'),false);
 for(const[k,v]of[['researchPlanId','p'],['studyGroupId','g'],['researchProjectId','r']])assert.equal(url.searchParams.get(k),v);
 assert.equal(url.hash,'#quality');assert.equal(url.origin,'http://127.0.0.1:19501');
 assert.equal(syntheticRunUrl(url.href,'next').href,url.href);
});
