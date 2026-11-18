import test from 'node:test';
import assert from 'node:assert/strict';
import { realEntryLinks } from '../src/real-entry-links.js';

const user={displayName:'合成科研人员',studyGroups:[{id:'g1',name:'合成研究组',researchProjects:[{id:'p1',name:'针灸合成Study'}]}]};
test('real entry links derive only from current authenticated Study membership',()=>{
  const design=realEntryLinks(user,'design');
  assert.equal(design.length,1);
  assert.equal(design[0].url,'/pages/q02/?designWorkspace=1&studyGroupId=g1&researchProjectId=p1');
  const assets=realEntryLinks(user,'assets');
  assert.equal(assets[0].url,'/pages/a01/?crfMethodAssets=1&studyGroupId=g1&researchProjectId=p1');
  assert.deepEqual(realEntryLinks({...user,studyGroups:[]},'design'),[]);
});
test('AI entry offers existing grounded capabilities without fabricated answer or cross-Study link',()=>{
  const links=realEntryLinks(user,'ai');
  assert(links.some(item=>item.url==='/pages/k01/'));
  assert(links.some(item=>item.url.includes('studyGroupId=g1&researchProjectId=p1')));
  assert(!links.some(item=>item.url.includes('g2')));
  assert.deepEqual(realEntryLinks({...user,studyGroups:[]},'assets'),[]);
});
