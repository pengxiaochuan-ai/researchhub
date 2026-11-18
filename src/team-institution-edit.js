import {sameTeamDraft} from './team-draft-equality.js';
export const institutionEditFields=['name','organizationType','summary','aliases','directions'];
export function setTeamOrganization(data,next){return {...data,organization:next,members:data.members.map(m=>!m.entityId&&(!m.organization||sameTeamDraft(m.organization,data.organization))?{...m,organization:next}:m)};}
// Called only after the administrator reads the conflict comparison and clicks.
export function rebaseInstitutionEdit(value,latest){
 const profile={...latest.payload};
 for(const key of institutionEditFields)if(!sameTeamDraft(value.edit.profile[key],value.edit.baseProfile[key]))profile[key]=value.edit.profile[key];
 return {...value,name:profile.name,type:profile.organizationType??'',edit:{expectedRevision:latest.revision,baseProfile:latest.payload,profile}};
}
// A single proposed revision is shared by all editable references in this team.
export function updateTeamInstitution(data,previous,next){
 const same=o=>previous?.entityId&&o?.entityId===previous.entityId;
 const changed=same(data.organization)?next:data.organization;
 return {...data,organization:changed,members:data.members.map(m=>!m.entityId&&same(m.organization)?{...m,organization:next}:m)};
}
export function displayedInstitution(value,record){
 const p=value?.edit?.profile??record?.facts?.find(f=>f.kind==='profile')?.payload;
 return p?{...value,name:p.name,type:p.organizationType??''}:value;
}
