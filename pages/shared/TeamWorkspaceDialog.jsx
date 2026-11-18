import React,{useEffect,useId,useRef} from 'react';
import {Button} from './Components.jsx';
import './team-workspace-dialog.css';

export default function TeamWorkspaceDialog({title,onClose,onAfterClose,children,footer,busy=false}){
 const ref=useRef(null),id=useId();
 useEffect(()=>{const node=ref.current;node.showModal();node.querySelector('button')?.focus();return()=>{node.close();onAfterClose?.();};},[]);
 function trap(event){const node=ref.current;if(event.key!=='Tab'||document.activeElement?.closest('dialog')!==node)return;const controls=[...node.querySelectorAll('button,a[href],input,select,textarea,[tabindex]')].filter(e=>!e.disabled&&e.tabIndex>=0&&e.getClientRects().length),first=controls[0],last=controls.at(-1);if(!first){event.preventDefault();node.focus();}else if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
 return <dialog ref={ref} tabIndex={-1} className="team-workspace-dialog" aria-modal="true" aria-labelledby={id} aria-busy={busy} onKeyDown={trap} onCancel={e=>{if(e.target!==e.currentTarget)return;e.preventDefault();onClose();}}>
  <header className="team-workspace-dialog-header"><h2 id={id} tabIndex={-1}>{title}</h2><Button onClick={onClose} aria-label="关闭审核弹窗">关闭</Button></header>
  <div className="team-workspace-dialog-body">{children}</div>
  <footer className="team-workspace-dialog-footer">{footer}</footer>
 </dialog>;
}
