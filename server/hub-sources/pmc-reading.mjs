import {createRequire} from 'node:module';

const {XMLParser,XMLValidator}=createRequire(new URL('../../../app/server/package.json',import.meta.url))('fast-xml-parser');
const invalid=()=>{throw new Error('HUB_SOURCE_PMC_READING_INVALID');};
const key=node=>Object.keys(node).find(x=>x!==':@');
const children=node=>Array.isArray(node?.[key(node||{})])?node[key(node)]:[];
const attr=(node,name)=>node?.[':@']?.['@_'+name]||'';
const findAll=(nodes,tag)=>nodes.flatMap(node=>key(node)===tag?[node]:findAll(children(node),tag));
const clean=value=>String(value).replace(/\s+/g,' ').trim();
const text=nodes=>nodes.map(n=>{
  const tag=key(n);if(tag==='#text')return String(n['#text']);if(['script','style'].includes(tag))return '';
  if(['inline-formula','disp-formula'].includes(tag)||tag?.split(':').at(-1)==='math')return '【原文公式，请核对原件】';
  if(tag==='sup'||tag==='sub')return (tag==='sup'?'^':'_')+'('+text(children(n))+')';
  return text(children(n));
}).join('');
// JATS element-citation has no punctuation between structured fields; never glue names/IDs together.
function referenceText(nodes){
  const pieces=nodes.map(n=>{
    if(['mixed-citation','element-citation'].includes(key(n)))return referenceText(children(n));
    if(key(n)==='person-group')return children(n).map(x=>clean(referenceText([x]))).filter(Boolean).join(', ');
    if(['name','string-name'].includes(key(n)))return children(n).map(x=>clean(text([x]))).filter(Boolean).join(' ');
    return text([n]);
  }).filter(Boolean);
  return pieces.reduce((result,piece)=>result+(result&&!/\s$|[([{]$/.test(result)&&!/^\s|^[,.;:!?\])}]/.test(piece)?' ':'')+piece,'');
}

