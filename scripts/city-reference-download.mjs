// Download the three user-approved CC0 entity revisions only. No credentials,
// arbitrary URLs, retries, DB writes or automatic promotion into runtime data.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
const entries=[['Q956',2565775546,'北京市'],['Q8686',2554225580,'上海市'],['Q74881',2548806680,'大连市']];
assert.equal(process.argv[2],'--capture-three-approved-cities');
const directory=new URL('../docs/reference/city-map-2026-11-10/',import.meta.url),out=new URL('wikidata/',directory);mkdirSync(out,{recursive:true});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),receipt=[];
for(const [id,revision,name] of entries){
 const url=`https://www.wikidata.org/wiki/Special:EntityData/${id}.json?revision=${revision}`,file=new URL(`${id}-${revision}.json`,out);let bytes;
 if(existsSync(file))bytes=readFileSync(file);
 else{
  const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'ResearchHub-city-reference-review/1.0'}});assert.equal(r.status,200,'Source access must succeed without workaround');
  const chunks=[];let size=0;for await(const chunk of r.body){size+=chunk.length;if(size>2*1024*1024){await r.body.cancel().catch(()=>{});throw Error('CITY_SOURCE_TOO_LARGE');}chunks.push(chunk);}bytes=Buffer.concat(chunks);
 }
 const entity=JSON.parse(bytes).entities?.[id];assert.equal(entity?.id,id);assert.equal(entity.lastrevid,revision);assert.equal((entity.labels['zh-cn']??entity.labels.zh)?.value,name);
 const claims=(entity.claims.P625??[]).filter(c=>c.rank!=='deprecated'&&c.mainsnak?.snaktype==='value');assert.equal(claims.length,1,'Ambiguous coordinates require review, not first-item selection');
 const claim=claims[0],point=claim.mainsnak.datavalue?.value;assert.equal(point.globe,'http://www.wikidata.org/entity/Q2');assert(Number.isFinite(point.latitude)&&Number.isFinite(point.longitude));
 if(!existsSync(file))writeFileSync(file,bytes,{flag:'wx'});
 receipt.push({id,revision,name,sourceUrl:url,sourceSha256:sha(bytes),statementId:claim.id,point,referenceCount:claim.references?.length??0});
}
const receiptFile=new URL('download-receipt.json',directory),result={retrievedAt:new Date().toISOString(),license:'CC0-1.0',licenseUrl:'https://www.wikidata.org/wiki/Wikidata:Copyright',entries:receipt};
if(!existsSync(receiptFile))writeFileSync(receiptFile,JSON.stringify(result,null,2),{flag:'wx'});
console.log(JSON.stringify({captured:receipt.length,filesReused:receipt.map(x=>x.id),entries:receipt}));
