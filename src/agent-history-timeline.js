const segments=new Intl.Segmenter('zh-CN',{granularity:'grapheme'});
export const agentHistoryTitle=title=>[...segments.segment(String(title??'').replace(/\s+/gu,' ').trim()||'新对话')].slice(0,12).map(x=>x.segment).join('');
const dayIndex=date=>Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())/86400000;
export function groupAgentHistory(items,now=new Date()){
 const today=dayIndex(now),groups=new Map();
 for(const item of items){
  const date=new Date(item.updatedAt),valid=Number.isFinite(date.getTime()),age=valid?Math.max(0,today-dayIndex(date)):null;
  const label=item.pinned?'置顶':!valid?'时间未知':age===0?'今天':age===1?'昨天':age<7?'7天内':age<30?'30天内':date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0');
  const order=item.pinned?Infinity:!valid?-Infinity:age===0?today:age===1?today-1:age<7?today-2:age<30?today-7:Date.UTC(date.getFullYear(),date.getMonth(),1)/86400000;
  if(!groups.has(label))groups.set(label,{label,order,items:[]});groups.get(label).items.push(item);
 }
 return[...groups.values()].sort((a,b)=>b.order-a.order).map(group=>({...group,items:group.items.sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt)||0)}));
}
// Accepted server timestamps and text update only this row, never reset pages.
export function applyHistoryCommand(items,record){return items.map(item=>item.id!==record.sessionId?item:{...item,...(!item.hasPrompt&&!item.manuallyNamed?{title:record.text,hasPrompt:true}:{}),updatedAt:!Number.isFinite(new Date(item.updatedAt).getTime())||new Date(record.createdAt)>new Date(item.updatedAt)?record.createdAt:item.updatedAt});}
