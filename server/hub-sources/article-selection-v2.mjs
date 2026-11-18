import {createHash} from 'node:crypto';

const normalize=s=>String(s??'').replace(/\s+/g,' ').trim();
const hash=s=>createHash('sha256').update(s).digest('hex');
const sectionRules={methods:/method|participant|material|clinical assessment|case presentation|intervention protocol|方法|对象/i,
  results:/result|finding|clinical course|outcome|结果/i,discussion:/discuss|limit|conclu|讨论|局限|结论/i};
const limitation=/limitation|no control|absence of|lack(?:ing|ed|s)?|cannot|unconfirmed|not.{0,25}systematic|not.{0,25}comprehensive|evidence.{0,35}limited|bias|without.{0,20}control/gi;

// Both supported projections are exact. The saved import separates XML text
// nodes; the reading view joins them. Never invent an approximate field offset.
function paragraphs(reading,body){
  const found=[],failedAnchors=[];let cursor=0,total=0;
  const inline=(nodes,separator)=>(nodes??[]).map(n=>n.content?inline(n.content,separator):n.text??'').join(separator);
  function walk(nodes,path=[]){for(const n of nodes??[]){
    if(n.type==='section')walk(n.children,n.title?[...path,n.title]:path);
    else if(n.type==='list')for(const row of n.items??[])walk(row,path);
    else if(n.type==='p'||n.type==='pre'){
      total++;const variants=[...new Set(['',' '].map(s=>normalize(n.text??inline(n.content,s))))].filter(Boolean);
      const matches=variants.map(text=>({text,offset:body.indexOf(text,cursor)})).filter(x=>x.offset>=0).sort((a,b)=>a.offset-b.offset);
      if(!matches.length){failedAnchors.push(n.id??'unlocated');continue;}
      const p=matches[0];found.push({...p,path,locator:{kind:'jats',anchor:n.id,section:path.at(-1)??''}});cursor=p.offset+p.text.length;
    }
  }}walk(reading?.blocks);
  return {found,mapping:{total,matched:found.length,failedAnchors:failedAnchors.slice(0,50)}};
}

