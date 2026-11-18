// Browser-only test harness; never imported by a product page or API.
import React from 'react';import {createRoot} from 'react-dom/client';
import AgentCommandComposer from '../../pages/shared/AgentCommandComposer.jsx';
let attempts=0;window.commandHarness={ensureCalls:0,posts:[]};
const client={get:async()=>({items:[]}),post:async(path,body)=>{window.commandHarness.posts.push({path,body});return{id:'test-command'};}};
async function getSession(){window.commandHarness.ensureCalls++;if(++attempts===1)throw Error('会话建立连接超时，结果待核对。');return'harness-session';}
createRoot(document.getElementById('root')).render(<AgentCommandComposer client={client} getSession={getSession}/>);
