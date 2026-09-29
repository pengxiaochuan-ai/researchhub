import React from 'react';
import {
  AlertTriangle, Building2, CheckCircle2, ClipboardCheck, Database, Download,
  FileText, FolderPlus, ShieldCheck, TrendingUp, UserCog, UsersRound,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Shell } from './Shell.jsx';
import { Card, DataTable, Tabs } from './Components.jsx';

const statusData = [
  {name:'进行中',value:28,color:'#438df1',rate:'66%'},
  {name:'伦理审查',value:5,color:'#55c7b8',rate:'12%'},
  {name:'暂停',value:3,color:'#f2b344',rate:'7%'},
  {name:'已完成',value:4,color:'#a6b2cd',rate:'10%'},
  {name:'终止',value:2,color:'#ee6c82',rate:'5%'},
];

const ethicsData = [
  {name:'北京',passed:14,review:4,supplement:2,pending:1},
  {name:'上海',passed:12,review:3,supplement:2,pending:2},
  {name:'广州',passed:11,review:4,supplement:3,pending:1},
  {name:'成都',passed:15,review:3,supplement:1,pending:1},
  {name:'西安',passed:13,review:4,supplement:2,pending:1},
];

const qualityData = [
  {name:'4月',complete:91,consistent:88,timely:83,overall:87},
  {name:'5月',complete:93,consistent:90,timely:85,overall:89},
  {name:'6月',complete:95,consistent:91,timely:88,overall:91},
  {name:'7月',complete:94,consistent:93,timely:90,overall:92},
  {name:'8月',complete:97,consistent:94,timely:92,overall:94},
];

const loginValues = [68,83,72,66,74,80,78,84,88,77,82,94];
const activeValues = [46,60,54,51,58,63,61,69,72,65,70,78];
const activeData = ['10月','11月','12月','1月','2月','3月','4月','5月','6月','7月','8月','9月']
  .map((name,index)=>({name,login:loginValues[index],active:activeValues[index]}));

const centerRows = [
  ['北京中医医院','8','620','98%',{value:'通过',className:'good'},'查看'],
  ['上海中医药大学附属医院','7','540','96%',{value:'通过',className:'good'},'查看'],
  ['广州中医药大学第一附属医院','6','463','93%',{value:'审查中',className:'pill orange'},'查看'],
  ['成都中医药大学附属医院','5','398','95%',{value:'通过',className:'good'},'查看'],
  ['浙江省中医院','4','287','92%',{value:'需补充',className:'bad'},'查看'],
];

const risks = [
  ['中心 03 数据缺失率上升','近两周随访记录缺失率达21%，需尽快排查原因。','高','2024-09-12'],
  ['伦理批件即将到期','中心05伦理批件将在30天后到期。','高','2024-09-10'],
  ['受试者知情同意书版本不一致','发现2个中心仍在使用旧版知情同意书模板。','中','2024-09-08'],
  ['数据录入及时性下降','中心02近一周数据录入平均延迟5天。','中','2024-09-05'],
  ['研究人员权限异常','1个账号存在非常规访问行为，已限制权限。','低','2024-09-01'],
];

const notices = [
  ['关于加强数据安全管理的通知','2024-09-15'],
  ['伦理审查系统升级维护公告','2024-09-10'],
  ['《中医临床研究数据管理规范》发布','2024-09-01'],
  ['多中心协作流程优化上线','2024-08-20'],
];

const auditRows = [
  ['2024-09-15 14:32','李**','数据导出','导出受试者数据','192.168.1.23'],
  ['2024-09-15 11:20','张**','权限修改','调整中心成员权限','192.168.1.45'],
  ['2024-09-14 18:05','王**','伦理申请','提交伦理审查申请','192.168.1.88'],
  ['2024-09-14 09:12','陈**','数据修改','更新随访记录','192.168.1.27'],
  ['2024-09-13 16:40','刘**','系统登录','登录系统','192.168.1.56'],
];

