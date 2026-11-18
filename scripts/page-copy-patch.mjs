// Emits proposed exact patches for the parent to apply with apply_patch. No writes.
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url),{parse}=createRequire(require.resolve('@vitejs/plugin-react'))('@babel/parser');
const rules=JSON.parse(readFileSync('docs/planning/page-copy-cleanup-2026-11-06/copy-rules.json'));
const files=[];function list(dir,depth=0){if(depth>6)return;for(const e of readdirSync(dir,{withFileTypes:true})){if(e.name==='node_modules'||e.name.startsWith('.'))continue;const p=dir+'/'+e.name;if(e.isDirectory())list(p,depth+1);else if(/\.(jsx?|tsx?)$/.test(p))files.push(p);}}list('pages');list('src');
const sha=v=>createHash('sha256').update(v).digest('hex');
const parseCode=code=>parse(code,{sourceType:'unambiguous',plugins:['jsx','typescript']});
function structure(node){if(Array.isArray(node))return node.map(structure);if(!node||typeof node!=='object')return node;const copy={};for(const[k,v]of Object.entries(node)){if(['loc','start','end','comments','leadingComments','trailingComments','innerComments','extra','tokens'].includes(k))continue;if(k==='value'&&['StringLiteral','JSXText','TemplateElement'].includes(node.type)){copy[k]='COPY';continue;}copy[k]=structure(v);}return copy;}
const result=[];
for(const file of files){const before=readFileSync(file,'utf8'),ast=parseCode(before),edits=[],pairs=[...(rules.files[file]??[]),...rules.common];
 function visit(node){if(!node||typeof node!=='object')return;if(['JSXText','StringLiteral','TemplateElement'].includes(node.type)){const original=node.type==='TemplateElement'?node.value.raw:node.value;let value=original;for(const[old,text]of pairs)value=value.replaceAll(old,text);if(value!==original)edits.push({start:node.start,end:node.end,line:node.loc.start.line,type:node.type,old:original,new:value,source:node.type==='StringLiteral'?JSON.stringify(value):value});}
  for(const[k,v]of Object.entries(node)){if(['loc','comments','leadingComments','trailingComments','innerComments','extra'].includes(k))continue;if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v);}}
 visit(ast);if(!edits.length)continue;let after=before;for(const e of edits.sort((a,b)=>b.start-a.start))after=after.slice(0,e.start)+e.source+after.slice(e.end);
 const oldAst=sha(JSON.stringify(structure(ast))),newAst=sha(JSON.stringify(structure(parseCode(after))));if(oldAst!==newAst)throw Error('NON_COPY_AST_CHANGED:'+file);
 const left=before.split('\n'),right=after.split('\n');if(left.length!==right.length)throw Error('LINE_COUNT_CHANGED:'+file);
 result.push({file,beforeHash:sha(before),afterHash:sha(after),protectedAstHash:oldAst,lines:left.flatMap((old,i)=>old===right[i]?[]:[{line:i+1,old,new:right[i]}]),edits:edits.map(({source,...e})=>e)});
}
process.stdout.write(JSON.stringify(result));
