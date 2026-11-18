import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {REFERENCE_ROWS,validateLocation} from './divisions.mjs';

const base=new URL('../../docs/reference/city-map-2026-11-10/',import.meta.url);
const version='RH-CITY-REFERENCE-2026-11-10',usage='NATIONAL_OVERVIEW_APPROXIMATE_CITY_REFERENCE_NOT_TEAM_ADDRESS';
// Explicitly reviewed three-city binding, not fuzzy geocoding or code truncation.
const bindings={110000:['Q956','110000','北京市','北京市','Q148'],310000:['Q8686','310000','上海市','上海市','Q148'],210200:['Q74881','210000','大连市','辽宁省','Q43934']};
const invalid=()=>{throw Object.assign(new Error('城市参考位置暂不可用，请稍后重试。'),{code:'CITY_REFERENCE_INVALID',status:503});};
export function loadCityPoints(manifest,readSnapshot){
 try{
  if(manifest.version!==version||manifest.divisionVersion!=='MCA-2024-12-31'||manifest.license!=='CC0-1.0'||manifest.coordinateSystem!=='WGS84'||manifest.usage!==usage||manifest.entries.length!==3)invalid();
  const points=new Map();
  for(const row of manifest.entries){
   const binding=bindings[row.cityCode];if(!binding||points.has(row.cityCode)||JSON.stringify(binding.slice(0,4))!==JSON.stringify([row.entityId,row.provinceCode,row.name,row.region])||!Number.isSafeInteger(row.revision))invalid();
   const location=validateLocation(REFERENCE_ROWS,{version:manifest.divisionVersion,provinceCode:row.provinceCode,cityCode:row.cityCode});if(location.city!==row.name||location.region!==row.region)invalid();
   const raw=readSnapshot(row);if(createHash('sha256').update(raw).digest('hex')!==row.sourceSha256)invalid();
   const entity=JSON.parse(raw).entities[row.entityId];
   if(entity.id!==row.entityId||entity.lastrevid!==row.revision||entity.labels['zh-cn']?.value!==row.name)invalid();
   const hasEntity=(property,id)=>(entity.claims[property]??[]).some(c=>c.rank!=='deprecated'&&c.mainsnak?.datavalue?.value?.id===id);
   if(!hasEntity('P17','Q148')||!hasEntity('P131',binding[4]))invalid();
   const claims=(entity.claims.P625??[]).filter(c=>c.rank!=='deprecated');
   if(claims.length!==1||claims[0].id!==row.statementId||claims[0].mainsnak?.datatype!=='globe-coordinate')invalid();
   const c=claims[0],v=c.mainsnak.datavalue?.value;
   if(!v||v.globe!=='http://www.wikidata.org/entity/Q2'||!Number.isFinite(v.longitude)||Math.abs(v.longitude)>180||!Number.isFinite(v.latitude)||Math.abs(v.latitude)>90||!Number.isFinite(v.precision)||v.precision<=0||v.precision>1)invalid();
   points.set(row.cityCode,Object.freeze({city:row.name,cityCode:row.cityCode,region:row.region,regionCode:row.provinceCode,longitude:v.longitude,latitude:v.latitude,coordinateKind:'CITY_REFERENCE',reference:Object.freeze({datasetVersion:version,sourceUrl:`https://www.wikidata.org/wiki/Special:EntityData/${row.entityId}.json?revision=${row.revision}`,entityId:row.entityId,revision:row.revision,statementId:row.statementId,sourceSha256:row.sourceSha256,coordinateSystem:'WGS84',precision:v.precision,referenceCount:c.references?.length??0,usage})}));
  }
  return points;
 }catch{invalid();}
}
let points,catalogError;
try{points=loadCityPoints(JSON.parse(readFileSync(new URL('manifest.json',base))),row=>readFileSync(new URL(`wikidata/${row.entityId}-${row.revision}.json`,base)));}catch(e){catalogError=e;}
export function assertCityReferenceReady(){if(catalogError)throw catalogError;}
export function cityReference(geo){
 assertCityReferenceReady();
 if(!geo||geo.longitude!==null||geo.latitude!==null||geo.coordinateKind!==null||!geo.division)return null;
 let location;try{location=validateLocation(REFERENCE_ROWS,geo.division);}catch{return null;}
 if(location.city!==geo.name||location.region!==geo.region)return null;
 return points.get(location.location.cityCode)??null;
}
