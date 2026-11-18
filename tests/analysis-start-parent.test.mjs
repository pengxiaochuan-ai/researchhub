import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {transformWithEsbuild} from 'vite';
import * as analysis from '../src/formal-analysis-session.js';
import * as full from '../src/full-study-ui-session.js';
import {methodsUrl} from '../src/formal-methods-session.js';
import {createCaptureClient as createReadClient,captureUrl,schemaFields} from '../src/formal-capture-session.js';

const Button=()=>{},Card=()=>{},ConfirmDialog=()=>{};
const compile=async p=>(await transformWithEsbuild(readFileSync(new URL('../'+p,import.meta.url),'utf8').replace(/^import .*;\n/gm,''),p,{loader:'jsx',jsx:'transform'})).code;
const plan=(id='plan')=>({studyId:'study',planId:id,contentHash:'a'.repeat(64),definition:{protocolVersionId:'protocol',subjectIds:['subject-old'],variables:[],reason:'synthetic'},review:{reviewId:'review',decision:'approved',sequence:1},capabilities:{canReviewPlan:true,canReleaseSnapshot:true},snapshots:[]});
const view=p=>({plan:p,configuration:{forms:[],protocols:[]},preview:{manifestHash:'b'.repeat(64),manifest:{subjectCount:1,rowCount:0,variables:[],rows:[]},evaluation:{status:'review_required',blockingCount:0,warningCount:0}},runs:{items:[]}});
const all=(tree,predicate)=>!tree||typeof tree!=='object'?[]:[...(predicate(tree)?[tree]:[]),...React.Children.toArray(tree.props?.children).flatMap(c=>all(c,predicate))];
async function mount(branch){
 const states=new Map(),queued=[];let tag,cursor=0,seen,scope=branch+':study:actor:0',locked=true,control,continued=0,sends=0,labelStatus=200,labelRequests=0;
 const begin=t=>{tag=t;cursor=0;seen?.add(t);if(!states.has(t))states.set(t,[]);};
 const useState=v=>{const slots=states.get(tag),i=cursor++;if(!(i in slots))slots[i]=typeof v==='function'?v():v;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v];},useRef=v=>{const slots=states.get(tag),i=cursor++;return slots[i]??(slots[i]={current:v});};
 const useEffect=(fn,deps)=>{const owner=tag,slots=states.get(tag),i=cursor++,old=slots[i];if(!old||deps?.some((v,n)=>v!==old.deps?.[n])){slots[i]={deps};queued.push({owner,fn});}};
 const location={search:'?formalAnalysis=1&studyId=study&planId=plan',href:'https://qa.invalid/pages/s05/?formalAnalysis=1&studyId=study&planId=plan'};
 const session={actor:'actor',revision:0,busy:false,blocked:false,verified:true,pending:null,view:null,capabilities:{canCreateRun:true},request:async path=>({subject:{id:path.split('/').at(-1),subjectId:'OLD-ALIAS'}}),send:async()=>{sends++;}};
 const start={ready:true,busy:false,confirming:false,requiresProof:true,checkpoint:{actor:'actor',authVersion:0,studyId:'study',planId:'plan',stage:branch==='full'?'created':'released',pending:branch==='full'?'process':'create',snapshotId:'snap',runId:branch==='full'?'group':null},active:true,phase:'原结果待核对',core:{recover:async()=>{start.busy=true;},continue:async()=>{continued++;},cancel:()=>false}};
 const getStart=()=>{const bound=scope;return{...start,scope:bound,isLocked:()=>locked,isCurrentScope:()=>scope===bound};};
 const dep={createCaptureClient:options=>createReadClient({...options,fetchImpl:async path=>{labelRequests++;return new Response(JSON.stringify(labelStatus===200?{subject:{id:path.split('/').at(-1),subjectId:'OLD-ALIAS'}}:{code:'DATA_IMPORT_PERMISSION_CHANGED',message:'Label unavailable'}),{status:labelStatus,headers:{'Content-Type':'application/json'}});}}),React,useState,useRef,useEffect,useCallback:f=>f,Button,Card,ConfirmDialog,methodsUrl,...analysis,...full,captureUrl,schemaFields,visitStatus:{},reportsUrl:()=>'',location,document:{activeElement:{id:'recovery'}},window:{}};
 const Control=new Function(...Object.keys(dep),(await compile('pages/shared/AnalysisStartControl.jsx')).replace('export default function','return function'))(...Object.values(dep));
 let Page,PlanDetail;
 if(branch==='full'){const d={...dep,useFullStudyAnalysis:()=>session,useAnalysisStart:getStart,AnalysisStartControl:Control,FullStudySourceRecovery:()=>{},FullStudyReviewProgress:()=>{},FullStudySlices:()=>{},status:{}};Page=new Function(...Object.keys(d),(await compile('pages/shared/FullStudyAnalysisWorkspace.jsx')).replace('export default function','return function'))(...Object.values(d));}
 else{const d={...dep,useFormalAnalysis:()=>session,useAnalysisStart:getStart,AnalysisStartControl:Control,FullStudyModeGate:()=>{},FullStudyAnalysisWorkspace:()=>{}};const o=new Function(...Object.keys(d),(await compile('pages/shared/FormalAnalysisWorkspace.jsx')).replace('export default function','function')+'\nreturn {LegacyFormalAnalysisWorkspace,PlanDetail};')(...Object.values(d));Page=o.LegacyFormalAnalysisWorkspace;PlanDetail=o.PlanDetail;}
 function expand(node,path='root',parents=[]){
  if(!node||typeof node!=='object')return node;
  if(node.type===PlanDetail){const identity=path+'/PlanDetail';begin(identity);return expand(PlanDetail(node.props),identity,parents);}
  if(node.type===Control){assert(!control,'only one Control may mount');const identity=path+'/Control';begin(identity);control={identity,node,parents};return expand(Control(node.props),identity,parents);}
  const children=React.Children.toArray(node.props?.children).map((c,i)=>expand(c,path+'/'+(c?.key??i),[...parents,{type:node.type,title:node.props?.title}]));return React.cloneElement(node,{},...children);
 }
 const render=()=>{seen=new Set();control=null;begin('parent');const tree=expand(Page({route:{studyId:'study',planId:'plan'},configuration:{capabilities:{canReviewPlan:true},caseMetadata:{}}}));for(const k of states.keys())if(!seen.has(k))states.delete(k);return{tree,control,dialogs:all(tree,n=>n.type===ConfirmDialog)};};
 return{render,session,start,location,setLabelStatus:s=>{labelStatus=s;},labelRequests:()=>labelRequests,button:(r,text)=>all(r.tree,n=>n.type===Button&&n.props.children===text)[0],input:(r,label)=>all(r.tree,n=>n.type==='textarea'&&n.props['aria-label']===label)[0],text:r=>JSON.stringify(r.tree,(_k,v)=>typeof v==='function'?undefined:v),setScope:v=>{scope=v;},unlock:()=>{locked=false;start.checkpoint=null;start.active=false;start.requiresProof=false;},flushPlanEffects:async()=>{for(const e of queued.splice(0))if(e.owner.includes('/PlanDetail'))e.fn();await new Promise(r=>setImmediate(r));},continued:()=>continued,sends:()=>sends};
}
for(const branch of ['full','ordinary'])test('V4 actual '+branch+' parent keeps recovery modal through plan missing/loaded/revision while busy and only explicitly continues',async()=>{
 const h=await mount(branch);let r=h.render();h.button(r,'核对上次分析结果').props.onClick();r=h.render();assert.equal(r.dialogs.length,1);assert.equal(r.dialogs[0].props.busy,true);const owner=r.control.identity;
 h.session.view=view(plan());for(const change of [()=>{},()=>{h.session.revision++;},()=>{h.session.view=null;},()=>{h.session.view=view(plan());}]){change();r=h.render();assert.equal(r.control.identity,owner);assert.equal(r.dialogs.length,1);assert.equal(r.dialogs[0].props.busy,true);assert(r.control.parents.some(p=>p.type===Card&&p.title===(branch==='full'?'整课题分析计划':'分析数据准备')));}
 h.start.busy=false;h.start.requiresProof=false;h.start.checkpoint.pending=null;r=h.render();assert.equal(r.dialogs.length,1);assert.equal(r.dialogs[0].props.busy,false);assert.equal(h.continued(),0);r.dialogs[0].props.onConfirm();assert.equal(h.continued(),1);
 h.setScope(branch+':study:actor:1');h.start.checkpoint=null;h.start.active=false;r=h.render();assert.notEqual(r.control?.identity,owner);assert.equal(r.dialogs.length,0);
});
for(const change of ['plan','revision'])test('V4 ordinary '+change+' first render masks old inputs/subject/confirm without effects and rejects old callbacks',async()=>{
 const h=await mount('ordinary');h.unlock();h.session.view=view(plan());let r=h.render();await h.flushPlanEffects();r=h.render();assert(h.text(r).includes('OLD-ALIAS'));const review=h.input(r,'分析计划审批理由'),release=h.input(r,'分析快照放行理由');review.props.onChange({target:{value:'old-review'}});release.props.onChange({target:{value:'old-release'}});r=h.render();h.button(r,'撤销计划批准').props.onClick();r=h.render();const old=r.dialogs[0];assert(old);
 if(change==='plan')h.session.view=view(plan('next-plan'));else h.session.revision++;r=h.render();assert.equal(h.input(r,'分析计划审批理由').props.value,'');assert.equal(h.input(r,'分析快照放行理由').props.value,'');assert(!h.text(r).includes('OLD-ALIAS'));assert.equal(r.dialogs.length,0);review.props.onChange({target:{value:'late-old-value'}});old.props.onConfirm();r=h.render();assert.equal(h.input(r,'分析计划审批理由').props.value,'');assert.equal(h.sends(),0);
});

test('optional subject-label denial preserves the authorized plan and never invokes its required reader',async()=>{const h=await mount('ordinary');h.unlock();const approved=view(plan());h.session.view=approved;h.setLabelStatus(403);h.session.request=async()=>{h.session.view=null;throw Object.assign(Error('required read denied'),{status:403});};h.render();await h.flushPlanEffects();const r=h.render();assert.equal(h.labelRequests(),1);assert.equal(h.session.view,approved);assert(h.text(r).includes('受试者编号暂不可核对'));assert(h.text(r).includes('合成分析计划'));});
