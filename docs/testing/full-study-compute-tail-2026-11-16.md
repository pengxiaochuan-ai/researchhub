# 统计计算长尾验证

状态：2026-11-16，本机合成范围技术验证完成，候选3达到本组预定单次等待<10秒标准。39项新结果仍待审核，无新增业务报告签收；不代表生产、真实临床或长期并发SLA。证据根目录：[full-study-compute-tail-2026-11-16](evidence/full-study-compute-tail-2026-11-16/)。

## 场景与口径

沿已选真实课题的既有六例合成模拟，固定四访视、三量表、48修订、39子快照及同一根来源，不使用患者数据。Study `rh-study-645de1e7-52ea-4aa5-b4d7-c46cab722b25`，根快照 `full-snapshot-9eef3230-bc1b-492f-8c07-0441362f9198`，manifest `8d8cd84115e7cf661f0bf634acc463cd398ee55db6b965750be91411c08846f7`。新组 `full-run-d269ba65-f972-46aa-8c8d-13c74dedf03d`；不写旧277结果，不增审核或修改既有报告。

每次完整HTTP包含权限、来源核验、真实Worker、发布、完成证明及响应；不把批次耗时除以3。首1由CLI实际创建并计算，余38由真实Chrome一次确认后发13个POST；不隐藏首建开销。连续墙钟与HTTP累计分别报告，不将人工/排队间隙计为计算时间。

## 完整请求性能

| 范围 | 候选3实测 |
|---|---:|
| 首项完整HTTP（1项） | 7705.285ms |
| 12次普通三项请求中位 | 8316.947ms |
| 三项请求最小—最大 | 7710.732—9449.411ms |
| 最后两项完整HTTP | 8938.439ms |
| 后续13次HTTP累计（38项） | 109924.791ms |
| 全39项HTTP累计 | 117630.076ms |
| 一次确认余38项至全部可审核 | 112081.400ms |
| 最长可见批次推进 | 9632.800ms |
| 最终fetch开始至可审核 | 8948.000ms |
| 最终响应至DOM可审核 | 9.200ms |

首项和后续13个完整请求、完整资源与可见推进在本组均<10秒。全39项约118秒HTTP累计，不能称整批10秒完成。前轮39项HTTP累计162.943秒、本日旧版181.926秒各保留其测量窗口；候选1首17.669秒/三项中位12.646秒、候选2首11.584秒/中位10.475秒均未达标，不销毁或改写失败证据。

实际请求、各宽PNG/WebM、原13个POST正文与响应：[普通Chrome manifest](evidence/full-study-compute-tail-2026-11-16/browser/after-3-3b24e3e1/manifest.json)。普通宽320/390/1366/1440/1920、原生200%及manager只读均记录；表格允许局部滚动，原200%合成提示裁切留项。无页面异常、控制台错误或非预期网络失败；不是全站UI重验。

## 正确性、审计和真实事务

- [510项相关回归及去重59文件](evidence/full-study-compute-tail-2026-11-16/regression/candidate3-combined.json)，构建通过（4.96秒，仅既有大chunk提示）；后加恢复/xmin QA另12项通过，不混成生产集成执行数。
- [真实锁/失效8个强制回滚事务](evidence/full-study-compute-tail-2026-11-16/locked-metadata-pg/run-eb1f3b32-0e8a-4a01-8b56-0d6bdfcde103/result.json)：入组/访视写、合法撤回及app直接FK写阻塞、同事务撤回重评与保存点后重新取得锁。最终元数据helper摘要绑定实测。
- [处理任务成员3个真实强制回滚事务](evidence/full-study-compute-tail-2026-11-16/task-membership-pg/run-071ebd01-9da2-4849-bea3-5c6914595e0e/result.json)：任务先持subject/project兼容锁后，合法INSERT仍等待来源文件锁；真实blocking pid/55P03及锁释放后重试回读有证。无扩权或持久化任务。
- [首次原生审计](evidence/full-study-compute-tail-2026-11-16/native-audit/after-3/pre-review-28bbe8e2/result.json)：39独立native run、117创建/派发/发布审计、14父领取与14完成、15回执、0人工审核。全部needs_review/pending_review；原277完整行、48修订、39子快照和36科学原件不变。
- [独立数值oracle](evidence/full-study-compute-tail-2026-11-16/oracle/after-3-pre-review-independent/integrity.json)：2003数值＋1578来源＋1093绑定，0差异。预期摘要 `5dc8e1c64146310620d7eac4d954fa1a3aab4c5afd34fab11e868c34b2370d65`；这是审核前数值核验，不是新的报告审核签收。
- [真实PostgreSQL xmin](evidence/full-study-compute-tail-2026-11-16/xmin-proof/after-3/run-0d84ad43-e040-4c1b-ba1b-dcdf64c3c3f4/result.json)：组头、首领取、create/process回执4行同事务；后续13批38条native发布与对应父完成同事务。每项native创建/派发/发布仍不同事务；首项publish与finish仍分别提交。只读app＋原RLS核业务，direct只核合成夹具登记；0HTTP/Worker/业务写。

