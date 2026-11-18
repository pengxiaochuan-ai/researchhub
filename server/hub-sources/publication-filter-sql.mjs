import {sql,join} from './search-projection.mjs';
import {CLASSIFICATION_VERSION} from './publication-classification.mjs';
import {PUBLICATION_FACETS,facetChoices,YEAR_CHOICES,FULLTEXT_CHOICES,normalizePublicationFilters} from '../../src/publication-filters.js';

// Derivations may use only the current allowed title/abstract. Metadata follows
// bibliographic approval. No body/references-derived labels or count side channel.
export function classificationValuesSql(stored,hash,title,abstract){
 const valid=sql`(${stored}->>'extractorVersion'=${CLASSIFICATION_VERSION} AND ${stored}->>'sourceHash'=${hash} AND ${stored}->>'schemaVersion'='1')`;
 const claims=sql`jsonb_array_elements(CASE WHEN ${valid} AND jsonb_typeof(${stored}->'claims')='array' THEN ${stored}->'claims' ELSE '[]'::jsonb END)`;
 const pairs=[];
 for(const key of Object.keys(PUBLICATION_FACETS)){
  const allowed=PUBLICATION_FACETS[key].map(([v])=>v);
  pairs.push(sql`${key}`,sql`coalesce((SELECT jsonb_agg(DISTINCT claim->>'value') FROM ${claims} claim WHERE claim->>'facet'=${key} AND claim->>'value'=ANY(${allowed}::text[]) AND length(claim->>'quote')>0 AND
   (claim->>'field'='metadata' OR (claim->>'field'='title' AND position(claim->>'quote' in ${title})>0) OR (claim->>'field'='abstract' AND position(claim->>'quote' in ${abstract})>0))),'[]'::jsonb)`);
 }
 return sql`jsonb_build_object(${join(pairs)})`;
}
export function filterSql(fields,filters,except=null,year=new Date().getUTCFullYear()){
 const conditions=[];
 for(const key of Object.keys(PUBLICATION_FACETS)){
  if(key===except||!filters[key]?.length)continue;
  const actual=sql`coalesce(${fields.values}->${key},'[]'::jsonb)`;
  const options=filters[key].map(v=>v==='unknown'?sql`jsonb_array_length(${actual})=0`:sql`${actual} ? ${v}`);
  conditions.push(sql`(${join(options,' OR ')})`);
 }
 if(except!=='fulltext'&&filters.fulltext!=='any')conditions.push(sql`${fields.readable}=${filters.fulltext==='readable'}`);
 if(except!=='year'&&filters.year!=='any'){
  const knownYear=sql`CASE WHEN ${fields.year}::text ~ '^(18|19|20|21)[0-9]{2}$|^2200$' THEN ${fields.year}::text ELSE NULL END`;
  const start=sql`coalesce(${fields.date}->>0,${knownYear}||'-01-01')`,end=sql`coalesce(${fields.date}->>1,${knownYear}||'-12-31')`;
  const from=filters.year==='custom'?filters.from:String(year-Number(filters.year)+1)+'-01-01';
  const to=filters.year==='custom'?filters.to:String(year)+'-12-31';
  conditions.push(sql`${start} IS NOT NULL`);if(from)conditions.push(sql`${start}>=${from}`);if(to)conditions.push(sql`${end}<=${to}`);
 }
 return conditions.length?sql`(${join(conditions,' AND ')})`:sql`true`;
}
export function facetCountsSql(fields,filters){
 const defaults=normalizePublicationFilters(),groups={...Object.fromEntries(Object.keys(PUBLICATION_FACETS).map(k=>[k,facetChoices(k)])),year:YEAR_CHOICES.filter(([v])=>v!=='custom'),fulltext:FULLTEXT_CHOICES};
 const pairs=[];
 for(const [key,options] of Object.entries(groups)){
  const counts=[];
  for(const [value] of options){const own={...defaults,[key]:key==='year'||key==='fulltext'?value:[value]};
   counts.push(sql`${value}`,sql`(count(*) FILTER(WHERE ${filterSql(fields,filters,key)} AND ${filterSql(fields,own)}))::integer`);
  }
  pairs.push(sql`${key}`,sql`jsonb_build_object(${join(counts)})`);
 }
 return sql`jsonb_build_object(${join(pairs)})`;
}
