## 2026-11-13 · 当前增量：首版规则已获用户确认

下方为首次合成技术验证时的状态；其中canonical待确认已由本次明确回复解除。新批准配置、旧pending归档及新独立实际请求见[规则确认后复验](study-form-rule-confirmation-2026-11-13.md)。实际临床绑定/启用和整体业务签认仍未完成，旧JSON证据不改写。

# 表5电子计分与PHQ-9：本机合成技术验证

日期：2026-11-13。只覆盖当前用户指定表单功能，不恢复旧19项任务。数据均为新合成样例；无患者数据、外部邮件、模型调用、生产部署、DDL或角色权限修改。

## 四层验收

| 层 | 本轮事实 | 状态 |
| --- | --- | --- |
| 代码 | 纯计分、私有事务适配、来源profile、现场/H5/预览/历史、更正和模式守门；一次独立只读审查无新增发现 | 通过本轮技术核对 |
| 目标启用 | owned本机19501/19502重载，原数据/凭证保留；验证时PID95083，各原服务健康 | 本机通过；非生产 |
| 真实执行 | 实际HTTP+PG、正式revision和哈希、真实Chrome截图/录屏及原生200% | 下列证据通过 |
| 业务结果 | 专业用户未签认；舌脉/不适用策略待异步回复；实际课题/组/PI未绑定 | 待确认，不标临床或整体核心表单定版 |

## 真实请求与数据库

证据根目录：`docs/testing/evidence/study-form-electronic-scoring-2026-11-13/`。

- `http-result.json`：7项PHQ检查。浏览器现场原revision1=12；正常更正revision2=15，旧值/旧hash保持；H5=9；CSV=18及CSV SHA来源/幂等；legacy0/false/null且score=null。非法numeric/select更正400，version/ref不变；5份revision用原verifyFormalRevisionEnvelope重算通过。
- `table5-http-result.json`：独立Study、1被试、1答卷3修订，完整单脉24分且组合满足；N/A时complete=true/scoreComplete=false、total/diagnosis=null；双脉同时有review_required且无总分/标签；3份revision重算通过。该profile的confirmed是显式合成策略，非用户临床批准；canonical hash保持且status=pending。
- `final-check/result.json`：目标HTTP实际返回allowedCaptureModes，表5H5与混合模式均400且未增加方案；管理员实际S11研究者模式、PHQ原文预览和固定旧修订12分、H5已提交会话在服务重载后回看通过。记录最终受影响源文件SHA。

H5邀请使用no-send合成运输回执，明确记录合成来源；不冒称本轮真实邮件投递。token/cookie/本机密码只保留在项目私有.tmp，不进入报告或Notion。

## 浏览器与UI/UE

- `browser/result.json`及PNG/WebM：实际19501现场录入、提交和读回，H5 390/320填写、提交、刷新；无默认选中值，功能题无原件10号，原选项/指导语/致谢回显；提交成功仅一条感谢，无H5诊断反馈。
- `native-browser/result.json`及PNG/WebM：真实Chrome设置zoom=2（outer1440/inner720/DPR2，legend14/22，scrollWidth720），H5键盘radio、清空、必填不发请求、填写后清本地缺项提示、Esc取消保输入、单次提交；表5三份固定历史显示源标签及服务端状态/组合。
- `final-check/`：管理员预览、H5已提交重载及固定历史PNG/WebM。表5图片已定位历史区，避免只截到页面上半部。
- 组件夹具补充：前端PHQ 1440/H5 390/320/768及原生200%；表5六状态1440/390、渠道限制和旧不兼容值显式改选。它们独立于真实HTTP/PG证据，未冒称真实患者结果。

受影响消费者：CaptureAssignment、CaptureHistory、QuestionnaireH5、FormalPreparation；共用CaptureFields、ReadAnswers、原Button和ConfirmDialog，Shell/导航/既有布局框架不改。无默认浏览器业务确认框；beforeunload保护保留。管理员共用实际租户权限和同页流程，未改权限或绕过当前身份。

## 单元、构建与审查

- 后端采集59项：`node --test server/research-capture/{form-policy,form-core-adapter,fang-table5-policy,source-profiles,h5-controller,formal-capture,imports,import-csv}.test.mjs`通过；含实际旧writer函数执行但事务替身，另用上列真实PG证明持久结果。
- 方案/模式13项：`node --test server/research-execution/forms-mode.test.mjs server/research-execution/protocols.test.mjs`通过；controller/H5本机适配另2项通过。
- 前端定向40项通过，最新隔离Vite构建9.56秒通过；既有>500kB chunk警告保留。
- 最新全量前端627项中626通过，`tests/research-assets-read-boundary.test.mjs:10`因并行资产模块hook断言失败；本轮未改该模块，不据此宣称全仓全绿，也未为过测试扩大修改。精确日志和文件patch/hash见前端交接包。
- 一次独立只读总审无新增阻断/重要/轻微发现；包含补充模式守门和末次前端hash，未追加第二轮独审。

组件/后端日志、patch、hash和补充PNG/WebM已归档：`docs/testing/evidence/study-form-electronic-scoring-2026-11-13/implementation/{phq9-frontend,backend}/`；本报告汇总实际结果，不累加重叠测试数量。

## 保留的失败与修正

真实浏览器脚本首次焦点断言先于RAF、测试Cookie误设`/`导致续期后重复Cookie401、误读POST wrapper.result而中断；分别修正测试等候、测试Cookie `/api`和响应契约，保留initial-*失败/截图/视频。现场提交200已生效后只读取既有结果续验，没有重复提交。原生H5200%阶段已通过，表5整块文本断言误将合成更正原因中的not_applicable当答案代码，改为检查答案区域，分段证据保留。最后只读检查脚本混用Node Fetch status属性/Playwright status()方法也已修正；没有因此改产品认证或放松源标签校验。

组件浏览器发现的真实提示问题已修复：全部有效答案填完后，清除那一条本地必填提示，保留网络/服务错误。没有用隐藏失败代替恢复。

## 未验与后续

临床策略尚待用户确认；合成confirmed不会写回canonical或真实Study。HAMD特殊缺失/原五主症计分、真实课题身份/完整SAP/用途同意和专业签认仍未完成。本轮不放开真实临床分析，satisfied仅指答卷留存，不能替代scoreComplete/有效研究标签。客户更新中心本轮不发布，原因是尚属内部合成技术验证而非已验收客户发布批次。

## 协调解除后的只读复核

共享入口协调解除后，并行会话追加了controller/local-knowledge装配并重载为PID98184；本轮专属计分/展示/模式文件哈希保持，现场/CSV私有writer和H5接线仍在。`shared-entry-readback.json`记录当前5个只读真实请求通过：两类候选模式、现场更正后15分、表5双脉无总分状态、H5已提交及原文选项/指导语。验证时完整哈希与后续两个共享文件差异分别留痕，未重启/重跑其他会话功能，也不将其新增能力列入本轮交付。
