// Reuse the already installed Node PDF parser. Page markers are deterministic
// parser output consumed by native IngestionService, never invented by an LLM.
export function createRuntimeDocExtractor({Native,PDFParse,resolveMetadata,parserConfigured}){
 return new(class extends Native{
  async extract(filename,buffer){
   if(parserConfigured||!/^.*\.pdf$/i.test(filename??''))return super.extract(filename,buffer);
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
