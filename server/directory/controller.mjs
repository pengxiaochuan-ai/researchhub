import {withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import {inspectDirectorySchema,evaluateDirectorySchema,directorySchemaHash} from '../../scripts/directory-schema.mjs';
import {inspectDirectorySourceLock,evaluateDirectorySourceLock,directorySourceLockHash} from '../../scripts/directory-source-lock-schema.mjs';
import {createDirectoryService} from './commands.mjs';import {directoryError} from './contract.mjs';
import {inspectTeamDraftSchema,evaluateTeamDraftSchema,teamDraftSchemaHash} from '../../scripts/team-draft-schema.mjs';
export function directoryQuery(req,keys){const p=new URL(req.originalUrl??req.url,'http://127.0.0.1:19501').searchParams;if([...p.keys()].some(k=>!keys.includes(k)||p.getAll(k).length!==1))throw directoryError('DIRECTORY_INVALID_QUERY',400,'查询包含重复、未知或越界范围参数。');return Object.fromEntries(p);}
function verifiedTeamBrowser(h){
 // A port-stripped Origin is never sufficient. Require independent browser
 // Fetch Metadata AND the full page origin, only on explicitly opted-in writes.
 if(h.origin!=='http://127.0.0.1'||h['sec-fetch-site']!=='same-origin'||h['sec-fetch-mode']!=='same-origin'||h['sec-fetch-dest']!=='empty'||h['x-researchhub-request']!=='team-workspace-v1')return false;
 try{const page=new URL(h.referer);return page.origin==='http://127.0.0.1:19501'&&!page.username&&!page.password;}catch{return false;}
}
export function validateDirectoryRequest(req,body,{teamWorkspaceWrite=false}={}){
 const h=req.headers??{};
 if(!['127.0.0.1:19501','127.0.0.1:19502'].includes(h.host)||!['127.0.0.1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress)||['forwarded','x-forwarded-host','x-forwarded-proto'].some(k=>Object.hasOwn(h,k)))throw directoryError('DIRECTORY_ORIGIN_REJECTED',403,'仅允许本机合成环境请求。');
 if(!['GET','HEAD'].includes(req.method)){
  const sameOrigin=h.origin==='http://127.0.0.1:19501'||teamWorkspaceWrite&&req.method==='POST'&&verifiedTeamBrowser(h);
  if(!sameOrigin||!/^application\/json(?:\s*;.*)?$/i.test(h['content-type']??''))throw directoryError('DIRECTORY_ORIGIN_REJECTED',403,'仅允许本机同源JSON提交。');
 }
 if(body!==undefined&&Buffer.byteLength(JSON.stringify(body))>49152)throw directoryError('DIRECTORY_REQUEST_TOO_LARGE',413,'目录请求超过48KiB，请减少输入。');return{user:req.user};
}
const natural=(v,fallback)=>{if(v===undefined)return fallback;if(!/^[1-9]\d*$/.test(v)||!Number.isSafeInteger(Number(v))||Number(v)>10000)throw directoryError('DIRECTORY_INVALID_QUERY',400,'页码格式不正确。');return Number(v);};
export const localDirectoryBudget=Object.freeze({organization:4,team:4,researcher:5});
export async function createDirectoryController({env,ids,require}){
 evaluateDirectorySchema(await inspectDirectorySchema(env),directorySchemaHash);evaluateDirectorySourceLock(await inspectDirectorySourceLock(env),directorySourceLockHash);
 if(evaluateTeamDraftSchema(await inspectTeamDraftSchema(env),teamDraftSchemaHash)!=='existing')throw Error('DIRECTORY_TEAM_DRAFT_SCHEMA_REQUIRED');
 const db={tenantId:ids.tenant,hubKey:'lingshu-xinyu',budget:localDirectoryBudget,transaction:fn=>withFixtureTransaction(env,'app',fn)},service=createDirectoryService({db});
 const {Controller,Get,Post,Req,Res,Body,Param,HttpCode,HttpException,SetMetadata}=require('@nestjs/common');
 const invoke=async(req,res,hub,operation,browserProof)=>{res.setHeader('Cache-Control','no-store');try{if(hub!=='lingshu-xinyu')throw directoryError('DIRECTORY_NOT_FOUND',404,'该领域目录尚未开放。');validateDirectoryRequest(req,req.body,browserProof);return await operation({user:req.user});}catch(e){throw new HttpException({code:e.code??'DIRECTORY_UNAVAILABLE',message:e.status?e.message:'目录服务暂不可用，请保留输入并重新核对；不会自动重复提交。',...(Number.isInteger(e.totalPages)?{totalPages:e.totalPages}:{})},e.status??503);}};
 const listKeys=['q','direction','region','organizationType','teamType','sort','page','pageSize'];
 class DirectoryController{}
 Controller('hubs/:hubKey')(DirectoryController);
 function route(name,verb,path,handler,{publicRead=false,status=200,body=false,teamWorkspaceWrite=false}={}){const p=DirectoryController.prototype;p[name]=function(req,res,hub,id,input){return invoke(req,res,hub,ctx=>handler(ctx,req,id,input),{teamWorkspaceWrite});};const d=Object.getOwnPropertyDescriptor(p,name);verb(path)(p,name,d);HttpCode(status)(p,name,d);Req()(p,name,0);Res({passthrough:true})(p,name,1);Param('hubKey')(p,name,2);if(path.includes(':id'))Param('id')(p,name,3);if(body)Body()(p,name,4);if(publicRead)SetMetadata('isPublic',true)(p,name,d);}
 for(const[audience,prefix,publicRead]of [['public','',true],['tenant','member/',false]]){
  const researcherKeys=['q','direction','region','organizationId','researchRole','rank','sort','page','pageSize'];
  route(audience+'Researchers',Get,prefix+'researchers',(ctx,req)=>service.researchers(ctx,directoryQuery(req,researcherKeys),audience),{publicRead});
  route(audience+'ResearcherFacets',Get,prefix+'researchers/facets',(ctx,req)=>service.researcherFacets(ctx,directoryQuery(req,researcherKeys),audience),{publicRead});
  route(audience+'ResearcherRelations',Get,prefix+'researchers/:id/relations',(ctx,req,id)=>{const q=directoryQuery(req,['type','page','pageSize']);if(q.pageSize!==undefined&&q.pageSize!=='20')throw directoryError('DIRECTORY_INVALID_QUERY',400,'关联列表每页20条。');return service.researcherRelations(ctx,id,q.type,natural(q.page,1),audience);},{publicRead});
  route(audience+'Researcher',Get,prefix+'researchers/:id',(ctx,req,id)=>{directoryQuery(req,[]);return service.researcher(ctx,id,audience);},{publicRead});
  route(audience+'Teams',Get,prefix+'teams',(ctx,req)=>service.teams(ctx,directoryQuery(req,listKeys),audience),{publicRead});
  route(audience+'Facets',Get,prefix+'teams/facets',(ctx,req)=>service.facets(ctx,directoryQuery(req,listKeys),audience),{publicRead});
  route(audience+'Map',Get,prefix+'teams/map',(ctx,req)=>service.map(ctx,directoryQuery(req,listKeys),audience),{publicRead});
  route(audience+'Relations',Get,prefix+'teams/:id/relations',(ctx,req,id)=>{const q=directoryQuery(req,['type','page','pageSize']);if(q.pageSize!==undefined&&q.pageSize!=='20')throw directoryError('DIRECTORY_INVALID_QUERY',400,'关联列表每页20条。');return service.relations(ctx,id,q.type,natural(q.page,1),audience);},{publicRead});
  route(audience+'Team',Get,prefix+'teams/:id',(ctx,req,id)=>{directoryQuery(req,[]);return service.team(ctx,id,audience);},{publicRead});
 }
 route('entities',Get,'directory-admin/entities',(ctx,req)=>{const q=directoryQuery(req,['kind','q','page','pageSize']);if(q.pageSize!==undefined&&q.pageSize!=='20'||q.q?.length>120)throw directoryError('DIRECTORY_INVALID_QUERY',400,'目录查询参数不正确。');return service.adminEntities(ctx,{kind:q.kind,q:q.q,page:natural(q.page,1)});});
 route('sources',Get,'directory-admin/sources',(ctx,req)=>service.sources(ctx,directoryQuery(req,['q']).q??''));
 route('teamWorkspaces',Get,'directory-admin/team-workspaces',(ctx,req)=>{const q=directoryQuery(req,['q','page']);return service.teamWorkspaces(ctx,{q:q.q,page:natural(q.page,1)});});
 route('teamChoices',Get,'directory-admin/team-workspace-choices',(ctx,req)=>{const q=directoryQuery(req,['kind','q','page']);return service.teamWorkspaceChoices(ctx,{kind:q.kind,q:q.q,page:natural(q.page,1)});});
 route('createTeamWorkspace',Post,'directory-admin/team-workspaces',(ctx,req,_id,input)=>{directoryQuery(req,[]);return service.createTeamWorkspace(ctx,input);},{body:true,status:201,teamWorkspaceWrite:true});
 route('teamWorkspace',Get,'directory-admin/team-workspaces/:id',(ctx,req,id)=>{directoryQuery(req,[]);return service.teamWorkspace(ctx,id);});
 route('saveTeamWorkspace',Post,'directory-admin/team-workspaces/:id',(ctx,req,id,input)=>{directoryQuery(req,[]);return service.saveTeamWorkspace(ctx,id,input);},{body:true,teamWorkspaceWrite:true});
 route('previewTeamWorkspace',Get,'directory-admin/team-workspaces/:id/preview',(ctx,req,id)=>service.previewTeamWorkspace(ctx,id,directoryQuery(req,['audience']).audience??'tenant'));
 route('reviewTeamWorkspace',Post,'directory-admin/team-workspaces/:id/reviews',(ctx,req,id,input)=>{directoryQuery(req,[]);return service.reviewTeamWorkspace(ctx,id,input);},{body:true,teamWorkspaceWrite:true});
 route('teamWorkspaceReceipt',Get,'directory-admin/team-workspaces/:id/receipts',(ctx,req,id)=>service.teamWorkspaceReceipt(ctx,id,directoryQuery(req,['key']).key));
 route('createEntity',Post,'directory-admin/entities',(ctx,req,_id,input)=>{directoryQuery(req,[]);return service.createEntity(ctx,input);},{body:true,status:201});
 route('entity',Get,'directory-admin/entities/:id',(ctx,req,id)=>{directoryQuery(req,[]);return service.adminEntity(ctx,id);});
 route('assert',Post,'directory-admin/entities/:id/assertions',(ctx,req,id,input)=>{directoryQuery(req,[]);return service.appendAssertion(ctx,id,input);},{body:true,status:201});
 route('assertion',Get,'directory-admin/assertions/:id',(ctx,req,id)=>{directoryQuery(req,[]);return service.adminAssertion(ctx,id);});
 route('decide',Post,'directory-admin/assertions/:id/decisions',(ctx,req,id,input)=>{directoryQuery(req,[]);return service.decide(ctx,id,input);},{body:true});
 route('history',Get,'directory-admin/assertions/:id/decisions',(ctx,req,id)=>{const q=directoryQuery(req,['page','pageSize']);if(q.pageSize!==undefined&&q.pageSize!=='20')throw directoryError('DIRECTORY_INVALID_QUERY',400,'历史每页20条。');return service.history(ctx,id,natural(q.page,1));});
 route('operation',Get,'directory-admin/operations/:id',(ctx,req,id)=>service.operation(ctx,id,directoryQuery(req,['operation']).operation));
 return DirectoryController;
}
