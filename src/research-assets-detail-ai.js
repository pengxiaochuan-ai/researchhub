export function assetDetailAiRequestAllowed(method,path){return typeof path==='string'&&new RegExp('^/research-assets/[A-Za-z0-9_-]{1,160}/versions/[1-8]/'+(method==='GET'?'ai-status':method==='POST'?'(?:ai-jobs|ai-decisions)':'INVALID')+'$').test(path);}
export function assetDetailAiReferenceLabel(source,ref){
 const fields={'pico.question':'研究问题声明','pico.p':'研究人群声明','pico.i':'干预声明','pico.c':'对照声明','pico.o':'结局声明',eligibility:'纳入与排除条件',outcomes:'结局定义',visits:'访视安排','form.fields':'采集字段',mappings:'变量映射',method:'方法声明',coverage:'覆盖范围'};
 const id=(ref?.kind==='asset'?'A':ref?.kind==='target'?'T':'')+(ref?.index??''),label=source.kind==='fixed_asset_excerpt'?'资产原文段落 '+source.locator.index:fields[source.path]??'固定版本声明';
 return'['+id+'] '+label+' · v'+source.version;
}
