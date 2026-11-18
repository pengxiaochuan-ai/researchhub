import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {transformWithEsbuild} from 'vite';
import * as capture from '../src/formal-capture-session.js';
import {visitReviewAwaitingIndependent} from '../src/visit-workflow-session.js';

const later=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
const operation={actor:'actor',authVersion:2,studyId:'study',visitId:'visit',assignmentId:null,domain:'visit',action:'complete'};
const route={studyId:'study',visitId:'visit',page:'s09'};
const visit={id:'visit',version:2,status:'in_progress',subject:{id:'subject',subjectId:'SYNTHETIC'},visitPlan:{name:'Baseline',requirements:[]},capabilities:{canComplete:true},assignments:[],fulfillments:[]};
function session(extra={}){return{actor:'actor',authVersion:2,view:{visit},verified:true,busy:false,blocked:false,checking:false,pending:null,error:'',notice:'',holdConfirmation:()=>()=>{},...extra};}

// Execute transformed production components with deterministic React slots. Events below
// call their actual handlers; only leaf rendering and server transports are substituted.
async function mount(name,initialProps,extra={}){
 const path=new URL('../pages/shared/'+name+'.jsx',import.meta.url);assert(existsSync(path),'confirmation recovery component must exist');
 const source=readFileSync(path,'utf8').replace(/^import .*;\n/gm,'');
 const {code}=await transformWithEsbuild(source,name+'.jsx',{jsx:'transform',jsxFactory:'React.createElement',jsxFragment:'React.Fragment'});
 const slots=[],effects=[];let cursor=0,props=initialProps;
 const useRef=value=>{const i=cursor++;return slots[i]??(slots[i]={current:value});};
 const useState=value=>{const i=cursor++;if(!(i in slots))slots[i]=typeof value==='function'?value():value;return[slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];};
 const useEffect=(fn,deps)=>{const i=cursor++,old=slots[i];if(!old||deps?.some((x,n)=>!Object.is(x,old.deps?.[n]))){effects.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:fn()};});}};
 const React={Fragment:'Fragment',createElement:(type,props,...children)=>({type,props:{...props,children}})};
 const dependencies={React,useState,useRef,useEffect,useCallback:fn=>fn,Button:'Button',ConfirmDialog:'ConfirmDialog',CaptureConfirmation:'CaptureConfirmation',CaptureFiles:'CaptureFiles',CaptureAssignment:'CaptureAssignment',CaptureEmailInvitation:'CaptureEmailInvitation',CaptureFields:'CaptureFields',ReadAnswers:'ReadAnswers',FormPresentation:'FormPresentation',CaptureHistory:'CaptureHistory',CaptureQueries:'CaptureQueries',...capture,VisitReviewPanel:'VisitReviewPanel',useVisitWorkflow:()=>({blocked:false}),nextVisitCapture:()=>({kind:'review'}),getPlatformUser:()=>({id:'actor',authVersion:2}),captureUrl:()=>'/visit',formalTasksUrl:()=>'/tasks',subjectUrl:()=>'/subject',captureModes:()=>[],location:{hash:'',search:'?formalCapture=1&studyId=study&visitId=visit&assignmentId=assignment'},document:{activeElement:null},...extra};
 dependencies.visitReviewAwaitingIndependent=visitReviewAwaitingIndependent;
 const body=code.replace(/^export const /gm,'const ').replace('export default function '+name,'return function '+name);
 const Component=new Function(...Object.keys(dependencies),body)(...Object.values(dependencies));
 return{render(next=props){props=next;cursor=0;const tree=Component(props);for(const effect of effects.splice(0))effect();return tree;},cleanup(){for(const s of slots)s?.cleanup?.();}};
}
function nodes(tree){if(!tree||typeof tree!=='object')return[];if(Array.isArray(tree))return tree.flatMap(nodes);return[tree,...nodes(tree.props?.children)];}
const text=tree=>typeof tree==='string'?tree:Array.isArray(tree)?tree.map(text).join(''):text(tree?.props?.children??[]);
const button=(tree,label)=>nodes(tree).find(x=>x.type==='Button'&&text(x)===label);
const dialog=tree=>nodes(tree).find(x=>['ConfirmDialog','CaptureConfirmation'].includes(x.type));

