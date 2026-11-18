import {Module,createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {FULL_STUDY_REPORT_SCHEMA,FULL_STUDY_PRESENTATION_SCHEMA} from './full-study-content.mjs';
import {canonicalReportJson} from '../research-analysis/t17-report-content.mjs';

const fail=()=>{throw new Error('FULL_STUDY_DOCX_INVALID');};
const plain=text=>String(text).replace(/&amp;|&#(60|62|124|96);/gu,(entity,code)=>entity==='&amp;'?'&':String.fromCharCode(Number(code))).replace(/^>\s?/u,'');
function docxContent(input,docx){
 const block=input.contentBlocks?.[0],presentation=block?.presentation;
 if(input.typeKey!=='analysis_report'||block.type!=='full_study_analysis'||block.schemaVersion!==FULL_STUDY_REPORT_SCHEMA||presentation?.schemaVersion!==FULL_STUDY_PRESENTATION_SCHEMA||!Array.isArray(presentation.tables)||!presentation.tables.length)fail();
 const {Paragraph,TextRun,Table,TableRow,TableCell,HeadingLevel,WidthType,TableLayoutType,BorderStyle,ShadingType}=docx;
 const children=[],lines=input.contentMd.split('\n');let tableIndex=0;
 for(let index=0;index<lines.length;index++){
  const line=lines[index];if(!line)continue;
  if(line.startsWith('|')){
   const header=line.slice(1,-1).split('|').map(cell=>cell.trim()),rows=[];
   const divider=lines[++index];if(!divider||!/^\|(?: --- \|)+$/.test(divider))fail();
   while(lines[index+1]?.startsWith('|'))rows.push(lines[++index].slice(1,-1).split('|').map(cell=>cell.trim()));
   const model=presentation.tables[tableIndex++];
   if(!model||header.length<1||header.length>6||!rows.length||rows.some(row=>row.length!==header.length)||canonicalReportJson({header,rows})!==canonicalReportJson(model))fail();
   const width=9026,base=Math.floor(width/header.length),widths=header.map((_,i)=>i===header.length-1?width-base*i:base);
   children.push(new Table({width:{size:width,type:WidthType.DXA},columnWidths:widths,layout:TableLayoutType.FIXED,
    borders:Object.fromEntries(['top','bottom','left','right','insideHorizontal','insideVertical'].map(side=>[side,{style:BorderStyle.SINGLE,size:4,color:'CBD5E1'}])),
    rows:[header,...rows].map((cells,row)=>new TableRow({tableHeader:row===0,cantSplit:true,children:cells.map((text,column)=>new TableCell({width:{size:widths[column],type:WidthType.DXA},margins:{top:80,bottom:80,left:100,right:100},shading:row===0?{type:ShadingType.CLEAR,fill:'E8EEF4'}:undefined,children:[new Paragraph({spacing:{after:0,line:250},children:[new TextRun({text:plain(text),bold:row===0,size:19})]})]}))})),
   }));continue;
  }
  const heading=/^(#{2,3}) (.+)$/.exec(line);
  children.push(heading?new Paragraph({text:plain(heading[2]),heading:heading[1].length===2?HeadingLevel.HEADING_2:HeadingLevel.HEADING_3,pageBreakBefore:heading[2]==='可复核来源',keepNext:true,spacing:{before:220,after:100}}):new Paragraph({text:plain(line.replace(/^- /,'')),spacing:{after:100,line:280}}));
 }
 if(tableIndex!==presentation.tables.length)fail();return children;
}

/** Private copy of the existing business renderer: only its trusted DOCX-content dependency differs. */
export function createFullStudyRenderer({require:providedRequire}={}){
 const require=providedRequire??createRequire(new URL('../../../app/server/package.json',import.meta.url));
 const exportPath=fileURLToPath(new URL('../../../app/server/src/research-artifacts/research-artifact-export.ts',import.meta.url));
 const formalPath=fileURLToPath(new URL('../../../app/server/src/research-artifacts/formal-report-docx.ts',import.meta.url));
 const legacy=require(formalPath),docx=require('docx'),compile=require.extensions?.['.ts'];
 if(typeof compile!=='function')throw new Error('FULL_STUDY_RENDERER_RUNTIME_REQUIRED');
 const injected={...legacy,formalReportDocxContent:input=>input.contentBlocks?.[0]?.schemaVersion===FULL_STUDY_REPORT_SCHEMA?docxContent(input,docx):legacy.formalReportDocxContent(input)};
 const resolver=createRequire(exportPath),instance=new Module(exportPath);instance.filename=exportPath;
 instance.require=specifier=>resolver.resolve(specifier)===formalPath?injected:resolver(specifier);
 compile(instance,exportPath);instance.loaded=true;
 return instance.exports.renderResearchArtifact;
}
