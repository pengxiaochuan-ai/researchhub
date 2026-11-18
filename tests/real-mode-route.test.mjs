import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { realModeRouteState, REAL_MODE_ROUTE_IDS } from '../src/real-mode-route.js';

const pages=JSON.parse(readFileSync(new URL('../platform-pages.json',import.meta.url))).pages;
test('every registered page has an explicit real-mode classification',()=>{
  assert.equal(pages.length,52);
  assert.deepEqual(new Set(REAL_MODE_ROUTE_IDS),new Set(pages.map(page=>page.id)));
});
test('a configured real session never falls into fixed demo research without explicit demo choice',()=>{
  const real={configured:true,explicitDemo:false};
  for(const page of ['s01','s02','s08'])assert.equal(realModeRouteState(page,'',real),'pending',page);
  for(const page of ['h01','h05','e01','e02','g02','c01','c03','h06'])assert.equal(realModeRouteState(page,'',real),'live',page);
  for(const page of ['q01','s03','s06','s07','a02'])assert.equal(realModeRouteState(page,'',real),'pending',page);
  assert.equal(realModeRouteState('p01','',real),'live');
  assert.equal(realModeRouteState('k01','',real),'live');
  assert.equal(realModeRouteState('q02','',real),'entry');
  assert.equal(realModeRouteState('a01','',real),'entry');
  assert.equal(realModeRouteState('ai01','',real),'entry');
  assert.equal(realModeRouteState('s11','',real),'live');
  assert.equal(realModeRouteState('q02','?designWorkspace=1&studyGroupId=g1&researchProjectId=p1',real),'live');
  assert.equal(realModeRouteState('a02','?crfMethodAssets=1',real),'live');
  assert.equal(realModeRouteState('q02','?projectId=DEMO',real),'pending');
});
test('public pages remain public and explicit demonstration remains available',()=>{
  const real={configured:true,explicitDemo:false};
  assert.equal(realModeRouteState('p002','',real),'public');
  assert.equal(realModeRouteState('p003','',real),'auth');
  assert.equal(realModeRouteState('h01','',{configured:true,explicitDemo:true}),'demo');
  assert.equal(realModeRouteState('h01','',{configured:false,explicitDemo:false}),'demo');
});
