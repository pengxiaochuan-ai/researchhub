import assert from'node:assert/strict';
export function assertMediaBindingProtection({before,after,anchor,currentProjects,targetProjectId,registeredFileIds}){
 const outsideChanges=[];
 for(const[k,rows]of Object.entries(before)){
  const current=new Map(after[k].map(r=>[r.id,r.digest]));
  for(const row of rows){
   const outside=anchor.rows.find(x=>x.table===k&&x.id===row.id);
   if(outside){
    assert(['subject_visit','form_response'].includes(k)&&outside.project!==targetProjectId&&current.has(row.id));
    assert.equal(currentProjects[k+'/'+row.id],outside.project,'Outside row parent changed');
    if(current.get(row.id)!==row.digest)outsideChanges.push({table:k,id:row.id,project:outside.project,baseline:row.digest,preWriteAnchor:outside.digest,current:current.get(row.id)});
   }else assert.equal(current.get(row.id),row.digest,'Protected row changed: '+k+'/'+row.id);
  }
 }
 for(const name of ['processing_task','processing_status','usage_record','token_quota_reservation','media'])assert.deepEqual(after[name].map(x=>x.id).sort(),before[name].map(x=>x.id).sort(),'Protected ID set changed: '+name);
 assert.deepEqual(after.modality_file.map(x=>x.id).sort(),[...before.modality_file.map(x=>x.id),...registeredFileIds].sort(),'Only the two approved ModalityFiles may be added');
 return outsideChanges;
}
