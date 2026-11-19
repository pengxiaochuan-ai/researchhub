// Pure selection rules for the explicitly approved synthetic demo source.
export const DEMO_SOURCE_DATABASE='wp01_test_full_baseline';
export const DEMO_SCHEMAS=['public','rh_academic','rh_admission','rh_ai','rh_analysis','rh_asset','rh_directory','rh_hub','rh_reference','rh_research','rh_source','rh_study_tasks'];
export function assertDemoSourceEndpoint(value){
 let u;try{u=new URL(value);}catch{throw Error('DEMO_SOURCE_ENDPOINT_REJECTED');}
 if(!['postgres:','postgresql:'].includes(u.protocol)||!['127.0.0.1','localhost','[::1]'].includes(u.hostname)||u.port!=='5434'||decodeURIComponent(u.pathname)!=='/'+DEMO_SOURCE_DATABASE||decodeURIComponent(u.username)!=='aisci_owner')throw Error('DEMO_SOURCE_ENDPOINT_REJECTED');
}
export function demoIdentifier(value){
 if(typeof value!=='string'||!/^[_A-Za-z][_A-Za-z0-9]{0,62}$/.test(value))throw Error('DEMO_IDENTIFIER_REJECTED');
 return '"'+value+'"';
}
export function demoSelection(table,alias='t'){
 if(!DEMO_SCHEMAS.includes(table?.schema)||!Array.isArray(table.columns))throw Error('DEMO_TABLE_REJECTED');
 demoIdentifier(table.name);const a=demoIdentifier(alias);
 if(table.schema==='public'&&table.name==='tenant')return a+'.id=$1';
 if(table.schema==='public'&&table.name==='_prisma_migrations')return 'TRUE';
 if(table.schema==='rh_reference'&&table.name==='administrative_division')return 'TRUE';
 if(table.schema==='public'&&table.name==='scale_item')return 'EXISTS(SELECT 1 FROM public.scale_definition demo_scale WHERE demo_scale.id='+a+'."scaleId" AND demo_scale."tenantId"=$1)';
 const column=table.columns.includes('tenantId')?'tenantId':table.columns.includes('tenant_id')?'tenant_id':null;
 if(!column)throw Error('DEMO_UNSCOPED_TABLE_REJECTED');
 return a+'.'+demoIdentifier(column)+'=$1';
}
export function assertDemoSourceIdentity(identity,expectedRunId){
 let marker;try{marker=JSON.parse(identity?.marker);}catch{throw Error('DEMO_SOURCE_REJECTED');}
 if(identity.database!==DEMO_SOURCE_DATABASE||identity.role!=='aisci_owner'||identity.readonly!=='on'||marker.purpose!=='wp01-shared-boundary'||marker.syntheticOnly!==true||marker.runId!==expectedRunId)throw Error('DEMO_SOURCE_REJECTED');
}
