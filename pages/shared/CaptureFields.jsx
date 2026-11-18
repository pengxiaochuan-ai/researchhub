import React,{useId,useState} from 'react';
import {Button} from './Components.jsx';
import {answerInput,displayAnswer,schemaFields,fieldErrors} from '../../src/formal-capture-session.js';
import {captureModes,captureModeOptions} from '../../src/questionnaire-h5-session.js';
import './capture-fields.css';

export function FormPresentation({presentation}){
 if(!presentation||typeof presentation!=='object')return null;
 return <div className="fc-form-presentation">{['title','recallPeriodPrompt','instruction','attribution'].map(key=>typeof presentation[key]==='string'&&presentation[key]!==''?<p key={key} className={'fc-form-'+key}>{presentation[key]}</p>:null)}</div>;
}
export function ReadAnswers({fields,answers={},focusKey}){return <dl className="fc-answers">{fields?.map(f=><div key={f.key} className={focusKey===f.key?'fc-highlight':''}><dt>{f.label}{f.unit?'（'+f.unit+'）':''}</dt><dd>{displayAnswer(answers[f.key],f)}</dd></div>)}</dl>;}
export function FormPreview({schema}){
 const [answers,setAnswers]=useState({}),prefix=useId(),fields=schemaFields(schema);
 return fields?<><FormPresentation presentation={schema.presentation}/><CaptureFields fields={fields} answers={answers} onChange={setAnswers} idPrefix={'fc-preview-'+prefix}/></>:<p>此版本暂无可展示的字段。</p>;
}
export function CaptureModeField({name,config,form,onChange}){
 const options=captureModeOptions(form),value=captureModes(config).join(',');
 return <label className="ep-label">{name}的采集方式<select aria-label={name+'的采集方式'} value={value} onChange={e=>onChange(e.target.value.split(','))}>{!options.some(option=>option.value===value)&&<option value={value} disabled>当前方式不可用，请重新选择</option>}{options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select>{options.length===1&&options[0].value==='researcher'&&<span className="ep-helper">此表由研究人员评定</span>}</label>;
}
export default function CaptureFields({fields,answers,onChange,errors=[],disabled=false,focusKey,idPrefix='fc-field'}){
 return <div className="ep-grid fc-field-editor">{fields.map((f,index)=>{
  const name=idPrefix+'-'+index,value=answers[f.key]??'',pendingIssue=errors.find(e=>e.key===f.key),issue=Array.isArray(f.choices)&&!fieldErrors([f],answers).length?undefined:pendingIssue;
  const label=<>{f.label}{f.required?'（必填）':''}{f.unit?' · '+f.unit:''}</>,props={id:name,'aria-labelledby':name+'-label','aria-invalid':!!issue,'aria-describedby':issue?name+'-error':undefined,value:typeof value==='boolean'?String(value):value,disabled,onChange:e=>onChange(answerInput(answers,f,e.target.value))};
  const error=issue&&<p role="alert" className="ep-field-error" id={name+'-error'}>{issue.message}</p>;
  if(['number','integer'].includes(f.type)&&Array.isArray(f.choices))return <fieldset key={f.key} className={'fc-choice-field'+(focusKey===f.key?' fc-highlight':'')} disabled={disabled} role="radiogroup" aria-labelledby={name+'-label'} aria-required={f.required||undefined} aria-describedby={props['aria-describedby']}>
   <legend id={name+'-label'}>{label}</legend><div className="fc-choice-options">{f.choices.map((choice,i)=><label className="fc-choice-option" key={choice.value}><input id={i===0?name:name+'-choice-'+i} name={name} type="radio" value={choice.value} checked={answers[f.key]===choice.value} disabled={disabled} aria-invalid={!!issue} aria-describedby={props['aria-describedby']} onChange={e=>onChange(answerInput(answers,f,e.target.value))}/><span>{choice.label}</span></label>)}</div>
   <Button disabled={disabled||value===''} onClick={e=>{onChange(answerInput(answers,f,''));e.currentTarget.closest('fieldset')?.querySelector('input')?.focus();}}>清空选择</Button>{error}
  </fieldset>;
  return <div key={f.key} className={focusKey===f.key?'fc-highlight':''}><label className="ep-label" htmlFor={name}><span id={name+'-label'}>{label}</span>{f.type==='boolean'?<select {...props}><option value="">请选择</option><option value="true">是</option><option value="false">否</option></select>:f.type==='select'?<select {...props}><option value="">请选择</option>{f.options.map(v=><option key={typeof v==='string'?v:v.value} value={typeof v==='string'?v:v.value}>{typeof v==='string'?v:v.label}</option>)}</select>:<input {...props} type={['number','integer'].includes(f.type)?'number':'text'} step={f.type==='integer'?'1':'any'} min={f.min} max={f.max}/>}</label>{error}</div>;
 })}</div>;
}
