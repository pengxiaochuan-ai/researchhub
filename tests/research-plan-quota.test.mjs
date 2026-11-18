import test from 'node:test';
import assert from 'node:assert/strict';
import * as form from '../src/research-plan-form.js';
test('AI generation rejects missing/unknown/insufficient quota but ignores obsolete development caps',()=>{
 assert.equal(typeof form.canGenerateResearchPlan,'function');
 for(const quota of [undefined,{canStart:false,code:'TOKEN_QUOTA_UNAVAILABLE'},{canStart:false,code:'TOKEN_QUOTA_EXCEEDED'}])assert.equal(form.canGenerateResearchPlan({quota}),false);
 assert.equal(form.canGenerateResearchPlan({quota:{canStart:true},budget:{blocked:true,expired:true}}),true);
});
