import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));require('ts-node').register({project:new URL('../../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});
const {writeFormalResponseInTransaction}=require('./src/study-operations/formal-response-writer.ts');
const scope={tenantId:'t',studyGroupId:'g',researchProjectId:'p'},context={scope,actor:{kind:'account',id:'u'},assignmentId:'a',subjectId:'s',enrollmentId:'e',protocolVersionId:'pv'};
function fixture(){
 const writes=[];let row={id:'r',status:'draft',version:2,currentRevisionId:null,lockedRevisionId:null,answers:{flag:false}};
 const assignment={id:'a',subjectId:'s',enrollmentId:'e',subjectVisitId:null,formVersionId:'f',response:{id:'r'},formVersion:{status:'published',schema:{fields:[{key:'flag',label:'Flag',type:'boolean',required:true}]},scoring:null}};
 const tx={formAssignment:{findFirst:async()=>assignment,update:async()=>({})},auditLog:{create:async x=>writes.push(x)},$queryRaw:async(strings)=>{const sql=strings.join('?');if(sql.includes('pg_advisory'))return [{}];if(sql.includes('FROM public.form_assignment'))return [{id:'a'}];if(sql.includes('FROM public.form_response WHERE'))return [row];if(sql.includes('FROM public.form_response_command_receipt'))return [];if(sql.includes('FROM public.study_protocol_version'))return [{policyId:'pol',policyHash:'a'.repeat(64)}];throw Error(sql);},$executeRaw:async(strings)=>{writes.push(strings.join('?'));return 1;}};
 return {tx,writes,setRow:value=>row=value};
}
test('draft uses current CAS and preserves false without creating a revision',async()=>{
 const {tx,writes}=fixture();const result=await writeFormalResponseInTransaction(tx,context,{kind:'draft',requestKey:'request-key-1',expectedVersion:2,answers:{flag:false}});
 assert.equal(result.version,3);assert.equal(result.answers.flag,false);assert.equal(result.score,null);assert.equal(result.ref,null);assert.equal(writes.some(x=>typeof x==='string'&&x.includes('INSERT INTO public.form_response_revision')),false);
});
test('stale draft and locked response stop before any response write',async()=>{
 for(const row of [{id:'r',status:'draft',version:3,currentRevisionId:null,lockedRevisionId:null,answers:{}},{id:'r',status:'draft',version:2,currentRevisionId:null,lockedRevisionId:'x',answers:{}}]){
  const f=fixture();f.setRow(row);await assert.rejects(writeFormalResponseInTransaction(f.tx,context,{kind:'draft',requestKey:'request-key-2',expectedVersion:2,answers:{flag:false}}));assert.equal(f.writes.length,0);
 }
});
