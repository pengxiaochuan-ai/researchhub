import {readArticleOriginal} from './article-asset-reader.mjs';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {getCurrentPmcAiHit} from './pmc-visible.mjs';
import {parsePmcReading} from './pmc-reading.mjs';
import {assertHubPublicationSources} from './agent-retrieval.mjs';
import {selectArticleEvidenceV2} from './article-selection-v2.mjs';

const prefix='hub-article:v1:',policyVersion='rh-article-evidence-v1';
const hash=value=>createHash('sha256').update(value).digest('hex');
const seal=value=>hash(JSON.stringify(value));
const normalize=value=>String(value??'').replace(/\s+/g,' ').trim();
const fail=code=>{throw Object.assign(new Error(code),{code,status:code.includes('INSUFFICIENT')?422:code==='ARTICLE_SOURCE_UNAVAILABLE'?404:code.includes('INVALID')?400:409});};
const fields=['recordId','articleVersion','rawSha256','reviewVersion'];
const reviewFields=['aiReviewVersion','abstractDisplayVersion','abstractAiReviewVersion',
  'bodyDisplayVersion','bodyAiReviewVersion','tableDisplayVersion','tableAiReviewVersion'];

export function articleBinding(item){
  const b={recordId:item.id,articleVersion:item.articleVersion,rawSha256:item.rawSha256,reviewVersion:item.reviewVersion};
  articleContextKey(b);return b;
}
export function articleContextKey(b){
  if(!b||Object.keys(b).length!==4||!fields.every(k=>typeof b[k]==='string')||
    !/^pmc-PMC[1-9][0-9]{0,10}$/.test(b.recordId)||
    !new RegExp('^'+b.recordId.slice(4)+'[.][1-9][0-9]{0,2}$').test(b.articleVersion)||
    !/^[a-f0-9]{64}$/.test(b.rawSha256)||! /^(?:article:)?[1-9][0-9]{0,18}$/.test(b.reviewVersion))fail('ARTICLE_BINDING_INVALID');
  const key=prefix+Buffer.from(JSON.stringify(Object.fromEntries(fields.map(k=>[k,b[k]])))).toString('base64url');
  if(Buffer.byteLength(key)>768)fail('ARTICLE_BINDING_INVALID');return key;
}
export function parseArticleContext(key){
  if(typeof key!=='string'||!key.startsWith('hub-article:'))return null;
  try{if(!key.startsWith(prefix)||Buffer.byteLength(key)>768)throw Error();
    const b=JSON.parse(Buffer.from(key.slice(prefix.length),'base64url').toString('utf8'));
    if(articleContextKey(b)!==key)throw Error();return b;
  }catch{fail('ARTICLE_CONTEXT_INVALID');}
}

