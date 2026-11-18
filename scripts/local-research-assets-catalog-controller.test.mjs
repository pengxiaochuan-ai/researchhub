import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createAssetCatalogController} from './local-research-assets-catalog-controller.mjs';

function fixture(files,overview){
 const routes=[],headers=[],calls=[],metadata=[];
 class HttpException extends Error{constructor(body,status){super(body.message);this.status=status;this.body=body;}}
 const decorator=()=>()=>{};
 const common={Controller:decorator,Req:decorator,Param:decorator,Query:decorator,Body:decorator,SetMetadata:(key,value)=>(_target,method)=>metadata.push({key,value,method}),Post:path=>(_target,method)=>routes.push({path,method}),Head:path=>(_target,method)=>routes.push({path,method}),Get:path=>(_target,method)=>routes.push({path,method}),HttpException};
 const reader={catalog:async(u,q)=>{calls.push(['catalog',u,q]);return{total:0};},detail:async(u,id,v)=>{calls.push(['detail',u,id,v]);return{id,version:v};},preview:async(u,id,v,tab)=>{calls.push(['preview',u,id,v,tab]);return{id,version:v};}};
 const views={read:async(...a)=>{calls.push(['views',...a]);return{};}};
 const details={compare:async(...a)=>{calls.push(['compare',...a]);return{};},activity:async(...a)=>{calls.push(['activity',...a]);return{};},tags:async(...a)=>{calls.push(['tags',...a]);return{};}};
 const C=createAssetCatalogController({root:'/test/',require:name=>name==='@nestjs/common'?common:{RequireStudyGroup:decorator,RequireResearchProject:decorator,RequireStudyGroupMenu:decorator,RequireStudyGroupPermission:decorator},reader,views,details,files,overview,comments:{read:async(...a)=>{calls.push(['comments',...a]);return{};},execute:async(...a)=>{calls.push(['comment-execute',...a]);return{};},history:async(...a)=>{calls.push(['comment-history',...a]);return{};}}});
 return{controller:new C(),routes,calls,req:{user:{accountId:'account'},query:{},res:{setHeader:(...a)=>headers.push(a)}},headers,metadata};
}
test('only the read-only overview opts out of mandatory Study headers; original account guard remains',async()=>{let user;const f=fixture(null,{read:async(u,q)=>{user=u;assert.deepEqual(q,{});return{complete:true};}});assert.deepEqual(f.metadata,[{key:'requireStudyGroup',value:false,method:'overview'}]);assert(f.routes.some(r=>r.method==='overview'&&r.path==='overview'));assert.equal((await f.controller.overview(f.req)).complete,true);assert.equal(user,f.req.user);await assert.rejects(f.controller.overview({...f.req,headers:{'x-researchhub-actor':'someone-else','x-researchhub-auth-version':'1'}}),e=>e.status===409);});
test('catalog controller uses static family routes, no-store, original user and exact fixed version',async()=>{
 const f=fixture();assert.deepEqual(f.routes.map(r=>r.path),['applied-drafts','applied-drafts/:id/design','applied-drafts/:id/versions/:version','applied-drafts/:id/guidance-citations','applied-drafts/:id/versions','graph','contributions','trash','recommendations','usage',':id/versions/:version/comments',':id/versions/:version/comments',':id/versions/:version/comments/:commentId/revisions',':id/versions/:version/comments/:commentId/history',':id/versions/:version/ai-status',':id/versions/:version/ai-jobs',':id/versions/:version/ai-decisions',':id/versions/:version/reuse-options',':id/versions/:version/reuse-previews',':id/versions/:version/reuses',':id/versions/:version/reuse-result',':id/versions/:version/files',':id/versions/:version/files/:fileId/content',':id/versions/:version/files/:fileId/content',':id/versions/:version/markdown',':id/versions/:version/markdown',':id/versions/:version/compare',':id/versions/:version/activity',':id/versions/:version/tags','catalog','catalog/:id','catalog/:id/versions/:version',':id/preview']);
 assert.equal((await f.controller.catalog(f.req)).total,0);await f.controller.history(f.req,'asset',2);
 assert.deepEqual(f.calls,[['catalog',f.req.user,{}],['detail',f.req.user,'asset',2]]);assert(f.headers.every(h=>h[0]==='Cache-Control'&&h[1]==='no-store'));
 await assert.rejects(f.controller.detail({...f.req,query:{unexpected:'x'}},'asset'),e=>e.status===400);
 await assert.rejects(f.controller.preview({...f.req,query:{version:['1','2']}},'asset'),e=>e.status===400);
 await assert.rejects(f.controller.preview({...f.req,query:{version:'1',tab:'private'}},'asset'),e=>e.status===400);
 await f.controller.preview({...f.req,query:{version:'1',tab:'relations'}},'asset');assert.deepEqual(f.calls.at(-1),['preview',f.req.user,'asset','1','relations']);
 await f.controller.graph(f.req);assert.deepEqual(f.calls.at(-1),['views',f.req.user,'graph',{}]);
});
test('tag mutation rejects origin, actor and path/body disagreement before reaching its service',async()=>{
 const f=fixture(),user={accountId:'account',authVersion:5},headers={origin:'http://127.0.0.1:19501','x-researchhub-request':'asset-catalog-v1','x-researchhub-actor':'account','x-researchhub-auth-version':'5'},req={...f.req,user,headers};
 await assert.rejects(f.controller.tags({...req,headers:{...headers,origin:'http://other.invalid'}},'asset','2',{baseVersion:2}),e=>e.status===403);
 await assert.rejects(f.controller.tags({...req,headers:{...headers,'x-researchhub-actor':'other'}},'asset','2',{baseVersion:2}),e=>e.status===409);
 await assert.rejects(f.controller.tags(req,'asset','2',{baseVersion:1}),e=>e.status===400);assert.equal(f.calls.length,0);
 await f.controller.tags(req,'asset','2',{baseVersion:2});assert.equal(f.calls[0][0],'tags');
});
test('local assembly registers static catalog before the old dynamic id controller',()=>{
 const code=readFileSync(new URL('./local-knowledge.mjs',import.meta.url),'utf8');
 const controllers=code.slice(code.indexOf('Module({controllers:'));
 assert(controllers.indexOf('ai.AssetCatalogController')>=0);assert(controllers.indexOf('ai.AssetCatalogController')<controllers.indexOf('ai.ResearchAssetsReadController'));
});
test('a catalog request pinned to a former actor is refused before delivering another account data',async()=>{
 const f=fixture();await assert.rejects(f.controller.catalog({...f.req,headers:{'x-researchhub-actor':'former','x-researchhub-auth-version':'1'},user:{accountId:'account',authVersion:1}}),e=>e.status===409);assert.equal(f.calls.length,0);
});

