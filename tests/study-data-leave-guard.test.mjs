import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformWithEsbuild} from 'vite';
async function mount({dirty=true}={}){
 const source=readFileSync(new URL('../pages/shared/useStudyDataLeaveGuard.jsx',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export default function','function');
 const {code}=await transformWithEsbuild(source,'guard.jsx',{jsx:'transform',jsxFactory:'React.createElement'});
 const listeners=new Map(),slots=[],effects=[];let cursor=0,view,props={enabled:true,dirty};const assigned=[];
 const bus={addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name);}};
 const location={href:'http://local/pages/ai01/?sessionId=session',origin:'http://local',pathname:'/pages/ai01/',search:'?sessionId=session',assign:x=>assigned.push(x)};
 const useState=value=>{const i=cursor++;slots[i]??={value};return[slots[i].value,x=>{slots[i].value=x;}];},useRef=value=>{const i=cursor++;slots[i]??={current:value};return slots[i];};
 const useEffect=(fn,deps)=>{const i=cursor++,old=slots[i];if(!old||deps.some((x,n)=>x!==old.deps[n])){old?.cleanup?.();slots[i]={deps};effects.push(()=>{slots[i].cleanup=fn();});}};
 const React={createElement:(type,props,...children)=>({type,props:{...props,children}})};
 const hook=new Function('React','useEffect','useRef','useState','ConfirmDialog','window','document','location',code+';return useStudyDataLeaveGuard;')(React,useEffect,useRef,useState,'ConfirmDialog',bus,bus,location);
 const render=extra=>{props={...props,...extra};cursor=0;view=hook(props);while(effects.length)effects.shift()();return view;};
 const click=(href,extra={})=>{const link={href,target:'',hasAttribute:()=>false,...extra.link};const e={button:0,target:{closest:()=>link},preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...extra};listeners.get('click')?.(e);return e;};
 render();return{render,click,assigned,listeners,cleanup:()=>slots.forEach(s=>s.cleanup?.())};
}
test('dirty AI return uses one in-app decision, cancel preserves state, confirmed leave suppresses duplicate unload prompt',async()=>{
 const h=await mount();try{const e=h.click('http://local/pages/s09/?formalCapture=1&studyId=study&visitId=visit#capture-files');assert(e.prevented&&e.stopped);const dialog=h.render().dialog;assert.equal(dialog.props.title,'离开前核对未保存内容');dialog.props.onCancel();assert.equal(h.render().dialog,null);assert.deepEqual(h.assigned,[]);h.click('http://local/pages/s09/?formalCapture=1&studyId=study&visitId=visit#capture-files');h.render().dialog.props.onConfirm();assert.deepEqual(h.assigned,['/pages/s09/?formalCapture=1&studyId=study&visitId=visit#capture-files']);let prevented=false;h.listeners.get('beforeunload')?.({preventDefault(){prevented=true;}});assert.equal(prevented,false);}finally{h.cleanup();}
});
test('clean navigation, same-page anchors, other windows and downloads do not add confirmations; refresh still protects dirty input',async()=>{
 const h=await mount();try{for(const [url,extra]of [['http://local/pages/ai01/?sessionId=session#message',{}],['https://other.test/',{}],['http://local/pages/s01/',{ctrlKey:true}],['http://local/pages/s01/',{link:{target:'_blank'}}],['http://local/pages/s01/',{link:{hasAttribute:()=>true}}]])assert(!h.click(url,extra).prevented);let prevented=false;h.listeners.get('beforeunload')({preventDefault(){prevented=true;}});assert(prevented);h.render({dirty:false});assert(!h.listeners.has('beforeunload'));assert(!h.click('http://local/pages/s01/').prevented);}finally{h.cleanup();}
});