function bodyParagraphs(reading,body){
  const result=[];let cursor=0;
  const inline=nodes=>(nodes??[]).map(n=>n.text??(n.content?inline(n.content):'')).join('');
  function walk(nodes,section=''){
    for(const n of nodes??[]){if(n.type==='section')walk(n.children,n.title||section);
      else if(n.type==='list')for(const children of n.items??[])walk(children,section);
      else if(n.type==='p'||n.type==='pre'){
        const text=normalize(n.text??inline(n.content)),offset=text?body.indexOf(text,cursor):-1;
        // Only exact current-field matches earn a JATS anchor; no guessed pages/offsets.
        if(offset>=0){result.push({offset,text,locator:{kind:'jats',anchor:n.id,section}});cursor=offset+text.length;}
      }}
  }walk(reading?.blocks);return result;
}
function buildArticleEvidenceV1(item,reading=null){
  const binding=articleBinding(item);
  if(!item.body||!item.bodyDisplayVersion||!item.bodyAiReviewVersion)fail('ARTICLE_EVIDENCE_INSUFFICIENT');
  const text={abstract:item.abstract&&item.abstractDisplayVersion&&item.abstractAiReviewVersion?normalize(item.abstract):'',
    body:normalize(item.body),table:item.tables?.length&&item.tableDisplayVersion&&item.tableAiReviewVersion?normalize(JSON.stringify(item.tables)):''};
  const fragments=[],candidates=[];
  const add=(field,offset=0,locator={kind:'field-offset'},length=1200)=>candidates.push({field,offset,locator,length});
  if(text.abstract)add('abstract');
  const paragraphs=bodyParagraphs(reading,text.body),selected=new Set();
  const sectionRules={methods:/method|participant|material|方法|对象/i,results:/result|finding|结果/i,discussion:/discuss|limit|conclu|讨论|局限|结论/i};
  for(const pattern of Object.values(sectionRules)){
    const p=paragraphs.find(p=>pattern.test(p.locator.section)&&!selected.has(p.offset));
    if(p){add('body',p.offset,p.locator,Math.min(1200,p.text.length));selected.add(p.offset);}
  }
  if(!selected.size)add('body');
  if(text.table)add('table');
  for(const p of paragraphs)if(!selected.has(p.offset))add('body',p.offset,p.locator,Math.min(1200,p.text.length));
  if(text.body.length>1200)add('body',Math.max(0,text.body.length-1200));
  let remaining=6000;
  for(const c of candidates){
    if(fragments.length===6||remaining===0)break;
    const length=Math.min(c.length,remaining,text[c.field].length-c.offset);
    if(length<1||fragments.some(f=>f.field===c.field&&c.offset<f.offset+f.length&&f.offset<c.offset+length))continue;
    const value=text[c.field].slice(c.offset,c.offset+length);
    fragments.push({id:'fragment-'+(fragments.length+1),field:c.field,offset:c.offset,length:value.length,
      locator:c.locator,text:value,textHash:hash(value)});remaining-=value.length;
  }
  const source={index:1,pmcRecordId:item.id,...Object.fromEntries(['rawSha256','articleVersion','reviewVersion',...reviewFields,
    'title','doi','sourceUrl','sourceName'].map(k=>[k,item[k]??null])),snippetField:'title',snippetOffset:0,
    snippetHash:hash(String(item.title).replace(/\s+/g,' ').slice(0,1200))};
  const omissions=['image-pixels','supplement-content'];
  const sections={};for(const [role,pattern]of Object.entries(sectionRules)){
    sections[role]=fragments.find(f=>pattern.test(f.locator.section??''))?.locator.section??null;
    if(!sections[role])omissions.push(role+'-section-'+(paragraphs.some(p=>pattern.test(p.locator.section))?'not-selected':'not-located'));
  }
  for(const field of ['abstract','body','table'])if(!text[field])omissions.push(field+'-unavailable');
  if(fragments.reduce((n,f)=>n+f.length,0)<Object.values(text).reduce((n,s)=>n+s.length,0))omissions.push('unselected-text');
  const pack={binding,policyVersion,source,coverage:{notice:'基于本次选取的原文片段，非全文逐字审阅',
    fields:[...new Set(fragments.map(f=>f.field))],characters:6000-remaining,sections,locator:paragraphs.length?'jats-and-field-offset':'field-offset'},omissions,fragments};
  return {...pack,packHash:seal(pack)};
}
export function buildArticleEvidencePack(item,reading=null,{policyVersion='rh-article-evidence-v2'}={}){
  if(!['rh-article-evidence-v1','rh-article-evidence-v2'].includes(policyVersion))fail('ARTICLE_POLICY_INVALID');
  const legacy=buildArticleEvidenceV1(item,reading);
  return policyVersion==='rh-article-evidence-v1'?legacy:selectArticleEvidenceV2(item,reading,legacy);
}
export function assertArticlePackMatches(pack,item,reading=null){
  try{if(canonical(pack)!==canonical(buildArticleEvidencePack(item,reading,{policyVersion:pack.policyVersion})))fail('ARTICLE_EVIDENCE_CHANGED');}
  catch{fail('ARTICLE_EVIDENCE_CHANGED');}return pack;
}
export function articleToolResult(pack){
  return {mutated:false,result:'[1] 《'+pack.source.title+'》｜'+pack.source.sourceUrl+'｜'+pack.binding.articleVersion+
    '\n'+pack.coverage.notice+'\n覆盖与未提供项（not-located表示未定位，不代表原文绝对不存在）：'+JSON.stringify({sections:pack.coverage.sections,omissions:pack.omissions})+
    '\n'+pack.fragments.map(f=>`[1] ${f.id}｜${f.field}｜offset=${f.offset}｜length=${f.length}｜位置=${JSON.stringify(f.locator)}：${f.text}`).join('\n'),
    meta:{toolName:'hub_source_search',actualRetrieval:'ResearchHub-fixed-article-PG',sources:[pack.source],articleEvidence:pack}};
}

