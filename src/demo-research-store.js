export const DEMO_STORE_KEY='lingshu-research-demo-v1';
const clone=value=>JSON.parse(JSON.stringify(value));
const collections=['projects','protocols','tasks','visits','outputs','assets','reuses','members','queries','events'];
function seed(){return {version:1,...Object.fromEntries(collections.map(key=>[key,[]]))};}
export function validateProject(project){
  if(!project.name?.trim())throw Error('请填写课题名称');
  if(!project.question?.trim())throw Error('请填写核心研究问题');
  for(const [key,label] of Object.entries({p:'人群',i:'干预',c:'对照',o:'结局'}))if(!project.pico?.[key]?.trim())throw Error('请填写'+label);
}
export function createDemoStore(storage){
  let state=seed(),snapshotRaw=null;
  function reload(){try{const raw=storage.getItem(DEMO_STORE_KEY);const value=raw?JSON.parse(raw):seed();if(value.version!==1||collections.some(key=>!Array.isArray(value[key])))throw Error('schema');state=value;snapshotRaw=raw;}catch{throw Error('本机演示数据损坏或不可读取，请先导出备份或更换浏览器，不会自动覆盖。');}}
  reload();
  let sequence=0;
  const id=prefix=>prefix+'-'+Date.now().toString(36)+'-'+(++sequence).toString(36)+'-'+Math.random().toString(36).slice(2,7);
  function commit(next){try{if(storage.getItem(DEMO_STORE_KEY)!==snapshotRaw)throw Error('conflict');const serialized=JSON.stringify(next);storage.setItem(DEMO_STORE_KEY,serialized);snapshotRaw=serialized;}catch{throw Error('本机保存失败：存储不可用或其他页面已更新，请刷新后重试；当前操作未保存。');}state=next;if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('qiyan:demo-data-change'));}
  function get(key,value){reload();const record=state[key]?.find(item=>item.id===value);if(!record)throw Error('记录不存在：'+value);return clone(record);}
  function save(key,record,prefix){reload();const next=clone(state);let item={...record,id:record.id||id(prefix),updatedAt:new Date().toISOString()};const old=next[key].findIndex(row=>row.id===item.id);if(old>=0)next[key][old]=item;else next[key].push(item);next.events.unshift({id:id('EVT'),title:'本机保存：'+key,objectId:item.id,at:item.updatedAt});next.events=next.events.slice(0,100);commit(next);return clone(item);}
  return {
    list:key=>{reload();return clone(state[key]||[]);},get,
    saveProject(record){const old=record.id?get('projects',record.id):{};if(record.version!=null&&record.version!==(old.version||0))throw Error('课题版本已被其他页面更新，请刷新后重试');const merged={...old,...record};if(!merged.name?.trim())throw Error('请填写课题名称');return save('projects',{...merged,name:merged.name.trim(),status:merged.status||'草稿',version:(old.version||0)+1},'PRJ');},
    ensureProtocol(projectId){const project=get('projects',projectId);validateProject(project);const existing=state.protocols.find(item=>item.projectId===projectId);if(existing)return clone(existing);return save('protocols',{projectId,name:project.name,pico:project.pico,question:project.question,hubId:project.hubId,version:1,status:'草稿',design:'',analysis:'',reusedAssets:[]},'PRO');},
    saveProtocol(record){const old=get('protocols',record.id);get('projects',old.projectId);if(record.version!=null&&record.version!==old.version)throw Error('方案版本已被其他页面更新，请刷新后重试');if(!record.name?.trim())throw Error('请填写方案名称');return save('protocols',{...old,...record,projectId:old.projectId,version:old.version+1},'PRO');},
    saveTask(record){get('projects',record.projectId);if(!record.title?.trim())throw Error('请填写任务标题');return save('tasks',{...record,status:record.status||'待处理'},'TASK');},
    saveVisit(record){get('projects',record.projectId);if(!record.subjectId?.trim()||!record.visit?.trim())throw Error('请填写演示编号与访视');if(!Number.isFinite(Number(record.score))||Number(record.score)<0||Number(record.score)>100)throw Error('示例评分必须在0至100之间');return save('visits',{...record,score:Number(record.score),status:'已保存'},'VISIT');},
    saveMember(record){get('projects',record.projectId);if(!record.name?.trim())throw Error('请填写演示成员名');return save('members',record,'MEM');},
    saveQuery(record){get('projects',record.projectId);return save('queries',record,'QUERY');},
    saveOutput(record){get('projects',record.projectId);const protocol=get('protocols',record.protocolId);if(protocol.projectId!==record.projectId)throw Error('方案与课题不匹配');if(!record.title?.trim()||!record.content?.trim())throw Error('请填写产出标题与内容');return save('outputs',{...record,protocolVersion:protocol.version,version:(state.outputs.find(item=>item.id===record.id)?.version||0)+1},'OUT');},
    saveAsset(record){if(!record.title?.trim()||!record.content?.trim())throw Error('请填写资产标题与内容');return save('assets',{...record,version:record.version||1,scope:record.scope||'本机演示'},'ASSET');},
    publishOutput(outputId){const output=get('outputs',outputId);if(!output.confirmed)throw Error('请先确认产出内容');const existing=state.assets.find(asset=>asset.sourceOutputId===outputId&&asset.sourceVersion===output.version);if(existing)return clone(existing);return save('assets',{title:output.title,content:output.content,projectId:output.projectId,sourceOutputId:outputId,sourceVersion:output.version,protocolId:output.protocolId,protocolVersion:output.protocolVersion,version:1,scope:'本机演示'},'ASSET');},
    reuseAsset(assetId,projectId){const asset=get('assets',assetId),project=get('projects',projectId);validateProject(project);const next=clone(state),now=new Date().toISOString();let protocol=next.protocols.find(item=>item.projectId===projectId);if(!protocol){protocol={id:id('PRO'),projectId,name:project.name,pico:project.pico,question:project.question,hubId:project.hubId,version:0,status:'草稿',design:'',analysis:'',reusedAssets:[]};next.protocols.push(protocol);}const exists=protocol.reusedAssets?.find(item=>item.sourceAssetId===assetId&&item.sourceVersion===asset.version);if(exists)return {...clone(protocol),sourceAssetId:assetId,sourceVersion:asset.version};protocol.reusedAssets=[...(protocol.reusedAssets||[]),{sourceAssetId:assetId,sourceVersion:asset.version,title:asset.title,content:asset.content}];protocol.version++;protocol.updatedAt=now;next.reuses.push({id:id('REUSE'),assetId,projectId,protocolId:protocol.id,sourceVersion:asset.version,updatedAt:now});next.events.unshift({id:id('EVT'),title:'本机资产复用',objectId:protocol.id,at:now});next.events=next.events.slice(0,100);commit(next);return {...clone(protocol),sourceAssetId:assetId,sourceVersion:asset.version};},
    exportData:()=>{reload();return clone(state);},
  };
}
export function browserDemoStore(){return createDemoStore(window.localStorage);}
