import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractDivisions,divisionOptions,validateLocation,DATASET_VERSION,SOURCE_SHA256} from './divisions.mjs';
const rows=()=>extractDivisions(readFileSync(new URL('../../docs/reference/china-administrative-divisions/mca-2024.html',import.meta.url)));
test('official pinned MCA snapshot has 3213 unique units and 34 provinces, no invented municipality grouping',()=>{
 const data=rows();assert.equal(data.length,3213);assert.equal(new Set(data.map(x=>x.code)).size,3213);assert.equal(data.filter(x=>x.level===1).length,34);assert(!data.some(x=>x.code==='110100'));
 assert.equal(data.find(x=>x.code==='419001').name,'济源市');assert.equal(data.find(x=>x.code==='419001').sourceName,'济源市*');
 assert(data.every(x=>x.level===1||data.some(p=>p.code===x.parentCode)));
 assert.equal(DATASET_VERSION,'MCA-2024-12-31');assert.equal(SOURCE_SHA256.length,64);
});
test('province-to-city options preserve municipalities, direct administered cities, and no invented HK/Taiwan children',()=>{
 const data=rows();assert.equal(divisionOptions(data).length,34);assert.deepEqual(divisionOptions(data,'110000').map(x=>x.code),['110000']);
 assert(divisionOptions(data,'410000').some(x=>x.code==='419001'));assert(!divisionOptions(data,'130000').some(x=>x.code==='130102'));
 for(const p of ['710000','810000','820000'])assert.equal(divisionOptions(data,p).length,0);
 assert.throws(()=>divisionOptions(data,'130100'));assert.throws(()=>divisionOptions(data,'__proto__'));
});
test('selection validates exact version, parent/name and retains only source-backed codes',()=>{
 const data=rows(),location={version:DATASET_VERSION,provinceCode:'130000',cityCode:'130100'};
 assert.deepEqual(validateLocation(data,location),{location,region:'河北省',city:'石家庄市'});
 assert.equal(validateLocation(data,{...location,provinceCode:'110000',cityCode:'110000'}).city,'北京市');
 assert.equal(validateLocation(data,{...location,provinceCode:'810000',cityCode:null}).city,'香港特别行政区');
 assert.equal(validateLocation(data,{...location,cityCode:null}).city,'');
 for(const value of [{...location,version:'latest'},{...location,provinceCode:'110000'},{...location,cityCode:'130102'},{...location,tenantId:'foreign'}])assert.throws(()=>validateLocation(data,value));
});
test('wrong or changed raw source is rejected instead of a partial reference import',()=>{
 const raw=readFileSync(new URL('../../docs/reference/china-administrative-divisions/mca-2024.html',import.meta.url));assert.throws(()=>extractDivisions(Buffer.concat([raw,Buffer.from('changed')])));
});