## 服务重启与原结果只读恢复

测量装配PID24230，计算完成08:20:41 UTC，Chrome关闭08:20:55 UTC；其后观察到PID32233于08:29:38 UTC启动。实际owned命令、key、当前25份统计文件摘要与受保护scope均匹配，配置GET200。[测量装配](evidence/full-study-compute-tail-2026-11-16/runtime-loaded-after-3.json)和[恢复装配](evidence/full-study-compute-tail-2026-11-16/runtime-loaded-after-3-recovery.json)分别保存；本轮恢复验证未主动发起此重启，发起方未确定，不虚构独占主机或重启操作轨迹。

[恢复Chrome](evidence/full-study-compute-tail-2026-11-16/browser/recovery-00ea932c/manifest.json)在新会话内以原实发末批POST重建待核对标记，原页面自动GET核对，原2个run与全部39结果/来源一致，标记清除。manager可按权限读结果，但同key回执GET404，未获得owner证明。业务写请求全部禁止，实际无业务POST；业务请求清单排除认证流量，已核验两个角色的身份。PNG/WebM保留，contexts与本次私有profile已关闭清理。本轮没有故意丢弃真实POST响应，不能把标记重建当实际丢响应实验；前轮丢响应证据另存未复述为本轮执行。

[恢复后原生回查](evidence/full-study-compute-tail-2026-11-16/native-audit/after-3/pre-review-5a35f435/result.json)与[前后完整守恒](evidence/full-study-compute-tail-2026-11-16/recovery-preservation.json)：39行、117审计、29父事件、15回执逐字段相同；旧277行、48修订、39子快照保持，78条Worker dispatch/response未增加。旧Word经当前HTTP重新下载200、22581字节，摘要仍 `e961a2b57679f1ae9bd40a37bd49c16b268323826b58cc68fef98be208b21bb7`。因此核对没有重复计算、补写原生审计或误用新来源。

## 独立请求与计时核对

[请求来源独立核对](evidence/full-study-compute-tail-2026-11-16/oracle/after-3-pre-review-independent/request-provenance-independent/result.json)：209检查0差异；13个实发POST三字段、明确从已装配源码重建的内部首1、外部create原正文，逐一绑定14父claim/receipt digest、固定targets、原始回执及39成员；每次expectedStateHash对应上一实回响应。不声称GET含不存在的requestDigest字段。

[计时独立核对](evidence/full-study-compute-tail-2026-11-16/oracle/after-3-pre-review-independent/timing-independent/result.json)：162检查0差异，按原network responseEnd-requestStart复算完整HTTP，另核DOM可见推进；使用测量PID24230的原证据，不把恢复PID32233替作性能装配。不抹去CLI首1与Chrome续算之间的人工/启动间隙充当全39连续墙钟。

## 四层结论与限制

| 层次 | 当前证据与状态 |
|---|---|
| 代码实现 | 510相关回归、12后加QA、独审无P0/P1/P2；保留原权限/来源/CAS/审计与单项兼容 |
| 目标环境 | 本机19501按冻结25文件装配并真实配置GET200，测量与恢复PID分开；正式部署未做 |
| 真实执行 | 全39新Worker、原页13批POST、真实PG锁/xmin、重启后双角色只读恢复及旧Word下载均有原始证据 |
| 使用标准 | 本组合成数值一致、每次完整请求/可见推进<10秒的约定目标已测得；未新增用户对性能报告或新业务报告的签收 |

未扩大批量、延长超时、跨请求缓存可变来源、关闭权限或删来源检查；没有LLM数值或付费模型调用。原源文件与临床规则、原页面布局/导航、旧系统/DB schema均未修改。未覆盖大样本、多用户并发、生产和真实临床规则验收。

失败与不足也保留：候选1/2完整等待未达标；旧Prisma fluent observer的method duration/settled/pending无效，仅真实async wall与调用计数可用；xmin QA第一次因owner-only夹具表权限42501失败，修正为direct只核夹具、app只读核业务后重跑通过；一次临时Worker阶段名断言写为request，实际是dispatch，修正后守恒核对通过；共享其它AI模块临时缺文件导致status CLI失败，原配置GET/owned服务另核后已恢复。不得用这些早期失败或局部探针冒称性能通过。

产品与用户操作见[持续规格](../product/full-study-compute-tail-2026-11-16.md)及[使用说明书](../product/使用说明书.md)。未提交或合并共享dirty分支；无生产发布，客户更新中心发布不适用。
