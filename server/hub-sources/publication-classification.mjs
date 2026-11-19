import {coreDependencyRequire} from '../research-runtime/dependencies.mjs';
import {PUBLICATION_FACETS,publicationDateBounds} from '../../src/publication-filters.js';
const {XMLParser,XMLValidator}=coreDependencyRequire()('fast-xml-parser');
export const CLASSIFICATION_VERSION='paper-facets-rules-v1.3';
const list=v=>v==null?[]:Array.isArray(v)?v:[v];
export function parseArticleMetadata(xml,pmcid){
 if(typeof xml!=='string'||Buffer.byteLength(xml)>8*1024*1024||/<!ENTITY|<!DOCTYPE[^>]*\[/i.test(xml)||(xml.match(/</g)||[]).length>100000)throw Error('PUBLICATION_XML_REJECTED');
 const source=xml.replace(/<!DOCTYPE[^>]*>/gi,'');if(XMLValidator.validate(source)!==true)throw Error('PUBLICATION_XML_REJECTED');
 const root=new XMLParser({ignoreAttributes:false,parseTagValue:false,trimValues:true,processEntities:false}).parse(source);
 const article=root.article??root['OAI-PMH']?.GetRecord?.record?.metadata?.article;
 const meta=article?.front?.['article-meta'];
 if(!meta||!list(meta['article-id']).some(id=>id['@_pub-id-type']==='pmcid'&&id['#text']===pmcid))throw Error('PUBLICATION_XML_ID_MISMATCH');
 const dates=list(meta['pub-date']),chosen=dates.find(d=>d['@_pub-type']==='epub'||d['@_publication-format']==='electronic')??dates.find(d=>d.year);
 let publicationDate=chosen?.year?String(chosen.year):null;
 if(publicationDate&&/^\d{1,2}$/.test(String(chosen.month)))publicationDate+='-'+String(chosen.month).padStart(2,'0');
 if(publicationDate?.length===7&&/^\d{1,2}$/.test(String(chosen.day)))publicationDate+='-'+String(chosen.day).padStart(2,'0');
 if(!publicationDateBounds(publicationDate,null))publicationDate=null;
 return {articleType:article['@_article-type']??null,language:article['@_xml:lang']??null,publicationDate};
}
const rules={
 methods:[['electroacupuncture',/\belectro[- ]?acupuncture\b|电针/i],['moxibustion',/\bmoxibustion\b|艾灸/i],['auricular',/\bauricular (?:acupuncture|acupressure|therapy)|耳针|耳穴/i],['needling',/\bmanual acupuncture\b|\bdry needling\b|针刺|毫针/i],['acupuncture',/\bacupuncture\b|\belectro[- ]?acupuncture\b|\bmoxibustion\b|针灸|针刺|电针|艾灸|耳针|耳穴/i]],
 diseases:[['depression',/\b(?:major depressive disorder|depressive disorders?|depression)\b|抑郁障碍|抑郁症/i],['anxiety',/\b(?:anxiety disorders?|generalized anxiety disorder)\b|焦虑障碍|焦虑症/i],['other',/\b(?:post[- ]traumatic stress disorder|obsessive.compulsive disorder|bipolar disorder|insomnia disorder|sleep disorder)\b|创伤后应激障碍|强迫症|双相情感障碍|失眠症|睡眠障碍/i]],
 people:[['child',/\b(?:children|adolescents?|pediatric|paediatric)\b|儿童|青少年/i],['older',/\b(?:elderly|older adults?|geriatric)\b|老年/i],['adult',/(?<!older )\badults?\b|成年人|成人/i]],
 designs:[['nonrandom',/\bnon[- ]randomi[sz]ed (?:controlled )?(?:trial|stud(?:y|ies))\b|非随机对照/i],['rct',/(?<!non[- ])\brandomi[sz]ed (?:controlled |clinical )?trials?\b|随机对照试验|随机临床试验/i],['cohort',/\bcohort stud(?:y|ies)\b|队列研究/i],['caseControl',/\bcase[- ]control stud(?:y|ies)\b|病例对照研究/i],['crossSectional',/\bcross[- ]sectional stud(?:y|ies)\b|横断面研究/i],['realWorld',/\breal[- ]world stud(?:y|ies)\b|真实世界研究/i]],
};
export function extractClassification({title='',abstract='',sourceHash,metadata={}}){
 const claims=[],add=(facet,value,field,quote,rule)=>{if(quote.length<=1000&&!claims.some(c=>c.facet===facet&&c.value===value&&c.field===field))claims.push({facet,value,field,quote,rule});};
 const abstractReview=String(abstract??'').match(/\b[Tt]his (?:systematic |narrative |critical narrative )?[Rr]eview\b[^.!?。]{0,600}[.!?。]?/);
 const titleReview=/systematic review|umbrella review|meta[- ‐‑–—]analys(?:is|es)|系统(?:综述|评价)|荟萃分析|Meta[-－ ]?分析/i.test(title)?'systematic':/\breview\b|综述/i.test(title)?'review':null;
 const review=titleReview??(abstractReview?'review':metadata.articleType==='review-article'?'review':null);
 const protocol=/\bprotocol\b|研究方案/i.test(title);
 const secondary=/\b(?:meta[- ‐‑–—]regression|secondary analysis|post[- ]hoc analysis|pooled analysis|overview)\b/i.test(title);
 const letter=/\[letter\]|\(letter\)|\bletter to the editor\b/i.test(title);
 if(titleReview)add('types',review,'title',title,'own-title-review');
 else if(abstractReview)add('types',review,'abstract',abstractReview[0],'own-abstract-review');
 else if(review)add('types',review,'metadata','review-article','jats-article-type');
 else if(protocol)add('types','other','title',title,'own-title-protocol');
 else if(secondary||letter)add('types','other','title',title,letter?'own-title-letter':'own-title-secondary-analysis');
 else if(/\b(?:editorial|commentary|perspective)\b|编辑评论/i.test(title))add('types','editorial','title',title,'own-title-editorial');
 else if(/\b(?:methodolog(?:y|ical)|methods? paper)\b|方法学研究/i.test(title))add('types','methods','title',title,'own-title-methodology');
 else if(metadata.articleType==='research-article')add('types','original','metadata','research-article','jats-article-type');
 else if(['editorial','letter','brief-report','case-report'].includes(metadata.articleType))add('types',metadata.articleType==='editorial'?'editorial':'other','metadata',metadata.articleType,'jats-article-type');
 const spans=[{field:'title',quote:title}];
 // Only explicit own objective/methods, never background/results/references or full text mentions.
 const structured=String(abstract??'').match(/(?:^|\b)(?:Methods?|METHODS?|Materials and Methods|Objective|OBJECTIVE|Aim|方法|目的)\s*(?:[:：]\s*|\s+)([\s\S]*?)(?=\b(?:Results?|RESULTS?|Conclusions?|CONCLUSIONS?|Background|BACKGROUND)\b\s*[:：]?|结果\s*[:：]?|结论\s*[:：]?|$)/g)??[];
 for(const part of structured)for(const sentence of part.split(/(?<=[.!?。])\s+/))if(sentence.trim())spans.push({field:'abstract',quote:sentence.trim()});
 const animal=/\b(?:rats?|mouse|mice|murine|rodents?|zebrafish|rabbits?|monkeys?|animal models?)\b|小鼠|大鼠|动物模型/i.test(title+' '+String(abstract??''));
 const nonPrimary=review||protocol||secondary||letter||claims.some(c=>c.facet==='types'&&['methods','editorial','other'].includes(c.value));
 for(const {field,quote} of spans){
  if(!quote||quote.length>1000)continue;
  for(const [facet,entries]of Object.entries(rules)){
   if(facet==='designs'&&(nonPrimary||animal||/\b(?:searched?|reviewed|eligible (?:studies|trials)|included (?:studies|trials))\b/i.test(quote)))continue;
   if(facet==='people'&&animal)continue;
   if(facet==='diseases'&&animal)continue;
   // Populations in review abstracts are not this paper's enrolled population.
   if(facet==='people'&&review&&field==='abstract')continue;
   if(/\b(?:previous|prior|earlier|not |without |no )\b/i.test(quote)&&field==='abstract')continue;
   for(const [value,pattern]of entries){
    if(value==='rct'&&/\bnon[- ‐‑–—]randomi[sz]ed|\b(?:not|no) (?:a )?randomi[sz]ed|非随机/i.test(quote))continue;
    if(pattern.test(quote))add(facet,value,field,quote,'explicit-own-'+facet);
   }
  }
 }
 const design=claims.find(c=>c.facet==='designs');
 if(!nonPrimary&&design&&!claims.some(c=>c.facet==='types'))add('types','original',design.field,design.quote,'own-study-design');
 if(metadata.language){const lang=String(metadata.language).toLowerCase().split('-')[0];if(/^[a-z]{2,3}$/.test(lang))add('languages',['en','zh'].includes(lang)?lang:'other','metadata',String(metadata.language),'jats-language');}
 return {schemaVersion:1,extractorVersion:CLASSIFICATION_VERSION,sourceHash,publicationDate:metadata.publicationDate??null,dateRange:publicationDateBounds(metadata.publicationDate,null),claims};
}
export function projectClassification(stored,{title,abstract,sourceHash}){
 const values=Object.fromEntries(Object.keys(PUBLICATION_FACETS).map(key=>[key,[]]));
 const valid=stored?.schemaVersion===1&&stored?.extractorVersion===CLASSIFICATION_VERSION&&stored?.sourceHash===sourceHash;
 const claims=valid?(stored.claims??[]).filter(c=>PUBLICATION_FACETS[c.facet]?.some(([v])=>v===c.value)&&typeof c.quote==='string'&&c.quote&&(c.field==='metadata'||(typeof ({title,abstract})[c.field]==='string'&&({title,abstract})[c.field].includes(c.quote)))):[];
 for(const c of claims)if(!values[c.facet].includes(c.value))values[c.facet].push(c.value);
 return {extractorVersion:valid?stored.extractorVersion:null,publicationDate:valid?stored.publicationDate:null,values,claims};
}
