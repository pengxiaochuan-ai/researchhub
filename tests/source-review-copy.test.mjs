import test from 'node:test';
import assert from 'node:assert/strict';
import * as queue from '../src/source-review-queue.js';
import {loadGovernanceItems} from '../src/governance-overview.js';
const now=Date.parse('2026-11-12T00:00:00Z');
const decision=(fieldKind,purpose='display',extra={})=>({fieldKind,purpose,decision:'approve',audience:'public',expiresAt:null,evidenceRef:'https://example.org/review',...extra});
const item=(decisions,extra={})=>({key:'external:guideline-1',kind:'external',title:'指南',state:{status:'partial',label:'待统一核对'},detail:{decisions,...extra}});
const copy=(x)=>{assert.equal(typeof queue.sourceReviewCopy,'function');return queue.sourceReviewCopy(x,now);};
test('overview explains a display-approved guideline with no AI approval without changing its pending action',async()=>{
 const x=item([decision('bibliographic'),decision('guidance_clauses')],{guidanceExtraction:{review:decision('guidance_clauses')}});
 const [row]=await loadGovernanceItems('sources','pending',{sourceRequest:async()=>({items:[x]})});
 assert.match(row.reason,/页面展示已批准（公开）/);assert.match(row.reason,/AI检索尚未授权/);
 assert.equal(row.status,'partial');assert.equal(row.disposition,'action');assert.equal(row.actionLabel,'审核');
 assert.equal(queue.isDecidedReview(x),false);assert.equal(queue.isPendingReview(x),true);
});
test('tenant-only and mixed display decisions never become a public approval',()=>{
 const tenant=copy(item([decision('bibliographic','display',{audience:'tenant'})]));
 assert.match(tenant.summary,/仅本租户/);assert.doesNotMatch(tenant.summary,/（公开）/);
 const mixed=copy(item([decision('bibliographic'),decision('guidance_clauses','display',{audience:'tenant'})],{guidanceExtraction:{review:decision('guidance_clauses','display',{audience:'tenant'})}}));
 assert.match(mixed.summary,/部分内容已有展示批准|展示范围需确认/);assert.doesNotMatch(mixed.summary,/页面展示已批准（公开）/);
});
test('expired, revoked, and invalid expiry approvals are not presented as effective',()=>{
 for(const expiresAt of ['2020-01-01T00:00:00Z','invalid'])assert.doesNotMatch(copy(item([decision('bibliographic','display',{expiresAt})])).summary,/页面展示已批准/);
 const revoked=copy(item([decision('bibliographic'),decision('bibliographic','ai_retrieval',{decision:'revoke'})]));assert.match(revoked.summary,/AI检索已撤回/);
 const expired=copy(item([decision('bibliographic'),decision('bibliographic','ai_retrieval',{expiresAt:'2020-01-01T00:00:00Z'})]));assert.match(expired.summary,/AI检索授权已过期/);
});
test('missing or stale extraction decisions and differing unified snapshot references do not overstate display',()=>{
 const unified=decision('bibliographic','display',{evidenceRef:'evidence://hub-review/op/hash'});
 for(const detail of [{guidanceExtraction:{}},{guidanceExtraction:{review:decision('guidance_clauses')}}]){
  const c=copy(item([unified,decision('guidance_clauses')],detail));assert.doesNotMatch(c.summary,/页面展示已批准（公开）/);
 }
});
test('AI approvals in partial records remain qualified rather than claiming all current content is retrievable',()=>{
 const c=copy(item([decision('bibliographic'),decision('bibliographic','ai_retrieval')]));
 assert.match(c.summary,/AI检索已有批准/);assert.match(c.summary,/当前内容范围待确认/);
 assert.doesNotMatch(c.summary,/AI检索尚未授权/);
});
test('registry display-only snapshot mismatch cannot claim all current page content has been approved',()=>{
 const base=decision('bibliographic','display',{evidenceRef:'evidence://hub-display/operation-a/snapshot-a'});
 const stale=decision('registry_details','display',{evidenceRef:'evidence://hub-display/operation-b/snapshot-b'});
 const c=copy(item([base,stale],{structuredExtraction:{review:stale}}));
 assert.doesNotMatch(c.summary,/页面展示已批准（公开）/);assert.match(c.summary,/部分内容已有展示批准/);
 const current={...stale,evidenceRef:base.evidenceRef};
 assert.match(copy(item([base,current],{structuredExtraction:{review:current}})).summary,/页面展示已批准（公开）/);
});
test('workbook overlap and missing evidence retain an honest unresolved explanation',()=>{
 for(const x of [{kind:'workbook',state:{status:'partial',label:'含单行决定，待统一核对'},detail:{decisions:[decision('bibliographic')]}},item([]),item([decision('bibliographic'),decision('bibliographic')])]){
  const c=copy(x);assert.doesNotMatch(c.summary,/页面展示已批准（公开）/);assert.match(c.summary,/核对|确认/);
 }
});
test('already decided or newly pending states keep their existing labels and review actions',()=>{
 for(const status of ['public','tenant','withheld','public_display','pending','changed','unavailable']){
  const x={kind:'external',state:{status,label:'existing-'+status},detail:{decisions:[]}};const c=copy(x);
  assert.equal(c.label,'existing-'+status);assert.equal(c.summary,'');
 }
});
