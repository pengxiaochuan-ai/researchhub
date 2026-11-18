import test from 'node:test';
import assert from 'node:assert/strict';

test('H01 V2 count includes the two confirmed secondary-outcome papers, not all thirteen source candidates',async()=>{
 const r=await fetch('http://127.0.0.1:19501/api/hubs/lingshu-xinyu/overview');assert.equal(r.status,200);
 const {metrics}=await r.json(),m=metrics.publications;
 assert.equal(m.value,11);assert.equal(m.pendingVisibleCount,0);assert.equal(m.excludedVisibleCount,2);
 assert.equal(m.ruleVersion,'RH-PAPER-BROAD-2026-11-10-V2');
 assert.equal(m.included.length,11);assert.equal(new Set(m.included.map(x=>x.paperKey)).size,11);
 assert.equal(m.byType.animal_mechanism,2);assert.equal(m.byType.bibliometric,1);
 assert(m.included.every(x=>x.sources.every(s=>s.sourceUrl&&s.evidence.length)));
 for(const id of ['pmc-PMC13550960','pmc-PMC13637160'])assert(m.included.some(x=>x.sources.some(s=>s.recordId===id)));
 assert(!m.included.some(x=>x.sources.some(s=>['pmc-PMC13522945','pmc-PMC13565737'].includes(s.recordId))));
 assert.equal(metrics.registrations.value,2);assert.equal(metrics.guides.value,3);
});
