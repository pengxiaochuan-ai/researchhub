const defaults={q:'',status:'',reviewStatus:'',assigneeAccountId:'',overdue:false,limit:20};
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
const cursor=value=>typeof value==='string'&&value.length<=2048&&/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
const invalid=()=>{throw new Error('任务筛选或翻页信息无效，请回到第一页重新核对。');};
export const newTaskListState=()=>({filters:{...defaults},cursors:[null],index:0});
export function applyTaskFilters(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!Object.hasOwn(defaults,k)))invalid();
 const filters={...defaults,...input};
 if(typeof filters.q!=='string'||filters.q.trim().length>120||!['','open','in_progress','blocked','completed','cancelled'].includes(filters.status)||!['','not_required','not_submitted','pending_review','accepted','returned'].includes(filters.reviewStatus)||filters.assigneeAccountId!==''&&!id(filters.assigneeAccountId)||typeof filters.overdue!=='boolean'||!Number.isInteger(filters.limit)||filters.limit<1||filters.limit>20)invalid();
 filters.q=filters.q.trim();return {filters,cursors:[null],index:0};
}
export function taskListQuery(state){
 const query=Object.fromEntries(Object.entries(state.filters).filter(([,value])=>value!==''&&value!==false));
 if(query.overdue)query.overdue='true';
 if(state.index>0)query.cursor=state.cursors[state.index];return query;
}
export function moveTaskPage(state,direction,nextCursor){
 if(direction==='previous')return state.index>0?{...state,index:state.index-1}:state;
 if(direction!=='next'||!cursor(nextCursor))invalid();
 return {...state,cursors:[...state.cursors.slice(0,state.index+1),nextCursor],index:state.index+1};
}
export function taskListSnapshot(state,scope,actor){return {scope:scope.studyId?{studyId:scope.studyId}:{studyGroupId:scope.studyGroupId,researchProjectId:scope.researchProjectId},actor,state:{filters:{...state.filters},cursors:[...state.cursors],index:state.index}};}
export function restoreTaskList(value,scope,actor){
 try{
  if(!value||value.actor!==actor||(scope.studyId?value.scope?.studyId!==scope.studyId:value.scope?.studyId!==undefined||value.scope?.studyGroupId!==scope.studyGroupId||value.scope?.researchProjectId!==scope.researchProjectId))invalid();
  const state=value.state,base=applyTaskFilters(state?.filters);
  if(!Array.isArray(state.cursors)||state.cursors.length<1||state.cursors.length>21||state.cursors[0]!==null||!state.cursors.slice(1).every(cursor)||!Number.isInteger(state.index)||state.index<0||state.index>=state.cursors.length)invalid();
  return {...base,cursors:[...state.cursors],index:state.index};
 }catch{return newTaskListState();}
}
