import React from 'react';import {Button} from './Components.jsx';
export function TeamWorkspaceList({items,selected,onSelect,disabled=false}){
 return <div className="team-list-wrap"><table className="team-list" aria-label="团队维护列表"><thead><tr><th scope="col">团队名称</th><th scope="col">审核状态</th><th scope="col">展示状态</th><th scope="col">更新时间</th><th scope="col">操作</th></tr></thead><tbody>{items.map(item=><tr key={item.id} aria-current={selected===item.id?'true':undefined}>
  <th scope="row" data-label="团队名称">{item.name}</th><td data-label="审核状态"><span className={'team-status '+(item.reviewed?'is-reviewed':'is-pending')}>{item.reviewed?'已审核':item.hasDraft?(item.hasPublished?'有待审修改':'待首次审核'):'待完善／待审核'}</span></td><td data-label="展示状态">{item.hasPublished?'已展示':'未展示'}</td><td data-label="更新时间">{item.savedAt?<time dateTime={item.savedAt}>{new Date(item.savedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}</time>:'尚未保存'}</td><td data-label="操作"><Button disabled={disabled} data-team-review-id={item.id} aria-label={'审核：'+item.name} onClick={e=>onSelect(item.id,e.currentTarget)}>审核</Button></td>
 </tr>)}</tbody></table>{!items.length&&<p>暂无匹配团队，可调整搜索或新建团队。</p>}</div>;
}