test('actual visit confirmation stays open while its command is unresolved',async()=>{
 const hold=later();let posts=0;const s=session({send:async()=>{posts++;return hold.promise;}}),h=await mount('CaptureVisit',{route,session:s,onDirty:()=>{}});
 button(h.render(),'完成访视').props.onClick();const pending=dialog(h.render()).props.onConfirm();
 assert(dialog(h.render()),'confirmation must not disappear before a result is known');assert.equal(posts,1);
 hold.resolve({receipt:{action:'visit.complete'}});await pending;h.cleanup();
});
test('actual visit confirmation cannot silently close after verification becomes unavailable',async()=>{
 let posts=0;const s=session({send:async()=>{posts++;return true;}}),h=await mount('CaptureVisit',{route,session:s,onDirty:()=>{}});
 button(h.render(),'完成访视').props.onClick();const tree=h.render({route,session:{...s,verified:false,blocked:true},onDirty:()=>{}});await dialog(tree).props.onConfirm();
 assert(dialog(h.render()),'blocked confirmation must retain its context');assert.equal(posts,0);h.cleanup();
});
test('quiet checking holds the confirmation and exposes an explicit waiting state without disabling cancel',async()=>{
 let holds=0,releases=0,posts=0;const s=session({checking:true,holdConfirmation:()=>{holds++;return()=>releases++;}}),h=await mount('CaptureConfirmation',{session:s,operation,onConfirm:()=>posts++,onCancel:()=>{},onCompleted:()=>{}});
 const tree=h.render();assert.equal(holds,1);assert.equal(tree.props.confirmDisabled,true);assert.equal(tree.props.busy,false);assert.match(text(tree),/正在核对当前状态/);await tree.props.onConfirm();assert.equal(posts,0);h.cleanup();assert.equal(releases,1);
});
test('confirmation awaits one command, rejects duplicate clicks, and reports success only from its real result',async()=>{
 const hold=later();let posts=0,completed=0;const h=await mount('CaptureConfirmation',{session:session(),operation,onConfirm:async()=>{posts++;return hold.promise;},onCompleted:()=>completed++,onCancel:()=>{}});
 const tree=h.render(),first=tree.props.onConfirm();await tree.props.onConfirm();assert.equal(posts,1);assert.equal(completed,0);assert.equal(h.render().props.busy,true);
 hold.resolve({receipt:{action:'visit.complete'}});await first;assert.equal(completed,1);h.cleanup();
});
test('a not-sent result remains visible in the original confirmation and explicit recheck never writes',async()=>{
 let posts=0,loads=0,completed=0;const s=session({load:async()=>{loads++;return true;}}),props={session:s,operation,onConfirm:async()=>{posts++;return false;},onCompleted:()=>completed++,onCancel:()=>{}},h=await mount('CaptureConfirmation',props);
 await h.render().props.onConfirm();assert.match(text(h.render()),/本次尚未执行/);assert.equal(completed,0);
 await button(h.render({...props,session:{...s,verified:false,blocked:true,error:'连接中断'}}),'重新核对当前状态').props.onClick();assert.equal(loads,1);assert.equal(posts,1);assert.equal(completed,0);h.cleanup();
});
test('matching unknown operation is recovered by a read and never invokes a new command',async()=>{
 let posts=0,reads=0,completed=0;const result={receipt:{action:'visit.complete'}},p={...operation,requestKey:'original'},s=session({pending:p,blocked:true,recover:async retry=>{assert.equal(retry,false);reads++;return result;}}),h=await mount('CaptureConfirmation',{session:s,operation,onConfirm:()=>posts++,onCompleted:r=>{assert.equal(r,result);completed++;},onCancel:()=>{}});
 await button(h.render(),'核对本次操作结果').props.onClick();assert.equal(posts,0);assert.equal(reads,1);assert.equal(completed,1);h.cleanup();
});
test('a pending marker for another action has no recovery action or false success',async()=>{
 const s=session({pending:{...operation,action:'start',requestKey:'other'},blocked:true}),h=await mount('CaptureConfirmation',{session:s,operation,onConfirm:()=>assert.fail('must not send'),onCompleted:()=>assert.fail('must not complete'),onCancel:()=>{}});
 const tree=h.render();assert.equal(tree.props.confirmDisabled,true);assert.equal(button(tree,'核对本次操作结果'),undefined);assert.match(text(tree),/另一项操作/);h.cleanup();
});
test('same-account auth-version change invalidates the old confirmation without queuing a write',async()=>{
 let calls=0;const props={session:session(),operation,onConfirm:()=>calls++,onCompleted:()=>calls++,onCancel:()=>{}},h=await mount('CaptureConfirmation',props);
 h.render();const tree=h.render({...props,session:session({authVersion:3})});assert.equal(tree.props.confirmDisabled,true);assert.match(text(tree),/身份或访视已变化/);await tree.props.onConfirm();assert.equal(calls,0);h.cleanup();
});
test('failed receipt lookup does not claim success or automatically retry, and explicit retry keeps original operation',async()=>{
 const calls=[];let completed=0;const p={...operation,requestKey:'original'},s=session({pending:p,blocked:true,canRetry:true,recover:async retry=>{calls.push(retry);return false;}}),h=await mount('CaptureConfirmation',{session:s,operation,onConfirm:()=>assert.fail('new send forbidden'),onCompleted:()=>completed++,onCancel:()=>{}});
 assert.equal(button(h.render(),'以原内容重试'),undefined);await button(h.render(),'核对本次操作结果').props.onClick();assert.deepEqual(calls,[false]);assert.equal(completed,0);await button(h.render(),'以原内容重试').props.onClick();assert.deepEqual(calls,[false,true]);assert.equal(completed,0);h.cleanup();
});

