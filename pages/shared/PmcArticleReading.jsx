import React from 'react';

export const articleAnchor=(version,id)=>`pmc-${version}-${id}`;
export function jumpToArticle(event,id) {
  const target=document.getElementById(id);if(!target)return;
  event.preventDefault();
  for(let node=target.parentElement;node;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;
  target.focus({preventScroll:true});target.scrollIntoView({block:'start'});
}
export function readingBacklinks(article) {
  const found={};
  function visitInline(parts,id){for(const part of parts){if(part.type==='xref')for(const rid of part.rids)found[rid]??=id;if(part.content)visitInline(part.content,id);}}
  function visit(blocks){for(const block of blocks){
    if(block.type==='object')found[block.refId]??='mention-'+block.id;
    visitInline(block.content||[],block.id);
    if(block.children)visit(block.children);for(const item of block.items||[])visit(item);
  }}visit(article?.blocks||[]);return found;
}

function ScientificInline({parts=[],targets={},versionId}) {
  const math=(node,index=0)=>Object.hasOwn(node,'text')?node.text:React.createElement(node.tag,{...node.attrs,key:index},node.children.map(math));
  return parts.map((part,index)=>{
    if(part.type==='xref'){
      const valid=part.rids.filter(id=>Object.hasOwn(targets,id));
      const link=(rid,label)=><a key={rid} href={'#'+articleAnchor(versionId,targets[rid])} onClick={event=>jumpToArticle(event,articleAnchor(versionId,targets[rid]))}>{label}</a>;
      return !valid.length?<React.Fragment key={index}>{part.text}</React.Fragment>:valid.length===1?<React.Fragment key={index}>{link(valid[0],part.text)}</React.Fragment>:
        <span key={index}>{part.text}<span className="hub-pmc-multi-refs">（{valid.map((rid,i)=>link(rid,`关联来源${i+1}`))}）</span></span>;
    }
    if(part.type==='math')return <React.Fragment key={index}>{math(part.node)}</React.Fragment>;
    if(part.type==='formula-source')return <span className="hub-pmc-formula-source" key={index}>【原文公式，源文本呈现：<code>{part.text}</code>；请结合原文核对】</span>;
    const Tag={bold:'strong',italic:'em',sup:'sup',sub:'sub'}[part.type]||React.Fragment;
    return <Tag key={index}>{part.content?<ScientificInline parts={part.content} targets={targets} versionId={versionId}/>:part.text}</Tag>;
  });
}

export default function PmcArticleReading({article,versionId}) {
  const prefix=id=>articleAnchor(versionId,id);
  const backlinks=readingBacklinks(article);
  const link=(id,label,key)=> <a key={key||id} href={'#'+prefix(id)} onClick={event=>jumpToArticle(event,prefix(id))}>{label}</a>;
  const inline=parts=><ScientificInline parts={parts} targets={article.targets} versionId={versionId}/>;
  function render(blocks,level=4){return blocks.map(block=>{
    if(block.type==='pre')return <pre key={block.id} id={prefix(block.id)} tabIndex={-1}>{block.text}</pre>;
    if(block.type==='section') {const Heading='h'+Math.min(level,6);return <section key={block.id} id={prefix(block.id)} tabIndex={-1} className="hub-pmc-section">
      {block.title&&<Heading>{block.title}</Heading>}{render(block.children,level+1)}</section>;}
    if(block.type==='list'){const List=block.ordered?'ol':'ul';return <List key={block.id}>{block.items.map((item,i)=><li key={i}>{render(item,level)}</li>)}</List>;}
    if(block.type==='object')return <p key={block.id} id={prefix('mention-'+block.id)} tabIndex={-1} className="hub-pmc-object-position">
      {link(block.id,`核对 ${block.label|| (block.kind==='image'?'原文图片':'原文表格')}：${block.caption||'查看原始内容'}`)}</p>;
    return <p key={block.id} id={prefix(block.id)} tabIndex={-1}>{inline(block.content||[])}</p>;
  });}
  const sections=[];
  function headings(blocks,depth=0){for(const b of blocks){if(b.type==='section'){if(b.title)sections.push({id:b.id,title:b.title,depth});headings(b.children,depth+1);}}}
  headings(article.blocks);
  return <>
    <nav className="hub-pmc-contents" aria-label="文章目录">
      <strong>正文定位</strong><ul>{sections.map(x=><li key={x.id} className={x.depth?'is-subsection':''}>{link(x.id,x.title)}</li>)}
        {!!article.references.length&&<li>{link('references','参考文献（'+article.references.length+'）')}</li>}</ul>
    </nav>
    <div className="hub-pmc-structured-body">{article.blocks.length?render(article.blocks):<p role="status">原件未包含可阅读正文，不能以书目代替全文。</p>}</div>
    {!!article.references.length&&<section className="hub-pmc-references" id={prefix('references')} tabIndex={-1}>
      <h4>参考文献</h4><ol role="list">{article.references.map(ref=><li id={prefix(ref.id)} tabIndex={-1} key={ref.id}>
        <span>{ref.label&&`[${ref.label}] `}{ref.text}</span>{ref.url&&<> <a href={ref.url} target="_blank" rel="noopener noreferrer">打开 DOI 来源</a></>}
        {backlinks[ref.refId]&&<> · {link(backlinks[ref.refId],'返回正文引用位置')}</>}
      </li>)}</ol></section>}
  </>;
}

export function PmcReadingTable({table,versionId,returnId,targets={}}) {
  const id=articleAnchor(versionId,table.id);
  return <div className="hub-pmc-table" id={id} tabIndex={-1}>
    <div className="hub-pmc-table-scroll" tabIndex={0} role="region" aria-label={`${table.label||'表格'}，宽表可横向滚动`}>
      <table><caption>{table.label} · {table.caption||'原文未标注表题'}</caption><tbody>{table.rows.map((row,ri)=><tr key={ri}>{row.map((cell,ci)=>{
        const Cell=cell.kind==='th'?'th':'td';return <Cell key={ci} scope={Cell==='th'&&['col','row','colgroup','rowgroup'].includes(cell.scope)?cell.scope:undefined}
          rowSpan={cell.rowSpan} colSpan={cell.colSpan}>{cell.content?<ScientificInline parts={cell.content} targets={targets} versionId={versionId}/>:cell.text}</Cell>;
      })}</tr>)}</tbody></table>
    </div>{table.footnote&&<p>{table.footnote}</p>}
    {returnId&&<a href={'#'+articleAnchor(versionId,returnId)} onClick={event=>jumpToArticle(event,articleAnchor(versionId,returnId))}>返回正文引用位置</a>}
  </div>;
}
