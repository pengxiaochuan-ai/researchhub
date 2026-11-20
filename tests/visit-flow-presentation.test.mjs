import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformWithEsbuild} from 'vite';
import * as capture from '../src/formal-capture-session.js';
import * as flow from '../src/visit-workflow-session.js';

const ref={assignmentId:'assignment',responseId:'response',revisionNo:1,contentHash:'a'.repeat(64)};
const schema={schemaVersion:'form-schema.v1',fields:[{key:'value',label:'Observation',type:'number'},{key:'completed',label:'Completed',type:'boolean'}]};
const route={page:'s09',studyId:'study',visitId:'visit',assignmentId:'assignment'};
const scope={tenantId:'tenant',actor:'actor',authVersion:2,studyId:'study',visitId:'visit'};
const visit={id:'visit',version:4,status:'in_progress',subject:{id:'subject',subjectId:'SYNTHETIC'},visitPlan:{name:'Baseline',requirements:[]},assignments:[],fulfillments:[],capabilities:{canComplete:false}};
const response={version:1,status:'submitted',answers:{value:0,completed:false},score:{total:0},ref,review:null,locked:false};
const assignment={id:'assignment',subjectVisitId:'visit',formVersion:{id:'form',schema}};
const capabilities={canCorrect:true,canReview:true,canLock:false,disableReasons:{}};
const makeSession=(extra={})=>({actor:'actor',authVersion:2,verified:true,busy:false,checking:false,blocked:false,pending:null,revision:0,view:{visit,capture:{studyId:'study',assignment,response,capabilities}},...extra});
const item=(extra={})=>({assignmentId:'assignment',formVersionId:'form',formVersion:{id:'form',schema},title:'Observation form',mode:'researcher',required:true,action:'review_lock',response,capabilities,...extra});
const summary=(extra={})=>({schemaVersion:'visit-workflow-v1',studyId:'study',visitId:'visit',summaryHash:'b'.repeat(64),canStartBatch:true,items:[item()],visit,...extra});

// Run the actual production component handlers/effects. Rendering leaves and
// network transports are boundary doubles; state, decisions and emitted actions
// are from the transformed production source, rather than a copied algorithm.
async function mount(name,initialProps,extra={}){
 const source=readFileSync(new URL('../pages/shared/'+name+'.jsx',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
 const {code}=await transformWithEsbuild(source,name+'.jsx',{jsx:'transform',jsxFactory:'React.createElement',jsxFragment:'React.Fragment'});
 const slots=[],effects=[],frames=new Map(),focuses=[],scrolls=[];let cursor=0,props=initialProps,frame=0;
 const target={isConnected:true,scrollIntoView:options=>scrolls.push(options),focus:options=>focuses.push(options)};
 const useRef=value=>{const i=cursor++;return slots[i]??(slots[i]={current:value});};
 const useState=value=>{const i=cursor++;if(!(i in slots))slots[i]=typeof value==='function'?value():value;return[slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];};
 const useEffect=(fn,deps)=>{const i=cursor++,old=slots[i];if(!old||deps?.some((value,n)=>!Object.is(value,old.deps?.[n]))){effects.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:fn()};});}};
 const React={Fragment:'Fragment',createElement:(type,props,...children)=>({type,props:{...props,children}})};
 const deps={React,useState,useRef,useEffect,useCallback:fn=>fn,...capture,...flow,Button:'Button',CaptureConfirmation:'CaptureConfirmation',ConfirmDialog:'ConfirmDialog',CaptureFiles:'CaptureFiles',CaptureAssignment:'CaptureAssignment',CaptureEmailInvitation:'CaptureEmailInvitation',VisitReviewPanel:'VisitReviewPanel',CaptureFields:'CaptureFields',ReadAnswers:'ReadAnswers',FormPresentation:'FormPresentation',CaptureHistory:'CaptureHistory',CaptureQueries:'CaptureQueries',CorrectionImpactPanel:'CorrectionImpactPanel',useVisitWorkflow:()=>({scope,load:async()=>true,blocked:false}),getPlatformUser:()=>({id:'actor',authVersion:2}),formalTasksUrl:()=>'/tasks',subjectUrl:()=>'/subject',captureModes:()=>[],location:{pathname:'/pages/s09/',hash:'',search:'?formalCapture=1&studyId=study&visitId=visit&assignmentId=assignment'},document:{activeElement:null,getElementById:id=>id==='fc-assignment-title'?target:null},requestAnimationFrame:fn=>{frames.set(++frame,fn);return frame;},cancelAnimationFrame:id=>frames.delete(id),...extra};
 const body=code.replace(/^export const /gm,'const ').replace('export default function '+name,'return function '+name);
 const Component=new Function(...Object.keys(deps),body)(...Object.values(deps));
 return{render(next=props){props=next;cursor=0;const tree=Component(props);for(const effect of effects.splice(0))effect();return tree;},flushFrames(){for(const[id,fn]of [...frames]){frames.delete(id);fn();}},focuses,scrolls,target,cleanup(){for(const slot of slots)slot?.cleanup?.();}};
}
const nodes=tree=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];
const text=tree=>typeof tree==='string'?tree:Array.isArray(tree)?tree.map(text).join(''):text(tree?.props?.children??[]);
const button=(tree,label)=>nodes(tree).find(node=>node.type==='Button'&&text(node)===label);
const leaf=(tree,type)=>nodes(tree).find(node=>node.type===type);

