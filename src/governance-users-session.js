export function createGovernanceUsersClient({fetchImpl=globalThis.fetch}={}){
 async function request(path,{method='GET',body,signal}={}){
  let response;try{response=await fetchImpl('/api/governance-users/'+path,{method,mode:'same-origin',credentials:'same-origin',cache:'no-store',redirect:'error',signal:signal??AbortSignal.timeout(15000),headers:{Accept:'application/json',...(body?{'Content-Type':'application/json','X-ResearchHub-Request':'session-v1'}:{})},...(body?{body:JSON.stringify(body)}:{})});}catch{throw Object.assign(Error('连接中断或超时，请先核对原操作结果，不会自动重复提交。'),{status:0,unknown:method!=='GET'});}
  let value;try{value=await response.json();}catch{throw Object.assign(Error('结果暂时无法核对，请保留当前操作。'),{status:503,unknown:method!=='GET'});}
  if(!response.ok)throw Object.assign(Error(value.message??'资料暂时无法读取，请重试。'),{status:response.status,code:value.code,unknown:method!=='GET'&&response.status>=500});return value;
 }
 return{request,accounts:q=>request('accounts?'+new URLSearchParams(q)),detail:id=>request('accounts/'+encodeURIComponent(id)),status:(id,input)=>request('accounts/'+encodeURIComponent(id)+'/status',{method:'POST',body:input}),receipt:key=>request('account-receipts/'+encodeURIComponent(key)),studies:()=>request('studies'),members:(g,p)=>request('studies/'+encodeURIComponent(p)+'/members?'+new URLSearchParams({studyGroupId:g})),changeMember:(g,p,id,input)=>request('studies/'+encodeURIComponent(p)+'/members/'+encodeURIComponent(id),{method:'POST',body:{studyGroupId:g,...input}})};
}
