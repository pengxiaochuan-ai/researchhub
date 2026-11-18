export async function presentFormalRevisions(tx,scope,items){
 const ids=[...new Set(items.filter(i=>i.actorKind==='account').map(i=>i.actorId))];
 const accounts=ids.length?await tx.account.findMany({where:{tenantId:scope.tenantId,id:{in:ids}},select:{id:true,displayName:true}}):[];
 const names=new Map(accounts.map(a=>[a.id,a.displayName?.trim()||'历史账号']));
 return items.map(item=>({...item,actorDisplayName:item.actorKind==='h5_session'?'问卷自填':names.get(item.actorId)??'历史账号'}));
}
