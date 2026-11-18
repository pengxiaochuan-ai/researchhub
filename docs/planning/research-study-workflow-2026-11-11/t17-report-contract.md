# T17 · 固定统计报告、人工审阅与受控文件契约

2026-11-12。对应已授权 T17；本文件先于实现。当前只针对 T15 允许的三人通用合成研究。代码、目标装配、真实执行、专业业务签收分层记录；不因单元/回滚 PG 通过声称报告已交付。UI、共享 Controller、runtime、T15/T16 源码及 Notion 同步由主循环集成，本子任务不改。

## 核实的复用与缺口

| 项 | 直接复用 | 必须适配/新增 |
| --- | --- | --- |
| 产物 | public ResearchArtifact / Version / Source / Review 的原表、既有状态转换、只追加版本模型 | 正式报告 ID 使用 `rh-formal-report-` 私有命名段；固定 Run、完整 AnalysisBasis 与正文摘要的确定性映射 |
| 旧服务 | ResearchArtifactsService 的来源/版本/审核/导出模型及既有 helper 源码 | 旧 `analysis_report` 完整性只认唯一 data_analysis_query，不假称可直接调用；旧通用路径须拒绝正式命名段，防绕过 T15 |
| 导出 | ResearchArtifactExportJob / File、worker-claim 的 claim/heartbeat/assertLiveClaim/recoverExpiredClaim、renderResearchArtifact、artifactExportFilename | 正式队列按真实请求者与原 authVersion、当前 Study/basis/审阅状态重新授权；不走旧只检查产物状态的授权路径 |
| 存储 | StorageService.put/statObject/getBuffer/remove | 随机独占 key，生成后重读校验 SHA-256；发布及下载前重验，文件不使用可绕过当前授权的预签名链接 |
| 幂等 | rh_research.operation、实际 actor、同键请求锁、审计 | create/review/release/export 的结果与审计同事务；原回执 GET 不创建、不重发，404 仍未知 |

不新增表、字段或枚举，不执行 DDL。sourceType 复用 `research_method_run` 与 `data_snapshot`；snapshot 明示 schema，不把 JSON 中仅塞 ID 当已实现。报告不作为会话 Artifact，也不自动公开/共享或创建 Asset。

## 服务接口和注入

`createT17Reports({studies,analysis,storage,load,deploymentScope})`；load 必须装配现有 TS helper，analysis 必须是真实 T15 `assertCurrent`，studies 为当前正式 Study 事务包装。storage 必须是真实 StorageService；缺失/不可用导出明确 503，不能排队后假成功。运行时显式调用 `processExport(user,studyId,jobId)` 或 `resume`，不能默认关闭核心能力后静默跳过。

- `create(user,studyId,{requestKey,runId,title?})`：只认已人工 confirmed/completed 的 descriptive-statistics Run，核其固定 basis 与实际 outputs/numericEvidence 一致；服务端模板复制 Worker 结果，不计算/补数、不调用 LLM。创建不可覆盖 v1 并提交 in_review。更正后的新 Run 生成新固定报告，旧报告留存且受当前依据限制。
- `list/read`：分页/限定上限；当前失效只给 blocked 元数据，不返回旧正文、数值或来源细节。详情当前可用时给固定正文、版本、真实审核记录及文件摘要。
- `review(...,{requestKey,versionNo,decision,reason})`：当前 artifact.review 或租户管理员，decision approved/changes_requested；身份与理由来自实际账号及输入。状态 CAS，写真实 Review，审核不自动发布。
- `release(...,{requestKey,versionNo,reason})`：当前 artifact.release 或租户管理员，只有已批准固定当前版；同事务核正文/来源与当前 basis，更新 released。
- `export(...,{requestKey,versionNo,format})`：当前 artifact.export 或租户管理员、实际启用 research-artifact-export，限定已发布正式版及 docx/pdf/markdown；保存真实 queued job 与原 authVersion 审计。
- `readExport/processExport/download`：当前身份/Study、固定版/来源/审阅完整性与 T15 phase=export 均重验。claim 与发布事务分别复查；生成和存储发生事务外；发布前再核并受 claim CAS。下载读取真实私有对象并核 SHA 后最终重验。来源失效保留历史、拒绝交付。
- `receipt(...,key,{action,targetId})`：只恢复同 actor/Study/动作/目标原结果，重新验证其报告/导出当前条件；不返回正文/原始答案/链接凭证。

## 锁与兼容

