import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projectPublicationIndex,normalizeDoi} from './publication-index.mjs';
const row=(id,doi='10.1234/one',changes={})=>({id,title:'Acupuncture for depression',year:2026,doi,articleVersion:id+'.1',rawSha256:'a'.repeat(64),sourceUrl:'https://example.org/'+id,visibility:'public',abstract:'A direct depression acupuncture study.',...changes});
const assessment=(r,decision='include',type='human_clinical')=>({recordId:r.id,title:r.title,doi:r.doi,articleVersion:r.articleVersion,rawSha256:r.rawSha256,decision,type,reason:'独立合成主题核对',evidence:[{field:'title',quote:'Acupuncture for depression'},{field:'abstract',quote:'direct depression acupuncture study'}]});
test('confirmed secondary-outcome cases enter V2 without admitting excluded or unknown background records',()=>{
 const manifest=JSON.parse(readFileSync(new URL('./publication-assessments.json',import.meta.url),'utf8'));
 const rows=manifest.entries.map(e=>({...e,id:e.recordId,visibility:'public',year:2026,abstract:e.evidence.filter(x=>x.field==='abstract').map(x=>x.quote).join(' ')}));
 const m=projectPublicationIndex(rows);
 assert.equal(m.value,11);assert.equal(m.pendingVisibleCount,0);assert.equal(m.excludedVisibleCount,2);
 assert.equal(m.ruleVersion,'RH-PAPER-BROAD-2026-11-10-V2');
 for(const id of ['pmc-PMC13550960','pmc-PMC13637160']){
  const entry=manifest.entries.find(e=>e.recordId===id);
  assert.equal(entry.decisionAuthority,'user-confirmed-secondary-outcomes-2026-11-10');
  assert(m.included.some(p=>p.sources.some(s=>s.recordId===id)));
  const changed=rows.map(r=>r.id===id?{...r,abstract:null}:r);
  assert.equal(projectPublicationIndex(changed).value,10);assert.equal(projectPublicationIndex(changed).pendingVisibleCount,1);
 }
 assert.equal(m.byType.case_report,2);assert.equal(m.byType.protocol,1);
 const unknown=row('pmc-PMC9999','10.1234/background',{title:'Pain rehabilitation with mood background'});
 const withUnknown=projectPublicationIndex([...rows,unknown]);assert.equal(withUnknown.value,11);assert.equal(withUnknown.pendingVisibleCount,1);
});
test('DOI normalization and exact DOI/PMCID alias bridge deduplicate across sources without deleting provenance',()=>{
 assert.equal(normalizeDoi(' DOI: 10.1234/ONE '),'10.1234/one');assert.equal(normalizeDoi('https://doi.org/10.1234/ONE'),'10.1234/one');
 for(const value of ['not-a-doi','10.12/bad','https://evil.test/10.1234/ONE',null])assert.equal(normalizeDoi(value),null);
 const a=row('pmc-PMC123'),b=row('rhsr-other','https://doi.org/10.1234/ONE'),c=row('source-no-doi',null,{pmcid:'PMC123'});
 const m=projectPublicationIndex([a,b,c],[assessment(a)]);
 assert.equal(m.value,1);assert.equal(m.pendingVisibleCount,0);assert.equal(m.included[0].sources.length,3);assert.equal(m.included[0].paperKey,'doi:10.1234/one');
 const separate=row('pmc-PMC124','10.1234/correction');assert.equal(projectPublicationIndex([a,separate],[assessment(a),assessment(separate)]).value,2);
});
test('identifier or metadata conflicts become pending instead of merging unrelated papers',()=>{
 const a=row('pmc-PMC123'),otherDoi=row('other','10.1234/other',{pmcid:'PMC123'});
 assert.equal(projectPublicationIndex([a,otherDoi],[assessment(a)]).value,0);
 const otherPmc=row('pmc-PMC124',a.doi);
 const pmcConflict=projectPublicationIndex([a,otherPmc],[assessment(a)]);
 assert.equal(pmcConflict.value,0);assert.equal(pmcConflict.pendingVisibleCount,1);
 for(const change of [{title:'A different article'},{year:2025}]){
  const m=projectPublicationIndex([a,row('other',a.doi,change)],[assessment(a)]);assert.equal(m.value,0);assert.equal(m.pendingVisibleCount,1);
 }
 const noId=row('anonymous',null);assert.equal(projectPublicationIndex([noId],[assessment(noId)]).value,0);
 const pmcOnly=row('pmc-PMC125',null);assert.equal(projectPublicationIndex([pmcOnly],[assessment(pmcOnly)]).value,1);
});
test('current version/hash/visible evidence is required; private, unknown and conflicting assessments do not inherit inclusion',()=>{
 const a=row('pmc-PMC123'),pin=assessment(a);
 for(const change of [{articleVersion:a.id+'.2'},{rawSha256:'b'.repeat(64)},{abstract:null},{title:'Changed title'},{doi:'10.1234/changed'}]){
  const m=projectPublicationIndex([{...a,...change}],[pin]);assert.equal(m.value,0);assert.equal(m.pendingVisibleCount,1);
 }
 assert.equal(projectPublicationIndex([{...a,visibility:'tenant'}],[pin]).value,0);
 assert.equal(projectPublicationIndex([a],[]).pendingVisibleCount,1);
 assert.equal(projectPublicationIndex([a],[pin,{...pin,decision:'exclude'}]).value,0);
 const excluded=projectPublicationIndex([a],[assessment(a,'exclude')]);assert.equal(excluded.value,0);assert.equal(excluded.excludedVisibleCount,1);
 const pending=projectPublicationIndex([a],[assessment(a,'pending')]);assert.equal(pending.value,0);assert.equal(pending.pendingVisibleCount,1);
});
