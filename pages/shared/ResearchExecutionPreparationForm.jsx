import React,{useRef,useState} from 'react';
import {Button,Card} from './Components.jsx';
import {nullableNumber,preparationRelationErrors} from '../../src/research-execution-preparation-session.js';
const keyPattern='[A-Za-z][A-Za-z0-9_]{0,63}';
const nextKey=(prefix,rows)=>{let n=1;while(rows.some(r=>r.key===prefix+n))n++;return prefix+n;};
export default function PreparationForm({config,onChange,onSave,disabled,busy,dirty}){
 const [errors,setErrors]=useState([]),form=useRef(null);
 const change=fn=>{const next=structuredClone(config);fn(next);onChange(next);setErrors([]);};
 const update=(group,index,key,value)=>change(c=>{c[group][index][key]=value;});
 const fieldUpdate=(index,key,value)=>change(c=>{const f=c.form.schema.fields[index];if(value===undefined)delete f[key];else f[key]=value;});
 const mapped=(kind,key)=>config.mappings.some(m=>m[kind]===key);
 const field=(id,label,value,set,props={})=><label htmlFor={id} className="ep-label"><span id={id+'-label'}>{label}</span><input id={id} value={value??''} onChange={e=>set(e.target.value)} aria-labelledby={id+'-label'} aria-invalid={errors.some(x=>x.id===id)||undefined} aria-describedby={errors.some(x=>x.id===id)?id+'-error':undefined} {...props}/>{errors.some(x=>x.id===id)&&<span className="ep-field-error" id={id+'-error'}>{errors.find(x=>x.id===id).message}</span>}</label>;
 function submit(e){
  e.preventDefault();const inputs=[...form.current.querySelectorAll('input,textarea,select')];inputs.forEach(el=>el.setCustomValidity(''));
  for(const [prefix,rows]of [['outcome',config.outcomes],['visit',config.visits],['field',config.form.schema.fields]])for(let i=0;i<rows.length;i++){
   const row=rows[i],el=form.current.querySelector('#'+prefix+'-'+i+'-key');if(['prototype','constructor','__proto__'].includes(row.key)||rows.filter(r=>r.key===row.key).length>1)el?.setCustomValidity('标识须唯一，且不能使用保留名称。');
   if(prefix==='visit'&&rows.filter(r=>r.order===row.order).length>1)form.current.querySelector('#visit-'+i+'-order')?.setCustomValidity('访视顺序不能重复。');
   if(prefix==='field'&&row.min!==undefined&&row.max!==undefined&&row.min>row.max)form.current.querySelector('#field-'+i+'-min')?.setCustomValidity('最小值不能大于最大值。');
  }
  for(const error of preparationRelationErrors(config))form.current.querySelector('#'+error.id)?.setCustomValidity(error.message);
  const invalid=inputs.filter(el=>!el.disabled&&!el.checkValidity()).map(el=>({id:el.id,message:el.validationMessage}));setErrors(invalid);if(invalid.length){form.current.querySelector('#'+invalid[0].id)?.focus();return;}void onSave();
 }
 return <form ref={form} noValidate onSubmit={submit} className="ep-form">
  {errors.length>0&&<div role="alert" className="ep-error"><h3>请先修正以下字段</h3><ul>{errors.map(x=><li key={x.id}><a href={'#'+x.id} onClick={e=>{e.preventDefault();document.getElementById(x.id)?.focus();}}>{x.message}</a></li>)}</ul></div>}
  <fieldset disabled={disabled||busy} className="ep-controls"><legend className="ep-sr-only">执行准备配置</legend>
   <Card title="执行准备配置"><p>先明确研究结局，再安排访视和字段。空白时间表示待确认，不等于第0天；所有数值由研究者填写。</p>{field('ep-label','配置名称',config.label,v=>change(c=>{c.label=v;}),{required:true,maxLength:120})}
    <label className="ep-label" htmlFor="ep-notes">准备说明<textarea id="ep-notes" aria-label="准备说明" maxLength={1000} rows={3} value={config.notes} onChange={e=>change(c=>{c.notes=e.target.value;})}/></label>
   </Card>
   <Card title="1. 结局定义" className="ep-outcomes"><p className="ep-helper">最多8项。定义和单位可暂留空，保存后会列为待确认；量表分数不由AI填写或计算。</p>
    {config.outcomes.map((o,i)=><fieldset key={i} id={'ep-target-outcomes-'+o.key}><legend>结局 {i+1}</legend><div className="ep-grid">
     {field('outcome-'+i+'-key','结局标识',o.key,v=>update('outcomes',i,'key',v),{required:true,pattern:keyPattern,maxLength:64,disabled:mapped('outcomeKey',o.key),title:'字母开头，仅字母、数字和下划线'})}
     {field('outcome-'+i+'-label','结局名称',o.label,v=>update('outcomes',i,'label',v),{required:true,maxLength:120})}
     {field('outcome-'+i+'-unit','结局单位或不适用声明',o.unit,v=>update('outcomes',i,'unit',v),{maxLength:40})}
    </div><label className="ep-label" htmlFor={'outcome-'+i+'-definition'}>结局操作定义<textarea id={'outcome-'+i+'-definition'} aria-label="结局操作定义" rows={3} maxLength={1000} value={o.definition} onChange={e=>update('outcomes',i,'definition',e.target.value)}/></label>
     <Button disabled={mapped('outcomeKey',o.key)} onClick={()=>change(c=>{c.outcomes.splice(i,1);})}>移除结局 {i+1}</Button>{mapped('outcomeKey',o.key)&&<p className="ep-helper">已有映射；需先移除对应映射，才能修改标识或移除结局。</p>}
    </fieldset>)}<Button disabled={config.outcomes.length>=8} onClick={()=>change(c=>{c.outcomes.push({key:nextKey('outcome',c.outcomes),label:'新结局',definition:'',unit:''});})}>添加结局</Button>
   </Card>
   <Card title="2. 访视安排" className="ep-visits"><p className="ep-helper">最多4次。默认“基线／随访”为待确认占位，不表示访视周期已确认。</p>
    {config.visits.map((v,i)=><fieldset key={i} id={'ep-target-visits-'+v.key}><legend>访视 {i+1}</legend><div className="ep-grid">
     {field('visit-'+i+'-key','访视标识',v.key,x=>update('visits',i,'key',x),{required:true,pattern:keyPattern,maxLength:64,disabled:config.mappings.some(m=>m.visitKeys.includes(v.key))})}
     {field('visit-'+i+'-name','访视名称',v.name,x=>update('visits',i,'name',x),{required:true,maxLength:120})}
     {field('visit-'+i+'-order','访视顺序',v.order,x=>update('visits',i,'order',nullableNumber(x)),{required:true,type:'number',min:1,max:4,step:1})}
     {field('visit-'+i+'-offset','相对起始日（天，待确认可留空）',v.targetDayOffset,x=>update('visits',i,'targetDayOffset',nullableNumber(x)),{type:'number',min:-3650,max:3650,step:1})}
     {field('visit-'+i+'-before','允许提前（天，待确认可留空）',v.windowBeforeDays,x=>update('visits',i,'windowBeforeDays',nullableNumber(x)),{type:'number',min:0,max:365,step:1})}
     {field('visit-'+i+'-after','允许延后（天，待确认可留空）',v.windowAfterDays,x=>update('visits',i,'windowAfterDays',nullableNumber(x)),{type:'number',min:0,max:365,step:1})}
    </div><Button disabled={config.mappings.some(m=>m.visitKeys.includes(v.key))} onClick={()=>change(c=>{c.visits.splice(i,1);})}>移除访视 {i+1}</Button>{config.mappings.some(m=>m.visitKeys.includes(v.key))&&<p className="ep-helper">已有映射；请先在映射中取消该访视，才能修改标识或移除。</p>}</fieldset>)}
    <Button disabled={config.visits.length>=4} onClick={()=>change(c=>{const order=[1,2,3,4].find(n=>!c.visits.some(v=>v.order===n));c.visits.push({key:nextKey('visit',c.visits),name:'新访视',order,targetDayOffset:null,windowBeforeDays:null,windowAfterDays:null});})}>添加访视</Button>
   </Card>
   <Card title="3. CRF字段草稿" className="ep-crf"><p className="ep-helper">仅1张CRF，最多12个字段。这里编辑配置，不创建正式模板，不采集受试者数据。</p><div className="ep-grid">{field('ep-form-key','CRF标识',config.form.key,v=>change(c=>{c.form.key=v;}),{required:true,pattern:keyPattern,maxLength:64})}{field('ep-form-name','CRF名称',config.form.name,v=>change(c=>{c.form.name=v;}),{required:true,maxLength:120})}</div>
    {config.form.schema.fields.map((f,i)=><fieldset key={i} id={'ep-target-form-fields-'+f.key}><legend>字段 {i+1}</legend><div className="ep-grid">
     {field('field-'+i+'-key','字段标识',f.key,v=>fieldUpdate(i,'key',v),{required:true,pattern:keyPattern,maxLength:64,disabled:mapped('fieldKey',f.key)})}
     {field('field-'+i+'-label','字段名称',f.label,v=>fieldUpdate(i,'label',v),{required:true,maxLength:120})}
     <label className="ep-label" htmlFor={'field-'+i+'-type'}><span id={'field-'+i+'-type-label'}>字段类型</span><select id={'field-'+i+'-type'} aria-labelledby={'field-'+i+'-type-label'} value={f.type} onChange={e=>change(c=>{const row=c.form.schema.fields[i],type=e.target.value;delete row.min;delete row.max;delete row.options;row.type=type;if(type==='select')row.options=[{value:'option1',label:'待确认选项'}];})}>{[['text','文本'],['number','数值'],['integer','整数'],['select','单选'],['boolean','是/否']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
     <label className="ep-checkbox"><input type="checkbox" checked={f.required===true} onChange={e=>fieldUpdate(i,'required',e.target.checked)}/>必填字段</label>
     {['number','integer'].includes(f.type)&&<>{field('field-'+i+'-min','最小值（可留空）',f.min,v=>fieldUpdate(i,'min',v===''?undefined:Number(v)),{type:'number',step:'any'})}{field('field-'+i+'-max','最大值（可留空）',f.max,v=>fieldUpdate(i,'max',v===''?undefined:Number(v)),{type:'number',step:'any'})}</>}
    </div>{f.type==='select'&&<div><p className="ep-helper">选择项最多12个，值必须唯一。</p>{f.options.map((o,j)=><div className="ep-grid" key={j}>{field('option-'+i+'-'+j+'-value','选项值',typeof o==='string'?o:o.value,v=>change(c=>{const opts=c.form.schema.fields[i].options;opts[j]={value:v,label:typeof o==='string'?o:o.label};}),{required:true,maxLength:64})}{field('option-'+i+'-'+j+'-label','选项名称',typeof o==='string'?o:o.label,v=>change(c=>{c.form.schema.fields[i].options[j]={value:typeof o==='string'?o:o.value,label:v};}),{required:true,maxLength:120})}<Button disabled={f.options.length<=1} onClick={()=>change(c=>{c.form.schema.fields[i].options.splice(j,1);})}>移除选项 {j+1}</Button></div>)}<Button disabled={f.options.length>=12} onClick={()=>change(c=>{const opts=c.form.schema.fields[i].options;let n=1;while(opts.some(o=>(typeof o==='string'?o:o.value)==='option'+n))n++;opts.push({value:'option'+n,label:'待确认选项'});})}>添加选项</Button></div>}
     <Button disabled={mapped('fieldKey',f.key)} onClick={()=>change(c=>{c.form.schema.fields.splice(i,1);})}>移除字段 {i+1}</Button>{mapped('fieldKey',f.key)&&<p className="ep-helper">已有映射；需先移除对应映射，才能修改标识或移除字段。</p>}
    </fieldset>)}<Button disabled={config.form.schema.fields.length>=12} onClick={()=>change(c=>{c.form.schema.fields.push({key:nextKey('field',c.form.schema.fields),label:'新字段',type:'text',required:false});})}>添加CRF字段</Button>
   </Card>
   <Card title="4. 结局—字段—访视映射" className="ep-mappings"><p className="ep-helper">人工指定最多24项映射。单位只做声明比对，不自动换算；访视可暂不选，规则会提示缺项。</p>
    {config.mappings.map((m,i)=><fieldset key={i} id={'ep-target-mappings-'+m.outcomeKey+'-'+m.fieldKey}><legend>映射 {i+1}</legend><div className="ep-grid">
     <label className="ep-label" htmlFor={'mapping-'+i+'-outcome'}><span id={'mapping-'+i+'-outcome-label'}>对应结局</span><select id={'mapping-'+i+'-outcome'} aria-labelledby={'mapping-'+i+'-outcome-label'} value={m.outcomeKey} onChange={e=>update('mappings',i,'outcomeKey',e.target.value)}>{config.outcomes.map(o=><option key={o.key} value={o.key}>{o.label}（{o.key}）</option>)}</select></label>
     <label className="ep-label" htmlFor={'mapping-'+i+'-field'}><span id={'mapping-'+i+'-field-label'}>对应CRF字段</span><select id={'mapping-'+i+'-field'} aria-labelledby={'mapping-'+i+'-field-label'} aria-invalid={errors.some(x=>x.id==='mapping-'+i+'-field')||undefined} aria-describedby={errors.some(x=>x.id==='mapping-'+i+'-field')?'mapping-'+i+'-field-error':undefined} value={m.fieldKey} onChange={e=>update('mappings',i,'fieldKey',e.target.value)}>{config.form.schema.fields.map(f=><option key={f.key} value={f.key}>{f.label}（{f.key}）</option>)}</select>{errors.some(x=>x.id==='mapping-'+i+'-field')&&<span className="ep-field-error" id={'mapping-'+i+'-field-error'}>{errors.find(x=>x.id==='mapping-'+i+'-field').message}</span>}</label>
     {field('mapping-'+i+'-unit','映射单位或不适用声明',m.unit,v=>update('mappings',i,'unit',v),{maxLength:40})}
    </div><fieldset><legend>适用访视</legend>{config.visits.map(v=><label key={v.key} className="ep-checkbox"><input type="checkbox" checked={m.visitKeys.includes(v.key)} onChange={e=>update('mappings',i,'visitKeys',e.target.checked?[...m.visitKeys,v.key]:m.visitKeys.filter(k=>k!==v.key))}/>{v.name}</label>)}</fieldset><Button onClick={()=>change(c=>{c.mappings.splice(i,1);})}>移除映射 {i+1}</Button></fieldset>)}
    <Button disabled={config.mappings.length>=24||!config.outcomes.length||!config.form.schema.fields.length||config.outcomes.every(o=>config.form.schema.fields.every(f=>config.mappings.some(m=>m.outcomeKey===o.key&&m.fieldKey===f.key)))} onClick={()=>change(c=>{for(const o of c.outcomes)for(const f of c.form.schema.fields)if(!c.mappings.some(m=>m.outcomeKey===o.key&&m.fieldKey===f.key)){c.mappings.push({outcomeKey:o.key,fieldKey:f.key,visitKeys:[],unit:''});return;}})}>添加映射</Button>{(!config.outcomes.length||!config.form.schema.fields.length)&&<p className="ep-helper">先添加至少一项结局和一个CRF字段，再建立映射。</p>}
   </Card>
  </fieldset><div className="ep-actions"><Button primary type="submit" disabled={disabled||busy||!dirty} loading={busy}>保存执行准备草稿</Button><span role="status">{dirty?'有未保存修改；预览和AI核对不会使用这些输入。':'当前无未保存修改。'}</span></div>
 </form>;
}
