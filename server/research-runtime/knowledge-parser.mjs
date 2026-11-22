const PDF_PAGE_LIMIT = 1000;
const PDF_MARKDOWN_LIMIT = 5_000_000;

async function extractPdfRanges(parserUrl, buffer, resolveMetadata) {
  const form = new FormData();
  form.append('file', new Blob([buffer]), 'document.pdf');
  const parts = [];
  const warnings = [];
  let pageCount;
  let firstRange;
  let usedOcr = false;
  let chars = 0;
  for (let start = 1; start <= (pageCount ?? 1);) {
    let response;
    try {
      response = await fetch(`${parserUrl}/extract/pdf-range?start=${start}`, {
        method: 'POST', body: form, signal: AbortSignal.timeout(5 * 60_000),
      });
    } catch (error) {
      throw new Error(`PDF 第 ${start} 页起的解析请求失败：${error.message}`);
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`PDF 第 ${start} 页起解析失败（${response.status}）：${detail.slice(0, 200)}`);
    }
    const range = await response.json();
    pageCount ??= range.pageCount;
    if (!Number.isSafeInteger(pageCount) || pageCount < 1 || pageCount > PDF_PAGE_LIMIT ||
        range.pageCount !== pageCount || range.startPage !== start ||
        !Number.isSafeInteger(range.endPage) || range.endPage < start || range.endPage > pageCount ||
        typeof range.contentMd !== 'string') {
      throw new Error('PDF 分页结果与原始页码不一致');
    }
    const pageMarkers = [...range.contentMd.matchAll(/^## 第 (\d+) 页$/gm)];
    if (pageMarkers.length !== range.endPage - start + 1 ||
        pageMarkers.some((match, offset) => Number(match[1]) !== start + offset)) {
      throw new Error('PDF 分页正文缺少原始页码');
    }
    chars += range.contentMd.length + (parts.length ? 2 : 0);
    if (chars > PDF_MARKDOWN_LIMIT) throw new Error('PDF 解析正文超过导入上限');
    firstRange ??= range;
    parts.push(range.contentMd);
    if (Array.isArray(range.warnings)) {
      warnings.push(...range.warnings.filter(warning => typeof warning === 'string'));
    }
    usedOcr ||= range.usedOcr === true;
    start = range.endPage + 1;
  }
  const contentMd = parts.join('\n\n');
  if (!contentMd.replace(/^## 第 \d+ 页\s*$/gm, '').trim()) throw new Error('PDF 未提取到可用文本');
  const {title, authors, doi, publicationYear, metadataSource, metadataConfidence} = firstRange;
  const metadata = resolveMetadata({
    contentMd, preferredTitle: title, authors, doi, publicationYear, metadataSource, metadataConfidence,
  });
  return {contentMd, ...metadata, pageCount, usedOcr, warnings: warnings.slice(0, 20), extractor:'kb-doc-parser'};
}

// Reuse the already installed Node PDF parser. Page markers are deterministic
// parser output consumed by native IngestionService, never invented by an LLM.
export function createRuntimeDocExtractor({Native,PDFParse,resolveMetadata,parserConfigured,parserUrl}){
 return new(class extends Native{
  async extract(filename,buffer){
   if(!/\.pdf$/i.test(filename??''))return super.extract(filename,buffer);
   if(parserUrl)return extractPdfRanges(parserUrl.replace(/\/$/,''),buffer,resolveMetadata);
   if(parserConfigured)return super.extract(filename,buffer);
   const parser=new PDFParse({data:buffer});
   try{
    const result=await parser.getText(),pages=result.pages;
    if(!Array.isArray(pages)||!pages.length||pages.length>1000||result.total!==pages.length||pages.some((p,i)=>p.num!==i+1||typeof p.text!=='string'))throw Object.assign(Error('该PDF的页码无法核对，请检查原文件后重新上传。'),{code:'KNOWLEDGE_PDF_PAGE_METADATA_INVALID'});
    if(!pages.some(p=>p.text.trim()))throw Error('该PDF未提取到文字，请使用带文字层的PDF，或联系管理员核对OCR服务。');
    const raw=pages.map(p=>p.text).join('\n\n'),warnings=pages.filter(p=>!p.text.trim()).map(p=>`第${p.num}页没有可读取的文字，请核对原件。`);
    return{contentMd:pages.map(p=>`# 第${p.num}页\n\n${p.text.trim()}`).join('\n\n'),...resolveMetadata({contentMd:raw,metadataSource:'content_heading',metadataConfidence:'low'}),pageCount:pages.length,usedOcr:false,warnings,extractor:'node-local'};
   }finally{await parser.destroy();}
  }
 })();
}
