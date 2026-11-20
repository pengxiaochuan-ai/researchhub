// Deliberately mocked component contract. Never AI execution or backend acceptance.
import React,{useState,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import KnowledgeBasePage from '../../src/knowledge-reuse/pages/knowledge/KnowledgeBasePage';
import KbAgentPanel from '../../src/knowledge-reuse/pages/knowledge/KbAgentPanel';
import WikiEditor from '../../src/knowledge-reuse/pages/knowledge/WikiEditor';
import {SystemDialogProvider} from '../../src/knowledge-reuse/components/SystemDialogProvider';
import {session} from '../../src/knowledge-reuse/store/auth';
import {adoptKnowledgeAnswer,appendKnowledgeAnswer} from '../../src/knowledge-records.js';
import '/pages/k01/frame.css';

const scope={studyGroupId:'contract-group',researchProjectId:'contract-project'};
session.scope=scope;
session.user={tenantId:'contract-tenant',accountId:'contract-actor',authVersion:0,role:'researcher',studyGroups:[{id:scope.studyGroupId,role:{menuPermissions:['knowledge','workbench'],buttonPermissions:['knowledge.edit','chat.use']},researchProjects:[{id:scope.researchProjectId}]}]};
const scenario=new URLSearchParams(location.search).get('scenario')||'page';
function Contract(){
 const [,tick]=useState(0),[target,setTarget]=useState({key:'doc:1',allowed:true}),[draft,setDraft]=useState('contract original'),[rendered,setRendered]=useState('');
 const latest=useRef(draft);latest.current=draft;
 window.__f07={
  changeTarget:(key,allowed=true)=>setTarget({key,allowed}),
  changeIdentity:()=>{session.user={...session.user,authVersion:session.user.authVersion+1};tick(v=>v+1);},
  setDraft,
  adoptionCalls:window.__f07?.adoptionCalls||0,
  renderAnswer:async(message)=>setRendered(await adoptKnowledgeAnswer({get:path=>fetch('/api'+path).then(r=>r.json()),sessionId:'contract-session',kbId:'contract-kb',message,scope})),
 };
 if(scenario==='panel')return <><textarea aria-label="contract draft" value={draft} onChange={e=>setDraft(e.target.value)}/><KbAgentPanel kbId="contract-kb" kbName="Contract" canAdopt={target.allowed} adoptionTargetKey={target.key} onAdopt={(md,key)=>{window.__f07.adoptionCalls++;if(key===target.key&&target.allowed)setDraft(appendKnowledgeAnswer(latest.current,md));}}/></>;
 if(scenario==='render')return <><section data-testid="wysiwyg"><WikiEditor value={rendered} onChange={()=>{}} editable mode="wysiwyg"/></section><section data-testid="preview"><WikiEditor value={rendered} onChange={()=>{}} mode="preview"/></section></>;
 return <KnowledgeBasePage embedded initialKbId="contract-kb" initialDocId="contract-current"/>;
}
createRoot(document.getElementById('root')).render(<SystemDialogProvider><div className="knowledge-island" style={{height:'100vh'}}><Contract/></div></SystemDialogProvider>);
