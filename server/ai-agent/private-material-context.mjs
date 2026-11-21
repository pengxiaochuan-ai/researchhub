const prefix='hub-private:v1:',hub='hub:lingshu-xinyu',conversation=hub+':conversation:';
const valid=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(id);
const uuid='[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}';
export function privateMaterialContext(sessionId,originalContext){
 if(!valid(sessionId))throw Error('HUB_PRIVATE_CONTEXT_INVALID');
 const origin=originalContext===hub?'legacy':new RegExp('^'+conversation+'('+uuid+')$').exec(originalContext??'')?.[1];
 if(!origin)throw Error('HUB_PRIVATE_CONTEXT_INVALID');return prefix+sessionId+':'+origin;
}
export function parsePrivateMaterialContext(session){
 if(!valid(session?.id)||session.channel!=='knowledge'||typeof session.contextKey!=='string')return null;
 const origin=session.contextKey.slice((prefix+session.id+':').length);
 if(session.contextKey!==prefix+session.id+':'+origin||origin!=='legacy'&&!new RegExp('^'+uuid+'$').test(origin))return null;
 return{sessionId:session.id,originalContextKey:origin==='legacy'?hub:conversation+origin};
}
export const isPrivateMaterialSession=session=>Boolean(parsePrivateMaterialContext(session));
// Historical receipts keep their original context hash; this is a read-only
// view, never a write, grant, or reinterpretation of a new native result.
export function privateMaterialLegacySession(session,stored,digest){
 const previous=parsePrivateMaterialContext(session);
 return previous&&stored?.session?.id===session.id&&stored.session.contextHash===digest(previous.originalContextKey)?{...session,contextKey:previous.originalContextKey}:session;
}
export const PRIVATE_MATERIAL_CONTEXT_PREFIX=prefix;
export const PRIVATE_NATIVE_RUNTIME='hub-native-private.v1';