test('a previous saved notice is not presented as this new confirmation result',async()=>{
 const h=await mount('CaptureConfirmation',{session:session({notice:'已保存并核对当前状态。'}),operation,onConfirm:()=>{},onCompleted:()=>{},onCancel:()=>{}});
 assert.doesNotMatch(text(h.render()),/已保存并核对/);h.cleanup();
});
test('actual assignment awaits submission in place and forwards the exact recovered result for continuation',async()=>{
 const hold=later(),next=[];let posts=0;const assignment={id:'assignment',subjectVisitId:'visit',formVersion:{id:'form',schema:{fields:[{key:'score',label:'Observation',type:'integer',required:true}]}}},response={version:0,status:'draft',answers:{score:1},ref:null},s=session({view:{visit,capture:{studyId:'study',assignment,response,capabilities:{canSaveDraft:true,canSubmit:true}}},send:async()=>{posts++;return hold.promise;}}),h=await mount('CaptureAssignment',{route:{...route,assignmentId:'assignment'},session:s,onDirty:()=>{},onSubmitted:r=>next.push(r)});
 button(h.render(),'提交并继续').props.onClick();const modal=dialog(h.render()),pending=modal.props.onConfirm();assert(dialog(h.render()));assert.equal(posts,1);assert.equal(next.length,0);
 hold.resolve(false);await pending;assert(dialog(h.render()));assert.equal(next.length,0);
 const result={studyId:'study',receipt:{action:'form.submit',targetId:'assignment',requestKey:'original'}};await dialog(h.render()).props.onCompleted(result);assert.deepEqual(next,[result]);assert.equal(dialog(h.render()),undefined);h.cleanup();
});
test('a proved submit continuation waits for current state instead of using a pending render closure',async()=>{
 const reads=[],writes=[],goes=[],r={...route,assignmentId:'assignment'},s=session({blocked:true,pending:{...operation,domain:'assignment',action:'submit'},view:{visit,capture:{assignment:{id:'assignment'}}},request:async path=>{reads.push(path);return{studyId:'study',visit};},send:async(...args)=>{writes.push(args);return{result:{id:'next-assignment'}};},go:url=>goes.push(url)}),props={route:r,session:s,onDirty:()=>{}},h=await mount('CaptureVisit',props,{nextVisitCapture:()=>({kind:'assign',formVersionId:'next-form'})});
 const child=nodes(h.render()).find(x=>x.type==='CaptureAssignment');child.props.onSubmitted({studyId:'study',receipt:{action:'form.submit',targetId:'assignment'}});h.render();assert.equal(reads.length,0);assert.equal(writes.length,0);
 h.render({...props,session:{...s,blocked:false,pending:null}});await new Promise(r=>setImmediate(r));assert.equal(reads.length,1);assert.equal(writes.length,1);assert.equal(writes[0][0],'visit');assert.equal(writes[0][1],'assign');assert.equal(goes.length,1);h.cleanup();
});
test('a proved submit never continues after auth version or study context changes',async()=>{
 for(const changed of[{authVersion:3},{actor:'other'}]){
  let reads=0;const r={...route,assignmentId:'assignment'},s=session({blocked:true,pending:{},view:{visit,capture:{assignment:{id:'assignment'}}},request:async()=>{reads++;return{studyId:'study',visit};}}),props={route:r,session:s,onDirty:()=>{}},h=await mount('CaptureVisit',props);
  nodes(h.render()).find(x=>x.type==='CaptureAssignment').props.onSubmitted({studyId:'study',receipt:{action:'form.submit',targetId:'assignment'}});h.render({...props,session:{...s,blocked:false,pending:null,...changed}});await new Promise(r=>setImmediate(r));assert.equal(reads,0);h.cleanup();
 }
});

