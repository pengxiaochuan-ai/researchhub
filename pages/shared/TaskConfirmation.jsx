import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
import ConfirmDialog from './ConfirmDialog.jsx';
const Confirmation=createContext(async()=>false);
export const useTaskConfirmation=()=>useContext(Confirmation);
export default function TaskConfirmation({children}){
 const [question,setQuestion]=useState(null),pending=useRef(null);
 useEffect(()=>()=>{pending.current?.(false);},[]);
 function ask(message){if(pending.current)return Promise.resolve(false);return new Promise(resolve=>{pending.current=resolve;setQuestion({message,trigger:document.activeElement});});}
 function answer(value){const resolve=pending.current;pending.current=null;setQuestion(null);resolve?.(value);}
 return <Confirmation.Provider value={ask}>{children}{question&&<ConfirmDialog title="请确认当前操作" returnFocus={question.trigger} confirmLabel="确认" onCancel={()=>answer(false)} onConfirm={()=>answer(true)}><p>{question.message}</p></ConfirmDialog>}</Confirmation.Provider>;
}
