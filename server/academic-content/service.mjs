import {createHash,randomUUID} from 'node:crypto';
import {HUB_KEY,fail,only,draftInput,validatePublication,publicView,safeUrl,contentCard} from './policy.mjs';
import {normalizeDraft,operationPayload,canonicalContent} from './contract.mjs';
import {assertApprovedInTransaction,bindAdmissionContext} from '../admission/service.mjs';
export const contentHash=value=>createHash('sha256').update(canonicalContent(value)).digest('hex');
// Hash the exact submitted JSON and action/target; the browser can reproduce it without private data in its GET.
export const mutationHash=(action,id,body)=>contentHash(operationPayload(action,id,body));
const validId=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const notFound=()=>fail(404,'CONTENT_NOT_FOUND','内容不存在或当前不可访问。');
const conflict=()=>fail(409,'CONTENT_VERSION_CONFLICT','内容已变化，请保留输入后核对最新版本。');
export function createAcademicContentService({transact,lockAuthorization,tenantId,hubKey=HUB_KEY,now=()=>new Date(),recordPublicVersion}){
 if(typeof transact!=='function'||typeof lockAuthorization!=='function'||!validId(tenantId)||hubKey!==HUB_KEY)throw Error('CONTENT_DEPENDENCIES_REQUIRED');
 async function activeDeployment(tx){const rows=await tx.$queryRawUnsafe("SELECT t.id FROM public.tenant t JOIN rh_hub.hub h ON h.tenant_id=t.id WHERE t.id=$1 AND t.status='active' AND h.hub_key=$2 AND h.status='active'",tenantId,hubKey);if(!rows[0])fail(503,'CONTENT_DEPLOYMENT_UNAVAILABLE','当前平台内容暂不可用。');}
 async function identity(tx,p,admin){
  if(p?.tenantId!==tenantId||!validId(p.accountId)||!Number.isSafeInteger(p.authVersion)||p.authVersion<0)fail(401,'AUTH_SESSION_EXPIRED','请先登录。');
  await bindAdmissionContext(tx,p,hubKey);
  const a=await tx.account.findFirst({where:{id:p.accountId,tenantId,status:'active',authVersion:p.authVersion,tenant:{status:'active'}},select:{id:true,role:true,isTenantAdmin:true}});
  if(!a)fail(401,'AUTH_SESSION_EXPIRED','登录身份已失效。');
  if(admin&&(a.role!=='tenant_admin'||a.isTenantAdmin!==true))fail(403,'CONTENT_ADMIN_REQUIRED','当前账号没有内容管理权限。');
  await assertApprovedInTransaction(tx,p,hubKey);
 }
 const run=(p,fn,{admin=false}={})=>transact(async tx=>{await lockAuthorization(tx,tenantId);await activeDeployment(tx);if(p)await identity(tx,p,admin);else{if(admin)fail(401,'AUTH_SESSION_EXPIRED','请先登录。');await bindAdmissionContext(tx,{tenantId,accountId:'',authVersion:-1},hubKey);}return fn(tx);});
 async function find(tx,id,lock=false){if(!validId(id))notFound();const rows=await tx.$queryRawUnsafe('SELECT * FROM rh_academic.content WHERE tenant_id=$1 AND hub_key=$2 AND id=$3'+(lock?' FOR UPDATE':''),tenantId,hubKey,id);if(!rows[0])notFound();return rows[0];}
 const present=r=>({id:r.id,revision:r.revision,status:r.status,draft:r.draft,publishedVersionId:r.published_version_id,publishedAt:r.first_published_at?new Date(r.first_published_at).toISOString():null,updatedAt:new Date(r.updated_at).toISOString(),hasUnpublishedChanges:r.status==='published'&&contentHash(r.draft)!==r.published_hash});
 async function prior(tx,p,key){return(await tx.$queryRawUnsafe('SELECT * FROM rh_academic.event WHERE tenant_id=$1 AND actor_id=$2 AND request_key=$3',tenantId,p.accountId,key))[0];}
 function input(body,keys,revision=true){only(body,keys);if(typeof body.requestKey!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(body.requestKey)||revision&&(!Number.isSafeInteger(body.baseRevision)||body.baseRevision<1))fail(400,'CONTENT_INPUT_INVALID','操作信息无效，请重新核对。');}
 async function record(tx,p,row,action,body,hash,baseRevision){
  const receipt={contentId:row.id,action,baseRevision,requestKey:body.requestKey,requestHash:hash},result={content:present(row),receipt};
  await tx.$queryRawUnsafe('INSERT INTO rh_academic.event(id,content_id,tenant_id,hub_key,actor_id,actor_auth_version,action,base_revision,revision,request_key,request_hash,result,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13)',randomUUID(),row.id,tenantId,hubKey,p.accountId,p.authVersion,action,baseRevision,row.revision,body.requestKey,hash,JSON.stringify(result),body.reason??'');
  await tx.auditLog.create({data:{tenantId,accountId:p.accountId,action:'hub.academic.'+action,target:row.id,meta:{hubKey,revision:row.revision,publishedVersionId:row.published_version_id,requestKey:body.requestKey,requestHash:hash}}});return result;
 }
 async function replay(tx,p,key,hash){const saved=await prior(tx,p,key);if(!saved)return null;if(saved.request_hash!==hash)fail(409,'CONTENT_REQUEST_CONFLICT','原请求标识对应不同内容，请核对原操作。');return saved.result;}
 async function update(tx,row,{draft=row.draft,status=row.status,versionId=row.published_version_id,audience=row.published_audience,firstPublishedAt=row.first_published_at,publishedHash=row.published_hash},date){
  const rows=await tx.$queryRawUnsafe('UPDATE rh_academic.content SET draft=$5::jsonb,status=$6,published_version_id=$7,published_audience=$8,first_published_at=$9,updated_at=$10,published_hash=$11,revision=revision+1 WHERE id=$1 AND tenant_id=$2 AND hub_key=$3 AND revision=$4 RETURNING *',row.id,tenantId,hubKey,row.revision,JSON.stringify(draft),status,versionId,audience,firstPublishedAt,date,publishedHash);if(!rows[0])conflict();return rows[0];
 }
 async function published(tx,p,id){if(!validId(id))notFound();const rows=await tx.$queryRawUnsafe("SELECT v.*,c.first_published_at FROM rh_academic.content c JOIN rh_academic.version v ON v.id=c.published_version_id AND v.content_id=c.id AND v.tenant_id=c.tenant_id AND v.hub_key=c.hub_key WHERE c.tenant_id=$1 AND c.hub_key=$2 AND c.id=$3 AND c.status='published'"+(p?'':" AND v.payload->>'audience'='public'"),tenantId,hubKey,id);if(!rows[0])notFound();return rows[0];}
 function view(v,p,date){return publicView({...v.payload,id:v.content_id,publishedAt:v.first_published_at,updatedAt:v.published_at,resources:v.payload.resources.map(r=>({...r,key:v.id+'_'+r.key}))},Boolean(p),date.getTime());}
 return{
  hubKey,
  // Only this scoped service may inspect publication history; never expose raw versions to public SQL roles.
  publicActivitySources:()=>run(null,async tx=>{
   const rows=await tx.$queryRawUnsafe(`SELECT c.id AS "contentId",v.payload->>'title' AS title,v.payload->>'type' AS type,
    v.payload->>'summary' AS summary,first_public.published_at AS "firstPublicAt",first_public.id AS "proofVersionId"
    FROM rh_academic.content c JOIN rh_academic.version v ON v.id=c.published_version_id AND v.content_id=c.id
     AND v.tenant_id=c.tenant_id AND v.hub_key=c.hub_key
    JOIN LATERAL(SELECT h.id,h.published_at FROM rh_academic.version h WHERE h.tenant_id=c.tenant_id
     AND h.hub_key=c.hub_key AND h.content_id=c.id AND h.payload->>'audience'='public'
     ORDER BY h.published_at,h.id LIMIT 1)first_public ON true
    WHERE c.tenant_id=$1 AND c.hub_key=$2 AND c.status='published' AND v.payload->>'audience'='public'
    ORDER BY first_public.published_at,c.id`,tenantId,hubKey);
   return rows.map(row=>({id:row.contentId,title:row.title,type:row.type,summary:row.summary??'',
    firstPublicAt:new Date(row.firstPublicAt).toISOString(),proofRef:'academic-public-version:'+row.proofVersionId}));
  }),
  create:(p,body)=>{input(body,['requestKey','draft'],false);const draft=normalizeDraft(body.draft),hash=mutationHash('create',null,body);return run(p,async tx=>{const old=await replay(tx,p,body.requestKey,hash);if(old)return old;const date=now(),rows=await tx.$queryRawUnsafe('INSERT INTO rh_academic.content(id,tenant_id,hub_key,draft,updated_at,created_at) VALUES($1,$2,$3,$4::jsonb,$5,$5) RETURNING *',randomUUID(),tenantId,hubKey,JSON.stringify(draft),date);return record(tx,p,rows[0],'create',body,hash,0);},{admin:true});},
  save:(p,id,body)=>{input(body,['requestKey','baseRevision','draft']);const draft=normalizeDraft(body.draft),hash=mutationHash('save',id,body);return run(p,async tx=>{const row=await find(tx,id,true),old=await replay(tx,p,body.requestKey,hash);if(old)return old;if(row.revision!==body.baseRevision)conflict();return record(tx,p,await update(tx,row,{draft},now()),'save',body,hash,body.baseRevision);},{admin:true});},
  publish:(p,id,body)=>{input(body,['requestKey','baseRevision']);const hash=mutationHash('publish',id,body);return run(p,async tx=>{const row=await find(tx,id,true),old=await replay(tx,p,body.requestKey,hash);if(old)return old;if(row.revision!==body.baseRevision)conflict();const draft=normalizeDraft(row.draft);validatePublication(draft);const date=now(),versionId=randomUUID();await tx.$queryRawUnsafe('INSERT INTO rh_academic.version(id,content_id,tenant_id,hub_key,payload,published_at,revision) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7)',versionId,id,tenantId,hubKey,JSON.stringify(draft),date,row.revision+1);const changed=await update(tx,row,{status:'published',versionId,audience:draft.audience,firstPublishedAt:row.first_published_at??date,publishedHash:contentHash(draft)},date);const receipt=await record(tx,p,changed,'publish',body,hash,body.baseRevision);if(draft.audience==='public'&&recordPublicVersion)await recordPublicVersion(tx,{tenantId,hubKey},id);return receipt;},{admin:true});},
  withdraw:(p,id,body)=>{input(body,['requestKey','baseRevision','reason']);if(typeof body.reason!=='string'||!body.reason.trim()||[...body.reason].length>1000)fail(400,'CONTENT_REASON_REQUIRED','请填写撤下原因（最多1000字）。');const hash=mutationHash('withdraw',id,body);return run(p,async tx=>{const row=await find(tx,id,true),old=await replay(tx,p,body.requestKey,hash);if(old)return old;if(row.revision!==body.baseRevision)conflict();if(row.status!=='published')fail(409,'CONTENT_STATE_CONFLICT','当前内容未发布。');return record(tx,p,await update(tx,row,{status:'withdrawn',versionId:null,audience:null},now()),'withdraw',body,hash,body.baseRevision);},{admin:true});},
  adminDetail:(p,id)=>run(p,async tx=>present(await find(tx,id)),{admin:true}),
  adminList:(p,q={})=>run(p,async tx=>{
   only(q,['status','type','q','page']);const status=q.status??'all',type=q.type??'all',search=q.q??'',page=Number(q.page??1);if(!['all','draft','published','withdrawn'].includes(status)||!['all','news','progress','notice','event'].includes(type)||typeof search!=='string'||search.length>200||!Number.isSafeInteger(page)||page<1||page>100000)fail(400,'CONTENT_INPUT_INVALID','列表筛选无效。');
   const filter="tenant_id=$1 AND hub_key=$2 AND ($3='all' OR status=$3) AND ($4='all' OR draft->>'type'=$4) AND (draft->>'title' ILIKE $5 OR draft->>'summary' ILIKE $5)",args=[tenantId,hubKey,status,type,'%'+search+'%'];const total=Number((await tx.$queryRawUnsafe('SELECT count(*) AS total FROM rh_academic.content WHERE '+filter,...args))[0].total),actualPage=Math.min(page,Math.max(1,Math.ceil(total/20)));const rows=await tx.$queryRawUnsafe('SELECT * FROM rh_academic.content WHERE '+filter+' ORDER BY updated_at DESC,id DESC LIMIT 20 OFFSET $6',...args,(actualPage-1)*20);return{items:rows.map(present),page:actualPage,total};
  },{admin:true}),
  history:(p,id)=>run(p,async tx=>{await find(tx,id);const rows=await tx.$queryRawUnsafe('SELECT action,base_revision AS "baseRevision",revision,actor_id AS "actorId",created_at AS "createdAt",reason,result FROM rh_academic.event WHERE tenant_id=$1 AND hub_key=$2 AND content_id=$3 ORDER BY revision DESC',tenantId,hubKey,id);return{items:rows};},{admin:true}),
  operation:(p,id,key,proof={})=>run(p,async tx=>{
   if(typeof key!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(key))fail(400,'CONTENT_INPUT_INVALID','原操作信息无效。');only(proof,['action','baseRevision','requestHash']);const revision=Number(proof.baseRevision),hasProof=Object.keys(proof).length>0;if(hasProof&&(!['create','save','publish','withdraw'].includes(proof.action)||!Number.isSafeInteger(revision)||revision<0||!/^[a-f0-9]{64}$/.test(proof.requestHash??'')))fail(400,'CONTENT_INPUT_INVALID','原操作证明不完整。');
   const saved=await prior(tx,p,key);if(saved){if(saved.content_id!==id&&!(id===null&&saved.action==='create')||hasProof&&(saved.action!==proof.action||saved.base_revision!==revision||saved.request_hash!==proof.requestHash))fail(409,'CONTENT_REQUEST_CONFLICT','原回执与本次操作不一致。');const result=saved.result;return{state:'committed',...result.receipt,result};}
   if(!hasProof)fail(404,'CONTENT_OPERATION_UNKNOWN','尚无可确认回执，请保留原输入。');if(id===null){if(proof.action!=='create'||revision!==0)fail(400,'CONTENT_INPUT_INVALID','原创建信息无效。');return{state:'unsubmitted',contentId:null,action:proof.action,baseRevision:0,requestKey:key,requestHash:proof.requestHash,revision:0};}
   const row=await find(tx,id,true),binding={contentId:id,action:proof.action,baseRevision:revision,requestKey:key,requestHash:proof.requestHash};if(proof.action==='create')fail(400,'CONTENT_INPUT_INVALID','请从原创建操作核对。');if(row.revision!==revision)return{...binding,state:'superseded',revision:row.revision,status:row.status};if(proof.action==='withdraw'&&row.status!=='published')fail(409,'CONTENT_STATE_CONFLICT','当前内容不可撤下。');if(proof.action==='publish')validatePublication(normalizeDraft(row.draft));return{...binding,state:'unsubmitted',revision:row.revision};
  },{admin:true}),
  detail:(p,id)=>run(p,async tx=>view(await published(tx,p,id),p,now())),
  resource:(p,id,key)=>run(p,async tx=>{const v=await published(tx,p,id),item=v.payload.resources.find(r=>v.id+'_'+r.key===key&&(p||r.audience==='public'));if(!item||!item.rights)notFound();return{url:safeUrl(item.url)};}),
  list:(p,q={})=>run(p,async tx=>{
   only(q,['type','phase','q','limit','cursor','order']);const type=q.type??'all',phase=q.phase??'all',search=q.q??'',limit=Number(q.limit??20),order=q.order??'published';if(!['all','news','progress','notice','event'].includes(type)||!['all','upcoming','ongoing','past','cancelled'].includes(phase)||typeof search!=='string'||search.length>200||!Number.isInteger(limit)||limit<1||limit>20||!['published','portal'].includes(order)||order==='portal'&&(type!=='event'||limit>3||q.cursor))fail(400,'CONTENT_INPUT_INVALID','内容筛选无效。');
   const binding=contentHash({tenantId,hubKey,actor:p?.accountId??null,authVersion:p?.authVersion??null,type,phase,search,order}),date=now();let after=null;if(q.cursor){try{if(typeof q.cursor!=='string'||q.cursor.length>1024)throw Error();after=JSON.parse(Buffer.from(q.cursor,'base64url').toString('utf8'));if(after.binding!==binding||!validId(after.id)||!Number.isFinite(Date.parse(after.at)))throw Error();}catch{fail(400,'CONTENT_CURSOR_INVALID','列表位置已变化，请重新读取。');}}
   const stage="CASE WHEN v.payload->'event'->>'cancelled'='true' THEN 'cancelled' WHEN $7::timestamptz<(v.payload->'event'->>'startAt')::timestamptz THEN 'upcoming' WHEN $7::timestamptz<(v.payload->'event'->>'endAt')::timestamptz THEN 'ongoing' ELSE 'past' END";
   const sql="SELECT v.*,c.first_published_at FROM rh_academic.content c JOIN rh_academic.version v ON v.id=c.published_version_id AND v.content_id=c.id AND v.tenant_id=c.tenant_id AND v.hub_key=c.hub_key WHERE c.tenant_id=$1 AND c.hub_key=$2 AND c.status='published'"+(p?'':" AND v.payload->>'audience'='public'")+" AND ($3='all' OR v.payload->>'type'=$3) AND (v.payload->>'title' ILIKE $4 OR v.payload->>'summary' ILIKE $4) AND ($5::timestamptz IS NULL OR (c.first_published_at,c.id)<($5::timestamptz,$6::text)) AND ($8='all' OR (v.payload->>'type'='event' AND ("+stage+")=$8))"+(order==='portal'?" ORDER BY CASE ("+stage+") WHEN 'upcoming' THEN 0 WHEN 'ongoing' THEN 1 ELSE 2 END,CASE WHEN (v.payload->'event'->>'endAt')::timestamptz<=$7::timestamptz THEN -extract(epoch FROM (v.payload->'event'->>'endAt')::timestamptz) ELSE extract(epoch FROM (v.payload->'event'->>'startAt')::timestamptz) END,v.id":" ORDER BY c.first_published_at DESC,c.id DESC")+' LIMIT $9';
   const rows=await tx.$queryRawUnsafe(sql,tenantId,hubKey,type,'%'+search+'%',after?.at??null,after?.id??'',date,phase,limit+1),items=rows.slice(0,limit),last=items.at(-1);return{items:items.map(v=>contentCard(view(v,p,date))),nextCursor:order==='published'&&rows.length>limit?Buffer.from(JSON.stringify({binding,at:last.first_published_at,id:last.content_id})).toString('base64url'):null};
  }),
 };
}
