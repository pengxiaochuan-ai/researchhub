// Isolated free browser fixture. Not imported by a product page/API.
import React from 'react';import {createRoot} from 'react-dom/client';
import AgentCommandComposer from '../../pages/shared/AgentCommandComposer.jsx';
import '../../src/design-tokens.css';
import '../../pages/shared/real-ai-workspace.css';
let items=[{id:'length-waiting',text:'待执行的研究问题',status:'waiting',version:1,requestKey:'length-fixture-key'}];
window.questionLengthHarness={writes:[]};
const client={get:async()=>({items,paused:false,uncertain:false}),post:async(path,body)=>{window.questionLengthHarness.writes.push({method:'POST',path,body});return{id:'length-confirmed',text:body.text};},patch:async(path,body)=>{window.questionLengthHarness.writes.push({method:'PATCH',path,body});items=items.map(x=>({...x,text:body.text,version:x.version+1}));return items[0];}};
createRoot(document.getElementById('root')).render(<main className="real-ai-workspace" style={{margin:24}}><div className="composer"><AgentCommandComposer client={client} sessionId="length-harness-session" running getSession={async()=>'length-harness-session'}/></div></main>);
