// Read-only diagnostics for T06's original synthetic scope. Never submits a task.
import {readFile} from 'node:fs/promises';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const {ids}=JSON.parse(await readFile('../.tmp/researchhub-knowledge-local/runtime.json','utf8'));
const {env}=loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const jobs=await withFixtureTransaction(env,'direct',async tx=>{
 const rows=await tx.knowledgeChatJob.findMany({where:{tenantId:ids.tenant,accountId:{in:[ids.owner,ids.admin]},studyGroupId:ids.group,researchProjectId:ids.project},orderBy:{createdAt:'desc'},take:8});
 return rows.filter(j=>j.payload?.hubSkillRoute?.decision?.mode==='hub-literature-search').map(j=>({id:j.id,status:j.status,errorCode:j.errorCode,errorMessage:j.errorMessage,actor:j.accountId===ids.admin?'admin':'owner',text:j.text,payloadKeys:Object.keys(j.payload),evidence:j.payload.hubLiteratureEvidence?{hash:j.payload.hubLiteratureEvidence.hash,selected:j.payload.hubLiteratureEvidence.selected.map(s=>({id:s.id,title:s.title,pmid:s.pmid})),tools:j.payload.hubLiteratureEvidence.tools.map(t=>({tool:t.tool,status:t.status}))}:null,assistantMessageId:j.assistantMessageId}));
},{readOnly:true});
console.log(JSON.stringify(jobs,null,2));
