# WF08 持久分析任务与原生执行

2026-11-18。本机合成实现与验收；[ADR0014](../decisions/0014-durable-research-analysis.md)为设计依据，[测试报告](../testing/study-workflow-wf08-2026-11-18.md)记录实际结果。生产与临床另验。

## 对外入口

均位于 `/api/research-studies/:studyId/analysis`，沿现有Cookie、Origin、当前Study授权及no-store规则。

| 方法/路径 | 用途 |
|---|---|
| POST `/jobs` | `{requestKey,snapshotId}`，202接纳持久任务，返回原Job与receipt |
| GET `/jobs/:jobId` | 当前授权读者的真实状态、进度、原Run/group链接；不派发计算 |
| GET `/job-receipts/:requestKey` | 原作者/授权版本与意图核对，不新建或补执行 |
| POST `/jobs/:jobId/cancellations` | `{requestKey}`明确停止，原子作废旧代并保存停止receipt；不承诺杀死Python |
| GET `/jobs/:jobId/cancellation-receipts/:requestKey` | 原停止意图只读核定 |

原放行、Native Methods、full group/批次、结果审核、导出合同不替换。固定快照计算不要求再次取得放行权；计算、原来源与算子权限继续逐项重验。authVersion0为合法版本。

## 持久与发布围栏

专用 `rh_analysis.execution_job`，独立consumer及限元数据候选角色，不扫描KnowledgeChatJob或报告导出队列。部署必须显式执行 `app/server/prisma/migrations/20261117154400_research_analysis_execution_job/migration.sql`，启动仅预检；固定迁移SHA为 `d0f27995c5ad289c0db7757123ad3b21b7e59bb82112cc3a815ee857965c0530`。

scope、actor/version、原请求hash、plan/review/snapshot/manifest、算子参考及目标绑定不可变。原键唯一约束不把authVersion纳入key；权限版本变化不能借新版本重用旧意图。

DB时钟租约120秒、心跳20秒、轮询1秒；代际与计算attempt分离，未发布可确定性重试，已发布严格不重算。创建/绑定原Session、Native Run与checkpoint同事务；原生dispatch、publish及失败清理都必须核同一可信租约/代际和最新权限、固定来源。公开JSON不能冒充内部issuer能力。跨进程重启不通过改租约/时钟测试。

full root固定39适用目标、15不适用不计算；首项和后续每批3项沿原生批次回执、claim和逐项审计。重启先结清旧pending，再续未发布。停止保留已发布结果，只结算未完成目标与原claim；旧Worker成功晚到也不能发布或改写新代。权限/来源变化是受阻，不能伪装成有结果或科学失败。

锁顺序保持官方/租户授权→Job→group/claim/source/plan→Session→Run；停止/恢复不绕过当前原生权限。物理HTTP未发布重试不提供恰好一次保证。

## 原页客户端

`analysis-job-session.js`的V2意图与旧V1分离；未知写只核原键，部分成功不重播，账号/版本/Study/URL变化拒迟到。后台轮询不续登录会话、不制造脏输入；真实未保存或写未知仍保护。结果页已有runId不自动发起新计划预检。

接纳完成只按新createKey处理一次，不能因轮询关闭之后的停止确认。辅助编号显示用独立可取消读client；403只影响其提示，401核登录，分析本身权威链不降级。固定快照的当前合法计算人员无需重复放行。

本机实际验收包含两次SIGKILL、原租约到期恢复、真实UI停止及三项迟到200零发布、失权/新计划撤准、两角色多宽/原生200%与81项独立数值复核。旧591队列、科学结果与Word、原全表及前序新增完成行均保护；具体来源、失败和修复见测试最终清单。
