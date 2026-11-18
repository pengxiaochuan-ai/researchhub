import {filterReviewQueue,isPendingReview,isDecidedReview} from './source-review-queue.js';

const nameOf=value=>String(value||'').split('/').at(-1).split('?')[0];
const formatCopy=name=>name==='jats'||/^PMC\d+\.\d+\.(xml|txt|pdf)$/i.test(name);
export function pmcContentInventory(item,article=null) {
  const assets=item.assets||[],refs=item.mediaRefs||[],manifest=item.componentManifest||[];
  const images=assets.filter(x=>x.assetKind==='image');
  const authorRefs=article?.supplements||refs.filter(x=>['supplement','supplementary-material'].includes(x.kind));
  const supplements=assets.filter(x=>authorRefs.some(ref=>nameOf(ref.href)===x.componentRef));
  const technical=assets.filter(x=>x.assetKind!=='image'&&!supplements.includes(x));
  const missing=manifest.filter(x=>!assets.some(a=>a.componentRef===x.name));
  const figureRefs=article?.media||refs.filter(x=>x.kind==='image');
  const missingFigures=figureRefs.filter(x=>!images.some(a=>a.componentRef===nameOf(x.href)));
  const pdf=manifest.find(x=>x.kind==='pdf'||/^PMC\d+\.\d+\.pdf$/i.test(x.name));
  const hasPdf=pdf&&assets.some(x=>x.componentRef===pdf.name);
  return {images,supplements,technical,missing,authorRefs,missingFigures,
    formats:technical.filter(x=>formatCopy(x.componentRef)),
    abstract:{label:item.abstract?'已解析':article&&!article.presence.abstract?'原文未提供摘要':'未解析，待核对'},
    body:{label:article?.blocks?.length?'已解析（章节可定位）':item.body?'已取得纯文本，章节待核对':'尚未取得可阅读正文'},
    figures:{label:figureRefs.length?`已取得 ${figureRefs.length-missingFigures.length}/${figureRefs.length} 个图版${missingFigures.length?'，仍有待补齐图片':''}`:images.length?`已取得 ${images.length} 份图文件，原文位置待核对`:article?'原文未列出图片':'原文图片数量待核对'},
    tables:{label:(article?.tables||item.tables)?.length?`已解析 ${(article?.tables||item.tables).length} 张`:article?'原文未列出表格':'原文表格数量待核对'},
    supplementStatus:{label:authorRefs.length?`已取得 ${authorRefs.filter(ref=>supplements.some(a=>a.componentRef===nameOf(ref.href))).length}/${authorRefs.length} 个作者附录`:article?'原文未列出作者附录':'作者附录待核对'},
    pdf:{label:!pdf?'当前来源清单未列出PDF':hasPdf?'已取得':'未取得（不影响已解析正文）'}};
}
export function reviewQueueCounts(items,filters) {
  const rows=filterReviewQueue(items,{...filters,status:'all'});
  return {all:rows.length,pending:rows.filter(isPendingReview).length,
    decided:rows.filter(isDecidedReview).length};
}
export const nextReviewLabel=(status,kind='pmc')=>isDecidedReview({state:{status}})
  ?`下一${kind==='pmc'?'篇':'项'}待审核 →`:`跳过，查看下一${kind==='pmc'?'篇':'项'} →`;
