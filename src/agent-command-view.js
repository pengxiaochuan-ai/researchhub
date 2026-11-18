// Presentation only: the server remains responsible for dispatch and admission.
export function agentCommandView({items=[],paused=false,uncertain=false,restricted=false},running=false,editingId=null){
 if(restricted)return{primary:null,waiting:[]};
 const waiting=items.filter(i=>['waiting','paused'].includes(i.status)||i.id===editingId);
 const first=waiting.find(i=>i.status==='waiting');
 const active=running||items.some(i=>['queued','processing'].includes(i.status));
 const primary=!active&&!paused&&!uncertain&&first?.id!==editingId?first??null:null;
 return{primary,waiting:waiting.filter(i=>i!==primary)};
}
