import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,symlinkSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildCoreBundle,verifyCoreBundle} from './core-bundle.mjs';

function fixture(){
 const dir=mkdtempSync(join(tmpdir(),'rh-core-unit-')),source=join(dir,'source'),output=join(dir,'bundle');
 for(const p of ['src/prisma','prisma/migrations/001','node_modules/ts-node','node_modules/typescript','node_modules/prisma'])mkdirSync(join(source,p),{recursive:true});
 writeFileSync(join(source,'package.json'),JSON.stringify({dependencies:{},devDependencies:{'ts-node':'1','typescript':'1','prisma':'1'}}));
 for(const name of ['ts-node','typescript','prisma'])writeFileSync(join(source,'node_modules',name,'package.json'),JSON.stringify({version:'1.0.0'}));
 writeFileSync(join(source,'tsconfig.json'),'{}');writeFileSync(join(source,'prisma/schema.prisma'),'// synthetic schema');writeFileSync(join(source,'prisma/migrations/001/migration.sql'),'SELECT 1;');
 writeFileSync(join(source,'src/prisma/service.ts'),'export const value=1;');writeFileSync(join(source,'src/prisma/service.spec.ts'),'never bundle');writeFileSync(join(source,'.env'),'SECRET=never-copy');
 return{dir,source,output};
}
test('private core snapshot is self-verifying and never copies env, tests or installed modules',()=>{
 const f=fixture();try{const m=buildCoreBundle({source:f.source,output:f.output});assert(m.digest);assert(!existsSync(join(f.output,'.env')));assert(!existsSync(join(f.output,'node_modules')));assert(!existsSync(join(f.output,'src/prisma/service.spec.ts')));assert.equal(verifyCoreBundle(f.output,m.digest).files.length,m.files.length);
 writeFileSync(join(f.output,'src/prisma/service.ts'),'changed');assert.throws(()=>verifyCoreBundle(f.output,m.digest),/CORE_CONTENT_MISMATCH/);
 }finally{rmSync(f.dir,{recursive:true,force:true});}
});
test('core builder rejects symlinks, nested outputs and nonempty output without reading credentials',()=>{
 const f=fixture();try{assert.throws(()=>buildCoreBundle({source:f.source,output:join(f.source,'nested')}),/CORE_OUTPUT_REJECTED/);assert.throws(()=>buildCoreBundle({source:f.source,output:join(f.source,'..bundle')}),/CORE_OUTPUT_REJECTED/);symlinkSync(join(f.source,'.env'),join(f.source,'src/escape.ts'));assert.throws(()=>buildCoreBundle({source:f.source,output:f.output}),/CORE_SYMLINK_REJECTED/);
 }finally{rmSync(f.dir,{recursive:true,force:true});}
});
test('an explicitly URL-distributed dependency is vendored at its installed version',()=>{
 const f=fixture();try{mkdirSync(join(f.source,'node_modules','synthetic-url-package'));writeFileSync(join(f.source,'node_modules','synthetic-url-package','package.json'),JSON.stringify({name:'synthetic-url-package',version:'1.0.0',files:['index.js']}));writeFileSync(join(f.source,'node_modules','synthetic-url-package','index.js'),'module.exports=1;');const p=JSON.parse(readFileSync(join(f.source,'package.json')));p.dependencies={'synthetic-url-package':'https://example.test/1.0.0.tgz'};writeFileSync(join(f.source,'package.json'),JSON.stringify(p));const result=buildCoreBundle({source:f.source,output:f.output});const built=JSON.parse(readFileSync(join(f.output,'package.json')));assert.match(built.dependencies['synthetic-url-package'],/^file:vendor\//);assert(result.files.some(f=>f.path.startsWith('vendor/')));
 }finally{rmSync(f.dir,{recursive:true,force:true});}
});
test('manifest path escapes and unexpected source files are rejected at load',()=>{
 const f=fixture();try{const m=buildCoreBundle({source:f.source,output:f.output});writeFileSync(join(f.output,'src/unlisted.ts'),'unlisted');assert.throws(()=>verifyCoreBundle(f.output,m.digest),/CORE_UNLISTED_FILE/);assert.throws(()=>verifyCoreBundle(f.output,'0'.repeat(64)),/CORE_MANIFEST_MISMATCH/);
 }finally{rmSync(f.dir,{recursive:true,force:true});}
});
