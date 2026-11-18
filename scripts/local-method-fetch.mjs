// Metadata-only evidence for the owned deterministic Worker; never log input rows or auth.
import assert from 'node:assert/strict';
import {appendFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
export function createLocalMethodFetch({file,fetchImpl=globalThis.fetch}){
 return async(url,options)=>{
  assert(url==='http://127.0.0.1:19505/v1/execute'&&options?.method==='POST'&&typeof options.body==='string','LOCAL_METHOD_FETCH_SCOPE_REJECTED');
  const payload=JSON.parse(options.body),base={requestId:payload.requestId,executorKey:payload.executorKey,manifestHash:payload.input?.manifestHash,requestSha256:sha(options.body)};
  const record=value=>appendFileSync(file,JSON.stringify({...base,at:new Date().toISOString(),...value})+'\n',{mode:0o600});
  record({phase:'dispatch'});
  let response;try{response=await fetchImpl(url,options);}catch(error){record({phase:'transport_failed'});throw error;}
  const bytes=Buffer.from(await response.clone().arrayBuffer());let value;try{value=JSON.parse(bytes.toString('utf8'));}catch{}
  record({phase:'response',httpStatus:response.status,responseSha256:sha(bytes),executorVersion:value?.executorVersion,workerVersion:value?.workerVersion,ok:value?.ok===true});
  return response;
 };
}