const stats = [
  {label:'在研项目',value:'42',note:'+5 较上季度',Icon:Database,tone:'violet',noteClass:'green'},
  {label:'参与中心',value:'15',note:'+2',Icon:FileText,tone:'blue',noteClass:'green'},
  {label:'研究人员',value:'286',note:'+12',Icon:UsersRound,tone:'teal',noteClass:'green'},
  {label:'受试者总数',value:'3,420',note:'+18%',Icon:ShieldCheck,tone:'rose',noteClass:'green'},
  {label:'合规审查通过率',value:'98%',note:'+2%',Icon:TrendingUp,tone:'orange',noteClass:'green'},
  {label:'数据质量达标率',value:'96%',note:'+4%',Icon:Database,tone:'violet',noteClass:'green'},
];

function ProjectStatus() {
  return <div className="g02-status-card">
    <div className="g02-donut-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart>
      <Pie data={statusData} dataKey="value" innerRadius={47} outerRadius={66} startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>
        {statusData.map(item=><Cell key={item.name} fill={item.color}/>)}
      </Pie>
      <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" className="g02-pie-number">42</text>
      <text x="50%" y="62%" textAnchor="middle" dominantBaseline="middle" className="g02-pie-label">在研项目</text>
    </PieChart></ResponsiveContainer></div>
    <div className="g02-status-legend">{statusData.map(item=><div key={item.name}>
      <i style={{background:item.color}}/><span>{item.name}</span><b>{item.value}</b><em>{item.rate}</em>
    </div>)}</div>
  </div>;
}

function EthicsChart() {
  return <div className="g02-chart-box ethics"><ResponsiveContainer width="100%" height="100%"><BarChart data={ethicsData} margin={{top:3,right:8,left:-20,bottom:0}}>
    <CartesianGrid stroke="#edf1f7" vertical={false}/>
    <XAxis dataKey="name" tick={{fontSize:12,fill:'#6979a2'}} axisLine={false} tickLine={false}/>
    <YAxis domain={[0,20]} ticks={[0,5,10,15,20]} tick={{fontSize:12,fill:'#6979a2'}} axisLine={false} tickLine={false}/>
    <Tooltip/><Legend iconType="circle" iconSize={7} wrapperStyle={{fontSize:12,top:-27,right:0}}/>
    <Bar name="已通过" dataKey="passed" stackId="a" fill="#4d45ee" barSize={17} isAnimationActive={false}/>
    <Bar name="审查中" dataKey="review" stackId="a" fill="#498bed" isAnimationActive={false}/>
    <Bar name="需补充" dataKey="supplement" stackId="a" fill="#e56c9b" isAnimationActive={false}/>
    <Bar name="未提交" dataKey="pending" stackId="a" fill="#d9def0" radius={[3,3,0,0]} isAnimationActive={false}/>
  </BarChart></ResponsiveContainer></div>;
}

function QualityChart() {
  return <div className="g02-chart-box quality"><ResponsiveContainer width="100%" height="100%"><LineChart data={qualityData} margin={{top:3,right:8,left:-20,bottom:0}}>
    <CartesianGrid stroke="#edf1f7" vertical={false}/>
    <XAxis dataKey="name" tick={{fontSize:12,fill:'#6979a2'}} axisLine={false} tickLine={false}/>
    <YAxis domain={[75,100]} ticks={[80,85,90,95,100]} tick={{fontSize:12,fill:'#6979a2'}} axisLine={false} tickLine={false}/>
    <Tooltip/><Legend iconType="circle" iconSize={7} wrapperStyle={{fontSize:12,top:-27,right:0}}/>
    <Line name="完整性" type="monotone" dataKey="complete" stroke="#3e50f4" strokeWidth={2} dot={false} isAnimationActive={false}/>
    <Line name="一致性" type="monotone" dataKey="consistent" stroke="#08a38d" strokeWidth={2} dot={false} isAnimationActive={false}/>
    <Line name="及时性" type="monotone" dataKey="timely" stroke="#f4a11e" strokeWidth={2} dot={false} isAnimationActive={false}/>
    <Line name="总体" type="monotone" dataKey="overall" stroke="#8390b4" strokeWidth={2} dot={false} isAnimationActive={false}/>
  </LineChart></ResponsiveContainer></div>;
}