test('actual complete in an assignment-detail route explicitly targets a visit-only marker',async()=>{
 let targets;const r={...route,assignmentId:'assignment'},s=session({view:{visit,capture:{assignment:{id:'assignment'}}},send:async(domain,action,body,target)=>{assert.equal(domain,'visit');assert.equal(action,'complete');targets=target;return false;}}),h=await mount('CaptureVisit',{route:r,session:s,onDirty:()=>{}});
 button(h.render(),'完成访视').props.onClick();const modal=dialog(h.render());await modal.props.onConfirm();assert.equal(targets.assignmentId,null);assert.equal(modal.props.operation.assignmentId,null);assert.equal(targets.visitId,'visit');h.cleanup();
});
test('pending GET recheck keeps result unknown and never claims this operation has not executed',async()=>{
 const p={...operation,requestKey:'original'},s=session({pending:p,blocked:true,verified:false,load:async()=>true}),h=await mount('CaptureConfirmation',{session:s,operation,onConfirm:()=>assert.fail('no new write'),onCompleted:()=>assert.fail('read-only load is not receipt proof'),onCancel:()=>{}});
 await button(h.render(),'重新核对当前状态').props.onClick();const output=text(h.render());assert.doesNotMatch(output,/本次尚未执行/);assert.match(output,/结果尚未确认/);h.cleanup();
});
test('late result cannot complete under changed current identity or URL even without rerender',async()=>{
 for(const change of['actor','authVersion','study','visit']){
  const hold=later(),user={id:'actor',authVersion:2},loc={hash:'',search:'?formalCapture=1&studyId=study&visitId=visit'};let completed=0;
  const h=await mount('CaptureConfirmation',{session:session(),operation,onConfirm:()=>hold.promise,onCompleted:()=>completed++,onCancel:()=>{}},{getPlatformUser:()=>user,location:loc});
  const pending=h.render().props.onConfirm();if(change==='actor')user.id='other';if(change==='authVersion')user.authVersion=3;if(change==='study')loc.search='?studyId=other&visitId=visit';if(change==='visit')loc.search='?studyId=study&visitId=other';
  hold.resolve({receipt:{action:'visit.complete'}});await pending;assert.equal(completed,0,change);h.cleanup();
 }
});

test('a valid assignment-only route still completes under its unchanged entry context',async()=>{
 let completed=0;const loc={pathname:'/pages/s09/',search:'?formalCapture=1&studyId=study&assignmentId=assignment'},h=await mount('CaptureConfirmation',{session:session(),operation:{...operation,domain:'assignment',action:'submit',assignmentId:'assignment'},onConfirm:async()=>({receipt:{action:'form.submit'}}),onCompleted:()=>completed++,onCancel:()=>{}},{location:loc});
 await h.render().props.onConfirm();assert.equal(completed,1);h.cleanup();
});
test('current identity changed before click cannot send even before a React rerender',async()=>{
 let calls=0;const user={id:'actor',authVersion:2},h=await mount('CaptureConfirmation',{session:session(),operation,onConfirm:()=>calls++,onCompleted:()=>calls++,onCancel:()=>{}},{getPlatformUser:()=>user});
 const tree=h.render();user.authVersion=3;await tree.props.onConfirm();assert.equal(calls,0);assert.match(text(h.render()),/身份或访视已变化/);h.cleanup();
});
