import assert from 'node:assert/strict';import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {fileURLToPath} from 'node:url';
import {target} from './f01-admission-migration.mjs';import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
export async function inspect(mode){
 assert(['before','after'].includes(mode));const {env}=target();await assertFixtureTarget(env);
 const rows=await withFixtureTransaction(env,'direct',async tx=>{
  const tables=await tx.$queryRawUnsafe("SELECT schemaname,tablename FROM pg_tables WHERE schemaname='public' OR schemaname LIKE 'rh\\_%' ESCAPE '\\' ORDER BY schemaname,tablename");const values=[];
  for(const t of tables){const name='"'+t.schemaname.replaceAll('"','""')+'"."'+t.tablename.replaceAll('"','""')+'"';const [r]=await tx.$queryRawUnsafe('SELECT count(*)::text AS count,md5(coalesce(string_agg(md5(row_to_json(x)::text),\'\' ORDER BY md5(row_to_json(x)::text)),\'\')) AS hash FROM '+name+' x');values.push({schema:t.schemaname,table:t.tablename,...r});}return values;
 },{readOnly:true});
 const dir=root+'researchhub/docs/testing/evidence/f01-admission-2026-11-17/';mkdirSync(dir,{recursive:true});
 if(mode==='before')writeFileSync(dir+'runtime-before.json',JSON.stringify({at:new Date().toISOString(),tables:rows},null,2));
 else{const before=JSON.parse(readFileSync(dir+'runtime-before.json','utf8'));const changed=rows.filter((r,i)=>JSON.stringify(r)!==JSON.stringify(before.tables[i]));writeFileSync(dir+'runtime-after.json',JSON.stringify({at:new Date().toISOString(),tables:rows,changed},null,2));assert.deepEqual(changed,[]);assert.equal(rows.length,before.tables.length);}
 return{mode,tables:rows.length,unchanged:mode==='after'};
}
if(process.argv[1]===fileURLToPath(import.meta.url))inspect(process.argv[2]?.replace(/^--/,'')).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.code??e.message);process.exitCode=1;});
