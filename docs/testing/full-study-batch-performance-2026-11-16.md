# 整课题统计与审核批次性能验收

2026-11-16：本机技术验证通过，业务体验待用户核对；真实临床与生产未验收。本轮仅落实用户选定的批次合并重复来源核验，不扩大后台队列、临床规则、旧源码或生产范围。

## 实测与口径

同一课题6例合成来源、4个逻辑访视、54切片/39非空统计；新运行`full-run-0358f67e-e4d7-4e5f-b861-ed25db601745`，审核操作`full-review-operation-ecc2e46b-e60b-4db7-8534-e9fd617c3c30`。根快照`full-snapshot-9eef3230-bc1b-492f-8c07-0441362f9198`、manifest `8d8cd84115e7cf661f0bf634acc463cd398ee55db6b965750be91411c08846f7`保持。

| 指标 | 本轮结果 |
|---|---|
| 首项单算 | 12.870秒 |
| 12个三项计算批次，共36项 | 每批10.615–12.522秒，中位11.110秒；HTTP累计134.816秒，连续墙钟135.299秒 |
| 最后浏览器两项计算 | 完整请求15.257秒，真实提交丢响应后原key只读找回 |
| 全39项计算提交 | 14次HTTP累计162.943秒，包含上述首项及末批 |
| 审核意图受理 | 2.202秒，此时0/39，并非已审核 |
| 13个三项审核批次，共39项 | 每批6.140–9.805秒，中位7.780秒；HTTP累计102.637秒 |
| 新标签一次继续余36项 | 12批HTTP累计96.140秒，连续墙钟98.281秒 |

所有批次耗时均为等到整批响应的完整等待，未除以3冒称单项延迟。计算尚未稳定达到10秒内，审核未达到每次5秒内的初始目标。

历史基准：最初38个单项中位45.418秒、35.967–53.335秒；前轮最终13个单项样本中位16.089秒。前轮37次审核HTTP累计327.552秒，本轮39次累计102.637秒，累计少68.67%；日期、样本规模和批次形状不同，不能冒称同日同规模随机对照或端到端墙钟减少68.67%。

本次首建至末次计算响应的观察跨度404.971秒，审核意图至最后审核响应跨度541.942秒，包含脚本启动、协调、故障、重启和调试间隙。HTTP累计不含上述请求外等待或恢复GET；正常连续墙钟另列。全部慢样本保留。另一会话03:28:15/03:28:32 UTC各约0.3秒READ ONLY探查不与计算POST区间重叠，未扣减时间。

## 权限、来源与原生证明

每阶段重新核权并取得RLS、稳定任务共享行锁后读取完整根来源；同批同阶段复用证明，各项仍执行原生切片、输入、版本、权限、CAS与审计。证明不跨事务、阶段、身份或请求复用。

实际39运行、39审核、156原生审计（创建/派发/发布/审核每项各1）、14计算claim＋13审核claim、29独立回执及1审核意图核对通过。原生审核小批原子回滚；无终态证明的失败只记attempt_failed，未决批次不能借旧limit1跳过，GET不派发或补写结束记录。

真实PG并发7组、27事务全部回滚，前后24表哈希相等。覆盖任务更新、原生heartbeat/recover/claim生命周期、反向锁序、插入、解锁、撤权。准确边界是准备UPDATE等待及原生生命周期已执行，不把它夸称某个heartbeat语句独自等待，也不外推未测试的真实原始采集Worker。

## 数值与原件

严格终态oracle不带`--pre-review`：2042项数值/绑定、1578项raw48来源、3023项补充root/slice/basis/native/旧117/原件/browser/restart检查均0差异；各套范围可能重叠，不相加冒称唯一覆盖数。冻结expected SHA为`5dc8e1c64146310620d7eac4d954fa1a3aab4c5afd34fab11e868c34b2370d65`。

旧117运行全字段、36科学文件、39子快照保持；新39计算审核前后仅允许审核相关六字段变化。原Word实际HTTP200、22581字节、SHA `e961a2b57679f1ae9bd40a37bd49c16b268323826b58cc68fef98be208b21bb7`，未重生成或替换。