/** Deterministic reading projection, never executable HTML or rewritten scientific content. */
export function parsePmcReading(xml,pmcid) {
  if(typeof xml!=='string'||Buffer.byteLength(xml)>8*1024*1024||
    /<!ENTITY|<!DOCTYPE[^>]*\[/i.test(xml)||(xml.match(/</g)||[]).length>100000)invalid();
  // No DTD resolution or custom entities. Ordinary external JATS declarations are not fetched.
  const source=xml.replace(/<!DOCTYPE[^>]*>/gi,'');
  if(XMLValidator.validate(source)!==true)invalid();
  const tree=new XMLParser({preserveOrder:true,ignoreAttributes:false,parseTagValue:false,
    trimValues:false,htmlEntities:true,processEntities:true}).parse(source);
  let nodeCount=0;
  function bounded(nodes,depth=0){if(depth>80)invalid();for(const n of nodes){if(++nodeCount>50000)invalid();bounded(children(n),depth+1);}}
  bounded(tree);
  const articles=findAll(tree,'article');if(articles.length!==1)invalid();
  const article=children(articles[0]);
  const declared=findAll(article,'article-id').find(n=>attr(n,'pub-id-type')==='pmcid');
  if(!declared||clean(text(children(declared)))!==pmcid)invalid();
  let counter=0;const targets={},seen=new Set(),tables=[],media=[];
  const mathNames=new Set(['math','mrow','mi','mn','mo','mtext','mspace','ms','mfrac','msqrt','mroot','msub','msup','msubsup','munder','mover','munderover','mfenced','menclose','mtable','mtr','mtd','mstyle','mpadded','mphantom','semantics']);
  function mathNode(n){
    if(key(n)==='#text')return {text:String(n['#text'])};
    const name=key(n).split(':').at(-1);if(!mathNames.has(name))return null;
    const parts=children(n).filter(x=>!['annotation','annotation-xml'].includes(key(x)?.split(':').at(-1)));
    const content=parts.map(mathNode);if(content.some(x=>x===null))return null;
    const attrs={};for(const name of ['display','mathvariant','stretchy','accent','fence','separator','form','linethickness','notation','columnalign','rowspan','columnspan','open','close','separators']){
      const value=attr(n,name);if(value&&value.length<100&&!/[<>]/.test(value))attrs[name]=value;
    }
    return {tag:name==='semantics'?'mrow':name,attrs,children:content};
  }
  function formula(n){
    function mathIn(nodes){for(const x of nodes){if(key(x)?.split(':').at(-1)==='math')return x;const match=mathIn(children(x));if(match)return match;}}
    const math=mathIn([n]),node=math&&mathNode(math);
    if(node)return {type:'math',node};
    return {type:'formula-source',text:clean(text(children(n)))||'此处原文公式尚不能呈现，请打开原文核对'};
  }
  function id(node){const anchor='part-'+(++counter),raw=attr(node,'id');if(raw){if(seen.has(raw))invalid();seen.add(raw);Object.defineProperty(targets,raw,{value:anchor,enumerable:true});}return anchor;}
  function inline(nodes){return nodes.flatMap(n=>{
    const tag=key(n),parts=children(n);
    if(tag==='#text')return [{type:'text',text:String(n['#text'])}];
    if(['script','style','graphic','inline-graphic'].includes(tag))return [];
    if(tag==='inline-formula'||tag==='disp-formula'||tag?.split(':').at(-1)==='math')return [formula(n)];
    if(tag==='fig'||tag==='table-wrap'){const [object]=blocks([n]);return [{type:'xref',text:object.label||'查看图表',rids:object.refId?[object.refId]:[],objectInline:true}];}
    if(tag==='xref')return [{type:'xref',text:clean(text(parts)),rids:attr(n,'rid').trim().split(/\s+/).filter(Boolean)}];
    if(tag==='break')return [{type:'text',text:' '}];
    if(['bold','italic','sup','sub'].includes(tag))return [{type:tag,text:text(parts),content:inline(parts)}];
    return inline(parts);
  });}
  const positive=value=>/^[1-9]\d{0,2}$/.test(String(value))?Number(value):1;
  function blocks(nodes){return nodes.flatMap(n=>{
    const tag=key(n),parts=children(n);
    if(tag==='#text')return clean(n['#text'])?[{type:'p',id:id(n),content:[{type:'text',text:String(n['#text'])}]}]:[];
    if(['title','label','script','style','caption','table-wrap-foot'].includes(tag))return [];
    if(tag==='preformat')return [{type:'pre',id:id(n),text:text(parts)}];
    if(tag==='disp-formula')return [{type:'p',id:id(n),content:[formula(n)]}];
    if(['sec','boxed-text'].includes(tag))return [{type:'section',id:id(n),title:clean(text(children(parts.find(x=>key(x)==='title')||{}))),children:blocks(parts)}];
    if(tag==='p')return [{type:'p',id:id(n),content:inline(parts)}];
    if(tag==='list')return [{type:'list',id:id(n),ordered:['order','ordered'].includes(attr(n,'list-type')),items:parts.filter(x=>key(x)==='list-item').map(x=>blocks(children(x)))}];
    if(tag==='fig'||tag==='table-wrap') {
      const anchor=id(n),refId=attr(n,'id'),label=clean(text(children(parts.find(x=>key(x)==='label')||{}))),caption=clean(text(children(parts.find(x=>key(x)==='caption')||{})));
      if(tag==='fig')media.push({refId,id:anchor,label,caption,href:attr(findAll(parts,'graphic')[0],'xlink:href')});
      else {
        const rawTable=findAll(parts,'table')[0];
        const headerRows=new Set(findAll(children(rawTable||{}),'thead').flatMap(x=>findAll(children(x),'tr')));
        const rows=findAll(children(rawTable||{}),'tr').map(row=>children(row).filter(x=>['td','th'].includes(key(x))).map(cell=>({
          kind:key(cell),text:clean(text(children(cell))),content:inline(children(cell)),rowSpan:positive(attr(cell,'rowspan')),colSpan:positive(attr(cell,'colspan')),
          scope:key(cell)==='th'?(attr(cell,'scope')|| (headerRows.has(row)?'col':'row')):null})));
        tables.push({id:anchor,refId,label,caption,rows,footnote:clean(text(children(parts.find(x=>key(x)==='table-wrap-foot')||{})))});
      }
      return [{type:'object',id:anchor,refId,label,caption,kind:tag==='fig'?'image':'table'}];
    }
    if(['statement','disp-quote'].includes(tag))return [{type:'p',id:id(n),content:inline(parts)}];
    return blocks(parts);
  });}
  const body=article.find(n=>key(n)==='body');const result=blocks(children(body||{}));
  // Figures/tables may be stored after the body in a JATS floats-group.
  for(const floats of article.filter(n=>key(n)==='floats-group'))blocks(children(floats));
  const references=findAll(article,'ref').map(n=>{
    const parts=children(n),anchor=id(n),labelNode=parts.find(x=>key(x)==='label');
    const citation=parts.filter(x=>key(x)!=='label');
    const doi=findAll(citation,'pub-id').find(x=>attr(x,'pub-id-type')==='doi');
    const raw=doi&&clean(text(children(doi)));const doiUrl=raw&&/^10\.\d{4,9}\/\S+$/.test(raw)?'https://doi.org/'+raw:null;
    return {id:anchor,refId:attr(n,'id'),label:clean(text(children(labelNode||{}))),text:clean(referenceText(citation)),url:doiUrl};
  });
  const supplements=findAll(article,'supplementary-material').map(n=>({kind:'supplement',href:attr(n,'xlink:href')||attr(findAll(children(n),'media')[0],'xlink:href')||attr(findAll(children(n),'graphic')[0],'xlink:href'),label:clean(text(children(n)))}));
  return {blocks:result,references,tables,media,targets,supplements,presence:{abstract:findAll(article,'abstract').length>0,body:!!body}};
}
