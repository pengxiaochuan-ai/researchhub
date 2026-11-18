import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {REFERENCE_ROWS,validateLocation} from '../reference/divisions.mjs';

// Use the same bundled geography as T01's outline. These are region display
// anchors, not geocoded team/city addresses; never persist them into profiles.
const raw=readFileSync(new URL('../../pages/h01/src/china.json',import.meta.url));
export const mapReference=Object.freeze({kind:'BUNDLED_BASEMAP',sha256:createHash('sha256').update(raw).digest('hex')});
const regions=new Map(JSON.parse(raw).features.filter(f=>f.properties.level==='province').map(({properties:p})=>[String(p.adcode),p]));
export function regionAnchor(geo){
 if(!geo||geo.longitude!==null||geo.latitude!==null||geo.coordinateKind!==null||!geo.division)return null;
 let location;try{location=validateLocation(REFERENCE_ROWS,geo.division);}catch{return null;}
 if(!location.city||location.city!==geo.name||location.region!==geo.region)return null;
 const p=regions.get(location.location.provinceCode),point=p?.centroid??p?.center;
 if(p?.name!==location.region||!Array.isArray(point)||point.length!==2||!point.every(Number.isFinite))return null;
 return {region:p.name,regionCode:String(p.adcode),longitude:point[0],latitude:point[1],coordinateKind:'REGION_ANCHOR'};
}
