import React from 'react';
import {Button} from './Components.jsx';
import {studyWorkflowStages} from '../../src/study-workflow-stages.js';
export default function StudyWorkflowNav({item,studyId,onRetry}){
 let stages;try{stages=studyWorkflowStages(item,studyId);}catch(e){return <div role="alert"><p>{e.message}</p><Button onClick={onRetry}>重新读取概览</Button></div>;}
 return <nav onFocusCapture={event=>{const node=event.target,top=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--layout-topbar'))||0;if(node.getBoundingClientRect().top<top+12)node.scrollIntoView({block:'center',inline:'nearest'});}} className="rh-study-flow" aria-label="当前课题流程"><ol>{stages.map((stage,index)=><li key={stage.key}>{stage.href?<a href={stage.href}><span>{index+1}. {stage.label}</span><p>{stage.detail}</p></a>:<div aria-disabled="true"><span>{index+1}. {stage.label}</span><p>{stage.detail}</p></div>}</li>)}</ol></nav>;
}
