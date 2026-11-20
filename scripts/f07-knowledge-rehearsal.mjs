// Exact role-only preparation for the current owned F06/F07 synthetic database.
// Import/inspect is read-only. configure must be invoked only after the root's
// F06 negative-check gate; it neither creates a knowledge base nor enables AI.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {inspectRehearsal} from '../deploy/rehearsal.mjs';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const fail=()=>{throw Error('F07_OWNED_SCOPE_REJECTED');};
export function f07RoleDelta(role,ids){
 if(role?.id!==ids.reader+'-target-editor'||role.tenantId!==ids.tenant||role.key!=='f06-target-editor'||role.status!=='active'||!Array.isArray(role.menuPermissions)||!Array.isArray(role.buttonPermissions)||role.menuPermissions.includes('*')||role.buttonPermissions.includes('*'))fail();
 return{menuPermissions:[...new Set([...role.menuPermissions,'knowledge'])],buttonPermissions:[...new Set([...role.buttonPermissions,'knowledge.edit'])]};
}
export function f07Owned(directory){
 directory=path.resolve(directory);
 if(!directory.startsWith(path.join(root,'.tmp/f06-hub-assets-')))fail();
 const state=JSON.parse(fs.readFileSync(directory+'/rehearsal-state.json')),prepared=JSON.parse(fs.readFileSync(directory+'/prepared.json'));
 if(!prepared.syntheticOnly||prepared.runId!==state.runId||prepared.database!==state.database||prepared.port!==19661)fail();
 inspectRehearsal(state);
 return{directory,state,prepared,origin:'http://127.0.0.1:19663'};
}
export async function configureF07(directory){
 const owned=f07Owned(directory),{state,prepared}=owned,ids=prepared.ids;
 const require=createRequire('/Users/mac/aisciencesys/app/server/package.json');
 require('ts-node').register({project:'/Users/mac/aisciencesys/app/server/tsconfig.json',transpileOnly:true});
 const {PrismaClient}=require('@prisma/client'),urls=JSON.parse(fs.readFileSync(owned.directory+'/runtime-database.json'));
 const url=new URL(urls.directUrl);if(url.pathname!=='/'+state.database)fail();url.hostname='127.0.0.1';url.port='19661';
 const db=new PrismaClient({datasources:{db:{url:url.toString()}}}),lock=require('/Users/mac/aisciencesys/app/server/src/common/worker-publication.ts').lockAuthorizationMutation;
 try{
  const proof=await db.$transaction(async tx=>{
   const [identity]=await tx.$queryRawUnsafe('SELECT current_database() AS database,current_user AS role');
   if(identity.database!==state.database||identity.role!=='aisci_owner')fail();
   await lock(tx,ids.tenant);
   const member=await tx.studyGroupMembership.findUnique({where:{id:ids.invite+'-target-group'},include:{role:true}});
   const account=await tx.account.findUnique({where:{id:ids.invite}});
   if(member?.tenantId!==ids.tenant||member.studyGroupId!==ids.group||member.accountId!==ids.invite||member.status!=='active'||account?.tenantId!==ids.tenant||account.role!=='researcher'||account.isTenantAdmin||account.status!=='active')fail();
   const linked=await tx.studyGroupMembership.findMany({where:{roleId:member.roleId},select:{accountId:true,tenantId:true}});
   if(linked.length!==1||linked[0].accountId!==ids.invite||linked[0].tenantId!==ids.tenant)fail();
   const counts=async()=>({source:await tx.researchProjectMembership.count({where:{tenantId:ids.tenant,accountId:ids.invite,researchProjectId:ids.sourceProject,status:'active'}}),target:await tx.researchProjectMembership.count({where:{tenantId:ids.tenant,accountId:ids.invite,researchProjectId:ids.targetProject,status:'active'}})});
   const before=await counts();if(before.source!==0||before.target!==1)fail();
   const next=f07RoleDelta(member.role,ids);
   await tx.permissionRole.update({where:{id:member.roleId},data:next});
   const after=await counts();if(after.source!==0||after.target!==1)fail();
   return{syntheticOnly:true,runId:state.runId,database:state.database,dbPort:19661,accountId:ids.invite,roleId:member.roleId,before:{menuPermissions:member.role.menuPermissions,buttonPermissions:member.role.buttonPermissions,memberships:before},after:{...next,memberships:after},added:['menu:knowledge','button:knowledge.edit'],privateKnowledgeBaseCreated:false,aiEnabled:false,modelCalls:0};
  },{timeout:15000});
  const file=owned.directory+'/f07-configuration-'+randomUUID()+'.json';fs.writeFileSync(file,JSON.stringify(proof,null,2)+'\n',{mode:0o600,flag:'wx'});
  return{configured:true,proof:file,roleId:proof.roleId,sourceMemberships:0,targetMemberships:1,modelCalls:0};
 }finally{await db.$disconnect();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 try{const[command,directory]=process.argv.slice(2);if(!['inspect','configure'].includes(command))fail();const value=command==='configure'?await configureF07(directory):(()=>{const{state,prepared,origin}=f07Owned(directory);return{syntheticOnly:true,runId:state.runId,database:state.database,dbPort:19661,origin,roleId:prepared.ids.reader+'-target-editor',plannedAddition:['menu:knowledge','button:knowledge.edit'],writes:0};})();console.log(JSON.stringify(value));}
 catch(error){console.error(error.message?.startsWith('F07_')?error.message:'F07_CONFIGURATION_FAILED');process.exitCode=1;}
}
