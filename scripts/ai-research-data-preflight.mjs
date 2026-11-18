import {createResearchDataPreflight,preflightError} from '../server/ai-agent/research-data-preflight.mjs';
export {selectImportDestination} from '../server/ai-agent/research-data-preflight.mjs';
// No Ingest/RawProcessing instance, storage client, model or database dependency.
export function createNativeResearchDataPreflight({load,require}){
 const XLSX=require('xlsx'),inspectBuffer=load('sessions/chat-upload-inspector','inspectChatUploadBuffer'),SignatureError=load('sessions/chat-upload-signature','ChatUploadSignatureError'),InspectionError=load('sessions/chat-upload-inspector','ChatUploadInspectionError');
 return createResearchDataPreflight({
  inspect:({filename,buffer})=>{try{return inspectBuffer({filename,buffer,declaredModality:'tabular'});}catch(e){if(e instanceof SignatureError)throw preflightError('DATA_PREFLIGHT_FORMAT');if(e instanceof InspectionError)throw preflightError('DATA_PREFLIGHT_CAPACITY');throw e;}},
  classify:load('ingest/tabular-skill-classifier','classifyTabularSkill'),
  triage:load('ingest/raw-triage','buildTabularTriageSummary'),
  readWorkbook(buffer){
   const wb=XLSX.read(buffer,{type:'buffer',raw:true,codepage:65001,cellDates:false,cellFormula:true,cellHTML:false,cellNF:false,cellStyles:false});
   if(wb.SheetNames.length>5)throw preflightError('DATA_PREFLIGHT_CAPACITY');
   return wb.SheetNames.map(name=>{
    const sheet=wb.Sheets[name],range=XLSX.utils.decode_range(sheet['!ref']??'A1');
    if(range.e.r>10000||range.e.c>=100)throw preflightError('DATA_PREFLIGHT_CAPACITY');
    const grid=XLSX.utils.sheet_to_json(sheet,{header:1,raw:true,blankrows:true,defval:null,range:{s:{r:0,c:0},e:range.e}});
    // Do not promote the first data row into a header when a header is partial.
    const headerIndex=grid.findIndex(row=>row.some(v=>v!==null&&String(v).trim()!==''));
    if(headerIndex<0)throw preflightError('DATA_PREFLIGHT_HEADER');
    const headers=Array.from({length:range.e.c+1},(_,i)=>String(grid[headerIndex][i]??'').trim());
    const rows=grid.slice(headerIndex+1).flatMap((values,index)=>{
     if(values.every(v=>v===null||v===''))return[];
     const r=headerIndex+1+index,formulaColumns=headers.flatMap((_,c)=>sheet[XLSX.utils.encode_cell({r,c})]?.f?[c+1]:[]);
     return[{rowNumber:r+1,values:headers.map((_,i)=>values[i]??null),formulaColumns}];
    });
    return{name,headers,rows};
   });
  },
 });
}
