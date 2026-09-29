import React, { useState } from 'react';
import { CalendarDays, CheckCircle2, Download, Edit3, FileText, MoreHorizontal, Plus, Share2, Upload, UsersRound } from 'lucide-react';
import { Shell, go } from './Shell.jsx';
import { AIPanel, Button, Card, CheckList, DataTable, DocumentPreview, Donut, MiniBars, SimpleLine, Stats, Stepper, Tabs, Timeline, Toolbar } from './Components.jsx';

const studyHero = {
  breadcrumb: '针刺抑郁多中心研究', title: '受试者管理', subtitle: '全流程管理受试者入组、随访、数据采集与安全性，提升研究执行质量。',
  actions: [{label:'新增受试者', primary:true, icon:<Plus/>},{label:'批量操作'},{label:'导出', icon:<Download/>}],
};

export function S02() {
  const steps = ['研究课题','证据检索与分析','研究设计','方案评审','执行与数据收集','结果分析','发表与复用'];
  return <Shell active="我的科研" hero={{breadcrumb:'研究设计 › 研究设计详情',title:'研究设计详情',en:'Study Design Detail',subtitle:'基于证据与临床问题，生成科学、可执行、合规的研究方案。',slogan:['以严谨的研究设计','推动更有价值的临床证据'],actions:[{label:'版本历史'},{label:'导出方案 (DOCX)'},{label:'提交伦理审查',primary:true},{label:'•••'}]}}>
    <div className="content stack">
      <Stepper steps={steps} active={2}/>
      <div className="two-col" style={{gridTemplateColumns:'minmax(0,1fr) 305px'}}>
        <Card className="form-block"><div className="tag-row"><span className="pill">研究方案 v1.0</span><span className="pill green">草稿</span></div><h2>针灸联合常规治疗对中度抑郁症的疗效：多中心、随机对照试验</h2><p>Efficacy of Acupuncture Combined with Conventional Treatment for Moderate Depression</p><div className="tag-row">{['RCT','多中心','优效性','中度抑郁症','针灸','SSRI','12周'].map(x=><span className="pill" key={x}>{x}</span>)}</div></Card>
        <Card className="form-block"><div className="detail-list"><p><span>方案编号</span><b>SUB-2024-0008</b></p><p><span>创建人</span><b>王教授</b></p><p><span>当前状态</span><b className="good">草稿</b></p><p><span>版本</span><b>v1.0</b></p></div></Card>
      </div>
      <Tabs items={['方案总览','研究背景','研究设计','研究人群','干预措施','结局指标','样本量估计','统计分析','数据管理','伦理与合规','附录']}/>
      <div className="main-grid">
        <div className="stack">
          <Card title="1. 研究简介"><div className="form-block"><p>本研究旨在评估针灸联合常规抗抑郁治疗相比单纯常规治疗在中度抑郁症患者中的疗效和安全性，采用多中心、随机、对照、开放标签、盲评估试验。</p></div></Card>
          <Card title="2. 研究设计图"><div className="flow-diagram"><div>筛选与基线评估<br/>中度抑郁症患者<br/>HAMD 17–24<br/>n ≈ 320</div><b>→</b><div>试验组<br/>针灸 + 常规治疗 n≈160<hr/>对照组<br/>常规治疗 n≈160</div><b>→</b><div>干预阶段<br/>12 周<br/>HAMD 评分</div><b>→</b><div>随访阶段<br/>24 周<br/>复发率 / 安全性</div></div></Card>
          <Card title="3. 关键要素" action="编辑"><div className="key-cards">{['研究类型|多中心、随机对照试验（RCT）','干预措施|试验组：针灸 + SSRI；对照组：单用 SSRI','随机与盲法|中心随机，1:1 分配，评价者盲法','研究人群|18–65 岁，符合 DSM-5 中度抑郁症','主要结局指标|第 12 周 HAMD 评分较基线的变化','统计方法|ANCOVA、混合效应模型','样本量|总计 320 例（每组 160 例）','次要结局指标|应答率、复发率、生活质量','研究周期|入组 12 个月，干预 12 周，随访 24 周'].map(v=>{const [a,b]=v.split('|');return <article key={a}><b>{a}</b>{b}</article>})}</div></Card>
        </div>
        <div className="stack"><AIPanel title="岐研 AI 研究设计助手"><p>基于您的研究课题、核心研究问题和已检索的证据，我为您生成了以上研究设计方案。</p><CheckList items={['研究人群与既往高质量研究一致','主要结局指标选择 HAMD','样本量估计考虑失访率','采用多中心设计提高外部有效性','符合伦理规范，风险可控']}/></AIPanel><Card title="相关文件" action="上传文件"><div className="right-list">{['研究方案 v1.0.docx','知情同意书（模板）.docx','病例报告表（CRF）.xlsx','针灸操作标准化手册.pdf','统计分析计划 SAP.docx'].map((x,i)=><p key={x}><FileText/><span>{x}</span><time>2024-09-{15-i}</time></p>)}</div></Card></div>
      </div>
    </div>
  </Shell>;
}

