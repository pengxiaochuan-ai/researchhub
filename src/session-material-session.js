const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
const fields=['studyGroupId','researchProjectId','kbId','docId'];
export function readMaterialKnowledgeTarget(search){
 const params=new URLSearchParams(search);
 if(!params.has('kbId')&&!params.has('docId')&&!params.has('importTaskId'))return {kind:'none'};
 const selected=[...fields.slice(0,3),params.has('importTaskId')?'importTaskId':'docId'];
 const fixed=params.has('docVersion')||params.has('contentSha256'),version=Number(params.get('docVersion'));
 if(params.has('importTaskId')&&params.has('docId')||selected.some(key=>params.getAll(key).length!==1||!id(params.get(key)))||[...params.keys()].some(key=>!selected.includes(key)&&!['mode','docVersion','contentSha256'].includes(key))||params.getAll('mode').length>1||fixed&&(params.has('importTaskId')||params.getAll('docVersion').length!==1||params.getAll('contentSha256').length!==1||!Number.isSafeInteger(version)||version<1||!/^[a-f0-9]{64}$/.test(params.get('contentSha256')??'')))return {kind:'invalid'};
 return {kind:'valid',...Object.fromEntries(selected.map(key=>[key,params.get(key)])),...(fixed?{docVersion:version,contentSha256:params.get('contentSha256')}:{})};
}
export function materialKnowledgeHref(item,scope){
 const target=item?.decisionRequired?{importTaskId:item.importTaskId}:item?.available||item?.canReviewDoc?{docId:item.docId}:null;
 if(!target||![scope?.studyGroupId,scope?.researchProjectId,item?.kbId,...Object.values(target)].every(id))return null;
 const fixed=item.docVersion!==undefined||item.contentSha256!==undefined;
 if(fixed&&(target.docId===undefined||!Number.isSafeInteger(item.docVersion)||item.docVersion<1||!/^[a-f0-9]{64}$/.test(item.contentSha256??'')))return null;
 return '/pages/k01/?'+new URLSearchParams({studyGroupId:scope.studyGroupId,researchProjectId:scope.researchProjectId,kbId:item.kbId,...target,...(fixed?{docVersion:item.docVersion,contentSha256:item.contentSha256}:{})});
}
export async function assertMaterialDocumentVersion(doc,target){
 if(target?.docVersion==null&&target?.contentSha256==null)return true;
 const invalid=()=>{throw Object.assign(Error('资料已修订，与本次回答引用的版本不同。请返回原会话核对固定选段，或重新提问。'),{code:'HUB_PRIVATE_DOCUMENT_CHANGED'});};
 if(doc?.id!==target.docId||doc.kbId!==target.kbId||doc.version!==target.docVersion||typeof doc.contentMd!=='string')invalid();
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(doc.contentMd)),actual=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
 if(actual!==target.contentSha256)invalid();return true;
}
export function readPendingMaterialKeys(raw){
 try{const keys=JSON.parse(raw??'[]');if(!Array.isArray(keys)||keys.length>20||!keys.every(id))return [];return [...new Set(keys)];}catch{return [];}
}
export function materialStateLabel(item){
 return item.state==='ready'?'已保存，可查看':item.state==='blocked'?(item.decisionRequired?'需要确认保存':item.stage==='discarded'?'未保存':item.canReviewDoc?'已保存，需核对':'安全检查未通过'):item.state==='failed'?'无法使用':item.state==='removed'?'已移除':item.stage==='parsing'?'正在解析':'正在整理';
}
export function assertMaterialPage(value){
 if(!value||!Array.isArray(value.items)||value.items.length>50||(value.nextCursor!==null&&!id(value.nextCursor))||value.items.some(item=>!id(item?.id)||!Number.isSafeInteger(item.version)||item.version<1||!['staged','importing','ready','blocked','failed','removed'].includes(item.state)||typeof item.name!=='string'||item.available!==(item.state==='ready')))throw Error('资料状态无法核对，请重新获取。');
 return value;
}
export function materialAnalysisState({enabled,analysisReady=false,checking=false,error='',uploading=false,pending=[],items=[]}){
 const usable=items.some(item=>item.available||['staged','importing'].includes(item.state));
 return {hasMaterials:items.length>0,blocksAnalysis:Boolean(enabled&&(checking||error||uploading||pending.length||items.length&&(!analysisReady||!usable)))};
}
