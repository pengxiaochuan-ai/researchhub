import test from 'node:test';
import assert from 'node:assert/strict';
import {mapDirectory} from './read-model.mjs';
const q={page:1,pageSize:10,sort:'relevance'};
const team=(city,region,provinceCode,cityCode)=>({id:city,name:city,city,region,aliases:[],directions:[],affiliations:[],leads:[],geo:{name:city,region,longitude:null,latitude:null,coordinateKind:null,division:{version:'MCA-2024-12-31',provinceCode,cityCode}}});
const bj=()=>team('北京市','北京市','110000','110000');
const dl=()=>team('大连市','辽宁省','210000','210200');
test('three approved reference cities retain source identity, precision and original profile values',()=>{
 const items=[bj(),dl(),team('上海市','上海市','310000','310000')],before=structuredClone(items),m=mapDirectory(items,q,'unchanged');
 assert.equal(m.cities.length,3);assert.deepEqual(m.regions,[]);assert.equal(m.mappedTeamCount,3);assert.equal(m.dataRevision,'unchanged');assert.deepEqual(items,before);
 const d=m.cities.find(p=>p.cityCode==='210200');assert.equal(d.city,'大连市');assert.equal(d.coordinateKind,'CITY_REFERENCE');assert.equal(d.longitude,121.6);assert.equal(d.latitude,38.9);
 assert.equal(d.reference.revision,2548806680);assert.equal(d.reference.referenceCount,0);assert.equal(d.reference.precision,1/60);assert.equal(d.reference.coordinateSystem,'WGS84');assert.match(d.reference.sourceSha256,/^[a-f0-9]{64}$/);
});
test('explicit source coordinates never inherit or merge with the city reference location',()=>{
 const a=bj();a.id='explicit';Object.assign(a.geo,{longitude:116.42,latitude:39.92,coordinateKind:'SOURCE_LOCATION'});
 const m=mapDirectory([a,bj(),dl()],q,'r');assert.equal(m.mappedTeamCount,3);assert.equal(m.cities.length,3);
 assert.equal(m.cities.find(p=>p.coordinateKind==='SOURCE_LOCATION').longitude,116.42);
 assert.equal(m.cities.filter(p=>p.city==='北京市').length,2);assert.equal(m.cities.find(p=>p.cityCode==='110000').longitude,116.407526);
});
test('unlisted but valid city still uses the province fallback, while text-only data does not geocode',()=>{
 const s=team('沈阳市','辽宁省','210000','210100'),bad=dl();bad.geo.division=null;
 const m=mapDirectory([s,bad],q,'r');assert.deepEqual(m.cities,[]);assert.equal(m.regionMappedTeamCount,1);assert.equal(m.unmappedTeamCount,1);assert.equal(m.regions[0].regionCode,'210000');
});
