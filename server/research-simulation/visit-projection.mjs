const sameScope=(a,b)=>['tenantId','studyGroupId','researchProjectId'].every(k=>a?.[k]===b?.[k]);
const mutation=new Set(['create','createMany','createManyAndReturn','update','updateMany','updateManyAndReturn','upsert','delete','deleteMany']);
const blocked=()=>{throw Error('SIMULATION_VISIT_PREVIEW_WRITE_FORBIDDEN');};
/** Reuse the native completion refresh in memory, then its full authorized reader. */
export function createSimulationVisitProjection({operations,readVisit,resolveCase}){
 if(typeof operations?.refreshSystemVisitRequirements!=='function'||typeof readVisit!=='function'||typeof resolveCase!=='function')throw Error('SIMULATION_VISIT_PREVIEW_DEPENDENCIES_REQUIRED');
 return async function read(tx,user,s,visitId){
  const original=await readVisit(tx,user,s,visitId);if(original.status==='completed')return original;
  const c=await resolveCase(tx,s);if(!c||!sameScope(c.scope,s))return original;
  const raw=await tx.subjectVisit.findFirst({where:{...s,id:visitId,acceptanceFixture:false},include:{visitPlan:{include:{requirements:true}},requirementFulfillments:true}});
  const subject=c.subjects?.find(x=>x.id===raw?.subjectId),plan=c.visitPlans?.find(x=>x.id===raw?.visitPlanId);
  if(!raw||raw.status==='completed'||!sameScope(raw,s)||raw.protocolVersionId!==c.protocolVersionId||!subject||!plan?.armCodes?.includes(subject.armCode))return original;
  const memory=new Map(raw.requirementFulfillments.map(x=>[x.visitRequirementId,structuredClone(x)])),models=new Map();
  const view=row=>row?.id===visitId&&Array.isArray(row.requirementFulfillments)?{...row,requirementFulfillments:[...memory.values()].map(x=>structuredClone(x))}:row;
  const preview=new Proxy(tx,{get(target,key){
   const value=Reflect.get(target,key,target);
   if(key==='$executeRaw'||key==='$queryRaw')return (...args)=>{
    const sql=Array.isArray(args[0])?args[0].join(''):'';
    // Native refresh/reader only SELECT (including authorization/file locks).
    if(!/^\s*SELECT\b/i.test(sql)||/;\s*\S/.test(sql))blocked();return value.apply(target,args);
   };
   if(typeof key==='string'&&(key.endsWith('Unsafe')||key==='$transaction'))return blocked;
   if(!value||typeof value!=='object')return typeof value==='function'?value.bind(target):value;
   if(models.has(key))return models.get(key);
   const model=new Proxy(value,{get(delegate,method){
    const fn=Reflect.get(delegate,method,delegate);
    if(key==='visitRequirementFulfillment'&&method==='upsert')return async args=>{
     const binding=args.where?.subjectVisitId_visitRequirementId,requirement=raw.visitPlan.requirements.find(r=>r.id===binding?.visitRequirementId);
     if(binding?.subjectVisitId!==visitId||!requirement||!['scale','profile_field','modality_file'].includes(requirement.kind)||!sameScope(args.create,s)||args.create.subjectVisitId!==visitId||args.create.visitRequirementId!==requirement.id)blocked();
     const current=memory.get(requirement.id),next=current?{...current,...structuredClone(args.update)}:{id:'preview-'+requirement.id,...structuredClone(args.create)};memory.set(requirement.id,next);return structuredClone(next);
    };
    if(mutation.has(method))return blocked;
    if(key==='subjectVisit'&&method==='findFirst')return async(...args)=>view(await fn.apply(delegate,args));
    return typeof fn==='function'?fn.bind(delegate):fn;
   }});models.set(key,model);return model;
  }});
  await operations.refreshSystemVisitRequirements(preview,raw);
  return {...await readVisit(preview,user,s,visitId),previewOnly:true};
 };
}
