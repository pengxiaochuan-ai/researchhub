import React from 'react';
import {Button} from './Components.jsx';
import {taskLabels} from './StudyTaskRow.jsx';
export function StudyTaskConflict({conflict,busy,onConfirm,onDiscard}){
 if(!conflict)return null;
 const {pending,latest}=conflict,input=pending.input;
 return <div className="wf-error" role="region" aria-label="任务版本冲突核对">
  <h3>其他操作已更新任务，您的草稿仍保留</h3>
  <p>原提交基于 v{input.expectedVersion}；当前已保存版本为 v{latest.version}。未自动重试，也未自动覆盖他人修改。请核对后再决定。</p>
  <p>当前任务：{latest.name}；状态：{taskLabels[latest.status]}；截止日：{latest.dueAt?.slice(0,10)}；优先级：{({low:'低',normal:'普通',high:'高',urgent:'紧急'})[latest.priority]}；负责人：{latest.assignee?.displayName??'未分派'}。</p>
  <p>保留的提交内容：{input.name??input.completionNote??input.blockedReason??input.note??input.reason??({edit:'任务字段修改',assign:'负责人、协作者及依赖选择',transition:'任务状态选择',review:'任务验收意见',link:'关联记录选择',remind:'记录站内提醒'})[pending.action]}{input.status&&<>（{taskLabels[input.status]}）</>}。</p>
  <p>确认后仅提交你选择的修改；若权限、状态、来源或版本再次变化，仍须重新核对。</p>
  <div className="wf-toolbar"><Button primary disabled={busy} onClick={onConfirm}>确认保留修改并按最新版本提交</Button><Button disabled={busy} onClick={onDiscard}>放弃本次草稿并读取当前任务</Button></div>
 </div>;
}