async function loadReading(args,item){
  const [asset]=await args.db.$queryRaw`SELECT a.local_object_key AS key,a.object_sha256 AS sha,a.byte_count AS bytes
    FROM rh_source.pmc_asset a JOIN rh_source.pmc_candidate_version v ON v.id=a.version_id AND v.tenant_id=a.tenant_id AND v.hub_key=a.hub_key
    WHERE a.tenant_id=${args.tenantId} AND a.hub_key=${args.hubKey} AND v.pmcid=${item.id.slice(4)}
      AND v.article_version=${item.articleVersion} AND v.raw_sha256=${item.rawSha256}
      AND a.asset_kind='jats' AND a.object_sha256=${item.rawSha256}
    ORDER BY (a.component_ref='jats') DESC,a.component_ref LIMIT 1`;
  if(!asset)return null; // Explicit field-offset fallback, not fabricated structure.
  if(asset.key!=='objects/'+item.rawSha256||Number(asset.bytes)<1||Number(asset.bytes)>8388608)fail('ARTICLE_EVIDENCE_CHANGED');
  const reader=args.readPmcAsset??(value=>readFile(new URL('../../.tmp/researchhub-pmc-local/'+value.localObjectKey,import.meta.url)));
  const bytes=await readArticleOriginal({localObjectKey:asset.key,sha256:asset.sha,byteCount:Number(asset.bytes)},reader);
  return parsePmcReading(bytes.toString('utf8'),item.id.slice(4));
}
export async function loadArticleEvidence(args){
  const item=await getCurrentPmcAiHit(args);if(!item)fail('ARTICLE_SOURCE_UNAVAILABLE');
  const reading=await loadReading(args,item),pack=buildArticleEvidencePack(item,reading,{policyVersion:args.policyVersion});
  if(args.binding&&articleContextKey(args.binding)!==articleContextKey(pack.binding))fail('ARTICLE_VERSION_CONFLICT');
  // Filesystem I/O must not let a withdrawn/newly-reviewed source escape the final read check.
  const current=await getCurrentPmcAiHit(args);if(!current)fail('ARTICLE_SOURCE_UNAVAILABLE');
  assertArticlePackMatches(pack,current,reading);
  return {item,pack};
}
export async function assertCurrentArticleEvidence(args){
  if(!args.pack?.binding)fail('ARTICLE_EVIDENCE_CHANGED');
  if(args.lock)await assertHubPublicationSources({...args,sources:[args.pack.source]});
  const {pack}=await loadArticleEvidence({...args,recordId:args.pack.binding.recordId,binding:args.pack.binding,policyVersion:args.pack.policyVersion});
  // JSONB reorders keys; compare canonical data, including every fragment, rather than property insertion order.
  if(canonical(pack)!==canonical(args.pack))fail('ARTICLE_EVIDENCE_CHANGED');return pack;
}
function canonical(value){return JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);}
