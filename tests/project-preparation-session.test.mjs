import test from 'node:test';
import assert from 'node:assert/strict';
const mod=await import('../src/project-preparation-session.js').catch(()=>({}));
const scope={actorId:'owner',authVersion:1};
const values={title:'Synthetic WF01',question:'',researchType:'',hubKey:'',pico:{p:'',i:'',c:'',o:''}};
const draft={id:'project',version:1,...values,study:null};
const study={id:'study',studyGroupId:'group',executionProjectId:'execution'};
function fixture(overrides={}){
 const storage=new Map(),calls=[],state={scope:{...scope},version:1,groups:[{id:'group'}],study:null,...overrides};
 const result=()=>({item:{...draft,version:state.version,study:state.study},creationGroups:state.groups,capabilities:{canEdit:true,canCreateStudy:!state.study}});
 const request=async(path,options={})=>{calls.push({path,...options});if(options.method){if(overrides.write)return overrides.write(path,options,state,result);if(path.endsWith('/studies')){state.study=study;state.version++;}return result();}return overrides.read?overrides.read(path,state,result):path.startsWith('/research-studies/')?{item:{project:result().item,study:state.study}}:result();};
 const make=()=>{assert.equal(typeof mod.createProjectPreparation,'function','WF01 must expose the actual recoverable preparation behavior');return mod.createProjectPreparation({request,storage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},scope:()=>state.scope,key:(()=>{let n=0;return()=> 'request-wf01-'+(++n);})()});};
 return{state,storage,calls,make,result};
}
test('one preparation intent saves once, creates one Study and leads to S11 without clinical approval',async()=>{
 const f=fixture(),flow=f.make();const out=await flow.start({mode:'prepare',values,groups:f.state.groups});
 assert.equal(out.item.study.id,'study');assert.equal(out.href,'/pages/s11/?formalPreparation=1&studyId=study');
 assert.deepEqual(f.calls.filter(x=>x.method).map(x=>x.path),['/research-projects','/research-projects/project/studies']);assert.equal(flow.pending(),null);assert.equal(f.storage.size,0);
});
test('draft permits incomplete question/PICO with no group; multiple groups never select first implicitly',async()=>{
 const f=fixture({groups:[]}),flow=f.make();await flow.start({mode:'draft',values,groups:[]});assert.equal(f.calls.filter(x=>x.method).length,1);
 const g=fixture({groups:[{id:'g1'},{id:'g2'}]}),other=g.make();await assert.rejects(other.start({mode:'prepare',values,groups:g.state.groups}),/研究组/);assert.equal(g.calls.length,0);
});
test('existing Study is only saved when changed and otherwise entered by an authorized read',async()=>{
 for(const dirty of [false,true]){const f=fixture({study}),flow=f.make();const out=await flow.start({mode:'prepare',values,item:{...draft,study},dirty,groups:f.state.groups});assert.equal(out.item.study.id,study.id);assert.equal(f.calls.filter(x=>x.path.endsWith('/studies')).length,0);assert.equal(f.calls.filter(x=>x.method).length,dirty?1:0);}
});
test('partial success keeps its project checkpoint and explicit continue never repeats the project save',async()=>{
 let fails=true;const f=fixture({write:(path,_o,state,result)=>{if(path.endsWith('/studies')){if(fails)throw Object.assign(Error('暂时无权建立研究'),{status:403});state.study=study;state.version++;}return result();}}),flow=f.make();
 await assert.rejects(flow.start({mode:'prepare',values,groups:f.state.groups}));assert.equal(flow.checkpoint().projectId,'project');fails=false;
 const out=await flow.start({mode:'prepare',values,item:draft,dirty:false,groups:f.state.groups});assert.equal(out.item.study.id,'study');assert.equal(f.calls.filter(x=>x.path==='/research-projects').length,1);
});
test('unknown POST persists only opaque proof; refresh recovery GET never repeats a write or treats 404 as non-execution',async()=>{
 const f=fixture({write:()=>{throw Object.assign(Error('response lost'),{unknown:true});},read:()=>{throw Object.assign(Error('receipt missing'),{status:404});}}),flow=f.make();await assert.rejects(flow.start({mode:'prepare',values,groups:f.state.groups}));
 const serialized=[...f.storage.values()].join('');assert(serialized.includes('request-wf01-1'));assert(!serialized.includes(values.title));assert(!serialized.includes('question'));assert(!serialized.includes('pico'));
 const refreshed=f.make(),before=f.calls.length;await assert.rejects(refreshed.recover());assert(refreshed.pending());assert(f.calls.slice(before).every(x=>!x.method));
});
test('receipt success after refresh restores the saved project, but continuation stays an explicit action',async()=>{
 const f=fixture({write:()=>{throw Object.assign(Error('lost'),{unknown:true});}}),flow=f.make();await assert.rejects(flow.start({mode:'prepare',values,groups:f.state.groups}));
 const marker=flow.pending();f.state.version=1;const current=f.result();f.state.scope={...scope};
 const refreshed=mod.createProjectPreparation({request:async(path,options)=>{assert(!options?.method);return {...current,receipt:{requestKey:marker.requestKey,action:marker.action,targetId:'project',requestHash:marker.requestHash,authVersion:1},current};},storage:{getItem:k=>f.storage.get(k)??null,setItem:(k,v)=>f.storage.set(k,v),removeItem:k=>f.storage.delete(k)},scope:()=>f.state.scope});
 const out=await refreshed.recover();assert.equal(out.item.id,'project');assert.equal(out.href,undefined);assert.equal(refreshed.checkpoint().projectId,'project');assert.equal(refreshed.pending(),null);
});
test('double activation, authVersion/account changes and source drift cannot continue or publish stale results',async()=>{
 let resolve;const f=fixture({write:()=>new Promise(r=>resolve=r)}),flow=f.make(),first=flow.start({mode:'prepare',values,groups:f.state.groups});await new Promise(r=>setTimeout(r,10));await assert.rejects(flow.start({mode:'prepare',values,groups:f.state.groups}),/正在/);
 f.state.scope.authVersion=2;resolve(f.result());await assert.rejects(first,e=>e.code==='RESEARCH_STALE');assert.equal(f.calls.length,1);
 const g=fixture({read:(_path,state,result)=>{state.version=3;return result();}}),guard=g.make();await assert.rejects(guard.start({mode:'prepare',values,item:draft,dirty:false,groups:g.state.groups}),e=>e.status===409);assert.equal(g.calls.filter(x=>x.method).length,0);
});
test('PATCH unknown refresh retains exact project/CAS and malformed persisted proof cannot become a new intent',async()=>{
 const f=fixture({write:()=>{throw Object.assign(Error('lost'),{unknown:true});}}),flow=f.make();await assert.rejects(flow.start({mode:'prepare',values,item:draft,dirty:true,groups:f.state.groups}));assert.equal(flow.checkpoint()?.projectId,'project');
 const [key,value]=[...f.storage][0],saved=JSON.parse(value);saved.pending.path='/admin/delete-everything';f.storage.set(key,JSON.stringify(saved));const restored=f.make();assert.throws(()=>restored.pending(),/标记|核对/);assert.equal(f.calls.filter(x=>x.method).length,1);
});
test('only explicit retry may resend the exact frozen request; newer input cannot replace it',async()=>{
 const f=fixture({write:()=>{throw Object.assign(Error('lost'),{unknown:true});}}),flow=f.make();await assert.rejects(flow.start({mode:'draft',values,groups:f.state.groups}));const old=f.calls[0];
 const refreshed=f.make();await assert.rejects(refreshed.retryOriginal({...values,title:'changed'}),/原内容/);assert.equal(f.calls.length,1);await assert.rejects(refreshed.retryOriginal(values));assert.deepEqual(f.calls[1],old);
});
test('completed aliases are removed, and storage refusal aborts before any POST',async()=>{
 const f=fixture(),flow=f.make();await flow.start({mode:'prepare',values,groups:f.state.groups});assert.equal(f.storage.size,0);
 const blocked=mod.createProjectPreparation({scope:()=>scope,storage:{getItem:()=>null,setItem:()=>{throw Error('storage denied');}},request:()=>{throw Error('MUST NOT REQUEST');}});await assert.rejects(blocked.start({mode:'draft',values,groups:[]}),/storage denied/);
});
test('a URL change during a write rejects its late acknowledgment and never enters the old Study',{timeout:500},async()=>{
 let resolve;const f=fixture({scope:{...scope,route:'/pages/q01/?researchCreation=1'},write:(path,_opts,state,result)=>path.endsWith('/studies')?{...result(),item:{...draft,study}}:new Promise(r=>resolve=r)}),flow=f.make(),pending=flow.start({mode:'prepare',values,groups:f.state.groups});await new Promise(r=>setTimeout(r,10));f.state.scope.route='/pages/q01/?researchCreation=1&projectIntentId=other';resolve(f.result());await assert.rejects(pending,e=>e.code==='RESEARCH_STALE');assert.equal(f.calls.length,1);
});
test('client opaque digest is identical to the native canonical hash including raw input and request key',async()=>{
 const {requestHash}=await import('../server/research-studies/contract.mjs');const body={pico:{o:' x ',p:'',i:'',c:''},title:'  raw title  ',requestKey:'request-proof',expectedVersion:3};assert.equal(await mod.projectPreparationHash(body),requestHash(body));
});
test('an intent owner cannot enter an existing Study after Study access is revoked',async()=>{
 const f=fixture({study,read:(path,_state,result)=>{if(path.startsWith('/research-studies/'))throw Object.assign(Error('Study forbidden'),{status:403});return result();}}),flow=f.make();await assert.rejects(flow.start({mode:'prepare',values,item:{...draft,study},dirty:false,groups:f.state.groups}),e=>e.status===403);assert.equal(f.calls.filter(x=>x.method).length,0);
});
test('an invalidated actor does not hold the next actor or clear its busy/write guard when the old write settles',async()=>{
 const releases=[];const f=fixture({write:()=>new Promise(r=>releases.push(r))}),flow=f.make();const old=flow.start({mode:'draft',values,groups:f.state.groups});await new Promise(r=>setTimeout(r,10));flow.invalidate();f.state.scope={actorId:'second',authVersion:1};const next=flow.start({mode:'draft',values,groups:f.state.groups});await new Promise(r=>setTimeout(r,10));assert.equal(releases.length,2);releases[0](f.result());await assert.rejects(old,e=>e.code==='RESEARCH_STALE');assert.equal(flow.inFlight(),true);await assert.rejects(flow.start({mode:'draft',values,groups:f.state.groups}),/正在/);releases[1](f.result());await next;assert.equal(flow.inFlight(),false);
});
test('definitively rejected original create retry removes its opaque marker so refresh permits correction',async()=>{
 let first=true;const f=fixture({write:()=>{if(first){first=false;throw Object.assign(Error('lost'),{unknown:true});}throw Object.assign(Error('Hub no longer available'),{status:400});}}),flow=f.make();await assert.rejects(flow.start({mode:'draft',values,groups:f.state.groups}));await assert.rejects(flow.retryOriginal(values),e=>e.status===400);assert.equal(f.storage.size,0);const fresh=f.make();assert.equal(fresh.pending(),null);
});
test('definitive update retry failure permits corrected explicit PATCH, while Study failure preserves saved project checkpoint',async()=>{
 let attempt=0;const f=fixture({write:(_path,options,state,result)=>{attempt++;if(attempt===1)throw Object.assign(Error('lost'),{unknown:true});if(attempt===2)throw Object.assign(Error('validation changed'),{status:400});state.version++;return {...result(),item:{...result().item,...options.body,version:state.version}};}}),flow=f.make();await assert.rejects(flow.start({mode:'draft',values,item:draft,dirty:true,groups:f.state.groups}));await assert.rejects(flow.retryOriginal(values),e=>e.status===400);assert.equal(f.make().pending(),null);await flow.start({mode:'draft',values:{...values,title:'Corrected synthetic'},item:draft,dirty:true,groups:f.state.groups});const writes=f.calls.filter(c=>c.method);assert.equal(writes.length,3);assert(writes.every(c=>c.path==='/research-projects/project'&&c.method==='PATCH'));assert.notEqual(writes[0].body.requestKey,writes[2].body.requestKey);
 let child=0;const g=fixture({write:(path,_o,_state,result)=>{if(path.endsWith('/studies')){child++;throw Object.assign(Error('child unavailable'),child===1?{unknown:true}:{status:400});}return result();}}),partial=g.make();await assert.rejects(partial.start({mode:'prepare',values,groups:g.state.groups}));await assert.rejects(partial.retryOriginal(values),e=>e.status===400);const refreshed=g.make();assert.equal(refreshed.pending(),null);assert.equal(refreshed.checkpoint().projectId,'project');assert.equal(g.calls.filter(c=>c.path==='/research-projects').length,1);
});
