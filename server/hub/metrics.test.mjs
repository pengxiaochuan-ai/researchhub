import test from 'node:test';
import assert from 'node:assert/strict';
import {projectOverviewMetrics} from './metrics.mjs';

const profile=(id,kind,change={})=>({entity:{id,kind,archivedAt:null},head:{id:'a-'+id,entityId:id,assertionKey:'profile',kind:'profile',revision:1,hash:'h',payload:{name:id,directions:[]},sources:[{available:true}],decision:{decision:'approve',audience:'public',version:1},...change}});
function graph(rows){return{entities:rows.map(r=>r.entity),heads:rows.map(r=>r.head)};}
test('public indexed counts deduplicate registry keys and stable profile IDs, never count teams or accounts',()=>{
 const rows=[profile('o','organization'),profile('p','researcher'),profile('t','team')];
 const metrics=projectOverviewMetrics([
  {documentType:'clinical_registry',externalKey:'ChiCTR1'},{documentType:'clinical_registry',externalKey:'ChiCTR1'},
  {documentType:'clinical_registry',externalKey:'ChiCTR2'},
  {documentType:'research_standard',externalKey:'STD1'},{documentType:'research_standard',externalKey:'STD1'},
  {documentType:'clinical_guideline',externalKey:'GUIDE1'},
 ],graph(rows));
 assert.equal(metrics.registrations.value,2);assert.equal(metrics.guides.value,2);
 assert.equal(metrics.institutions.value,1);assert.equal(metrics.researchers.value,1);
 assert.equal(metrics.publications.value,null);assert.equal(metrics.publications.status,'unverified_scope_or_entity');
 assert.equal(metrics.registrations.scope,'CURRENT_HUB_APPROVED_PUBLIC_INDEXED');
 assert.equal(JSON.stringify(metrics).includes('a-p'),false);
});
test('private, revoked, expired, missing-source and archived profiles do not become public counts',()=>{
 const rows=[profile('o','organization'),profile('private','researcher',{decision:{decision:'approve',audience:'tenant'}}),profile('revoked','researcher',{decision:{decision:'revoke',audience:'none'}}),profile('expired','researcher',{decision:{decision:'approve',audience:'public',expiresAt:'2000-01-01T00:00:00Z'}}),profile('unavailable','organization',{sources:[{available:false}]}),profile('pending','researcher',{decision:null}),profile('archived','organization')];
 rows.at(-1).entity.archivedAt='2026-01-01';
 const metrics=projectOverviewMetrics([],graph(rows));
 assert.equal(metrics.registrations.value,0);assert.equal(metrics.guides.value,0);
 assert.equal(metrics.institutions.value,1);assert.equal(metrics.researchers.value,0);
 // A new pending head must hide the previously approved profile.
 const g=graph([profile('person','researcher')]);g.heads.push({...g.heads[0],id:'new',revision:2,decision:null});
 assert.equal(projectOverviewMetrics([],g).researchers.value,0);
});