// Keep a contiguous window of complete sentences. A single oversized sentence
// is visibly incomplete, never silently treated as a supported conclusion.
export function completeTextWindow(text,limit,tail=false){
  if(text.length<=limit)return {offset:0,text,complete:true};
  const sentences=[...new Intl.Segmenter('en',{granularity:'sentence'}).segment(text)]
    .map(s=>({offset:s.index,text:s.segment.trimEnd()}))
    .filter(s=>/[.!?。！？]["'”’）)]*$/.test(s.text)&&s.text.length<=limit);
  const first=tail?sentences.at(-1):sentences[0];
  if(first){let start=first.offset,end=start+first.text.length;
    if(tail){for(let i=sentences.length-2;i>=0;i--){const s=sentences[i];if(end-s.offset>limit)break;start=s.offset;}}
    else for(const s of sentences.slice(1)){if(s.offset+s.text.length-start>limit)break;end=s.offset+s.text.length;}
    return {offset:start,text:text.slice(start,end),complete:true};
  }
  return {offset:0,text:text.slice(0,limit),complete:false};
}

function tableWindows(tables,text){
  const result=[];let tableCursor=0;
  for(const table of tables??[]){const serialized=normalize(JSON.stringify(table)),at=text.indexOf(serialized,tableCursor);if(at<0)continue;tableCursor=at+serialized.length;
    if(!Array.isArray(table.rows)||!table.rows.length)continue;
    const rows=table.rows.map(r=>normalize(JSON.stringify(r))),array=normalize(JSON.stringify(table.rows)),start=serialized.indexOf(array)+1;
    if(start<1)continue;
    let count=0,length=0;
    for(const row of rows){const next=length+(count?1:0)+row.length;if(next>1200)break;length=next;count++;}
    if(!count)continue;
    result.push({field:'table',offset:at+start,text:text.slice(at+start,at+start+length),complete:true,
      locator:{kind:'field-offset'},role:'table',rowsSelected:count,rowsTotal:rows.length,
      priority:/measure|outcome|score|baseline|结局|评分/i.test(JSON.stringify(table.rows[0]))?0:1});
  }return result.sort((a,b)=>a.priority-b.priority);
}

export function selectArticleEvidenceV2(item,reading,legacy){
  const text={abstract:item.abstract&&item.abstractDisplayVersion&&item.abstractAiReviewVersion?normalize(item.abstract):'',body:normalize(item.body),
    table:item.tables?.length&&item.tableDisplayVersion&&item.tableAiReviewVersion?normalize(JSON.stringify(item.tables)):''};
  const {found,mapping}=paragraphs(reading,text.body),candidates=[],selected=new Set();
  const add=(p,role)=>{if(p&&!selected.has(p.offset)){candidates.push({...p,field:'body',role});selected.add(p.offset);}};
  const inSection=(p,re)=>p.path.some(s=>re.test(s));
  if(text.abstract)candidates.push({field:'abstract',offset:0,text:text.abstract,locator:{kind:'field-offset'},role:'abstract',tail:true});
  add(found.find(p=>inSection(p,sectionRules.methods)),'methods');
  const results=found.filter(p=>inSection(p,sectionRules.results));
  add(results.find(p=>p.path.some(s=>/summary of outcomes/i.test(s)))??results[0],'results');
  const limited=found.map(p=>({p,score:(p.text.match(limitation)??[]).length+(inSection(p,/limitation/i)?5:0)}))
    .filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
  add(limited.find(x=>!selected.has(x.p.offset))?.p,'limitations');
  const topic=found.filter(p=>inSection(p,/acupuncture|针刺|针灸|intervention protocol/i));
  add(topic.find(p=>/weak recommendation|弱推荐/i.test(p.text))??topic[0],'topic');
  const tables=tableWindows(item.tables,text.table);candidates.push(...tables);
  add(found.find(p=>inSection(p,sectionRules.discussion)),'discussion');
  for(const p of found)add(p,'body');
  if(!found.length)candidates.push({field:'body',offset:0,text:text.body,locator:{kind:'field-offset'},role:'body'});
  const fragments=[],omissions=['image-pixels','supplement-content'];let remaining=6000;
  for(const c of candidates){if(fragments.length===6||!remaining)break;
    // Table windows already contain complete rows; never shorten them mid-cell.
    if(c.field==='table'&&c.text.length>remaining)continue;
    const w=c.field==='table'?{text:c.text,offset:0,complete:true}:completeTextWindow(c.text,Math.min(1200,remaining),c.tail);
    if(!w.text)continue;
    const offset=c.offset+w.offset;
    if(fragments.some(f=>f.field===c.field&&offset<f.offset+f.length&&f.offset<offset+w.text.length))continue;
    fragments.push({id:'fragment-'+(fragments.length+1),field:c.field,offset,length:w.text.length,locator:c.locator,
      text:w.text,textHash:hash(w.text),complete:w.complete,role:c.role});remaining-=w.text.length;
    if(!w.complete)omissions.push('incomplete-fragment');
    if(c.field==='table'&&c.rowsSelected<c.rowsTotal)omissions.push('table-rows-not-selected');
  }
  const articleType=/\bthis review\b|narrative review|selective review/i.test(item.title+' '+text.abstract)?'review':/case report/i.test(item.title+' '+text.abstract)?'case-report':'unclassified';
  const sections={};for(const [role,re]of Object.entries(sectionRules)){
    const f=fragments.find(f=>f.role===role||role==='discussion'&&f.role==='limitations');
    sections[role]=f?.locator.section||null;
    if(!sections[role])omissions.push(role==='results'&&articleType==='review'?'results-role-not-applicable-review':role+'-section-'+(found.some(p=>inSection(p,re))?'not-selected':'not-located'));
  }
  if(mapping.failedAnchors.length)omissions.push('body-mapping-incomplete');
  for(const field of ['abstract','body','table'])if(!text[field])omissions.push(field+'-unavailable');
  if(fragments.reduce((n,f)=>n+f.length,0)<Object.values(text).reduce((n,s)=>n+s.length,0))omissions.push('unselected-text');
  const pack={binding:legacy.binding,policyVersion:'rh-article-evidence-v2',source:legacy.source,
    coverage:{notice:legacy.coverage.notice,fields:[...new Set(fragments.map(f=>f.field))],characters:6000-remaining,sections,mapping,articleType,
      locator:found.length?'jats-and-field-offset':'field-offset'},omissions:[...new Set(omissions)],fragments};
  return {...pack,packHash:hash(JSON.stringify(pack))};
}
