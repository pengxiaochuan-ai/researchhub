import test from 'node:test';
import assert from 'node:assert/strict';
import {projectOverviewSources} from './overview-sources.mjs';

test('overview combines both public source kinds in catalog ID order with bounded preview and full record count',()=>{
 const pmc=Array.from({length:13},(_,i)=>({id:'pmc-PMC'+String(100+i),title:'Paper '+i,doi:'10.1234/shared',body:'Not needed in overview',tables:['omit'],assets:['omit'],abstract:'omit',sourceName:'PubMed Central',reviewVersion:'article:1'}));
 const workbook={items:[{id:'rhsr-'+'a'.repeat(40),title:'Workbook',doi:'10.1234/shared'}],recordCount:5};
 const result=projectOverviewSources(workbook,pmc.toReversed());
 assert.equal(result.recordCount,18);assert.equal(result.items.length,6);
 assert.deepEqual(result.items.map(x=>x.id),pmc.slice(0,6).map(x=>x.id));
 assert(result.items.every(x=>x.doi==='10.1234/shared'));
 for(const item of result.items)for(const key of ['body','tables','assets','abstract'])assert(!Object.hasOwn(item,key));
 assert.deepEqual(projectOverviewSources({items:[],recordCount:0},[]),{items:[],recordCount:0});
 const mixed=projectOverviewSources(workbook,pmc.slice(0,1));assert.equal(mixed.recordCount,6);assert.equal(mixed.items.length,2);assert.equal(mixed.items[1].title,'Workbook');
});
