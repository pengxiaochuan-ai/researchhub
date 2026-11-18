import {createRequire} from 'node:module';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const require=createRequire(new URL('../../app/server/package.json',import.meta.url));
export async function createMaterialFixtures(){
 const parent=new URL('../.tmp/ai-file-data-2026-11-12/',import.meta.url).pathname;
 mkdirSync(parent,{recursive:true,mode:0o700});const dir=mkdtempSync(parent+'formats-');
 const lines=['Synthetic research upload validation','P02-HEAD: missing observations remain missing.','P02-MIDDLE: zero and false are observed values, not blanks.','P02-TAIL: no treatment effect is claimed by this synthetic note.'];
 const paths={txt:dir+'/material.txt',md:dir+'/material.md',pdf:dir+'/material.pdf',docx:dir+'/material.docx'};
 writeFileSync(paths.txt,lines.join('\n'),{mode:0o600});writeFileSync(paths.md,'# '+lines[0]+'\n\n'+lines.slice(1).join('\n\n'),{mode:0o600});
 const Pdf=require('pdfkit'),pdf=new Pdf({size:'A4',margin:48}),chunks=[];
 const done=new Promise((resolve,reject)=>{pdf.on('data',chunk=>chunks.push(chunk));pdf.on('end',resolve);pdf.on('error',reject);});
 pdf.font('Helvetica').fontSize(12);for(const line of lines)pdf.text(line).moveDown();pdf.end();await done;
 writeFileSync(paths.pdf,Buffer.concat(chunks),{mode:0o600});
 const {Document,Packer,Paragraph}=require('docx');
 const doc=new Document({styles:{default:{document:{run:{font:'Arial',size:24}}}},sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1440,right:1440,bottom:1440,left:1440}}},children:lines.map(text=>new Paragraph(text))}]});
 writeFileSync(paths.docx,await Packer.toBuffer(doc),{mode:0o600});
 return {dir,paths,markers:['P02-HEAD','P02-MIDDLE','P02-TAIL']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(await createMaterialFixtures()));
