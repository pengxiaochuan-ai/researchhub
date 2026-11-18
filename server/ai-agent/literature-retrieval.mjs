import {routeDigest} from './skill-routing.mjs';
const fail=code=>{throw Object.assign(Error(code),{code});};
export async function retrievePubmed({plan,call,signal}){
 if(plan?.status!=='ready'||plan.scope!=='hub-and-pubmed')fail('PUBMED_QUERY_REQUIRED');
 signal?.throwIfAborted();
 const search=await call('pubmed_search_articles',{query:plan.pubmedQuery,maxResults:plan.maxResults,offset:0,sort:'relevance'},{signal});
 const page=search.structuredContent;
 if(search.isError||!Array.isArray(page?.pmids)||page.pmids.length>plan.maxResults||page.pmids.some(id=>!/^\d{1,10}$/.test(id))||!Number.isSafeInteger(page.totalCount)||page.totalCount<page.pmids.length)fail('PUBMED_SEARCH_INVALID');
 const ids=[...new Set(page.pmids)],sources=[];
 if(ids.length){
  const fetched=await call('pubmed_fetch_articles',{pmids:ids},{signal}),articles=fetched.structuredContent?.articles;
  if(fetched.isError||!Array.isArray(articles)||articles.length>ids.length)fail('PUBMED_FETCH_INVALID');
  const seen=new Set();
  for(const a of articles){
   if(!ids.includes(a.pmid)||seen.has(a.pmid)||typeof a.title!=='string'||!a.title.trim())fail('PUBMED_RECORD_MISMATCH');seen.add(a.pmid);
   const source={kind:'pubmed-live',pmid:a.pmid,title:a.title,abstract:typeof a.abstractText==='string'?a.abstractText:'',journal:a.journalInfo??null,authors:a.authors??[],doi:a.doi??null,
    sourceUrl:`https://pubmed.ncbi.nlm.nih.gov/${a.pmid}/`,sourceName:'PubMed实时检索',reviewStatus:'live-unreviewed',coverage:a.abstractText?'abstract':'metadata',retrievedAt:new Date().toISOString()};
   sources.push({...source,contentHash:routeDigest(source)});
  }
 }
 signal?.throwIfAborted();
 return{schema:'hub-pubmed-evidence.v1',query:plan.pubmedQuery,effectiveQuery:page.effectiveQuery??plan.pubmedQuery,totalCount:page.totalCount,offset:0,requested:plan.maxResults,returned:sources.length,unavailable:ids.filter(id=>!sources.some(s=>s.pmid===id)),sources,searchHash:routeDigest(search),searchedAt:new Date().toISOString()};
}
