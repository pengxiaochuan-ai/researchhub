import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Button} from './Components.jsx';
import ProvinceCitySelect from './ProvinceCitySelect.jsx';
import TeamVerificationFields from './TeamVerificationFields.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import {manualInstitutionKey} from '../../src/team-review-flow.js';
import {sameTeamDraft} from '../../src/team-draft-equality.js';
import {updateTeamInstitution,displayedInstitution,rebaseInstitutionEdit,institutionEditFields,setTeamOrganization} from '../../src/team-institution-edit.js';
export const emptyTeam=()=>({name:'',summary:'',directions:[],city:'',region:'',teamType:'',organization:null,members:[],evidence:[],notes:'',verificationMethod:'administrator'});
const roles={lead:'负责人',co_lead:'共同负责人',member:'成员'};
function EntityPicker({kind,label,value,client,onSelect,disabled}){
 const [q,setQ]=useState(''),[items,setItems]=useState([]),[page,setPage]=useState(1),[total,setTotal]=useState(0),[error,setError]=useState(''),[loading,setLoading]=useState(false);const seq=useRef(0);
 async function load(p=1){const n=++seq.current;setLoading(true);setError('');try{const r=await client.teamWorkspaceChoices({kind,q,page:p});if(n===seq.current){setItems(r.items);setPage(p);setTotal(r.pagination.totalPages);}}catch(e){if(n===seq.current&&e.name!=='AbortError')setError(e.message);}finally{if(n===seq.current)setLoading(false);}}
 useEffect(()=>{void load();return()=>{seq.current++;};},[client,kind]);
 return <div className="team-picker">{kind!=='organization'&&<div className="team-form-row"><label>{label}检索<input value={q} maxLength={120} disabled={disabled||loading} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void load();}}}/></label><Button disabled={disabled||loading} onClick={()=>void load()}>查找人员</Button></div>}
  <label>{label}<select aria-label={label} disabled={disabled||loading} value={value?.entityId??''} onChange={e=>{const item=items.find(x=>x.id===e.target.value);onSelect(item??null,e.currentTarget);}}><option value="">{kind==='organization'?'就地填写新机构':'就地填写新人员'}</option>{value?.entityId&&!items.some(x=>x.id===value.entityId)&&<option value={value.entityId}>{value.name}（已选择）</option>}{items.map(x=><option key={x.id} value={x.id}>{x.id===value?.entityId?value.name:x.name}{kind==='researcher'?' · '+(x.rank||'职称未填')+' · '+(x.organization?.name||'机构未填'):''}{x.reviewed?'':'（资料待审核）'}</option>)}</select></label>
  {loading&&<p role="status">正在查找…</p>}{error&&<p role="alert">{error}<Button disabled={disabled} onClick={()=>void load(page)}>重新查找</Button></p>}{total>1&&<div className="team-form-actions"><Button disabled={disabled||loading||page<=1} onClick={()=>void load(page-1)}>上一页候选</Button><span>第{page}／{total}页</span><Button disabled={disabled||loading||page>=total} onClick={()=>void load(page+1)}>下一页候选</Button></div>}
 </div>;
}
function InstitutionConflict({value,fact,onChange,disabled}){
 if(!value.edit||!fact||value.edit.expectedRevision===fact.revision&&sameTeamDraft(value.edit.baseProfile,fact.payload))return null;
 const names={name:'名称',organizationType:'类型',summary:'简介',aliases:'别名',directions:'研究方向'},text=v=>Array.isArray(v)?v.join('、'):v||'未填写';
 return <section className="team-institution-conflict" aria-label="机构最新资料对照"><p role="alert">机构资料已更新，你的输入已保留。请核对后继续。</p><dl>{institutionEditFields.filter(k=>!sameTeamDraft(value.edit.profile[k],fact.payload[k])).map(k=><React.Fragment key={k}><dt>{names[k]}</dt><dd>我的输入：{text(value.edit.profile[k])}</dd><dd>最新资料：{text(fact.payload[k])}</dd></React.Fragment>)}</dl><p>保留你改过的字段，其余采用最新资料；之后仍需保存并审核。</p><Button disabled={disabled} onClick={()=>onChange(rebaseInstitutionEdit(value,fact))}>核对后保留我的修改</Button></section>;
}
function OrganizationFields({label,value,client,onChange,disabled,records,manual}){
 const [open,setOpen]=useState(false),record=records?.find(x=>x.item.id===value?.entityId),fact=record?.facts.find(f=>f.kind==='profile'),org=displayedInstitution(value,record)??{entityId:null,name:'',type:''},profile=org.edit?.profile??fact?.payload;
 useEffect(()=>setOpen(Boolean(value?.edit)),[value?.entityId]);
 function edit(patch){if(!org.edit&&!fact)return;const edit={...(org.edit??{expectedRevision:fact.revision,baseProfile:fact.payload}),profile:{...profile,...patch}};onChange({...org,name:edit.profile.name,type:edit.profile.organizationType??'',edit});}
 return <div className="team-organization"><EntityPicker kind="organization" label={label} value={org} client={client} disabled={disabled} onSelect={item=>onChange(item?{entityId:item.id,name:item.name,type:item.type}:{entityId:null,name:'',type:''})}/>
  {org.entityId&&manual&&<><Button disabled={disabled||!fact} onClick={()=>setOpen(v=>!v)}>{open?'收起机构资料':'完善机构资料'}</Button>{open&&profile&&<div className="team-institution-editor" aria-label={label+'资料'}><p>{fact?.decision?.audience==='public'?'该机构已公开；审核后机构修改仍公开展示，团队按所选范围展示。':'机构资料与团队一并审核；不改变机构原有展示范围。'}</p><label>机构正式名称<input aria-label={label+'正式名称'} value={profile.name} maxLength={200} onChange={e=>edit({name:e.target.value})}/></label><label>机构类型（选填）<input aria-label={label+'类型'} value={profile.organizationType??''} maxLength={100} onChange={e=>edit({organizationType:e.target.value||null})}/></label><label>机构简介（选填）<textarea aria-label={label+'简介'} value={profile.summary} maxLength={4000} onChange={e=>edit({summary:e.target.value})}/></label><label>机构别名（选填，顿号分隔）<input aria-label={label+'别名'} value={profile.aliases.join('、')} maxLength={1000} onChange={e=>edit({aliases:e.target.value.split(/[、,，\n]/)})}/></label><label>机构研究方向（选填，顿号分隔）<input aria-label={label+'研究方向'} value={profile.directions.join('、')} maxLength={400} onChange={e=>edit({directions:e.target.value.split(/[、,，\n]/)})}/></label><InstitutionConflict value={org} fact={fact} onChange={onChange} disabled={disabled}/></div>}</>}
  {!org.entityId&&<div className="team-form-row"><label>{label}名称<input value={org.name} maxLength={200} onChange={e=>onChange({...org,name:e.target.value})}/></label><label>{label}类型（选填）<input value={org.type} maxLength={100} onChange={e=>onChange({...org,type:e.target.value})}/></label></div>}
 </div>;
}
function MemberFields({members,teamOrganization,client,onChange,disabled,records,manual,onOrganizationChange}){
 const [choosing,setChoosing]=useState({}),[removal,setRemoval]=useState(null),[replacement,setReplacement]=useState(null);const addButton=useRef(null);
 const set=(key,patch)=>onChange(members.map(m=>m.key===key?{...m,...patch}:m));
 return <section className="team-form-section" aria-label="负责人和成员"><h3>2. 负责人和成员</h3><p className="team-helper">至少需一位负责人；成员资料不代表研究授权。</p>
  {members.map((m,index)=><fieldset key={m.key}><legend>{m.name||'新成员 '+(index+1)}</legend>
   <details onToggle={e=>{if(e.target===e.currentTarget){const open=e.currentTarget.open;setChoosing(old=>({...old,[m.key]:open}));}}}><summary>{m.entityId?'更换人员':'选择已有研究者'}</summary>{choosing[m.key]&&<EntityPicker kind="researcher" label={'人员'+(index+1)+'选择'} value={m} client={client} disabled={disabled} onSelect={(item,trigger)=>{const patch=item?{entityId:item.id,name:item.name,rank:item.rank,organization:item.organization}:{entityId:null,name:'',rank:'',organization:null};if(m.name||m.rank||m.organization)setReplacement({key:m.key,snapshot:JSON.stringify(m),name:m.name,nextName:item?.name,patch,trigger});else set(m.key,patch);}}/>}</details>
   <div className="team-form-row">{m.entityId?<div className="team-member-summary"><p>{[m.rank,m.organization?.name].filter(Boolean).join(' · ')||'职称及机构未填写'}</p></div>:<label>姓名<input aria-label={'人员'+(index+1)+'姓名'} value={m.name} maxLength={200} onChange={e=>set(m.key,{name:e.target.value})}/></label>}<label>团队角色<select aria-label={'人员'+(index+1)+'团队角色'} value={m.role} onChange={e=>set(m.key,{role:e.target.value})}>{Object.entries(roles).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>{!m.entityId&&<label>职称（选填）<input aria-label={'人员'+(index+1)+'职称（选填）'} value={m.rank} maxLength={100} onChange={e=>set(m.key,{rank:e.target.value})}/></label>}</div>
   {!m.entityId&&<><p className="team-helper">所属机构：{m.organization?.name&&(m.organization.entityId!==teamOrganization?.entityId||m.organization.name!==teamOrganization?.name)?m.organization.name:'与团队一致'}</p><details><summary>来自其他机构时修改</summary><OrganizationFields label={'人员'+(index+1)+'所属机构'} value={m.organization??teamOrganization} client={client} disabled={disabled} records={records} manual={manual} onChange={organization=>onOrganizationChange(m,organization)}/></details></>}
   <Button disabled={disabled} aria-label={'移除：'+(m.name||'新成员 '+(index+1))} onClick={event=>{if(!m.entityId)onChange(members.filter(x=>x.key!==m.key));else setRemoval({key:m.key,entityId:m.entityId,name:m.name,trigger:event.currentTarget});}}>移除</Button>
  </fieldset>)}
  <span ref={addButton} tabIndex={-1}><Button disabled={disabled||members.length>=20} onClick={()=>onChange([...members,{key:crypto.randomUUID(),entityId:null,name:'',rank:'',organization:teamOrganization??null,role:members.length?'member':'lead'}])}>添加人员</Button></span>
  {replacement&&<ConfirmDialog title="更换团队人员？" confirmLabel="更换人员" returnFocus={replacement.trigger} fallbackFocus={addButton.current} busy={disabled} onCancel={()=>setReplacement(null)} onConfirm={()=>{if(disabled)return;const current=members.find(x=>x.key===replacement.key);if(current&&JSON.stringify(current)===replacement.snapshot)set(replacement.key,replacement.patch);setReplacement(null);}}><p>将“{replacement.name||'当前人员'}”更换为{replacement.nextName?'“'+replacement.nextName+'”':'手动填写的新人员'}。</p><p>本行姓名、职称和机构资料将被替换，其他人员不变；保存并审核后才更新展示。</p></ConfirmDialog>}
  {removal&&<ConfirmDialog title="移除团队人员？" confirmLabel="移除人员" returnFocus={removal.trigger} fallbackFocus={addButton.current} busy={disabled} onCancel={()=>setRemoval(null)} onConfirm={()=>{if(disabled)return;const current=members.find(x=>x.key===removal.key);if(current?.entityId===removal.entityId&&current?.name===removal.name)onChange(members.filter(x=>x.key!==removal.key));setRemoval(null);}}><p>确定移除“{removal.name||'该人员'}”吗？</p><p>审核确认后才会结束其在当前团队的关系，历史及其他团队不受影响。</p></ConfirmDialog>}
 </section>;
}
export function TeamFields({data,client,onChange,disabled=false,onVerificationState,verificationRefresh=0,reviewControls}){
 const [institutionState,setInstitutionState]=useState(null),manual=data.verificationMethod==='administrator',key=manualInstitutionKey(data),records=institutionState?.key===key&&institutionState.refresh===verificationRefresh?institutionState.items:undefined;
 const report=useCallback(state=>{setInstitutionState({...state,refresh:verificationRefresh});onVerificationState?.(state);},[onVerificationState,verificationRefresh]);
 const set=(key,value)=>onChange({...data,[key]:value});
 useEffect(()=>{if(!records)return;let next=data;for(const record of records){const org=[next.organization,...next.members.filter(m=>!m.entityId).map(m=>m.organization)].find(o=>o?.entityId===record.item.id&&!o.edit);if(org)next=updateTeamInstitution(next,org,displayedInstitution(org,record));}if(!sameTeamDraft(data,next))onChange(next);},[records,data,onChange]);
 function organizationChange(previous,next,member){let changed;if(previous?.entityId===next?.entityId&&previous?.entityId)changed=updateTeamInstitution(data,previous,next);else changed=member?{...data,members:data.members.map(m=>m.key===member.key?{...m,organization:next}:m)}:setTeamOrganization(data,next);const shared=[changed.organization,...changed.members.filter(m=>!m.entityId).map(m=>m.organization)].find(o=>o?.entityId&&o.entityId===next?.entityId&&o.edit);if(shared)changed=updateTeamInstitution(changed,next,shared);onChange(changed);}
 return <fieldset className="team-fields" disabled={disabled}>
  <TeamVerificationFields data={data} client={client} onState={report} refresh={verificationRefresh}/>
  <section className="team-form-section" aria-label="团队基本资料"><h3>1. 团队基本资料</h3>
   <label>团队名称（必填）<input name="teamName" required value={data.name} maxLength={200} onChange={e=>set('name',e.target.value)}/></label>
   <OrganizationFields label="团队所属机构" value={data.organization} client={client} records={records} manual={manual} onChange={value=>organizationChange(data.organization,value)} disabled={disabled}/>
   <label>团队简介（选填）<textarea aria-label="团队简介（选填）" value={data.summary} maxLength={4000} onChange={e=>set('summary',e.target.value)}/></label>
   <label>研究方向（选填，顿号分隔）<input value={data.directions.join('、')} maxLength={500} onChange={e=>set('directions',e.target.value.split(/[、,，\n]/))}/></label>
   <ProvinceCitySelect value={data.location} city={data.city} region={data.region} disabled={disabled} onChange={patch=>onChange({...data,...patch})}/>
   <label>团队类型（选填）<input value={data.teamType} maxLength={100} onChange={e=>set('teamType',e.target.value)}/></label>
  </section>
  <MemberFields members={data.members} teamOrganization={data.organization} client={client} disabled={disabled} records={records} manual={manual} onOrganizationChange={(m,next)=>organizationChange(m.organization,next,m)} onChange={members=>{const allowed=['team','organization',...members.flatMap(m=>['member:'+m.key,'member-organization:'+m.key])];onChange({...data,members,evidence:data.evidence.map(e=>({...e,targets:e.targets.filter(x=>allowed.includes(x))}))});}}/>
  <section className="team-form-section" aria-label="核实与审核"><h3>3. 核实与审核</h3>{!manual&&<p>当前草稿沿用已有资料审核。<Button disabled={disabled} onClick={()=>set('verificationMethod','administrator')}>改由管理员本人核实</Button></p>}{reviewControls}</section>
 </fieldset>;
}
export function TeamWorkspacePreview({preview}){
 return <section className="team-review-feedback" aria-label="审核检查" tabIndex={-1}>
  {preview.issues.length>0?<div role="alert"><h4>本次未提交审核</h4><p>输入已保留，请核对以下问题后重试。</p><ul>{preview.issues.map((x,i)=><li key={i}>{x}</li>)}</ul></div>:!preview.changes.length?<p role="status">没有待审核变更。</p>:null}
 </section>;
}
