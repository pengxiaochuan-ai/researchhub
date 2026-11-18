import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {compileHubQuery} from './search-query-plan.mjs';
import {AGENT_QUESTION_MAX_CHARACTERS} from '../../src/agent-question.js';
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));
export const {sql,join}=require('@prisma/client').Prisma;
const dictionary=JSON.parse(readFileSync(new URL('./search-dictionary-v1.json',import.meta.url)));
export const prepareHubQuery=q=>q==null||q===''?null:compileHubQuery(q,dictionary);
// Agent questions use their own boundary; E01 keeps the default short query.
export const prepareAgentHubQuery=q=>compileHubQuery(q,dictionary,{maxCharacters:AGENT_QUESTION_MAX_CHARACTERS});
const regexTerm=value=>{
 const escaped=value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 return /^[\x00-\x7f]+$/.test(value)?'(^|[^[:alnum:]_])'+escaped+'($|[^[:alnum:]_])':escaped;
};
export function hubQuerySql(plan,fields,identifiers=[]){
 if(!plan)return sql`true`;
 const values=sql`ARRAY[${join(fields)}]::text[]`;
 if(plan.mode==='identifier')return sql`EXISTS(SELECT 1 FROM unnest(ARRAY[${join(identifiers)}]::text[]) AS identifier(value) WHERE lower(identifier.value)=${plan.appliedTerms[0].toLowerCase()})`;
 if(plan.mode==='literal')return sql`EXISTS(SELECT 1 FROM unnest(${values}) AS field(value) WHERE position(${plan.appliedTerms[0].toLowerCase()} in lower(coalesce(field.value,'')))>0)`;
 const patterns=JSON.stringify(plan.conceptGroups.map(group=>group.terms.map(regexTerm)));
 return sql`NOT EXISTS(SELECT 1 FROM jsonb_array_elements(${patterns}::jsonb) AS concept(terms)
  WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(concept.terms) AS term(pattern)
   CROSS JOIN unnest(${values}) AS field(value) WHERE coalesce(field.value,'') ~* term.pattern))`;
}
function matchesTerm(value,term){
 const escaped=term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const pattern=/^[\x00-\x7f]+$/.test(term)?'(^|[^\\p{L}\\p{N}_])'+escaped+'($|[^\\p{L}\\p{N}_])':escaped;
 return new RegExp(pattern,'iu').test(String(value??''));
}
// Only the fixed <=20 approved PMC universe uses this bounded projection;
// workbook rows use the same groups in SQL, BEFORE LIMIT or cursors.
export function matchesHubQuery(plan,fields,identifiers=[]){
 if(!plan)return true;
 if(plan.mode==='identifier')return identifiers.some(value=>String(value??'').toLowerCase()===plan.appliedTerms[0].toLowerCase());
 if(plan.mode==='literal')return fields.some(value=>String(value??'').toLowerCase().includes(plan.appliedTerms[0].toLowerCase()));
 return plan.conceptGroups.every(group=>group.terms.some(term=>fields.some(value=>matchesTerm(value,term))));
}
export function matchingQueryTerm(plan,value){
 return plan?.appliedTerms.find(term=>plan.mode==='mapped'?matchesTerm(value,term):String(value??'').toLowerCase().includes(term.toLowerCase()))??null;
}
export function hubQueryRankSql(plan,fields){
 if(!plan||plan.mode!=='mapped')return sql`0`;
 return sql`CASE WHEN EXISTS(SELECT 1 FROM unnest(ARRAY[${join(fields)}]::text[]) AS original(value) WHERE position(${plan.originalQuery.trim().toLowerCase()} in lower(coalesce(original.value,'')))>0) THEN 0 ELSE 1 END`;
}
export function publicationRank(plan,fields){return !plan||plan.mode!=='mapped'||fields.some(value=>String(value??'').toLowerCase().includes(plan.originalQuery.trim().toLowerCase()))?0:1;}
export function publicationCursor(secret){
 if(typeof secret!=='string'||secret.length<32)throw Error('HUB_QUERY_CURSOR_SECRET_REQUIRED');
 const sign=body=>createHmac('sha256',secret).update(body).digest('base64url');
 const binding=args=>createHash('sha256').update(JSON.stringify([args.tenantId,args.hubKey,args.principal?.accountId??'anonymous',args.principal?.authVersion??null,args.audience,args.plan,args.filters??null,args.filterYear??null])).digest('hex');
 return {
  encode(args,id,rank=0){const body=Buffer.from(JSON.stringify({v:1,binding:binding(args),id,rank})).toString('base64url');return body+'.'+sign(body);},
  decode(args,token){try{if(typeof token!=='string'||token.length>2048)throw Error();const [body,sig,...rest]=token.split('.'),expected=Buffer.from(sign(body),'base64url'),actual=Buffer.from(sig??'','base64url');if(rest.length||actual.length!==expected.length||!timingSafeEqual(actual,expected))throw Error();const data=JSON.parse(Buffer.from(body,'base64url'));if(data.v!==1||data.binding!==binding(args)||![0,1].includes(data.rank)||! /^(pmc-PMC[1-9][0-9]{0,10}|rhsr-[a-f0-9]{40})$/.test(data.id))throw Error();return {id:data.id,rank:data.rank};}catch{throw Object.assign(new Error('翻页条件已变化，请从第一页重新检索'),{code:'HUB_QUERY_CURSOR_INVALID',status:400});}},
 };
}