const subjects = [
  ['QY001-001','张**','女','32','中心 01','试验组','2024-06-12','第 4 访视',{value:'在研究中',className:'tag'},'100%','无','查看'],
  ['QY001-002','李**','男','45','中心 02','对照组','2024-06-15','第 3 访视',{value:'在研究中',className:'tag'},'95%','无','查看'],
  ['QY001-003','王**','女','28','中心 03','试验组','2024-06-18','第 2 访视',{value:'在研究中',className:'tag'},'88%','无','查看'],
  ['QY001-004','赵**','男','52','中心 03','对照组','2024-06-20','第 1 访视',{value:'随访中',className:'good'},'76%',{value:'头晕（中度）',className:'bad'},'查看'],
  ['QY001-005','刘**','女','39','中心 04','试验组','2024-07-01','第 4 访视',{value:'在研究中',className:'tag'},'100%','无','查看'],
  ['QY001-006','陈**','男','61','中心 05','对照组','2024-07-05','第 2 访视',{value:'随访中',className:'good'},'92%','无','查看'],
];

export function S03() {
  const [selected,setSelected]=useState(-1);
  const cols=['受试者编号','姓名','性别','年龄','中心','分组','入组时间','当前访视','状态','数据完整率','不良事件','操作'].map((x,i)=>({label:x,width:[1.15,.65,.55,.55,.8,.75,1,1,.9,.9,1, .7][i]+'fr'}));
  return <Shell active="我的科研" expanded hero={studyHero}>
    <div className="content stack"><Tabs items={['受试者列表','入组管理','随访管理','不良事件','数据质控','统计分析']}/>
      <div className="main-grid"><div className="stack"><Stats items={[{label:'入组进度',value:'42 / 120',note:'35%',bad:true},{label:'在随访',value:'38',note:'90%'},{label:'完成研究',value:'4',note:'10%',good:true},{label:'脱落/退出',value:'3',note:'7%',bad:true},{label:'数据完整率',value:'92%',note:'较上月 +2%',good:true}]}/>
        <div className="three-col"><Card title="中心入组情况"><MiniBars values={[72,55,43,68,54]}/></Card><Card title="受试者状态分布"><div style={{display:'flex',alignItems:'center',justifyContent:'space-evenly',padding:'5px 0'}}><Donut value={53} label="总受试者" color="#4b43ef"/><CheckList items={['筛选中 18','在研究中 38','已完成 4','提前退出 2']}/></div></Card><Card title="受试者人群特征"><CheckList items={['男 56（47%）','女 64（53%）','18–30 岁 12','31–45 岁 46','46–60 岁 48','>60 岁 14']}/></Card></div>
      </div><AIPanel title="岐研 AI 洞察"><h3>需要关注</h3><p>中心 03 近两周入组速度明显下降，流失率从 21% 上升至 38%。</p><hr/><h3>数据质控提醒</h3><p>有 6 例受试者 CRF 存在缺失或逻辑偏差。</p><hr/><h3>潜在风险</h3><p>1 例受试者出现中度不良事件，请关注随访情况。</p></AIPanel></div>
      <Card><Toolbar search="请输入受试者编号、姓名或手机号" filters={['全部中心','全部状态','全部访视周期','全部分组','入组时间']}/><DataTable columns={cols} rows={subjects} selected={selected} onRow={(i)=>{setSelected(i);if(i===0)go('s04')}}/><div className="pagination"><span>共 120 条</span><span><b className="active">1</b><b>2</b><b>3</b><b>4</b><b>5</b><b>…</b><b>12</b></span></div></Card>
    </div>
  </Shell>;
}

