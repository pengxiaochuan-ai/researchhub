import React,{useEffect,useId,useRef} from 'react';
import {Button} from './Components.jsx';
import './confirm-dialog.css';

export default function ConfirmDialog({title,children,confirmLabel='确认',cancelLabel='取消',onConfirm,onCancel,busy=false,confirmDisabled=false,danger=true,returnFocus,fallbackFocus,acknowledgeOnly=false}){
 const dialog=useRef(null),cancel=useRef(null),id=useId();
 useEffect(()=>{const node=dialog.current,trigger=returnFocus??document.activeElement;node.showModal();cancel.current?.querySelector('button')?.focus();return()=>{node.close();const target=trigger?.isConnected?trigger:fallbackFocus;if(target?.isConnected)(target.querySelector('button')??target).focus();};},[returnFocus,fallbackFocus]);
 function keepFocus(event){if(event.key!=='Tab')return;const controls=[...dialog.current.querySelectorAll('button,a[href],input,select,textarea,summary,[tabindex]')].filter(e=>!e.disabled&&e.tabIndex>=0&&e.getClientRects().length),first=controls[0],last=controls.at(-1);if(!first){event.preventDefault();dialog.current.focus();}else if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
 return <dialog ref={dialog} tabIndex={-1} className={'ui-confirm-dialog'+(acknowledgeOnly?' ui-result-dialog':'')} aria-modal="true" aria-labelledby={id+'-title'} aria-describedby={children?id+'-description':undefined} aria-busy={busy} onKeyDown={keepFocus} onCancel={event=>{event.preventDefault();if(!busy)onCancel();}}>
  <h2 id={id+'-title'}>{title}</h2>
  {children&&<div id={id+'-description'} className="ui-confirm-dialog-body">{children}</div>}
  <div className="ui-confirm-dialog-actions" ref={cancel}>{!acknowledgeOnly&&<Button disabled={busy} onClick={onCancel}>{cancelLabel}</Button>}<Button danger={danger} primary={!danger} disabled={busy||confirmDisabled} onClick={onConfirm}>{confirmLabel}</Button></div>
 </dialog>;
}
