import {useEffect,useRef,useState} from 'react';
import {getPlatformUser} from '../../src/platform-user.js';
export function useDirectoryIdentity(){
 const [user,setUser]=useState(getPlatformUser);
 useEffect(()=>{const update=()=>setUser(getPlatformUser());window.addEventListener('qiyan:user-change',update);return()=>window.removeEventListener('qiyan:user-change',update);},[]);
 const last=useRef('');const checking=user.status==='checking';if(!checking)last.current=[user.status,user.authenticated,user.id,user.accountId,user.authVersion].join(':');
 return {user,checking,unavailable:user.status==='unavailable',audience:user.authenticated?'tenant':'public',identityKey:last.current};
}
export const metricText=metric=>metric?.value===null||metric?.value===undefined?'—':metric.value;
export {directoryMessage} from '../../src/directory-presentation.js';