export function S04() {
  const visitRows=[['生命体征（血压、心率、体重）',{value:'已完成',className:'good'},'2024-08-02 09:15','BP 128/76 mmHg, HR 72 bpm, 68.5 kg','查看'],['抑郁症评分（HAMD-17）',{value:'已完成',className:'good'},'2024-08-02 09:30','12 分（较基线下降 52%）','查看'],['焦虑评分（HAMA）',{value:'已完成',className:'good'},'2024-08-02 09:32','8 分（较基线下降 47%）','查看'],['实验室检查（血常规、肝肾功能）',{value:'已完成',className:'good'},'2024-08-02 10:10','未见异常','查看'],['不良事件评估',{value:'已完成',className:'good'},'2024-08-02 10:20','无不良事件','查看'],['研究药物发放/回收',{value:'进行中',className:'tag'},'—','本次发放 4 周用药','填写'],['受试者问卷（生活质量 SF-36）',{value:'待完成',className:'bad'},'—','—','填写']];
  return <Shell active="我的科研" expanded hero={{breadcrumb:'研究项目 › 受试者管理 › 受试者详情',title:'受试者详情',en:'Subject Detail',subtitle:'全面管理受试者信息与随访过程，提升受试者依从性与数据质量。',slogan:['以受试者为中心','让每一次随访都有价值'],actions:[{label:'编辑',icon:<Edit3/>},{label:'随访记录'},{label:'导出报告',icon:<Download/>},{label:'更多操作'}]}}>
    <div className="content stack"><Card><div className="hero-detail-card" style={{gridTemplateColumns:'110px 260px 1fr 300px'}}><div className="header-avatar" style={{position:'static',width:100,height:100,fontSize:38}}>张</div><div><h2>S001–032 <span className="pill green">在研中</span></h2><b>张某某　<small>男｜56岁</small></b><p>138****1234<br/>北京市 朝阳区</p><div className="tag-row"><span className="pill green">积极配合</span><span className="pill green">依从性良好</span></div></div><div className="detail-list"><p><span>所属研究</span><b>针灸联合常规治疗对中度抑郁症的疗效</b></p><p><span>研究中心</span><b>北京中医医院</b></p><p><span>研究者</span><b>王教授 / 李医生</b></p><p><span>当前访视</span><b>第4次随访（第12周）</b></p></div><div className="progress-ring"><Donut value={75} label="3/4 次访视"/><CheckList items={['已完成 3','待进行 1','逾期 0']}/></div></div></Card>
      <Tabs items={['概览','基线信息','随访管理','疗效评估','安全性事件','用药记录','检查检验','文件资料','沟通记录','更多'] } initial={2}/>
      <div className="main-grid"><div className="stack"><Card title="随访时间线"><div style={{padding:'2px 18px 8px'}}><Stepper steps={['筛选期','基线访视','第1次随访','第2次随访','第3次随访','结局访视']} active={4}/></div></Card><Card title="访视详情（第12周）"><DataTable compact columns={[{label:'评估项目',width:'2fr'},{label:'状态',width:'.9fr'},{label:'完成时间',width:'1.4fr'},{label:'结果 / 说明',width:'2.3fr'},{label:'操作',width:'.6fr'}]} rows={visitRows}/><div className="form-block"><b>访视备注</b><textarea className="textarea" style={{height:62,marginTop:8}} placeholder="请输入本次访视的备注信息..."/></div></Card></div><div className="stack"><AIPanel title="岐研 AI 受试者洞察"><b>受试者整体情况</b><CheckList items={['依从性良好，按时完成 3 次随访','HAMD 评分下降 52%，疗效显著','未发生严重不良事件','生命体征和实验室检查均正常']}/><div className="notice">整体评估：受试者目前获益明显，建议继续按方案完成后续随访。</div></AIPanel><Card title="待办事项（2）" action="查看全部"><CheckList items={['完成第12周医生评估','受试者问卷（SF-36）']}/></Card><Card title="相关文档" action="上传文件"><div className="right-list">{['ICF_知情同意书.pdf','基线检查报告.pdf','第8周随访记录.pdf','第12周实验室检查.pdf'].map(x=><p key={x}><FileText/><span>{x}</span><time>2024-08-02</time></p>)}</div></Card></div></div>
    </div>
  </Shell>;
}