## Chrome与恢复

真实Chrome验证计算/审核意图/首三项审核提交后丢响应，owned服务提交后重启，原key整批GET找回，下一请求未到服务器而404、核对原父进度，新标签恢复最小记录并一次继续余36项。原首三项未再次POST或审核。**只证明提交后重启，不冒称midclaim中断或自动重启Worker。**

五宽1440/1920/1366/390/320、Chrome原生200%（设置2，CSS720/DPR4）、科研人员只读与Esc有证；最终23PNG/7WebM，0pageerror/0意外业务写。统计表沿既有横向滚动，页面无横向溢出。原生200%下既有合成提示长句右侧显示不全，登记为UI已知问题，不宣称所有文本或全站无障碍通过，也不扩展修改既有布局。

部分成员proof为false、来源409预览归档、旧v1 marker按limit1原key捕获是明确标记的UI Mock，未送对应业务POST；真实来源与权限反例来自PG，不能混称真实临床变更。真实404步骤没有claim/receipt，后续新key明确继续。

前三份QA失败轨迹保留：compact投影附加undefined或遗漏executionConfirmed/kind，导致脚本断言失败。产品验证未放宽，也未重复计算/首批审核。最终所有生产validator直接使用实际raw JSON，并独评真实compute POST/GET/review POST和负例。第一笔浏览器计算POST只留序列化compact，不冒称完整raw；同key真实raw GET及未裁剪CLI POST补证。

## 四层与交接

| 层次 | 状态 |
|---|---|
| 代码 | 冻结版本50个唯一测试文件414/414通过，构建4.50秒；独评重要问题闭合。另6项QA检查器与5组raw fixture单列 |
| 本机启用 | 固定19501每批最多3项，22产品源受控重启时未变；PID94703→7017、七服务ready、数据/共享挂载保留 |
| 实际执行 | 39确定性Worker、39原生审核、PG、Chrome与严格oracle通过；UI裁切限制如上 |
| 业务结果 | 性能体验待用户核对；前次整课题签收不替代本轮性能签收 |

无旧系统源码/算法/服务改动，无生产部署、用户邮件、付费模型调用。数据库迁移及客户更新中心正式发布不适用：本轮仅ResearchHub本机技术增量，未合并或正式发布。规格、手册、两个版本记录及Notion同步。验收后共享入口/19501协调已解除，此后PID可能被其他获授权会话更新。

## 证据

根目录`docs/testing/evidence/full-study-batch-performance-2026-11-16/`：

- `measurements.json`、`timing-interference.json`：完整请求、连续墙钟、历史与间隙；`item-lifecycle.json`另存39项创建/派发/发布审计/批次返回时间。最终run.completedAt是审核完成时间，不拿它当计算完成；审计记录时间也不冒称物理提交时钟。
- `regression/combined.json`、`regression/build.log`：当次冻结版测试与构建。
- `source-concurrency/run-77076c48/result.json`：真实PG及回滚哈希。
- `native-audit/final-e1b4d77f/`：完整原生审计、审核、claim/receipt与Word下载。
- `oracle/final-independent/integrity.json`：严格独立终态；`oracle/pre-review-gate.json`是审核前历史。
- `browser/run-6be2b162/manifest.json`、`offline-summary.json`：最终恢复/PNG/WebM；首批提交另见`browser/run-6dee118d/mutation-response-1.json`。
- `postcommit-restart-before.json`、`postcommit-restart-ready.json`、`coordination-release.json`：重启及协调解除。
- [产品规格](../product/full-study-batch-performance-2026-11-16.md) · [技术契约](../technical/full-study-batch-performance-2026-11-16.md)。

## 性能功能范围

本轮覆盖S05统计分析页的整课题计算（组别×访视×量表的描述统计与配对变化）、批量审核、超时或断线后的原批次核对与继续。主要剩余等待在计算与审核；原结果找回及不重复执行已验证。课题创建、数据录入、H5填写没有纳入本轮性能测量，不据此判断其快慢。
