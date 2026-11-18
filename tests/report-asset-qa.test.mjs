import test from 'node:test';import assert from 'node:assert/strict';
import {readReportQaRoute,reportQaHref,reportQaRequestAllowed,reportQaCitationHref,readReportQaCitation,reportQaLoginCandidate} from '../src/report-asset-qa.js';
import {safeSessionReturn} from '../src/session-lifecycle.js';
import {safeAuthenticatedReturnTo} from '../src/route-context.js';
test('report entry and fixed quote links cannot inject another route, duplicate context or remote return',()=>{
 const scope={studyGroupId:'g',researchProjectId:'p'},href=reportQaHref(scope,'asset',2);assert.deepEqual(readReportQaRoute(href.split('?')[1]),{assetId:'asset',version:2,scope});
 for(const q of [href.split('?')[1]+'&version=3',href.split('?')[1]+'&returnTo=https://other.test',href.split('?')[1].replace('version=2','version=02')])assert(readReportQaRoute(q).invalid);
 assert.equal(readReportQaRoute('?sessionId=s'),null);
 assert(reportQaRequestAllowed('POST','/research-assets/asset/versions/2/report-qa/search'));assert(!reportQaRequestAllowed('POST','/research-assets/asset/versions/2/report-qa/search?extra=1'));
 const e={id:'rf-0001-aaaaaaaaaaaa',quoteHash:'a'.repeat(64),startLine:3,endLine:9},link=reportQaCitationHref(scope,'asset',2,e);assert.deepEqual(readReportQaCitation('#'+link.split('#')[1]),e);assert(readReportQaCitation('#'+link.split('#')[1]+'&returnTo=https://other.test').invalid);
 assert.equal(safeSessionReturn(href),href);assert.equal(safeSessionReturn(link),link);assert.equal(safeSessionReturn(href+'&returnTo=https://other.test'),'/pages/p01/');assert.equal(safeSessionReturn(href+'#token=secret'),'/pages/p01/');assert.equal(safeSessionReturn(link+'&token=secret'),'/pages/p01/');
 assert.equal(safeAuthenticatedReturnTo(href),href);assert.equal(safeAuthenticatedReturnTo(link),link);assert.equal(safeAuthenticatedReturnTo(href+'&returnTo=https://other.test'),'/pages/p01/');
 const u=new URL(link,'http://hub.local');assert.equal(reportQaLoginCandidate(u),link);assert.equal(reportQaLoginCandidate({pathname:'/pages/a02/',search:'',hash:'#token=secret'}),'/pages/a02/');assert.equal(reportQaLoginCandidate({pathname:'/pages/p01/',search:'',hash:u.hash}),'/pages/p01/');
});
