const valid=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(id);
const fail=()=>{throw Error('执行准备入口或范围无效；不会回退演示或选择其他研究。');};
export const isPreparationRoute=(pageId,search)=>pageId==='s11'&&new URLSearchParams(search).has('executionPreparation');
export function readPreparationLocation(pageId,search){
 const p=new URLSearchParams(search),keys=['executionPreparation','studyGroupId','researchProjectId','researchPlanId'];
 if(!isPreparationRoute(pageId,search)||p.get('executionPreparation')!=='1'||['projectId','protocolId','designWorkspace'].some(k=>p.has(k))||keys.some(k=>p.getAll(k).length!==1))fail();
 const scope={studyGroupId:p.get('studyGroupId'),researchProjectId:p.get('researchProjectId')},planId=p.get('researchPlanId');if(!valid(scope.studyGroupId)||!valid(scope.researchProjectId)||!valid(planId))fail();return{scope,planId};
}
export function makePreparationUrl(scope,planId){if(!valid(scope?.studyGroupId)||!valid(scope?.researchProjectId)||!valid(planId))fail();return'/pages/s11/?'+new URLSearchParams({executionPreparation:'1',studyGroupId:scope.studyGroupId,researchProjectId:scope.researchProjectId,researchPlanId:planId});}
export function preparationHeader(config,pageId,search){return isPreparationRoute(pageId,search)?{...config,title:'研究执行准备',description:'将本人方案草稿整理为访视、CRF与结局映射；仅合成准备，不启动正式采集。',meta:"合成数据演练 · 私有本人草稿",actions:[],nav:undefined,crumbs:[['科研资产','a01'],['知识资料','k01'],['执行准备草稿']]}:config;}
export const nullableNumber=value=>value===''?null:Number(value);
export const preparationDraftDirty=(draft,saved)=>JSON.stringify(draft)!==JSON.stringify(saved??emptyPreparationConfig());
export function preparationDecisionEdits(items,drafts){const changes=[],errors={};for(const item of items){const d=drafts[item.itemId];if(item.decision||!d?.action)continue;const reason=(d.reason??'').trim();if(!['acknowledge','needs_revision'].includes(d.action)||!reason||reason.length>600)errors[item.itemId]='请选择核对意见并填写1–600字理由；不是审批。';changes.push({itemId:item.itemId,action:d.action,reason});}return{valid:Object.keys(errors).length===0,changes,errors};}
export async function copyPreparationVersion({version,write,isCurrent}){try{await write(JSON.stringify(version.config,null,2));return isCurrent()?'已复制目标v'+version.version+'配置JSON；仅供本人核对，不是导出或重绑。':null;}catch{return isCurrent()?'复制失败；请在只读配置中手动选择，不会误报成功。':null;}}
export function preparationRelationErrors(config){
 const errors=[];for(const[fIndex,f]of config.form.schema.fields.entries())if(f.type==='select'){const seen=new Set();for(const[i,o]of f.options.entries()){const value=typeof o==='string'?o:o.value;if(seen.has(value))errors.push({id:'option-'+fIndex+'-'+i+'-value',message:'同一字段的选项值不能重复。'});seen.add(value);}}
 const pairs=new Set();for(const[i,m]of config.mappings.entries()){const pair=m.outcomeKey+'.'+m.fieldKey;if(pairs.has(pair))errors.push({id:'mapping-'+i+'-field',message:'同一结局与字段的映射不能重复。'});pairs.add(pair);}return errors;
}
export function emptyPreparationConfig(){return{label:'本人执行准备草稿',outcomes:[],visits:[{key:'baseline',name:'基线（待确认）',order:1,targetDayOffset:null,windowBeforeDays:null,windowAfterDays:null},{key:'followup',name:'随访（待确认）',order:2,targetDayOffset:null,windowBeforeDays:null,windowAfterDays:null}],form:{key:'synthetic_crf',name:'合成CRF草稿',schema:{schemaVersion:'form-schema.v1',fields:[]}},mappings:[],missingStates:['missing','not_measured','not_applicable'],notes:''};}
export function mergePreparationRead(previous,data,force=false){
 if(data.sourceStatus==='restricted')return{view:null,draft:null,dirty:false,history:null,preview:null,notice:data.message??'资料或授权失效，已清除读取内容。'};
 if(previous.dirty&&!force)return{...previous,notice:data.version!==previous.view?.version?'已有新版本；当前输入和原保存基准保留，请先核对。':previous.notice};
 if(!force&&previous.view?.version===data.version&&previous.view?.sourceStatus===data.sourceStatus&&previous.view?.preparationStatus===data.preparationStatus)return{...previous,view:data};
 return{view:data,draft:structuredClone(data.config??emptyPreparationConfig()),dirty:false,history:null,preview:null,notice:''};
}
