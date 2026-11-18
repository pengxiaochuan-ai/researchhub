/** Add a discoverable invitation locator to an already-authorized visit DTO.
 * Never return addresses, token material, session IDs or delivery provider data. */
export async function presentOutreachVisit(tx,scope,visit){
 const ids=(visit.assignments??[]).filter(a=>a.mode==='patient_h5').map(a=>a.id);
 if(!ids.length)return visit;
 const rows=await tx.questionnaireInvitation.findMany({where:{...scope,assignmentId:{in:ids},deliveries:{some:{channel:'email'}}},select:{id:true,assignmentId:true},orderBy:[{createdAt:'desc'},{id:'desc'}]});
 const latest=new Map();for(const row of rows)if(!latest.has(row.assignmentId))latest.set(row.assignmentId,row.id);
 return {...visit,assignments:visit.assignments.map(a=>latest.has(a.id)&&a.mode==='patient_h5'?{...a,emailInvitation:{invitationId:latest.get(a.id)}}:a)};
}
