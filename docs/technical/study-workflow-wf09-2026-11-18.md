# WF09 · 报告预览接口与保存契约

2026-11-18，本机合成代码/配置/真实执行/既定业务结果已核。目标19501证据见本项验收记录；临床和生产未验。

## 现有服务复用

`createT17Reports`共用普通`currentRun/buildT17Report`与整课题`readSource/buildFullStudyReport`。预览不新增数据模型、统计方法、数值、文件或后台作业。标准研究read、报告read、账号/租户/authVersion、分析确认、方案/同意/来源重核仍从原事务执行。整课题服务通过原`dispatchStudyService`按Study精确分流，无额外启动注册。

## API

`GET /api/research-studies/:studyId/analysis/report-preview?runId=:runId`

整课题对应`?runGroupId=:runGroupId`。各服务只接受自身唯一selector；混合、重复数组、空值、额外参数或错误格式400。不自动选择最近运行或最近报告。

200字段：`studyId,status:"preview",title,contentMd,contentHash,sourceSnapshotHash,previewHash,runId|runGroupId,snapshotId,capabilities,docxExportStatus`。Cache-Control为no-store。正文不含受试者个体行；来源附录与合成数据标识保留。

`previewHash = SHA256(studyId + "\n" + sourceField + "\n" + sourceId + "\n" + contentHash + "\n" + sourceSnapshotHash)`。客户端校验正文SHA及摘要组合、精确selector和响应字段后展示。来源被撤回/失效、未确认、跨研究或失权时沿原错误码拒绝，客户端清旧正文，保留当前分析返回路径。

原`POST .../analysis/reports`增加可选`previewHash`。当前UI总是携带；服务端事务重新核源并构建默认预览后比对，变化返回409 `REPORT_PREVIEW_CHANGED`，不创建报告/版本/来源/回执/业务审计。合法可选标题沿原构建器保存，不接受客户端正文。旧调用不传摘要仍按原完整核源契约处理，原回执/原键语义不变。

## 前端与责任

普通S06/整课题S05原报告链接携带同一分析到S10。S10先GET预览，保存明确进入待审核；审核、发布、文件生成/下载和资产登记仍各自授权。只读研究者有报告read及原分析访问权时能看预览，无create不能保存；无报告read明确拒绝，不加角色权限兜底。管理员也核来源/状态。

读取和刷新不创建报告或导出任务；未知保存仅原键GET回执核对，不重放。原authVersion=0、身份/Study迟到丢弃、标题与理由防丢失保持。确认签名增加previewHash，相同来源轮询不关闭确认；来源变化关闭旧确认。WF10尚未实施，不把原生成Word/下载两步写成已合并。

## 验证边界

离线行为RED、后端/组件/路由/内容及受限QA工具测试见`docs/testing/evidence/study-workflow-simplification-2026-11-17/wf09/`。目标窗口释放后才执行实际PG回滚、19501双角色及多宽/原生200%、截图录屏和旧对象保护。新建上限两份合成报告（普通/整课题各一），0新计算/快照/导出；不更改旧角色和报告，不外发邮件，不调用模型/生产/临床数据。

## 真实确认并发修复

`send`遇仅只读reader时，invalidate并清reader，再保原写marker、递增epoch、重新验身份并原生提交；旧读的完成/错误均不能覆盖当前写结果。不因为轮询让用户已确认操作悄然不发，也不降低任何server核验。只读路径、JSX/CSS及其余源不变。V2单源变动保留原before/runtime/预算；原整课题零准入经过全旧行原生核定才允许本预算内一次新明确确认。实际在途GET被取消，唯一POST丢已提交响应并刷新后仅GET原键恢复；普通已成功操作未重播。[四层与证据](../testing/study-workflow-wf09-2026-11-18.md)。