export function S05() {
  const issues=[['1',{value:'高',className:'pill red'},'数据缺失','主要结局指标(HAMD-17)第8周缺失','S001-003','访视表 V3','2024-10-22',{value:'待处理',className:'bad'},'李医生','详情'],['2',{value:'中',className:'pill orange'},'数据不一致','人口学信息与知情同意书不一致','S001-015','基线表','2024-10-21',{value:'处理中',className:'tag'},'张医生','详情'],['3',{value:'高',className:'pill red'},'超出范围','体重录入值 320 kg，超出生理范围','S002-028','体征表','2024-10-20',{value:'待处理',className:'bad'},'王医生','详情'],['4',{value:'中',className:'pill orange'},'逻辑错误','结束日期早于开始日期','S003-007','用药记录','2024-10-19',{value:'已解决',className:'good'},'刘医生','详情'],['5',{value:'低',className:'pill green'},'数据缺失','不良事件严重程度未填写','S002-016','AE表','2024-10-18',{value:'已解决',className:'good'},'陈医生','详情'],['6',{value:'中',className:'pill orange'},'数据不一致','实验室检查单位与参考范围不匹配','S001-041','实验室检查','2024-10-17',{value:'待处理',className:'bad'},'李医生','详情']];
  return <Shell active="我的科研" expanded hero={{breadcrumb:'研究项目 › 数据管理 › 数据质量详情',title:'数据质量详情',en:'Data Quality Detail',subtitle:'实时监控数据质量，快速定位与解决数据问题，确保研究数据的完整性、准确性和合规性。',slogan:['高质量数据','让可靠的证据走得更远'],actions:[{label:'针灸治疗抑郁症的多中心随机对照试验'},{label:'进行中'}]}}>
    <div className="content stack"><Tabs items={['总体概览','数据核查','数据问题','SDV 监督','质控规则','数据趋势','中心对比','审计轨迹','数据导出']}/><Stats items={[{label:'受试者总数',value:'320',note:'较上期 +12',good:true},{label:'CRF表单总数',value:'5,120',note:'完整率 96.3%',good:true},{label:'数据问题总数',value:'48',note:'待处理 12',bad:true},{label:'重大问题',value:'3',note:'较上期 −40%',good:true},{label:'平均解决时长',value:'2.3 天',note:'较上期 −35%',good:true},{label:'数据质量评分',value:'96.2 / 100',note:'较上期 +2.1',good:true}]}/>
      <div className="three-col" style={{gridTemplateColumns:'1.4fr 1fr 1.15fr'}}><Card title="数据质量趋势"><div className="chart-card"><div className="chart-legend"><span><i/>数据完整性</span><span><i/>数据一致性</span><span><i/>数据准确性</span></div><SimpleLine lines={3} bars/></div></Card><Card title="数据问题分布"><div style={{display:'flex',alignItems:'center',justifyContent:'space-evenly',paddingTop:7}}><Donut value={38} label="48 问题总数" color="#4c43f1"/><CheckList items={['数据缺失 18','数据不一致 12','超出范围 8','逻辑错误 6','其他 4']}/></div></Card><Card title="各中心数据质量评分" action="查看更多"><DataTable compact columns={[{label:'中心',width:'1.4fr'},{label:'受试者数'},{label:'问题数'},{label:'质量评分'},{label:'趋势'}]} rows={[['北京中医医院','62','5','98.6','↑'],['上海市中医院','58','8','96.2','↑'],['广州中医药大学附属医院','55','12','93.5','↓'],['四川省中医院','48','7','95.8','→'],['浙江省中医院','52','6','97.1','↑']]}/></Card></div>
      <div className="main-grid"><Card title="数据问题列表（48）"><Toolbar search="搜索问题描述、受试者编号、CRF..." filters={['全部状态','全部严重度','全部问题类型','全部中心']}/><DataTable compact columns={['#','严重度','问题类型','问题描述','受试者编号','CRF/字段','发现日期','状态','负责人','操作'].map((x,i)=>({label:x,width:[.3,.6,.8,2, .8,.8,.8,.7,.6,.5][i]+'fr'}))} rows={issues}/><div className="pagination"><span>共 48 条</span><span><b className="active">1</b><b>2</b><b>3</b><b>4</b><b>5</b></span></div></Card><div className="stack"><AIPanel title="岐研 AI 数据质控助手"><b>数据质量洞察</b><CheckList items={['当前数据质量总体良好，主要问题集中在量表评分缺失','中心间数据质量差异，建议加强数据培训和监督','近两周数据问题呈下降趋势，质控措施效果显著','发现 3 条潜在的系统性问题']}/><CheckList items={['优化 CRF 界面校验规则','对异常值增加实时范围校验','建议定期中心进行专项数据核查']}/></AIPanel><Card title="常用操作"><div className="tag-row form-block"><Button>数据核查计划</Button><Button>批量问题分配</Button><Button>导出问题列表</Button><Button>数据质量报告</Button></div></Card></div></div>
    </div>
  </Shell>;
}