test('newly opened original form exposes a programmatic heading focus target',async()=>{
 const h=await mount('CaptureAssignment',{route,session:makeSession(),onDirty:()=>{}});const title=nodes(h.render()).find(node=>node.type==='h3');
 assert.equal(title.props.id,'fc-assignment-title');assert.equal(title.props.tabIndex,-1);h.cleanup();
});
test('entry focuses the current assignment once and same-form status/revision refresh never steals focus',async()=>{
 const props={route,session:makeSession(),onDirty:()=>{}},h=await mount('CaptureVisit',props);
 h.render();h.flushFrames();assert.equal(h.focuses.length,1);assert.equal(h.scrolls.length,1);
 h.render({...props,session:{...props.session,revision:1}});h.flushFrames();h.render();h.flushFrames();assert.equal(h.focuses.length,1);h.cleanup();
});
test('initial busy/checking entry waits for verified content before focusing, then keeps user focus',async()=>{
 const s=makeSession({busy:true,checking:true,blocked:true}),props={route,session:s,onDirty:()=>{}},h=await mount('CaptureVisit',props);
 h.render();h.flushFrames();assert.equal(h.focuses.length,0);h.render({...props,session:makeSession()});h.flushFrames();assert.equal(h.focuses.length,1);
 h.render({...props,session:makeSession({checking:true})});h.flushFrames();h.render({...props,session:makeSession()});h.flushFrames();assert.equal(h.focuses.length,1);h.cleanup();
});
test('query and fixed-history routes retain their specific focus instead of auto-focusing the current form',async()=>{
 for(const context of[{queryId:'query'},{fixedRef:ref}]){const h=await mount('CaptureVisit',{route:{...route,...context},session:makeSession(),onDirty:()=>{}});h.render();h.flushFrames();assert.equal(h.focuses.length,0);h.cleanup();}
});
test('a new assignment gets one focus and a no-longer-connected former target is never focused',async()=>{
 const props={route,session:makeSession(),onDirty:()=>{}},h=await mount('CaptureVisit',props);h.render();h.target.isConnected=false;h.flushFrames();assert.equal(h.focuses.length,0);
 h.target.isConnected=true;h.render({...props,route:{...route,assignmentId:'next'},session:makeSession({view:{visit,capture:{assignment:{id:'next'}}}})});h.flushFrames();assert.equal(h.focuses.length,1);h.cleanup();
});
test('expanded review presents the one complete action beside results and keeps the original expected version',async()=>{
 const calls=[],v={...visit,capabilities:{canComplete:true}},s=makeSession({view:{visit:v,capture:{assignment}},send:async(...args)=>{calls.push(args);return false;}}),props={route,session:s,onDirty:()=>{}},h=await mount('CaptureVisit',props,{location:{hash:'#visit-review'},useVisitWorkflow:()=>({scope,load:async()=>true,blocked:false,summary:summary({canStartBatch:false,items:[item({response:{...response,version:3,review:'review_approved',locked:true},action:null,capabilities:{canReview:false,canLock:false}})]}),batch:{status:'completed',completedCount:1,items:[{title:'Observation form',status:'completed'}]}})});
 const tree=h.render(),panel=leaf(tree,'VisitReviewPanel');assert.equal(button(tree,'完成访视'),undefined,'header must not duplicate result completion');assert.equal(typeof panel.props.onComplete,'function');panel.props.onComplete();
 const confirm=leaf(h.render(),'CaptureConfirmation');assert(confirm);await confirm.props.onConfirm();assert.equal(calls.length,1);assert.deepEqual(calls[0],['visit','complete',{expectedVersion:4},{visitId:'visit',assignmentId:null}]);
 const p=await mount('VisitReviewPanel',{...panel.props});const action=button(p.render(),'完成访视');assert(action);assert.equal(action.props['data-visit-complete'],'true');p.cleanup();h.cleanup();
});
test('no-completion capability cannot gain a completion action through expanded results',async()=>{
 const h=await mount('CaptureVisit',{route,session:makeSession(),onDirty:()=>{}},{location:{hash:'#visit-review'},useVisitWorkflow:()=>({scope,load:async()=>true,blocked:false,summary:summary()})});const p=leaf(h.render(),'VisitReviewPanel');assert.equal(p.props.onComplete,undefined);assert.equal(button(h.render(),'完成访视'),undefined);h.cleanup();
});
test('completed batch keeps the single complete action inside its visible result, without a second footer action',async()=>{
 const workflow={scope,load:async()=>true,blocked:false,busy:false,summary:summary({canStartBatch:false}),batch:{status:'completed',completedCount:1,items:[{title:'Observation form',status:'completed'}]}},h=await mount('VisitReviewPanel',{route,session:makeSession(),workflow,expanded:true,onExpand:()=>{},onComplete:()=>{}});
 const tree=h.render(),result=nodes(tree).find(n=>n.type==='section'&&n.props.className==='fc-review-progress'&&text(n).includes('本次处理结果'));
 assert(button(result,'完成访视'),'completion must be next to the result rather than below the long answers');assert.equal(nodes(tree).filter(n=>n.type==='Button'&&text(n)==='完成访视').length,1);h.cleanup();
});
test('newly completed batch focuses its result once after checks settle, not on refresh or revision remount',async()=>{
 let workflow={scope,load:async()=>true,blocked:false,busy:true,summary:summary(),batch:{batchId:'batch',status:'processing'}},focused=0,scrolled=0;
 const target={isConnected:true,focus:()=>focused++,scrollIntoView:()=>scrolled++},r={...route,assignmentId:null},s=makeSession({view:{visit}}),props={route:r,session:s,onDirty:()=>{}},h=await mount('CaptureVisit',props,{location:{hash:'#visit-review'},document:{activeElement:null,getElementById:id=>id==='visit-review-result'?target:null},useVisitWorkflow:()=>workflow});
 h.render();h.flushFrames();assert.equal(focused,0);workflow={...workflow,busy:false,batch:{batchId:'batch',status:'completed'}};const ready={...props,session:{...s,view:{visit:{...visit,capabilities:{canComplete:true}}}}};h.render(ready);h.flushFrames();assert.equal(focused,1);assert.equal(scrolled,1);
 h.render({...ready,session:{...ready.session,revision:2}});h.flushFrames();workflow={...workflow,batch:{...workflow.batch}};h.render();h.flushFrames();assert.equal(focused,1);h.cleanup();
});
test('collector awaiting independent review has a read-only handoff, without a grey approval action',async()=>{
 const own=item({action:null,capabilities:{canReview:false,canLock:false,disableReasons:{review:'FORM_INDEPENDENT_REVIEW_REQUIRED'}}}),sum=summary({canStartBatch:false,items:[own]}),workflow={scope,load:async()=>true,blocked:false,busy:false,summary:sum},s=makeSession(),h=await mount('CaptureVisit',{route,session:s,onDirty:()=>{}},{useVisitWorkflow:()=>workflow});
 const tree=h.render();assert(button(tree,'查看待审项'));assert.match(text(tree),/已提交，待独立审阅/);
 const p=await mount('VisitReviewPanel',{route,session:s,workflow,expanded:true,onExpand:()=>{}});assert.equal(button(p.render(),'审核通过并锁定'),undefined);assert.match(text(p.render()),/待独立审阅/);p.cleanup();h.cleanup();
});
test('a qualified reviewer still gets central review and explicit selection',async()=>{
 const workflow={scope,load:async()=>true,blocked:false,busy:false,summary:summary()},h=await mount('CaptureVisit',{route,session:makeSession(),onDirty:()=>{}},{useVisitWorkflow:()=>workflow});assert(button(h.render(),'集中审阅'));h.cleanup();
});
test('parent summary handoff excludes locked, already-approved and draft revisions',async()=>{
 for(const state of [{locked:true,review:'review_approved',status:'submitted'},{locked:false,review:'review_approved',status:'submitted'},{locked:false,review:null,status:'draft'}]){
  const v={...visit,capabilities:{canComplete:state.locked}},row=item({response:{...response,...state},action:null,capabilities:{canReview:false,canLock:false,disableReasons:{review:'FORM_INDEPENDENT_REVIEW_REQUIRED'}}}),workflow={scope,blocked:false,summary:summary({canStartBatch:false,items:[row]})},h=await mount('CaptureVisit',{route,session:makeSession({view:{visit:v,capture:{assignment}}}),onDirty:()=>{}},{useVisitWorkflow:()=>workflow});
  try{const tree=h.render();assert.doesNotMatch(text(tree),/待独立审阅|待其他人员审阅/);assert.equal(Boolean(button(tree,'完成访视')),state.locked);}finally{h.cleanup();}
 }
});
test('parent capture fallback excludes locked, already-approved and draft revisions',async()=>{
 for(const state of [{locked:true,review:'review_approved',status:'submitted'},{locked:false,review:'review_approved',status:'submitted'},{locked:false,review:null,status:'draft'}]){
  const s=makeSession({view:{visit,capture:{assignment,response:{...response,...state},capabilities:{canReview:false,canLock:false,disableReasons:{review:'FORM_INDEPENDENT_REVIEW_REQUIRED'}}}}}),h=await mount('CaptureVisit',{route,session:s,onDirty:()=>{}},{useVisitWorkflow:()=>({scope,blocked:false,summary:null})});
  try{assert.doesNotMatch(text(h.render()),/待独立审阅|待其他人员审阅/);}finally{h.cleanup();}
 }
});
test('parent keeps the submitted unreviewed author handoff for both summary and capture fallback',async()=>{
 const own=item({action:null,capabilities:{canReview:false,canLock:false,disableReasons:{review:'FORM_INDEPENDENT_REVIEW_REQUIRED'}}});
 for(const sum of [summary({canStartBatch:false,items:[own]}),null]){
  const s=makeSession({view:{visit,capture:{assignment,response,capabilities:own.capabilities}}}),h=await mount('CaptureVisit',{route,session:s,onDirty:()=>{}},{useVisitWorkflow:()=>({scope,blocked:false,summary:sum})});
  try{const tree=h.render();assert.match(text(tree),/已提交，待独立审阅/);assert(button(tree,'查看待审项'));assert.equal(button(tree,'完成访视'),undefined);}finally{h.cleanup();}
 }
});
test('same-revision audit/lock updates do not claim answers changed and later writes use the current version',async()=>{
 const calls=[],s=makeSession({send:async(...args)=>{calls.push(args);return false;}}),props={route,session:s,onDirty:()=>{}},h=await mount('CaptureAssignment',props);h.render();
 const updated={...response,version:3,review:'review_approved',locked:true},next={...props,session:{...s,view:{...s.view,capture:{...s.view.capture,response:updated,capabilities:{canCorrect:false,canReview:false,canLock:false}}}}};
 let tree=h.render(next);assert.doesNotMatch(text(tree),/当前记录已有变化|当前答卷已有更新/);tree=h.render();assert.doesNotMatch(text(tree),/核对并使用当前状态/);assert.equal(calls.length,0);
 const unlocked={...updated,version:4,locked:false};h.render({...next,session:{...s,view:{...s.view,capture:{...s.view.capture,response:unlocked}}}});tree=h.render();button(tree,'更正记录').props.onClick();tree=h.render();leaf(tree,'CaptureFields').props.onChange({value:2,completed:false});tree=h.render();
 const reason=nodes(tree).find(n=>n.type==='textarea'&&n.props['aria-label']==='更正原因');reason.props.onChange({target:{value:'synthetic correction'}});tree=h.render();button(tree,'核对并保存更正').props.onClick();const modal=leaf(h.render(),'CaptureConfirmation');await modal.props.onConfirm();assert.equal(calls[0][2].expectedVersion,4);assert.deepEqual(calls[0][2].expectedRef,ref);h.cleanup();
});
test('pending reason is preserved during audit-only updates until the current state is explicitly acknowledged',async()=>{
 const s=makeSession(),props={route,session:s,onDirty:()=>{}},h=await mount('CaptureAssignment',props);let tree=h.render();const reason=nodes(tree).find(n=>n.type==='textarea');reason.props.onChange({target:{value:'keep this reason'}});h.render();
 const next={...props,session:{...s,view:{...s.view,capture:{...s.view.capture,response:{...response,version:2,review:'review_approved'}}}}};tree=h.render(next);assert.doesNotMatch(text(tree),/当前答卷已有更新/);assert.match(text(tree),/审阅或锁定状态已更新/);const acknowledge=button(tree,'核对当前状态并保留输入');assert(acknowledge);acknowledge.props.onClick();tree=h.render();assert.equal(nodes(tree).find(n=>n.type==='textarea').props.value,'keep this reason');h.cleanup();
});
test('changed revision, mismatched answer content and concurrent draft updates retain the conflict gate',async()=>{
 for(const [base,next]of[[response,{...response,version:2,ref:{...ref,revisionNo:2,contentHash:'c'.repeat(64)}}],[response,{...response,version:2,answers:{value:1,completed:false}}],[{...response,status:'draft',ref:null},{...response,status:'draft',ref:null,version:2}]]){
  const s=makeSession({view:{visit,capture:{studyId:'study',assignment,response:base,capabilities:{...capabilities,canSubmit:true,canSaveDraft:true}}}}),props={route,session:s,onDirty:()=>{}},h=await mount('CaptureAssignment',props);h.render();let tree=h.render({...props,session:{...s,view:{...s.view,capture:{...s.view.capture,response:next}}}});tree=h.render();assert.match(text(tree),/当前记录已有变化|当前答卷已有更新/);const action=button(tree,'审核通过')??button(tree,'提交表单');assert(action?.props.disabled);h.cleanup();
 }
});
