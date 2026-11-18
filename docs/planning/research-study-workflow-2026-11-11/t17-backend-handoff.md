# T17 后端实施交接（未作整项验收）

2026-11-12。主循环已授权 T17 子任务；仅实现后端与必要旧消费者封口，未修改 UI、共享 Controller、runtime、T15/T16 代码或业务配置，未执行迁移、模型调用或发信。本次无 schema 改动。

## 实际注入和路由建议

```js
const reports = createT17Reports({
  studies: actualResearchStudiesService,
  analysis: actualT15AnalysisService,
  storage: actualStorageService,
  load: existingTsModuleLoader,
  deploymentScope: actualDeploymentScope,
});
```

`deploymentScope` 必须真实允许当前 tenant 并启用 `research-artifact-export`；`StorageService.available` 必须为 true。不另导入旧 AppModule，不启动 generic Artifacts 历史扫描，不传永远允许的 basis/permission/storage 替身。现有 T15 本机合成 Study allowlist 继续生效，不声称临床通用。

公开方法：`create(user,studyId,{requestKey,runId,title?})`、`list(user,studyId)`、`read(user,studyId,artifactId)`、`review(...,{requestKey,versionNo:1,decision:'approved'|'changes_requested',reason})`、`release(...,{requestKey,versionNo:1,reason})`、`export(...,{requestKey,versionNo:1,format:'docx'|'pdf'|'markdown'})`、`readExport(user,studyId,jobId)`、`download(user,studyId,jobId)`、`receipt(user,studyId,key,{action,targetId})`。动作前缀为 `analysis.report.create|review|release|export`；创建 receipt target 是 runId，其他是 artifactId。回执仅原 actor，404 仍未知。`download` 返回受控 Buffer/文件摘要，不给直接存储 key 或预签名 URL。

导出创建事务提交后，由 runtime 调用 `processExport(originalUser,studyId,jobId)`；不能在创建事务未提交时消费。实际消费者沿现 `claim/heartbeat/assertLiveClaim`，先出队重验、生成前重验、存储前重验、发布前重验；回读私有对象并核 SHA。错误不自动重排，提交确认丢失不删可能已经发布的对象。`resume(user,studyId)` 有界处理本人 queued，先用真实 `recoverExpiredClaim` 把最多20个过期 rendering 标为 interrupted/failed，不重排；再最多20个 queued 逐项当前检查。原请求 authVersion 固定在审计，换新身份不能代跑旧任务。根运行时还须实际启用/调度，工厂本身不会假装已经消费。

## 固定来源与版本语义

正文只复制已 completed/confirmed 的真实 descriptive-statistics Run 的 outputs，逐项核对 numericEvidence 同路径同值和 manifestHash，另核真实最新 MethodReview confirmed 且有意见。T15 当前完整依据在同一事务重验，之后锁 Run/Artifact/Job；报告 Source 复用 research_method_run/data_snapshot，校验完整快照/摘要和确定性模板，不能靠 ID 猜测来源。

当前报告 v1 固定、无自由数值/正文编辑；创建即进入待审，报告审阅、发布、导出分别显式执行。更正后的新 Run 产生新报告，旧报告保留并按当前依据阻断，不覆盖旧版。真实报告 Review 使用当前账号、roleKey、理由；发布及导出还核批准记录和固定版。未自动创建正式 Asset、公开共享或输出患者行数据。S10/A01/A02/G01 的页面/入口及完整版本体验需主循环继续串行完成。

正式 list 最新50项，单个来源失效只给 blocked 元数据，不返正文/数值，不导致全列表失败。相同已锁 Run/快照的 T15 重验仅在该次只读事务内复用，跨请求和写操作不缓存允许状态。

## 旧路径兼容和装配

`rh-formal-report-` 是服务端生成 ID 段；旧 ResearchArtifactsService 的通用列表排除，详情/版本/元数据改写/审核/发布/导出状态/文件内容拒绝，generic export 队列排除，generic worker-authorization 额外拒绝。普通旧 ID 逻辑不变。P01 草稿读取也显式排除。旧 SyntheticAssets/CrfMethodAssets/报告/task evidence 均另受 type、draft、自身 idempotency prefix、父对象及 marker 校验，正式 analysis_report 不命中；尚需目标 API 反例，静态核对不是 UI 验收。

旧 PDF renderer 使用相邻编译产物 `research-artifact-pdf.worker.js`。直接从 src/ts-node 调用 PDF 会 MODULE_NOT_FOUND，已如实记录；本次独立 tsc 到 `/Users/mac/aisciencesys/.tmp/t17-server-build` 后，真实 worker PDF、DOCX 及完整旧回归63/63通过。正式运行包须携带编译 worker 并正确解析 app/server 依赖；未验证的 src-only runtime 不应把 PDF 当已启用。T17 真实 PG/MinIO 本次实测格式为 DOCX；默认可先交付这个已验证格式。

## 验证与边界

- 模板/在途导出/提交确认丢失/下载后置重验/过期 claim/首页旁路18项通过，原始 TAP 见 `docs/testing/evidence/research-t17-2026-11-12/final-unit-overview.tap`。
- 受保护 `wp01_test_full_baseline` 的真实新 fixture：T15真实答卷→审阅锁定→计划放行快照；**Method Run 是明确 test-only completed fixture，未冒充 Methods/Worker 已执行**。正式报告/Source/版本/Review/Release/Export/回执均真实 SQL，审计故障 SAVEPOINT 后0产物；同键不重复；真实 member researcher 可读、无 create/review 权拒绝；authVersion不符拒绝；同意撤回后详情/文件/回执阻断、列表 blocked；历史 file 保留。全部 PG 行最终回滚。
- 真实现有 StorageService/MinIO put→getBuffer→SHA校验→受控下载与现 DOCX Packer 真二进制通过；DOCX ZIP及 document.xml 包含固定指标/来源路径。保护测试的精确私有对象在回滚后清理。本机证据 DOCX 是通用合成测试产物，不是已交付业务报告。
- noEmit 通过；隔离构建通过；旧 Artifacts + worker 授权63/63通过。源码 ts-node 旧 PDF 测试曾62/63，原因是编译 worker 缺失，未改旧源文件绕过 worker 后冒称通过。

真实 Methods→Worker→Run→方法人工确认→本服务→19501 HTTP→S10及资产/治理完整角色浏览器→实际文件交付尚由主循环接续。生产、真实临床、专业用户签收均未完成。Notion、living spec、使用说明书和版本记录由主循环统一同期更新，本文不把后端局部实现标为 T17 完成。
