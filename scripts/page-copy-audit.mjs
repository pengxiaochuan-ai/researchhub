// Source inventory only: findings are candidates, not instructions to delete.
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url),{parse}=createRequire(require.resolve('@vitejs/plugin-react'))('@babel/parser');
const pattern=/本轮|接入|接通|接口|后端|数据库|前端|占位|布局还原|测试环境|未实现|研发|开发|测试库|默认禁用|费用上限|预算|幂等|本机|合成|Provider|Mock|Token|Study|演示|本片|切片|门禁|原系统|旧系统|保留原|沿用|白名单|CAS|U02|WP0|软件|head/;
const files=[];
function list(dir,depth=0){if(depth>6)return;for(const e of readdirSync(dir,{withFileTypes:true})){if(e.name==='node_modules'||e.name.startsWith('.'))continue;const p=dir+'/'+e.name;if(e.isDirectory())list(p,depth+1);else if(/\.(jsx?|tsx?)$/.test(p))files.push(p);}}
list('pages');list('src');
const hits=[],failures=[];
for(const file of files){let ast;try{ast=parse(readFileSync(file,'utf8'),{sourceType:'unambiguous',plugins:['jsx','typescript']});}catch(e){failures.push({file,error:e.message});continue;}
 function visit(node){if(!node||typeof node!=='object')return;if(['JSXText','StringLiteral','TemplateElement'].includes(node.type)){const text=(node.type==='TemplateElement'?node.value.cooked:node.value)?.replace(/\s+/g,' ').trim();if(text&&/[\u3400-\u9fff]/.test(text)&&pattern.test(text))hits.push({file,line:node.loc.start.line,type:node.type,text});}
 for(const [key,value]of Object.entries(node)){if(['loc','comments','leadingComments','trailingComments','innerComments','extra'].includes(key))continue;if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);}}
 visit(ast);
}
const out='docs/testing/evidence/page-copy-source-'+randomUUID();mkdirSync(out,{recursive:true});writeFileSync(out+'/inventory.json',JSON.stringify({at:new Date().toISOString(),files:files.length,hits,failures},null,2));
const groups={};for(const h of hits)groups[h.file]=(groups[h.file]??0)+1;
console.log(JSON.stringify({evidence:out,files:files.length,hits:hits.length,failures,groups},null,2));