所有当前检查在 Study wrapper 的授权事务中依次执行 T15（授权→plan→protocol→sorted subjects）后锁 Run、Artifact、Job；不在持有 Artifact/Job 锁后反向获取来源锁。异步 worker 保留原请求 authVersion，禁止撤权后由新的管理员身份代跑。通用旧 worker 排除正式报告，避免两条 worker 竞争发布；普通旧产物逻辑保持。

模板只含合成标识、研究统计单位、实际 Run/算子版本、变量统计与逐项 JSON 路径/数值证据，不导出患者行数据、邮箱或邀请 token。null 写“不可估计/未提供”，不变 0；0 与 false 不丢失。不称报告审批等于临床结论确认。

## 验收待办

先 RED→GREEN 单元覆盖模板来源、0/null、数值路径不符、状态/权限/同键及导出配置；真实受保护回滚 PG 覆盖产物/版本/来源/审核/回执事务、来源/同意/身份失效、故障回滚与旧路径拒绝。主循环随后完成实际 Methods→Worker Run、真实 Storage 与生成可打开文件、正式 HTTP、S10/A01/A02/G01 的串行浏览器和业务核对。未完成部分保持未验收，不用测试数替代。

## 直接消费者封口（实施中）

主循环追加明确核对 P01 与 A01/A02/G01 旁路。P01 `my-research-overview` 当前已限定 draft，仍显式排除正式 ID 段，避免将来状态扩展后把报告 contentBlocks 当草稿。`local-synthetic-assets` 只认 research_report/draft/自身 idempotency prefix/ASSET_MARKER；`local-crf-method-assets` 同样限制 research_report/draft/CRF_ASSET_PREFIX、授权 sourceRoots 和 seal；两者读版本前先读受限 Artifact，当前 analysis_report/in_review/released 正式报告均不命中。对应报告消费者另有 data_quality_report/draft/各自 prefix，任务 evidence 只认 protocol_draft/research_report/data_quality_report draft，任务 synthetic link 还核固定 EDC marker，不能读取正式统计报告。以上是源码边界，后续仍用真实 API 反例验证，不把静态核对当业务验收。

旧 ResearchArtifactsService 通用列表排除正式段，详情/版本/更新/审核/发布/导出状态/文件下载及 generic worker 拒绝正式段；正式列表逐报告阻断，只留 id/title/status/version/time 等元数据，不因单个失效来源使整列表失败。未将旧私人资产候选变成正式 Asset，也未改 A01/A02/G01 布局。
# 本机 API 装配补充（2026-11-12）

原操作回执与相同请求键回放始终重验该动作的当前权限：create/review/release/export分别对应artifact.create/review/release/export；只保留读取权不能继续查询已撤销动作的原回执。真实固定详情读取仍按artifact.read，来源与用途均在同一事务重验。

沿用同一 Study wrapper 和 T15 当前依据服务，挂接 `/research-studies/:id/analysis/reports` 的创建/列表/固定详情/审阅/发布/导出，以及原操作回执、导出任务状态和受控文件下载。导出创建事务提交后在请求外层调用实际 `processExport`，真实 claim、当前依据和存储读回守门仍生效；GET 只读，不启动或重排任务。显式恢复接口仅处理原用户最多20个 queued，过期 rendering 标记失败，不重新执行。正式运行实例仅在 owned 合成租户范围启用该专用消费者，不启动旧通用队列扫描。

本机 src 装配先提供已验证 DOCX 和 Markdown；PDF 缺相邻编译 worker 时明确503且不创建导出任务，不给出假成功。页面本阶段提供 DOCX。下载返回带文件名/MIME和摘要的受控二进制响应，禁止暴露存储 key/直接 URL。HTTP/真实 Methods 来源与页面仍需后续实测，不因本补充标 T17 完成。


### S10 当前动作权限与 DOCX 服务状态

正式 list/read 在当前 Study 授权事务返回顶层 `capabilities:{canCreate,canReview,canRelease,canExport}`，分别调用既有 `artifact.create/review/release/export` 当前 permission 规则；只把明确 `REPORT_FORBIDDEN` 映射 false，身份撤销或其他错误继续失败。list仍先核 artifact.read，详情仍核当前报告与来源，阻断项目不暴露正文。`docxExportStatus:'available'|'unavailable'` 独立表示当前私有存储可用、导出worker已启用并允许当前租户；动作权限不代表报告状态、来源、审批或服务可执行。只读能力不改变持久版本/摘要、写入口或回执；界面用DOCX，PDF不新增能力。
