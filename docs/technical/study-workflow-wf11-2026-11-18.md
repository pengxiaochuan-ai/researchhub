# WF11 · 更正影响与重新交付契约

2026-11-18。只读元数据与S09原页引导；不增加写状态机、数据库表或统计计算。目标与业务验收结果以同日测试记录为准。

## API与权限

GET `/research-studies/:id/assignments/:assignmentId/correction-impact`。query仅`kind=analysis|report`、`limit=1..100`、`cursor`，默认analysis/20。控制器统一no-store，原Study事务、F01准入、RLS及原生表单/访视读取均保持。当前身份验证包含合法authVersion=0；分析元数据要求现行data.analyze，报告元数据要求artifacts与artifact.read，权限值必须为数组。无权域返回restricted、空items、null cursor，不返回标题或数量。

结果`correction-impact-v1`包含当前ref/responseVersion、锁定/审阅状态、访视完成依据、两类读取权限及本页items/nextCursor。analysis项为根snapshotId、planId、分支、固定日期、来源变化及关联运行记录数；report项增加artifactId/title/status/versionNo。没有答案、评分、数值结果、正文manifest或文件存储地址。

## 来源图与一致性

`rh_analysis.snapshot`按原租户/组/执行研究/Study过滤；仅普通formal根或整课题simulation根，使用JSONPath关联assignment。只提取cell.source内ref/responseVersion，比较当前修订；整课题切片仍受原根来源守门。报告从当前固定版本的data_snapshot来源精确关联，限制原正式报告前缀。运行记录数由同Scope/Study且属于原根或子快照的MethodRun计数，不是新的研究统计。

analysis/report分别按ID分页，签名cursor绑定当前actor/authVersion/Study/assignment/kind与当前ref/version摘要；更正后旧cursor拒绝。列表组装后再次读取原生当前表单，期间版本或ref变化则409 CORRECTION_IMPACT_CHANGED，不返回混合来源列表。相同ref不代表其它政策、授权、访视或来源有效，所有原执行入口仍重新核验。

## 交互与责任

当前表单“更正影响与重新交付”按需读取。新修订仍待审阅/锁定或访视完成依据待核时默认展开；其余日常流程不强制进入。当前表单、完成依据、新分析、新报告按顺序说明；同一分析计划合并一个入口，已有引用当前修订的发布记录时先核对现有交付有效性，不要求重做全部历史。

旧报告日期、状态、固定内容与审计不更写。来源变化时显示旧交付失效，原报告/文件读取服务继续阻断；不会自动代审、重放计算、放行或发布。原页入口携Study与计划，去掉旧snapshot，不让用户重复选研究。焦点可见性只在本项区处理，不改变Frozen Shell；异步结果绑定当前scope，离页/身份/修订变化丢弃旧读，失败清除旧清单并提供明确只读重试。

## 验证

相关单元/组件/原采集/Word回归49项通过；真实PG fixture整体回滚，普通实际来源与整课题来源结构、两类报告关联、更正失效、权限和cursor有证。整课题PG行仅元数据结构fixture，不称实际整课题计算；目标本机另用既有两套真实合成记录验证。双身份/六宽/当前原生200%、旧报告与文件实际阻断、现有有效交付往返、500恢复与真实换身份迟到丢弃均有证。无真实患者、外发、模型或云资源。详细结果见[验收记录](../testing/study-workflow-wf11-2026-11-18.md)。