function ActivityChart() {
  return <div className="g02-chart-box active"><ResponsiveContainer width="100%" height="100%"><BarChart data={activeData} margin={{top:0,right:8,left:-22,bottom:0}}>
    <CartesianGrid stroke="#edf1f7" vertical={false}/>
    <XAxis dataKey="name" tick={{fontSize:12,fill:'#6979a2'}} axisLine={false} tickLine={false}/>
    <YAxis tick={{fontSize:12,fill:'#6979a2'}} axisLine={false} tickLine={false}/>
    <Legend iconType="circle" iconSize={7} wrapperStyle={{fontSize:12,top:-26,right:0}}/>
    <Bar name="登录用户" dataKey="login" fill="#5145ef" barSize={8} radius={[3,3,0,0]} isAnimationActive={false}/>
    <Bar name="活跃用户" dataKey="active" fill="#aea9fb" barSize={8} radius={[3,3,0,0]} isAnimationActive={false}/>
  </BarChart></ResponsiveContainer></div>;
}

export default function G02Page() {
  return <Shell className="g02-page" active="管理与治理" hero={{
    breadcrumb:'管理与治理',
    title:'管理与治理',
    subtitle:'保障研究合规、数据安全、质量可控，促进多中心协作与科研价值的可持续发展。',
    actions:[{label:'下载治理报告',icon:<Download/>},{label:'2024-01-01 ~ 2024-12-31'}],
  }}>
    <div className="content g02-content">
      <Tabs items={['总览','伦理合规','数据治理','研究质量','用户与权限','多中心管理','审计日志','系统配置']}/>

      <section className="g02-stats">{stats.map(({label,value,note,Icon,tone,noteClass})=><article className="g02-stat" key={label}>
        <span className={`g02-stat-icon ${tone}`}><Icon/></span>
        <div><small>{label}</small><strong>{value}</strong><em className={noteClass}>{note}</em></div>
      </article>)}</section>

      <section className="g02-chart-row">
        <Card title="研究项目状态"><ProjectStatus/></Card>
        <Card title="伦理合规进度"><EthicsChart/></Card>
        <Card title="数据质量趋势"><QualityChart/></Card>
      </section>

      <section className="g02-middle-row">
        <Card title="多中心研究进展" action="查看全部"><DataTable compact columns={[{label:'中心名称',width:'1.6fr'},{label:'在研项目'},{label:'入组人数'},{label:'数据完整率'},{label:'合规状态'},{label:'操作'}]} rows={centerRows}/></Card>
        <Card title="风险与问题" action="查看全部"><div className="g02-risk-list">{risks.map(([title,note,level,date])=><article key={title}>
          <AlertTriangle/><div><b>{title}</b><small>{note}</small></div><span className={`risk-${level}`}>{level}</span><time>{date}</time>
        </article>)}</div></Card>
        <div className="g02-right-stack">
          <Card title="快捷操作"><div className="g02-actions">{[
            [FolderPlus,'新增研究项目'],[ClipboardCheck,'伦理申请管理'],[CheckCircle2,'数据质量检查'],[UserCog,'用户权限管理'],[Building2,'中心管理'],[Download,'导出治理报告'],
          ].map(([Icon,label])=><button key={label}><Icon/><span>{label}</span></button>)}</div></Card>
          <Card title="通知公告"><div className="g02-notices">{notices.map(([label,date])=><article key={label}><span>{label}</span><time>{date}</time></article>)}</div></Card>
        </div>
      </section>

      <section className="g02-bottom-row">
        <Card title="用户活跃度"><ActivityChart/></Card>
        <Card title="审计日志（最近记录）"><DataTable compact columns={[{label:'时间'},{label:'用户'},{label:'操作类型'},{label:'操作内容',width:'1.5fr'},{label:'IP 地址'}]} rows={auditRows}/></Card>
        <Card title="系统健康状态"><div className="g02-health">{[
          ['应用服务','正常','99.9%'],['数据库','正常','99.9%'],['文件存储','正常','99.8%'],['AI 服务','正常','99.7%'],['备份服务','正常','100%'],
        ].map(([label,state,rate])=><div key={label}><CheckCircle2/><span>{label}</span><b>{state}</b><em>{rate}</em></div>)}<small>最后检查：2024-09-15 14:35</small></div></Card>
      </section>
    </div>
  </Shell>;
}
