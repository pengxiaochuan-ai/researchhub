import {validReleasePending} from './execution-release-session.js';
export async function readReleaseReceipt(request,root,pending){
 if(!validReleasePending(pending,root))throw Error('无法核对此方案操作，请从原研究重新进入。');
 const action=pending.path.slice(root.length+1),key=pending.body.requestKey;
 const value=await request(root+'/release-receipts/'+encodeURIComponent(key)+'?'+new URLSearchParams({action}));
 if(value?.found===false)return{found:false};
 const expected=action==='policy'?'protocol.policy.save':'protocol.'+action;
 if(value?.found!==true||value.result?.receipt?.requestKey!==key||value.result.receipt.action!==expected||value.result.receipt.targetId!==root.split('/').at(-1))throw Error('原操作结果暂时无法核对，请稍后再试。');
 return value;
}
