import {createHash} from 'node:crypto';

const fail=()=>{throw new Error('ASSET_PRODUCTION_SCHEMA_DRIFT');};
const replace=(text,before,after)=>{if(text.split(before).length!==2)fail();return text.replace(before,after);};
const parent='rh_asset.business_parent_matches(asset_id,tenant_id,study_group_id,research_project_id,owner_account_id)';
const object='rh_asset.business_object_matches(asset_id,tenant_id,study_group_id,research_project_id)';
const scope=action=>`rh_asset.business_scope_matches(tenant_id,study_group_id,research_project_id,'${action}')`;
const recipients=column=>`rh_asset.business_recipients_valid(asset_id,tenant_id,study_group_id,research_project_id,ARRAY[${column}])`;
function constraint(snapshot,table,name,predicate){
 const old=snapshot.constraints.find(x=>x.table===table&&x.name===name),expression=old?.definition?.match(/^CHECK \(([\s\S]*)\)$/)?.[1];if(!expression)fail();
 return[`ALTER TABLE rh_asset.${table} DROP CONSTRAINT ${name}`,`ALTER TABLE rh_asset.${table} ADD CONSTRAINT ${name} CHECK (CASE WHEN asset_id LIKE 'rhab-%' THEN (${predicate}) ELSE (${expression}) END)`];
}
function definition(snapshot,name){const match=snapshot.functions.filter(x=>x.name===name);if(match.length!==1)fail();return match[0].definition.replace(/^CREATE FUNCTION /,'CREATE OR REPLACE FUNCTION ');}
export function runtimeReuseKey({kind,assetId,version,targetProjectId,accountId,requestKey}){return'rhab-reuse:'+createHash('sha256').update([kind,assetId,String(version),targetProjectId,accountId,requestKey].join('\x1f')).digest('hex');}
export function assetProductionStatements(snapshot){
 const statements=[];
 statements.push(...constraint(snapshot,'asset_registry','asset_registry_tenant_id_check',parent));
 for(const[name,predicate]of[
  ['access_request_initiator_account_id_check',recipients('initiator_account_id')],
  ['access_request_recipient_account_id_check',recipients('recipient_account_id')],
  ['access_request_decided_by_check',`decided_by IS NULL OR ${recipients('decided_by')}`],
  ['access_request_check2',`rh_asset.business_recipients_valid(asset_id,tenant_id,study_group_id,research_project_id,CASE WHEN initiator_account_id=recipient_account_id THEN ARRAY[initiator_account_id] ELSE ARRAY[initiator_account_id,recipient_account_id] END)`]
 ])statements.push(...constraint(snapshot,'access_request',name,predicate));
 statements.push(...constraint(snapshot,'asset_comment_event','asset_comment_event_comment_id_check',`${object} AND comment_id ~ '^rhc-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'`));
 statements.push(...constraint(snapshot,'asset_comment_event','asset_comment_event_revision_check',`${object} AND revision>0`));
 const actor="current_setting('app.account_id',true)",manager=`EXISTS(SELECT 1 FROM rh_asset.asset_registry r JOIN public.account a ON a.id=${actor} AND a."tenantId"=r.tenant_id WHERE r.asset_id=access_request.asset_id AND a.status='active' AND (a.id=r.owner_account_id OR a.role='tenant_admin'))`;
 statements.push(`CREATE POLICY runtime_business_insert ON rh_asset.access_request FOR INSERT WITH CHECK (${object} AND ${scope('artifact.read')} AND initiator_account_id=${actor})`);
 statements.push(`CREATE POLICY runtime_business_update ON rh_asset.access_request FOR UPDATE USING (${object} AND ${scope('artifact.read')} AND ${manager}) WITH CHECK (${object} AND ${scope('artifact.read')} AND ${manager})`);
 const body=`rh_asset.detail_actor_can_use(asset_id,version_no,'read_body')`;
 for(const table of ['asset_comment_event','asset_reuse_record']){
  const own=table==='asset_reuse_record'?` AND (actor_account_id=${actor} OR EXISTS(SELECT 1 FROM public.account a WHERE a.id=${actor} AND a."tenantId"=tenant_id AND a.status='active' AND a.role='tenant_admin'))`:'';
  statements.push(`CREATE POLICY runtime_business_select ON rh_asset.${table} FOR SELECT USING (${object} AND ${scope('artifact.read')} AND ${body}${own})`);
  const use=table==='asset_comment_event'?"'comment'":"CASE WHEN kind='copy' THEN 'derive' ELSE 'apply' END";
  statements.push(`CREATE POLICY runtime_business_insert ON rh_asset.${table} FOR INSERT WITH CHECK (${object} AND ${scope('artifact.read')} AND ${body} AND rh_asset.detail_actor_can_use(asset_id,version_no,${use}) AND actor_account_id=${actor})`);
 }
 let purposes=definition(snapshot,'check_detail_access_purposes');
 purposes=replace(purposes,"detail:=rh_asset.detail_version_limit(k,r.owner_account_id,r.asset_kind) IN (2,4);","detail:=rh_asset.detail_version_limit(k,r.owner_account_id,r.asset_kind) IN (2,4) OR rh_asset.business_object_matches(r.asset_id,r.tenant_id,r.study_group_id,r.research_project_id);");statements.push(purposes);
 let events=definition(snapshot,'check_registry_event');
 const old="EXISTS(SELECT 1 FROM public.research_artifact a WHERE a.id=r.asset_id AND rh_asset.detail_version_limit(a.\"idempotencyKey\",r.owner_account_id,r.asset_kind) IN (2,4))";
 if(events.split(old).length!==3)fail();events=events.replaceAll(old,`(${old} OR rh_asset.business_object_matches(r.asset_id,r.tenant_id,r.study_group_id,r.research_project_id))`);statements.push(events);
 let attachment=definition(snapshot,'detail_attachment_matches');
 const bodyStart=attachment.indexOf('AS '),tag=attachment.slice(bodyStart).match(/AS (\$[a-zA-Z0-9_]*\$)/)?.[1];if(!tag)fail();
 const end=attachment.lastIndexOf(tag),bodyEnd=attachment.slice(0,end).trimEnd();
 attachment=bodyEnd+` OR EXISTS(SELECT 1 FROM public.research_artifact_file f JOIN public.research_artifact a ON a.id=f."artifactId" JOIN rh_asset.version_policy p ON p.asset_id=a.id AND p.artifact_version_id=f."artifactVersionId" WHERE a.id=aid AND f.id=fid AND p.version_no=v AND rh_asset.business_object_matches(a.id,p.tenant_id,p.study_group_id,p.research_project_id) AND f."tenantId"=p.tenant_id AND f."studyGroupId"=p.study_group_id AND f."researchProjectId"=p.research_project_id AND f.role='source_attachment' AND f.sha256 ~ '^[a-f0-9]{64}$' AND f."sizeBytes">0 AND left(f."storageKey",length(p.tenant_id||'/hub-assets/'))=p.tenant_id||'/hub-assets/' AND position(chr(92) in f."storageKey")=0 AND f."storageKey" !~ '[[:cntrl:]]' AND NOT (string_to_array(f."storageKey",'/') && ARRAY['','.','..'])) `+tag+';';statements.push(attachment);
 let fact=definition(snapshot,'check_detail_fact');
 fact=replace(fact,'manager boolean; saved_project text;','manager boolean; saved_project text; business boolean; target_allowed boolean;');
 fact=replace(fact,'BEGIN\n SELECT * INTO r',`BEGIN\n business:=rh_asset.business_object_matches(NEW.asset_id,NEW.tenant_id,NEW.study_group_id,NEW.research_project_id);\n SELECT * INTO r`);
 fact=replace(fact,"IF NOT EXISTS(SELECT 1 FROM public.research_artifact a WHERE a.id=NEW.asset_id AND a.\"idempotencyKey\" LIKE 'rh-research-asset:detail-20261113:%') THEN", "IF NOT business AND NOT EXISTS(SELECT 1 FROM public.research_artifact a WHERE a.id=NEW.asset_id AND a.\"idempotencyKey\" LIKE 'rh-research-asset:detail-20261113:%') THEN");
 const slot='EXISTS(SELECT 1 FROM public.research_artifact a WHERE a.id=NEW.asset_id AND rh_asset.detail_comment_slot(NEW.comment_id,NEW.author_account_id,a."idempotencyKey",NEW.version_no,NEW.parent_comment_id))';
 const liveParent=`EXISTS(SELECT 1 FROM rh_asset.asset_comment_event c WHERE c.comment_id=NEW.parent_comment_id AND c.asset_id=NEW.asset_id AND c.version_no=NEW.version_no AND c.tenant_id=NEW.tenant_id AND c.study_group_id=NEW.study_group_id AND c.research_project_id=NEW.research_project_id AND c.revision=NEW.parent_revision AND c.revision=(SELECT max(z.revision) FROM rh_asset.asset_comment_event z WHERE z.comment_id=c.comment_id) AND c.action IN ('create','edit'))`;
 fact=replace(fact,slot,`(${slot} OR (business AND (NEW.action<>'create' OR (NEW.parent_comment_id IS NULL AND NEW.parent_revision IS NULL) OR ${liveParent})))`);
 fact=replace(fact,'NEW.parent_comment_id IS DISTINCT FROM prior.parent_comment_id','NEW.parent_comment_id IS DISTINCT FROM prior.parent_comment_id OR (business AND NEW.parent_revision IS DISTINCT FROM prior.parent_revision)');
 fact=replace(fact,"PERFORM set_config('app.research_project_id',saved_project,true);",`SELECT rh_asset.business_scope_matches(NEW.tenant_id,NEW.study_group_id,NEW.target_project_id,'artifact.create') INTO target_allowed;\n  PERFORM set_config('app.research_project_id',saved_project,true);`);
 const reuseSlot='rh_asset.detail_reuse_slot((SELECT "idempotencyKey" FROM public.research_artifact WHERE id=NEW.asset_id),t."idempotencyKey",NEW.actor_account_id,NEW.kind,NEW.version_no,NEW.target_project_id)';fact=replace(fact,'NOT '+reuseSlot,'(NOT business AND NOT '+reuseSlot+')');
 const runtimeKey="'rhab-reuse:'||encode(sha256(convert_to(concat_ws(chr(31),NEW.kind,NEW.asset_id,NEW.version_no::text,NEW.target_project_id,NEW.actor_account_id,NEW.request_key),'UTF8')),'hex')";
 for(const[kind,type,error]of[['copy','research_report','ASSET_COPY_TARGET_INVALID'],['apply','protocol_draft','ASSET_APPLICATION_TARGET_INVALID']]){
  const regex=new RegExp("IF ([^\\n]+) THEN RAISE EXCEPTION '"+error+"'; END IF;");const match=fact.match(regex);if(!match)fail();
  const policy=`t."typeKey"<>'${type}'${kind==='apply'?" OR r.asset_kind<>'protocol'":''}`;
  fact=fact.replace(regex,`IF (${policy}) OR (NOT business AND (${match[1]})) OR (business AND (NOT coalesce(target_allowed,false) OR t."idempotencyKey" IS DISTINCT FROM ${runtimeKey})) THEN RAISE EXCEPTION '${error}'; END IF;`);
 }
 statements.push(fact);return statements;
}
