import React from 'react';
import {researchStudyUrl} from '../../src/research-projects-session.js';
import {makeStudyOverviewUrl} from '../../src/study-overview-route.js';

const date = new Intl.DateTimeFormat('zh-CN', {dateStyle:'medium', timeZone:'Asia/Shanghai'});
const formatDate = value => date.format(new Date(value));

function EnrollmentMetrics({project}){
 const {actual,active,target,last14,previous14}=project;
 return <dl>
  <div><dt>累计入组</dt><dd>{actual} 人{target!=null&&` / 目标 ${target} 人`}</dd></div>
  <div><dt>当前在组</dt><dd>{active} 人</dd></div>
  <div><dt>近14天新增</dt><dd>{last14} 人</dd></div>
  <div><dt>前14天新增</dt><dd>{previous14} 人</dd></div>
 </dl>;
}

function EnrollmentProgress({project,center=false}){

 const {actual,target,expected,last14,previous14,planStart,planEnd,alert}=project;
 const delta=last14-previous14;
 const comparison=delta===0?'与前14天持平':`${delta>0?'较前14天增加':'较前14天减少'} ${Math.abs(delta)} 人`;
 const warning=alert==='target_overdue'
  ? `计划已到期，距目标还差 ${target-actual} 人。`
  : `累计入组 ${actual} 人，低于同期计划进度 ${expected} 人的 80%。`;
 const displayEnd=center&&planEnd?new Date(new Date(planEnd).getTime()-1):planEnd;
 return <>
   <EnrollmentMetrics project={project}/>
   <p>{comparison}。</p>
   {!project.centersRestricted&&(!project.centers?.length||planStart&&planEnd)&&<p>{target===null?'尚未配置入组目标。':!planStart||!planEnd||planStart>=planEnd?'计划窗口未配置完整，暂无法判定是否落后。':`计划期间 ${formatDate(planStart)} 至 ${formatDate(displayEnd)}。`}</p>}
   {alert&&<p className="enrollment-warning"><strong>{alert==='target_overdue'?'到期未达标':'低于计划'}</strong> {warning}</p>}
 </>;
}

const hasAlert=project=>Boolean(project.alert||project.centers?.some(center=>center.alert));

function EnrollmentRow({project}){
 const centerAlerts=project.centers?.filter(center=>center.alert)??[];
 return <li className="enrollment-row">
   <a className="enrollment-project" href={project.studyId?researchStudyUrl(project.studyId):makeStudyOverviewUrl({
     studyGroupId:project.studyGroupId,researchProjectId:project.researchProjectId})}>{project.title}</a>
   {project.centersRestricted&&<p>按所授权中心统计</p>}
   <EnrollmentProgress project={project}/>
   {project.remainingTarget>0&&<p>尚未分配到中心的目标 {project.remainingTarget} 人。</p>}
   {project.remainingTarget<0&&<p>中心目标超过课题总目标，请核对计划。</p>}
   {centerAlerts.length>0&&<p className="enrollment-warning">
    <strong>{centerAlerts.length} 个中心有预警</strong>{' '}
    {centerAlerts.map(center=>center.name+' '+(center.alert==='target_overdue'?'到期未达标':'低于计划')).join('；')}
   </p>}
   {Boolean(project.centers?.length)&&<details className="enrollment-more enrollment-centers">
    <summary>中心进度（{project.centers.length}）</summary>
    <ul className="enrollment-list">
     {project.centers.map(center=><li className="enrollment-center" key={center.id}>
      <h4>{center.name}{!center.enabled&&'（已停用）'}</h4>
      {center.planVersion!==null&&<p>入组计划第 {center.planVersion} 版</p>}
      <EnrollmentProgress project={center} center/>
     </li>)}
     {project.unassigned?.actual>0&&<li className="enrollment-center">
      <h4>待核对中心</h4><EnrollmentMetrics project={project.unassigned}/>
     </li>}
    </ul>
   </details>}
 </li>;
}

export default function PersonalEnrollment({enrollment,unverified}){
 const projects=[...(enrollment?.projects??[])].sort((a,b)=>Number(hasAlert(b))-Number(hasAlert(a)));
 const rows=projects=>projects.map(project=><EnrollmentRow key={project.studyGroupId+':'+project.researchProjectId} project={project}/>);
 return <section className="personal-enrollment" aria-labelledby="p01-enrollment-title">
  <h3 id="p01-enrollment-title">入组进度与趋势</h3>
  {unverified?<p>核验身份后可查看入组统计。</p>:!enrollment?<p>入组统计暂时无法读取。</p>
   :enrollment.status==='restricted'?<p>当前账号没有可访问的入组统计。</p>
   :!enrollment.projects.length?<p>当前没有可查看入组统计的课题。</p>:<>
    <p>截至 {formatDate(enrollment.asOf)}。累计入组包含已有入组记录的退出人员。</p>
    <ul className="enrollment-list">{rows(projects.slice(0,5))}</ul>
    {projects.length>5&&<details className="enrollment-more"><summary>查看其余 {projects.length-5} 个课题</summary>
      <ul className="enrollment-list">{rows(projects.slice(5))}</ul>
    </details>}
    {enrollment.centerPlans==='not_available'&&<p>当前按课题统计，暂无可核实的中心入组计划。</p>}
   </>}
 </section>;
}
