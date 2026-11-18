# 统计与批量审核性能验收

日期：2026-11-13开始，2026-11-14完成本机技术验证。状态：技术验证通过，性能业务结果待用户核对；临床与生产另行验收。

## 实测结果

同一已选抑郁症多模态课题的6例合成来源、54切片、39个非空计算，固定使用已签收更正版根快照。本轮新运行 `full-run-937ad872-cc4e-4e3a-bc8a-aa0fa8b497fb`；原46份答卷/48修订、旧39个运行及原报告保留。

| 项目 | 原基准 | 本轮实际 |
| --- | --- | --- |
| 完整单项计算 | 38次，中位45.418秒，35.967–53.335秒，P95 50.415秒 | 最终版本Node样本13次，中位16.089秒，8.954–18.231秒，P95 18.023秒，中位缩短64.58% |
| 新审核受理 | 一条批量长连接，曾丢失响应，精确完成时间只有观测范围 | 浏览器实际2.080秒受理；返回0/39，不冒充已审核 |
| 审核只读核对 | 原路径逐个复核39个原生回执 | 6次真实GET为2.869–4.422秒，中位3.676秒，不派发审核 |
| 正常续审 | 无可比精确分项基准 | 余37项HTTP各5.290–11.483秒、中位9.429秒，累计327.552秒；全组仍需数分钟 |
| 结果未知 | 前轮人工从原生记录恢复 | 页面刷新只读原次回执，明确继续；计算/审核响应丢失、step404及服务重启均有实际证据 |

初始“稳定10秒内”工程目标**未达到**，13次仅3次低于10秒。不同构建不能拼成同版本39项耗时：stage1先完成24项，最终版本Node完成13项，Chrome完成2项（分别约16.343/21.064秒，浏览器拦截至真实应答墙钟，含1次丢响应）。这两项与Node单调时钟样本分开保存。原审核只知道完成在请求后341.716–561.981秒之间，不据此声称整批审核已获得确定比例的总时长改善。

## 四层验收

| 层次 | 证据与边界 |
| --- | --- |
| 代码实现 | 46唯一文件338/338通过、构建4.60秒；独审两项P2已修复关闭，原生来源/权限/锁/审核与幂等不减弱 |
| 目标配置 | 本机固定19501，最终实测owned PID5072，七服务健康；18份装配/产品源码哈希与stage2一致，旧系统及生产未部署 |
| 真实执行 | 39个新descriptive-v1 Worker结果、39个原生审核；每项create/dispatch/publish/review恰1，40个claim/finished含1个中断后恢复；双角色Chrome及下列真实失败路径通过 |
| 业务结果 | 计算输出与冻结expected一致，界面可见进度并能恢复；性能体验待用户核对。前次整课题模拟签认不替代本次性能签收 |

独立最终oracle：2042项数值、1578项原始修订源检查、1081项额外绑定检查全部0差异，各自计数不相加冒充唯一检查数。39个新ID均不复用旧initial/corrected；根Study/plan/snapshot/hash、逐片basis、分母与配对端点均保持。原39个已签收运行全字段归一后相同；旧36项科学/报告文件、原Word SHA保持，重启后真实下载仍200/22581字节。profile工具是唯一已授权的旧库存文件修改，单列保留。

## 真实中断与恢复

1. 测试客户端在计算中SIGINT，服务继续完成；只读原key回执证明完成，没有重新POST或第二次派发。
2. Chrome真实fetch收到计算完成响应后丢弃，刷新只GET原process回执，再明确继续余项。
3. Chrome丢弃审核受理响应，刷新核对原意图0/39；丢弃第一项原生审核完成响应，刷新专用step回执证明1/39。
4. 下一step在到服务端前abort，刷新得到step404，再GET原parent保留1/39；没有凭parent进度把该step算作成功。
5. 新step的claim/receipt已由独立只读事务看到，尚无对应原生audit/review时，受控中断owned服务。退出与重启后仍无原生凭证；租期内GET显示processing/canContinue=false。租期过后明确新attempt，沿原parent/run/native key只产生1条audit/1条review。四组GET前后claim/events哈希相同。不能据此声称某条原生SQL已开始或数据库事务执行到某一行。
6. 新tab恢复原最小marker，明确一次UI继续完成余37项至39/39；旧未证明attempt归档保留，未伪造其服务端receipt。

科研manager实际可读39项，直接越权POST返回403且无receipt/意图，读取其他actor审核操作也403。管理员五宽1440/1920/1366/390/320及Chrome原生200%通过，表格在自身容器横向滚动，页面无横向溢出；Esc取消无业务POST。来源失效归档UI用单独context注入一次409，明确属于Mock网络故障，真实来源未改，预览只GET；实际后台源失效由两轮真实PG并发回滚另行举证。截图/视频保留，不以构建代替界面验证。

## 仍保留的限制

- 单项尚未稳定低于10秒；批量审核仍需数分钟，当前改进是快速受理、逐项可见和原次恢复，不是即时审核。
- 页面离开停止后续推进，当前请求可能完成；没有后台持续执行承诺。
- 计算claim若始终没有原生终态，只显示未证明/处理中；不自动重启Worker或猜测完成。
- 本轮只验证本机合成案例，不代表真实临床规模或生产性能；未新增邮件或付费模型调用。

## 证据入口

统一根目录：[evidence/full-study-performance-2026-11-13](evidence/full-study-performance-2026-11-13/)。

- [汇总JSON](evidence/full-study-performance-2026-11-13/result.json)、[最终只读API/PG对账](evidence/full-study-performance-2026-11-13/final-readonly/result.json)、[独立oracle与输入副本](evidence/full-study-performance-2026-11-13/oracle/final-independent/README.md)。
- [初段Chrome故障恢复](evidence/full-study-performance-2026-11-13/browser/run-7942f822/manifest.json)、[最终Chrome37步与双角色](evidence/full-study-performance-2026-11-13/browser/final-9761ec92/manifest.json)、[真实重启独评](evidence/full-study-performance-2026-11-13/restart/run-84767c45-8e4c-4922-bb63-042b86a63f40/review.md)。
- `baseline/`冻结原基准；`actual/stage1/`与`actual/stage2/timings-13.json`分层保存；`final-regression/`保存测试/构建/装配哈希。
- `concurrency/run-662a06d2/`及`run-eab5a441/`各12个真实PG强制回滚事务，原生解锁/撤权等待原锁后正确失效，24组表哈希保持。`authorization-http-negative.json`保存真实越权拒绝。

业务体验入口：固定19501的本课题数据分析页，查看最新已完成的性能运行；统计/审核功能范围见[持续规格](../product/full-study-performance-2026-11-13.md)，操作见[使用说明书](../product/使用说明书.md)。