export function S06() {
  const keyRows=[['基线均值 (SD)','24.3 (4.8)','24.1 (5.1)','—','0.623'],['第12周均值 (SD)','8.6 (6.2)','14.3 (7.1)','−5.7 (−7.8, −3.6)',{value:'<0.001',className:'bad'}],['均值变化 (SD)','−15.7 (7.1)','−9.8 (6.9)','−5.9 (−8.0, −3.8)',{value:'<0.001',className:'bad'}],['应答率(≥50%)','68.8%','42.5%','26.3%',{value:'<0.001',className:'bad'}],['缓解率(HAMD≤7)','52.5%','28.1%','24.4%',{value:'<0.001',className:'bad'}]];
  return <Shell active="我的科研" expanded hero={{breadcrumb:'研究项目 › 研究分析 › 分析结果详情',title:'研究分析结果',en:'Analysis Result',subtitle:'多维度分析研究数据，生成可靠的统计结果与可视化图表，助力临床决策与学术发表。',slogan:['用数据发现证据','让中医临床研究更有力量'],actions:[{label:'分享',icon:<Share2/>},{label:'导出报告',icon:<Download/>},{label:'生成论文图表'},{label:'更多操作'}]}}>
    <div className="content stack"><Card><div style={{display:'grid',gridTemplateColumns:'1fr 610px',padding:'12px 18px'}}><div><h2 style={{margin:'0 0 5px'}}>针灸联合常规治疗对中度抑郁症的疗效：多中心随机对照试验（v3.0）</h2><p className="muted" style={{margin:0,fontSize:12}}>方案编号：SUB-2024-0008　｜　研究类型：多中心 RCT　｜　研究周期：2024-03-01 ~ 2026-03-01</p></div><div className="inline-kpis"><div><small>入组受试者</small><strong>320</strong></div><div><small>完成研究</small><strong>298</strong></div><div><small>数据锁定</small><strong>2025-10-20</strong></div><div><small>分析版本</small><strong>v1.0</strong></div></div></div></Card><Tabs items={['总体结果','主要疗效分析','次要疗效分析','安全性分析','亚组分析','探索性分析','图表库','统计报告','数据集']}/>
      <div className="analysis-grid"><Card title="主要疗效结果"><div className="chart-card"><SimpleLine lines={2}/><div className="tag-row" style={{justifyContent:'space-around'}}>{['基线','第2周','第4周','第8周','第12周'].map(x=><span key={x}>{x}</span>)}</div></div></Card><Card title="关键统计指标（主要终点：第12周 HAMD–17）"><DataTable compact columns={[{label:'指标',width:'1.2fr'},{label:'针灸联合组',width:'1fr'},{label:'常规治疗组',width:'1fr'},{label:'组间差值',width:'1.1fr'},{label:'P 值',width:'.7fr'}]} rows={keyRows}/></Card><AIPanel title="岐研 AI 结果解读"><h3>主要疗效结果具有统计学显著性，且临床意义明确</h3><p>针灸联合治疗在第12周显著降低 HAMD-17 评分，组间差值 −5.7，P &lt; 0.001。</p><b>进一步分析建议</b><CheckList items={['建议进行亚组分析','结合安全性数据评估获益风险','进行敏感性分析验证稳健性','将关键结果制作为论文图表']}/></AIPanel></div>
      <div className="analysis-grid"><Card title="次要疗效结果"><Tabs items={['SDS 评分','SAS 评分','生活质量 (SF–36)','中医证候积分']} initial={2}/><MiniBars values={[62,54,48,68,74,60]} /></Card><Card title="安全性结果"><DataTable compact columns={[{label:'不良事件',width:'1.3fr'},{label:'针灸联合组'},{label:'常规治疗组'},{label:'P 值'}]} rows={[['任何不良事件','18 (11.3%)','20 (12.5%)','0.723'],['轻度','15 (9.4%)','17 (10.6%)','0.704'],['中度','3 (1.9%)','3 (1.9%)','>0.999'],['重度','0 (0%)','0 (0%)','—'],['与治疗相关','5 (3.1%)','4 (2.5%)','0.724']]}/></Card><div className="stack"><Card title="相关下载" action="全部下载"><div className="right-list">{['统计分析报告 v1.0.pdf','主要结果图表（高分辨率）.zip','数据集（分析集）.sas7bdat','分析代码（R）.zip','结果摘要（中英文）.docx'].map(x=><p key={x}><FileText/><span>{x}</span><time>2025-10-28</time></p>)}</div></Card><Card title="结论摘要"><div className="notice">常规治疗基础上联合针灸治疗可显著改善中度抑郁症患者的抑郁症状，提高治疗应答和缓解率，且安全性良好。</div></Card></div></div>
    </div>
  </Shell>;
}
