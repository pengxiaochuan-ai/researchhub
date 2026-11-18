import {browserDemoStore} from '../../src/demo-research-store.js';
import {readContext,buildPageRoute} from '../../src/route-context.js';
import {validateProjectForm} from '../../src/project-form-validation.js';
import React, { useEffect, useRef, useState } from 'react';
import { Save } from 'lucide-react';
import { Shell, go } from './Shell.jsx';
import { AIPanel, Button, Card, CheckList, Stepper } from './Components.jsx';
import './q01-project.css';
import ResearchPlanFlow from './ResearchPlanFlow.jsx';
import ResearchProjectCreation from './ResearchProjectCreation.jsx';
import {isResearchProjectRoute} from '../../src/research-projects-session.js';

const PROJECT_NAME = '针灸维持治疗对抑郁症患者长期疗效及复发预防作用的多中心随机对照研究';
const CORE_QUESTION = '针灸维持治疗是否能够降低抑郁症患者 12 个月复发率？';
const FIELD_IDS = {name:'q01-title',question:'q01-core-question',p:'q01-population',i:'q01-intervention',c:'q01-comparator',o:'q01-outcomes'};

export function Q01() {
  return new URLSearchParams(location.search).has('researchPlanId')?<ResearchPlanFlow/>:isResearchProjectRoute('q01',location.search)?<ResearchProjectCreation/>:<DemoQ01/>;
}
function DemoQ01() {
  const [initial]=useState(()=>{const ctx=readContext(location.search);try{return {context:ctx,draft:ctx.projectId?browserDemoStore().get('projects',ctx.projectId):null};}catch(err){return {context:ctx,error:err.message};}});
  const [projectId,setProjectId]=useState(initial.draft?.id||null);
  const [projectVersion,setProjectVersion]=useState(initial.draft?.version||0);
  const [feedback,setFeedback]=useState('');
  const [error,setError]=useState(initial.error||'');
  const [name, setName] = useState(initial.draft?.name??PROJECT_NAME);
  const [question, setQuestion] = useState(initial.draft?.question??CORE_QUESTION);
  const [pico, setPico] = useState(initial.draft?.pico??{
    p: '抑郁症缓解期患者',
    i: '针灸维持治疗',
    c: '常规随访/标准治疗',
    o: '12 个月复发率',
  });
  const [saveState, setSaveState] = useState(initial.draft ? 'saved' : 'unsaved');
  const [validationMode, setValidationMode] = useState(null);
  const savedValues = useRef(JSON.stringify({name,question,pico}));
  const dirty = useRef(false);
  const fields = useRef({});
  const values = {name,question,pico};
  const validation = validateProjectForm(values, {forNextStep:true});
  const errors = validationMode ? validateProjectForm(values, {forNextStep:validationMode==='next'}).errors : {};

  const checks = [
    ['课题名称已形成', !validation.errors.name],
    ['核心问题是可回答的问句', !validation.errors.question],
    ['P — 人群已界定', !validation.errors.p],
    ['I — 干预已界定', !validation.errors.i],
    ['C — 对照已界定', !validation.errors.c],
    ['O — 结局与时间已界定', !validation.errors.o],
  ];
  const ready = validation.valid;

  function saveCurrent(next=false){
    setError('');setFeedback('');
    setValidationMode(next?'next':'draft');
    const result=validateProjectForm(values,{forNextStep:next});
    if(!result.valid){
      requestAnimationFrame(()=>{
        const field=fields.current[result.firstInvalidField];
        field?.focus();
        field?.scrollIntoView({block:'center'});
      });
      return;
    }
    let store,project;
    try{
      store=browserDemoStore();
      project=store.saveProject({id:projectId,version:projectId?projectVersion:undefined,name,question,pico,hubId:initial.draft?.hubId??initial.context.hubId??'HUB-MOOD',opportunityId:initial.draft?.opportunityId??initial.context.opportunityId??'OP-2026-017'});
    }catch(err){setSaveState('failed');setError(err.message);return;}
    savedValues.current=JSON.stringify(values);dirty.current=false;
    setProjectId(project.id);setProjectVersion(project.version);setSaveState('saved');setFeedback('已保存本机演示草稿，可刷新或从我的课题继续。');
    try{
      history.replaceState(null,'',buildPageRoute({q01:'/pages/q01/'},'q01',{...initial.context,projectId:project.id}));
      if(next){const protocol=store.ensureProtocol(project.id);go('s07',{projectId:project.id,protocolId:protocol.id});}
    }catch(err){setError(`课题草稿已保存，但未能进入下一步：${err.message}`);}
  }
  useEffect(()=>{const onAction=event=>{if(event.detail?.pageId==='q01'){if(event.detail.label==='保存草稿')saveCurrent(false);if(event.detail.label==='生成研究方案')saveCurrent(true);}};window.addEventListener('qiyan:page-action',onAction);return()=>window.removeEventListener('qiyan:page-action',onAction);},[name,question,pico,projectId,projectVersion]);
  useEffect(()=>{
    const protectUnsaved=event=>{
      if(!dirty.current)return;
      event.preventDefault();
      event.returnValue='';
    };
    window.addEventListener('beforeunload',protectUnsaved);
    return()=>window.removeEventListener('beforeunload',protectUnsaved);
  },[]);

  function editField(key,value){
    const nextValues=key==='name'||key==='question'?{...values,[key]:value}:{...values,pico:{...pico,[key]:value}};
    dirty.current=JSON.stringify(nextValues)!==savedValues.current;
    setSaveState(dirty.current||!projectId?'unsaved':'saved');setFeedback('');setError('');
    if(key==='name')setName(value);
    else if(key==='question')setQuestion(value);
    else setPico(nextValues.pico);
  }
  const fieldProps=key=>({
    id:FIELD_IDS[key],
    ref:node=>{fields.current[key]=node;},
    'aria-required':true,
    'aria-invalid':errors[key]?true:undefined,
    'aria-describedby':errors[key]?`${FIELD_IDS[key]}-error`:undefined,
  });
  const fieldError=key=>errors[key]&&<p className="q01-field-error" id={`${FIELD_IDS[key]}-error`}>{errors[key]}</p>;

  if(initial.error)return <Shell active="领域研究" hero={{title:'研究对象不可打开'}}><div className="content"><p role="alert">{initial.error}</p><Button onClick={()=>go('q02',{projectId:null})}>返回课题列表</Button></div></Shell>;
  return <Shell active="领域研究" hero={{
    breadcrumb: '研究机会 › 研究课题',
    title: '研究课题',
    en: 'Research Project',
    subtitle: '从临床问题与研究机会出发，形成明确、可验证、可执行的研究课题。',
    actions: [{ label: '保存草稿', icon: <Save /> }, { label: '生成研究方案', primary: true }],
  }}>
    <div className="content stack q01-project">
      <p className="notice">本机演示课题，未提交真实平台，不输入受试者个人信息。</p>
      {error&&<p role="alert" className="q01-error-summary">{error} 当前输入仍保留；刷新前请先复制保留输入。</p>}
      {Object.keys(errors).length>0&&<p role="alert" className="q01-error-summary">请修正下方标记的 {Object.keys(errors).length} 项内容。已定位到首个需要修改的字段。</p>}
      <Stepper steps={['形成研究课题', '明确核心研究问题', 'AI 检查', '生成研究方案']} active={1} />
      <div className="main-grid">
        <div className="stack">
          <Card className="form-block">
            <div className="q01-kicker"><h2>研究课题</h2><em>Research Project</em></div>
            <p>决定「我要研究什么」。课题从临床问题与研究机会形成，确认后再进入研究方案。</p>
            <div className="q01-field">
              <label htmlFor={FIELD_IDS.name}>研究课题名称（必填）</label>
              <textarea {...fieldProps('name')} className="textarea" value={name} onChange={(event)=>editField('name',event.target.value)} />
              {fieldError('name')}
            </div>
            <div className="detail-list">
              <p><span>来源</span><b>研究机会 OP-2026-017</b></p>
              <p><span>所属领域</span><b>针灸治疗情志病</b></p>
              <p><span>研究类型</span><b>多中心随机对照研究</b></p>
            </div>
            <div className="q01-save-state" role="status" aria-live="polite" aria-atomic="true" data-save-state={saveState}>
              <strong>{saveState==='saved'?'已保存':saveState==='failed'?'保存失败':'未保存'}</strong>
              <span>{saveState==='saved'?(feedback||`本机演示草稿，版本 ${projectVersion}。`):saveState==='failed'?'当前输入仍保留；请先备份输入，再重试保存。':'草稿只要求课题名称；下一步需完整问题与PICO。仅保存在当前浏览器，离开前请保存修改。'}</span>
            </div>
          </Card>
          <Card className="form-block" id="q01-question">
            <div className="q01-kicker"><h2>核心研究问题</h2><em>Research Question</em></div>
            <p>明确「这个课题具体要回答什么」。它是课题内部的方法学对象，不单独作为平台一级对象。</p>
            <div className="q01-field">
              <label htmlFor={FIELD_IDS.question}>核心研究问题（下一步必填，以问号结尾）</label>
              <textarea {...fieldProps('question')} className="textarea" value={question} onChange={(event)=>editField('question',event.target.value)} />
              {fieldError('question')}
            </div>
            <h3>PICO</h3>
            <div className="q01-pico">
              {[
                ['p', 'P', '人群', pico.p],
                ['i', 'I', '干预', pico.i],
                ['c', 'C', '对照', pico.c],
                ['o', 'O', '结局', pico.o],
              ].map(([key, mark, label, value]) => (
                <div className="q01-pico-field" key={key}>
                  <label htmlFor={FIELD_IDS[key]}><b>{mark}</b> {label}（下一步必填）</label>
                  <input {...fieldProps(key)} value={value} onChange={(event)=>editField(key,event.target.value)} />
                  {fieldError(key)}
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div className="stack">
          <AIPanel title="核心研究问题是否明确" action="查看检查依据">
            <p>岐研 AI 检查这个问题是否明确、可验证。它不代替研究者确定课题，也不自动生成研究方案。</p>
            <p>仅检查必填信息，未调用AI。</p>
            {checks.some(([, ok]) => ok) && <CheckList items={checks.filter(([, ok]) => ok).map(([label]) => label)} />}
            <div className={`notice q01-completeness ${ready ? 'is-ready' : 'needs-input'}`}>{ready ? '本机必填检查已通过，仍需研究者确认；下一步创建演示方案草稿，未调用 AI。' : `${checks.filter(([, ok]) => !ok).map(([label]) => label).join('、')}，仍需研究者确认。`}</div>
          </AIPanel>
          <Card title="来自研究机会" className="form-block">
            <p>针灸治疗抑郁症的长期疗效与复发预防仍存在证据缺口。</p>
            <p className="muted">研究机会说明什么值得研究。形成课题后，才决定具体要回答的核心问题。</p>
            <Button onClick={() => go('o02')}>查看 OP-2026-017</Button>
          </Card>
        </div>
      </div>
      <div className="q01-actions">
        <Button onClick={() => go('o02')}>取消</Button>
        <div>
          <Button onClick={() => saveCurrent(false)}>保存草稿</Button>
          <Button primary onClick={() => saveCurrent(true)}>下一步：生成研究方案 →</Button>
        </div>
      </div>
    </div>
  </Shell>;
}