test('comment mutations require the existing same-origin actor guard and cannot confuse create with revisions',async()=>{
 const f=fixture(),user={accountId:'account',authVersion:5},headers={origin:'http://127.0.0.1:19501','x-researchhub-request':'asset-catalog-v1','x-researchhub-actor':'account','x-researchhub-auth-version':'5'},req={...f.req,user,headers};
 await assert.rejects(f.controller.commentCreate({...req,headers:{...headers,origin:'https://wrong.invalid'}},'asset','1',{action:'create'}),e=>e.status===403);
 await assert.rejects(f.controller.commentCreate(req,'asset','1',{action:'edit'}),e=>e.status===400);assert.equal(f.calls.length,0);
 await f.controller.commentCreate(req,'asset','1',{action:'create'});assert.equal(f.calls.at(-1)[0],'comment-execute');
 await assert.rejects(f.controller.commentRevise(req,'asset','1','rh-comment-'+ 'a'.repeat(32),{action:'create'}),e=>e.status===400);
});

test('binary file GET requires pinned custom request headers and rejects cross-origin before service',async()=>{const f=fixture(),user={accountId:'account',authVersion:5};await assert.rejects(f.controller.fileContent({...f.req,user,headers:{},query:{requestKey:'abcdefgh'}},'asset','1','file'),e=>e.status===403);await assert.rejects(f.controller.fileContent({...f.req,user,headers:{'x-researchhub-actor':'account','x-researchhub-auth-version':'5','x-researchhub-request':'asset-catalog-v1',origin:'https://outside.invalid'},query:{requestKey:'abcdefgh'}},'asset','1','file'),e=>e.status===403);assert.equal(f.calls.length,0);});

test('automatic HEAD fallback on GET never requires a request key or records a file event',async()=>{let head;const f=fixture({content:async(_u,_id,_v,input)=>{head=input.head;return{filename:'file.md',mimeType:'text/markdown; charset=utf-8',length:3,size:3,partial:false,sha256:'a'.repeat(64)};}});let ended=false;const req={...f.req,method:'HEAD',headers:{},res:{setHeader(){},status(){},end(){ended=true;}}};await f.controller.fileContent(req,'asset','1','file');assert.equal(head,true);assert(ended);});
