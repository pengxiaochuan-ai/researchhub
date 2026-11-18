// Only server-bound source metadata, never arbitrary model Markdown URLs.
export function literatureSourceLinks(evidence){
 return(evidence?.selected??[]).map(source=>{
  let href=null;
  if(source.kind==='pubmed-live'&&/^\d{1,10}$/.test(source.pmid??''))href=`https://pubmed.ncbi.nlm.nih.gov/${source.pmid}/`;
  else if(source.externalDocumentId){try{const u=new URL(source.sourceUrl);if(u.protocol==='https:'&&!u.username&&!u.password)href=u.href;}catch{}}
  else{const id=source.pmcRecordId??source.sourceRecordId;if(/^(?:pmc-PMC\d+|rhsr-[a-f0-9]{40})$/.test(id??''))href='/pages/e02/?recordId='+encodeURIComponent(id);}
  return{id:source.id,title:source.title,href,external:source.kind==='pubmed-live'||Boolean(source.externalDocumentId),label:source.kind==='pubmed-live'?'PubMed实时 · 未入库审核':'已审核Hub资料'};
 });
}
