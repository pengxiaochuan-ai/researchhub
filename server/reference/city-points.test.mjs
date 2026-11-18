import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadCityPoints,cityReference} from './city-points.mjs';
const base=new URL('../../docs/reference/city-map-2026-11-10/',import.meta.url),manifest=JSON.parse(readFileSync(new URL('manifest.json',base)));
const read=e=>readFileSync(new URL(`wikidata/${e.entityId}-${e.revision}.json`,base));
const failure=fn=>assert.throws(fn,e=>e.code==='CITY_REFERENCE_INVALID'&&e.status===503);
test('fixed snapshots produce exactly three city reference points, no online lookup',()=>{
 const entries=loadCityPoints(manifest,read);assert.equal(entries.size,3);assert.equal(entries.get('310000').latitude,31.2325);assert.equal(entries.get('210200').reference.referenceCount,0);
 const geo={name:'北京市',region:'北京市',longitude:null,latitude:null,coordinateKind:null,division:{version:'MCA-2024-12-31',provinceCode:'110000',cityCode:'110000'}};
 assert.equal(cityReference(geo).coordinateKind,'CITY_REFERENCE');assert.equal(cityReference({...geo,longitude:0}),null);assert.equal(cityReference({...geo,name:'北京'}),null);
});
test('missing/corrupt/hash-mismatched snapshots fail explicitly, never silently guess or update',()=>{
 failure(()=>loadCityPoints(manifest,()=>{throw Error('missing');}));failure(()=>loadCityPoints(manifest,()=>Buffer.from('{}')));
});
test('manifest version, licensing, CRS, exact entity binding and division parent cannot drift',()=>{
 for(const change of [m=>m.version='future',m=>m.license='unknown',m=>m.coordinateSystem='GCJ02',m=>m.divisionVersion='future',m=>m.entries.pop(),m=>m.entries[0].entityId='Q74881',m=>m.entries[2].provinceCode='110000',m=>m.entries[2].name='大連市',m=>m.entries.push(m.entries[0])]){
  const m=structuredClone(manifest);change(m);failure(()=>loadCityPoints(m,read));
 }
});
test('even rehashed snapshots must retain declared revision, claim, globe, rank and valid coordinates',()=>{
 for(const change of [e=>e.lastrevid++,e=>e.claims.P625[0].id='other',e=>e.claims.P625[0].rank='deprecated',e=>e.claims.P625.push(e.claims.P625[0]),e=>e.claims.P625[0].mainsnak.datavalue.value.globe='http://www.wikidata.org/entity/Q111',e=>e.claims.P625[0].mainsnak.datavalue.value.latitude=91,e=>e.claims.P625[0].mainsnak.datavalue.value.precision=0]){
  const m=structuredClone(manifest),raw=JSON.parse(read(m.entries[0]));change(raw.entities.Q956);const b=Buffer.from(JSON.stringify(raw));m.entries[0].sourceSha256=createHash('sha256').update(b).digest('hex');
  failure(()=>loadCityPoints(m,e=>e.entityId==='Q956'?b:read(e)));
 }
});
