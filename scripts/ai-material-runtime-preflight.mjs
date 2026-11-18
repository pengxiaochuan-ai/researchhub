// Read-only check before a local-only owned runtime reload. No worker actions.
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const {env}=loadFixtureInput('/Users/mac/aisciencesys/.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const {ids}=JSON.parse(readFileSync('/Users/mac/aisciencesys/.tmp/researchhub-knowledge-local/runtime.json','utf8'));
const result=await withFixtureTransaction(env,'direct',async tx=>{
 const names=await tx.$queryRawUnsafe(`SELECT c.table_name FROM information_schema.columns c WHERE c.table_schema='public' GROUP BY c.table_name HAVING bool_or(c.column_name='leaseExpiresAt') AND bool_or(c.column_name='tenantId') AND bool_or(c.column_name='status') ORDER BY c.table_name`);
 const active=[];
 for(const {table_name:name}of names){if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name))throw Error('INVALID_CATALOG_IDENTIFIER');
  const [row]=await tx.$queryRawUnsafe(`SELECT count(*)::int AS count FROM public."${name}" WHERE "tenantId"=$1 AND status::text IN ('running','processing')`,ids.tenant);active.push({table:name,count:row.count});
 }
 const queued=await tx.knowledgeChatJob.findMany({where:{tenantId:ids.tenant,status:'queued'},select:{id:true},orderBy:{id:'asc'}});
 const recent=await tx.knowledgeChatJob.count({where:{tenantId:ids.tenant,createdAt:{gt:new Date(Date.now()-120000)}}});
 return{active,recentJobs:recent,historicalQueued:queued.length,queuedIdHash:createHash('sha256').update(JSON.stringify(queued.map(x=>x.id))).digest('hex')};
},{readOnly:true});
console.log(JSON.stringify(result));if(result.active.some(x=>x.count)||result.recentJobs)process.exitCode=2;
