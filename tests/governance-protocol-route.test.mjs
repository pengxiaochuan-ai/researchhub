import test from 'node:test';
import assert from 'node:assert/strict';
import {readProtocolReviewRoute,protocolReviewHref,protocolReviewDetailHref} from '../src/governance-protocol-route.js';
import {readFormalRoute,formalBackHref,formalHeader} from '../src/formal-preparation-session.js';
import {isProtectedPage,safeSessionReturn} from '../src/session-lifecycle.js';
import {realModeRouteState} from '../src/real-mode-route.js';
test('G01 direct and history routes have a safe login roundtrip',()=>{
 assert.equal(isProtectedPage('/pages/g01/'),true);
 assert.equal(realModeRouteState('g01','',{configured:true}),'live');
 assert.deepEqual(readProtocolReviewRoute(''),{tab:'pending'});
 assert.equal(safeSessionReturn('/pages/g01/?reviewTab=processed'),'/pages/g01/?reviewTab=processed');
 for(const search of ['?reviewTab=other','?reviewTab=pending&reviewTab=processed','?returnTo=https://evil.test','?studyId=arbitrary'])assert.throws(()=>readProtocolReviewRoute(search));
 assert.equal(safeSessionReturn('/pages/g01/?reviewTab=evil'),'/pages/p01/');
 assert.equal(protocolReviewHref('processed'),'/pages/g01/?reviewTab=processed');
});
test('S07 fixed version preserves only the approved G01 list tab, never an arbitrary return URL',()=>{
 const href=protocolReviewDetailHref('study','protocol','processed'),route=readFormalRoute('s07',new URL(href,'http://local').search);
 assert.equal(formalBackHref(route),'/pages/g01/?reviewTab=processed');assert.equal(safeSessionReturn(href),href);
 assert.deepEqual(formalHeader({},'s07',new URL(href,'http://local').search).crumbs[0],['管理与治理','g01',{reviewTab:'processed'}]);
 for(const tail of ['&reviewTab=evil','&reviewTab=processed&governanceModule=ethics&governancePage=1','&reviewTab=pending&returnTo=https://evil.test','&reviewTab=pending&reviewTab=processed'])assert.throws(()=>readFormalRoute('s07','?formalPreparation=1&studyId=s&protocolId=p'+tail));
});
