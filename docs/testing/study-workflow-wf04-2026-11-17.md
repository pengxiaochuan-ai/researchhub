# WF04 入组核对测试报告

日期：2026-11-17。WF04 本机合成核心流程已取得代码、目标装配、真实 UI 请求和业务结果证据；最终 native audit 核定 3 新 Subject / 7 参与事件 / 2 入组，12 原子回执对应 24 条本项业务审计。正常三项记录保存加明确入组由四个主动作减为两个，不表示建档、填写或恢复的总点击数。

原390px末项过渡/hover遮挡失败PNG与独评观察保留；根已用新鲜390页面、移开指针、有限动画稳定、侧栏完全收起及按钮左右/中心三点命中只读补证，零业务写、产品/Shell未改。最终独立证据复核通过；本机合成验收完成，文档与Notion同步记录见本项最终清单。临床和生产未验。

## 当前验收结果

| 项目 | 已观察事实 | 状态 |
| --- | --- | --- |
| 目标装配 | 根受控装配 PID 84835 → 30580；前后检查、strict route 只读检查及休眠集合 hash 保留 | 本机目标已有证据 |
| A 管理员 | 原 S03 建档，S04 一次保存三个明确决定/独立依据，再明确入组；真实 enroll 成功响应丢失后严格 GET 核回，未重复入组 | 核心链通过 |
| B 原科研身份 | authVersion=0；先筛选，研究同意真实 200 丢响应；真实 beforeunload 刷新后原 marker/key/hash、未发 eventHash 与起始期限不变；严格 GET 后明确继续数据用途同意，再明确入组 | 分步/恢复链通过 |
| D 不合格 | 仅一条筛选不合格，未写两类同意，未入组 | 负例通过 |
| 输入与键盘 | 真实 quiet GET 500→恢复保输入；有依据无决定阻断；旧撤回确认 Tab/Esc/焦点归还及取消均无业务写 | 原页只读反例有证 |
| 五宽与原生 200% | 1440/1920/1366/390/320 和真实 Chrome 200% 六组测量；新鲜390末项三点命中及14/22补证、原生raw PNG，均零业务写 | 390补证通过；原过渡/hover遮挡失败PNG不覆盖 |
| 审计与保护 | 12 raw DB proofs / 24 业务审计；原 13 Subject、WF01–03、科学资料/Word、旧角色及 155 休眠 job 全行保护 | 最终 native audit 通过 |
| 最终收尾 | 本地具名产品/手册/版本/技术文档同步；独立真实证据终核、Notion 与最终封板 | 独立终核通过；同步记录见本项最终清单 |

## 本项边界与固定资源

本报告仅对应 [WF04 brief](../planning/study-workflow-simplification-2026-11-17/briefs/wf04.md) 与 [原生 API 合同](../planning/study-workflow-simplification-2026-11-17/briefs/wf04-api-contract.md)。沿原 S03 建档、S04“筛选、同意与入组”卡片，集中填写共同日期/签署主体，各条分别明确决定和依据；不默认同意，保存核对记录后仍需单独明确入组。历史、单项更正、撤回和退出保留。

当前固定资源为已有访视 QA Study `rh-study-1a7303bf-2980-4a5b-999c-a7959d1676eb`、Protocol `cmwj36p9c0014lucknwv7enly`、Policy `policy-5eded721-7fb1-46cd-a62b-6e1af1b86a00`，原政策筛选方式为精确 `manual`。仅复用已核可执行的管理员与原科研身份，不修改政策、旧成员、权限、角色、研究组或配额。资源判定见 [brief 的 v2 资源裁定](../planning/study-workflow-simplification-2026-11-17/briefs/wf04.md#真实pg发现与v2验收资源裁定)。

真实 UI 验收预算是最多 **3 create / 7 record / 2 enroll**，均为显式 SYNTHETIC 新 Subject：

| 案例 | 身份与计划 | create 上限 | record 上限 | enroll 上限 | 真实 UI 状态 |
| --- | --- | --- | --- | --- | --- |
| A | 管理员：三项明确记录后单独确认入组 | 1 | 3 | 1 | 原生 UI 已执行；enroll 丢响应后严格 GET 恢复 |
| B | 原科研账号：分步与未知恢复后单独确认入组 | 1 | 3 | 1 | 原生 UI 已执行；同意未知/刷新/严格 GET/明确继续 |
| D | 管理员：仅筛选不合格，保持未入组 | 1 | 1 | 0 | 原生 UI 已执行；零入组 |

PG 六项在物理事务内预测后整笔回滚，另以真实 UI 执行预算核定：恰 3 create / 7 record / 2 enroll，没有借回滚预测充抵真实界面操作。原 13 名合成被试、WF01–03 已验事实、316 runs / 48 修订 / 39 快照 / 36 科学文件 / Word、旧角色及休眠队列均属保护集合；按原 ID/full-row hash 验证，不能随新资源重定义旧集合。原生入组生成批准方案规定的访视/要求和原初始任务；没有模板任务时仍可能有一条原生 `data_capture/open` fallback，不能预断任务数为零，也不自动启动或分配表单。

范围仅本机专用合成环境的软件验证。本项未进行真实患者、临床规则定版、临床效果验证、生产部署、邮件/模型/云调用，不将合成结果表述为临床或生产验收。

## 已有代码与离线验证

| 层次 | 实际证据 | 已观察结果 | 证明范围 |
| --- | --- | --- | --- |
| 原生最小合同 | [native-freeze-v1.json](evidence/study-workflow-simplification-2026-11-17/wf04/native-freeze-v1.json)；`native-cas-proof-green-attempt-04.log` | 37 passed、0 failed；七源冻结 | 原 `expectedLastEventId` CAS、严格原回执与兼容合同；不证明真实 HTTP/UI。 |
| 修复后实现相关合集 | [implementation-freeze-v2.json](evidence/study-workflow-simplification-2026-11-17/wf04/implementation-freeze-v2.json)、[p2-related-v2-attempt01.log](evidence/study-workflow-simplification-2026-11-17/wf04/p2-related-v2-attempt01.log) | 84 passed、0 failed、0 skipped | 包含原生 37 与实际 parent+child hook/event 行为；不是 React DOM 或 Chrome。 |
| 根独立相关合集 | [root-related-v2-attempt01.log](evidence/study-workflow-simplification-2026-11-17/wf04/root-related-v2-attempt01.log) | 105 passed、0 failed、0 skipped | 根的扩大相关回归；不以数量替代业务验收。 |
| 全量前端 | [full-frontend-v2-attempt01.log](evidence/study-workflow-simplification-2026-11-17/wf04/full-frontend-v2-attempt01.log) | 1082 passed、0 failed、1 skipped | 既有 opt-in 跳过单列，不表述为 1083 全通过。 |
| 独立 V2 冻结复核 | [reviewer-freeze-v2.json](evidence/study-workflow-simplification-2026-11-17/wf04/reviewer-freeze-v2.json)、[reviewer-related-v2.log](evidence/study-workflow-simplification-2026-11-17/wf04/reviewer-related-v2.log) | 测试 exit 0、14 源 hash 前后无差异、native 七源不变、补丁匹配 | 离线独立复核；未执行目标 I/O。 |
| 隔离构建 | [p2-build-v2-attempt01.log](evidence/study-workflow-simplification-2026-11-17/wf04/p2-build-v2-attempt01.log) | exit 0，5.15s；输出 `/tmp/researchhub-wf04-p2-build-20261117T064359Z` | 构建可产出；仍有已有 >500kB chunk 警告。不是目标启用证明。 |

V2 全 14 源冻结，V1→V2 只改获准五文件：`ResearchSubjects.jsx`、`EnrollmentCheck.jsx`、`enrollment-check-session.js` 及其 helper/实际组件测试；native 七源、CSS 与 `research-subjects-session.js` 保持冻结 hash。旧 TS 核心、DDL、共享启动器及其他页面未因本修复改动。见 [p2-checks-v2.json](evidence/study-workflow-simplification-2026-11-17/wf04/p2-checks-v2.json)。

## V1 独评发现与 V2 两项 P2 修复

V1 的 79 项相关测试通过后，独评用真实组件/真实 helper 另行复现以下失败。V1 冻结与失败证据保留，不能将 V1 写为最终通过。

1. **P2A：临时读取失败清空未提交输入。** 同 actor/authVersion/Study/Subject/URL 填共同日期、签署主体及 consent evidence，quiet GET 500 后恢复 200，三字段丢空。根因是 `enabled` 被当作身份 binding，网络可用性变化触发 reset。原观察：[reviewer-availability-red-v1.json](evidence/study-workflow-simplification-2026-11-17/wf04/reviewer-availability-red-v1.json)。V2 将稳定 scope 与临时可用性分开；临时不可用只停写保输入，恢复不自动 POST。真实身份/URL 变化仍隔离；已确认 `canExecute=false` 清未提交 draft 并隐藏活跃私有回显。未改变原已提交 scoped 内容的固定隐私期限。
2. **P2B：await SHA 期间到期后仍发空 POST。** 集中 helper 在第二次 hash 中越过期限并清 body，随后仍调用 POST；旧父组件 send 存在同型窗口。原观察：[reviewer-ttl-dispatch-red-v1.json](evidence/study-workflow-simplification-2026-11-17/wf04/reviewer-ttl-dispatch-red-v1.json)。V2 在 await 后、紧邻写前重新核固定 TTL、scope、原 pending/body identity、原 key/hash 和原内容；到期只保 opaque 原恢复线索，不重建正文、不空 POST。已由 timer 转成 tombstone 时不二次 expire 或误删标记。

两项问题以三条正式行为 RED 固化（availability、集中 dispatch TTL、旧 parent send TTL）：[p2-red-v2-attempt02.log](evidence/study-workflow-simplification-2026-11-17/wf04/p2-red-v2-attempt02.log) 为 42 passed / 3 failed；[p2-green-v2-attempt02.log](evidence/study-workflow-simplification-2026-11-17/wf04/p2-green-v2-attempt02.log) 为 47 passed / 0 failed。TTL 测试分别覆盖 timer 已清 body 与仅时钟到期两种情况，并核原 key/hash 仍可严格 GET；补充明确失权清输入、临时 500/恢复不续原 15 分钟期限、不自动续写。

源码与补丁以 [V2 冻结清单](evidence/study-workflow-simplification-2026-11-17/wf04/implementation-freeze-v2.json) 为准；[原 before→V2 累积补丁](evidence/study-workflow-simplification-2026-11-17/wf04/implementation-relative-before-v2.patch) 和 [V1→V2 五文件补丁](evidence/study-workflow-simplification-2026-11-17/wf04/p2-relative-v1-v2.patch) 均留存。V1、原独评失败及中间 attempt 不覆盖。

## 实际 PG 预测与原 v1 失败

### v1 必须保留的失败

[原 v1 PG 批次](evidence/study-workflow-simplification-2026-11-17/wf04/root/pg-all-2026-11-17T06-07-17-793Z-46209/root-result.json) 的首 A record 实际返回 `409 SCREENING_METHOD_UNSUPPORTED`；[A-full 原生结果](evidence/study-workflow-simplification-2026-11-17/wf04/root/pg-all-2026-11-17T06-07-17-793Z-46209/A-full/pg-result.json) 保留失败。原候选 WF03 软件政策使用自由文本 decisionMethod，原 native 只接受精确 `manual`。不能把审核/启用流程通过推为所有临床机制可执行，也不能解释自由文本或修改已批准政策绕过拒绝。

brief 登记该物理事务回滚、外部完整状态/前缀/临时 ID 核 0 业务残留，新增全局 audit 仅自己的认证活动；原失败报告本身不能改写为成功。后续独立接纳既有 `manual` 资源并建立 v2 baseline，原 v1 manifest/baseline/保护集合继续保留。

### v2 六项真实回滚预测

[v2 批次汇总](evidence/study-workflow-simplification-2026-11-17/wf04/root/pg-all-2026-11-17T06-23-48-870Z-b9929/root-result.json) 为 `passed=true`、`persistentBusinessWrites=0`。六项报告均为真实 native-services-in-app-PG，`physicalTransactions=1`、`zeroResidualVerified=true`、旧 scoped 行 full hash 保留；均明确 `HTTPExecuted=false`、`ChromeExecuted=false`，不属于真实页面/HTTP 验收。

| 项目 | 实际原生预测 | 报告 |
| --- | --- | --- |
| A-full | 管理员三记录后单独入组 | [pg-result.json](evidence/study-workflow-simplification-2026-11-17/wf04/root/pg-all-2026-11-17T06-23-48-870Z-b9929/A-full/pg-result.json) |
| B-full | 原科研身份三记录后单独入组，authVersion=0 合法 | [pg-result.json](evidence/study-workflow-simplification-2026-11-17/wf04/root/pg-all-2026-11-17T06-23-48-870Z-b9929/B-full/pg-result.json) |
| D-failed-screening | 筛选不合格；原生 enroll 拒绝、保持未入组 | [pg-result.json](evidence/study-workflow-simplification-2026-11-17/wf04/root/pg-all-2026-11-17T06-23-48-870Z-b9929/D-failed-screening/pg-result.json) |
| A-records-cas | 后到事实使原补缺项 CAS 拒绝，不自动绑定新事实 | [pg-result.json](evidence/study-workflow-simplification-2026-11-17/wf04/root/pg-all-2026-11-17T06-23-48-870Z-b9929/A-records-cas/pg-result.json) |
| A-enroll-cas | ready 之后事实变化使原入组 CAS 拒绝 | [pg-result.json](evidence/study-workflow-simplification-2026-11-17/wf04/root/pg-all-2026-11-17T06-23-48-870Z-b9929/A-enroll-cas/pg-result.json) |
| A-after-record-core-fault | 原 record core 之后故障的 savepoint 回滚，未形成错误回执/残留 | [pg-result.json](evidence/study-workflow-simplification-2026-11-17/wf04/root/pg-all-2026-11-17T06-23-48-870Z-b9929/A-after-record-core-fault/pg-result.json) |

## 目标装配、真实 UI 与最终审计

装配前 [inspection.json](evidence/study-workflow-simplification-2026-11-17/wf04/root/assembly-before-2026-11-17T06-46-03-519Z-56488/inspection.json) 为 PID 84835，装配后 [inspection.json](evidence/study-workflow-simplification-2026-11-17/wf04/root/assembly-after-2026-11-17T06-48-25-229Z-d977b/inspection.json) 为 PID 30580；两次 root-result 均通过且零业务写。前后休眠集合 591 全行的 hash 相同、noQueueRecovery=true；其中原 155 job 不恢复。装配后的 [严格路由只读核查](evidence/study-workflow-simplification-2026-11-17/wf04/root/assembly-after-2026-11-17T06-48-25-229Z-d977b/strict-route-readonly.json) 与后续实际 UI 请求分别证明当前目标服务可用和功能实际执行。

| 真实案例 | 证据 | 已观察结果 |
| --- | --- | --- |
| A 三记录与入组恢复 | [三项一次保存](evidence/study-workflow-simplification-2026-11-17/wf04/root/ui-A-records-2026-11-17T06-50-13-545Z-5628a/root-result.json) · [入组丢响应/严格 GET 恢复](evidence/study-workflow-simplification-2026-11-17/wf04/root/ui-A-enroll-drop-2026-11-17T06-50-37-455Z-da8d9/root-result.json) | 原生三事实分别审计，保存不自动入组；明确 enroll 已成功后只核原回执，不重复入组。 |
| B 科研身份分步 | [先筛选](evidence/study-workflow-simplification-2026-11-17/wf04/root/ui-B-screen-2026-11-17T06-51-31-440Z-558e8/root-result.json) · [同意丢响应](evidence/study-workflow-simplification-2026-11-17/wf04/root/ui-B-consent-drop-2026-11-17T06-51-52-633Z-34097/root-result.json) | 原版本 0 身份有效；研究同意实际 200 后丢响应，未自动写下一条。 |
| B 原 tab 刷新与明确继续 | [刷新 marker 证明](evidence/study-workflow-simplification-2026-11-17/wf04/root/ui-B-consent-drop-2026-11-17T06-51-52-633Z-34097/original-reload-marker-proof.json) · [真实 beforeunload](evidence/study-workflow-simplification-2026-11-17/wf04/root/ui-B-consent-drop-2026-11-17T06-51-52-633Z-34097/real-beforeunload.json) · [明确继续](evidence/study-workflow-simplification-2026-11-17/wf04/root/ui-B-continue-2026-11-17T06-52-21-632Z-ab272/root-result.json) · [明确入组](evidence/study-workflow-simplification-2026-11-17/wf04/root/ui-B-enroll-2026-11-17T06-53-08-302Z-e0b2a/root-result.json) | 无 marker 注入；原 key/hash、未发条目 eventHash、固定期限保留，严格 GET 后须明确继续，最后另行确认入组。 |
| D 筛选不合格 | [最终状态](evidence/study-workflow-simplification-2026-11-17/wf04/root/ui-D-failed-2026-11-17T06-54-35-872Z-d9857/root-result.json) | 只记录筛选失败；不补同意、不入组。 |

[最终 raw DB audit](evidence/study-workflow-simplification-2026-11-17/wf04/root/ui-A-audit-2026-11-17T06-54-57-877Z-fd2e1/database-audit.json) 将 12 个原子 operation/proof 与原 key/hash/目标 Subject、wrapper/core 审计显式联接，本项业务审计总数 **24**；[root-result](evidence/study-workflow-simplification-2026-11-17/wf04/root/ui-A-audit-2026-11-17T06-54-57-877Z-fd2e1/root-result.json) 核 3 create / 7 record / 2 enroll。全局新增 audit 为 90，包含认证活动，不能写为 90 条本项业务审计。保护快照中的 raw proof 标志不替代这份最终逐项 audit。

原生结果净增 3 Subject、7 StudyParticipationEvent、2 StudyEnrollment、2 anchor、4 planned visits、16 missing fulfillments、2 open fallback tasks；零表单分配、零访视/采集启动、零答案。后四类来自原 native 入组规则，不为减少界面动作删掉任务，也不声称已开始采集。原 13 Subject、固定 Protocol/Policy、WF01–03、科学文件与 Word、旧角色和休眠队列全行保护见 [protection.json](evidence/study-workflow-simplification-2026-11-17/wf04/root/ui-A-audit-2026-11-17T06-54-57-877Z-fd2e1/protection.json)。

## 页面可用性与390只读补证

[原视觉批次](evidence/study-workflow-simplification-2026-11-17/wf04/root/visual-2026-11-17T06-53-45-580Z-97037/root-result.json) 记录六组测量、零业务写；[测量](evidence/study-workflow-simplification-2026-11-17/wf04/root/visual-2026-11-17T06-53-45-580Z-97037/measurements.json)、[真实校验/网络恢复](evidence/study-workflow-simplification-2026-11-17/wf04/root/visual-2026-11-17T06-53-45-580Z-97037/validation-and-network.json)、[撤回确认键盘/取消](evidence/study-workflow-simplification-2026-11-17/wf04/root/visual-2026-11-17T06-53-45-580Z-97037/keyboard-cancel.json) 留档。原生 200% 保留 raw CDP PNG，日常操作按 14/22 验证。

独评进一步指出原390px末项PNG有侧栏hover遮挡按钮左侧，center单点hittest不足；common-fields PNG、1920/1366对照正常。根随后完成[新鲜390只读补证](evidence/study-workflow-simplification-2026-11-17/wf04/root/supplement390-2026-11-17T06-59-16-880Z-4d503/root-result.json)：不在本页resize、指针离开侧栏、等待有限动画稳定；[metrics](evidence/study-workflow-simplification-2026-11-17/wf04/root/supplement390-2026-11-17T06-59-16-880Z-4d503/metrics.json)记录侧栏right=0、主按钮14px/22px、左右/中心三个hit均true，零未捕获page错误（补证未单列console明细）、零源码改动。根目视核[末项稳定PNG](evidence/study-workflow-simplification-2026-11-17/wf04/root/supplement390-2026-11-17T06-59-16-880Z-4d503/width-390-last-action-stable.png)完整；整轮零业务写、requireComplete的12预算/旧保护通过。原过渡遮挡失败PNG保留，不倒写为成功，产品/Shell未改。

## 四层验收状态

| 层次 | 当前事实与证据 | 限制/待项 |
| --- | --- | --- |
| 代码已实现 | native 七源、implementation-v2 十四源冻结；native37、实现/独评84、根105、全前端1082/1 skip/0 fail、隔离构建5.15s | V1 两项 P2、三条 RED 与全部 attempt 保留，不倒写 V1 为最终通过。 |
| 目标环境已配置启用 | 根受控装配84835→30580，前后保护及严格路由只读检查有据 | 仅本机专用合成目标；不代表生产装配。 |
| 真实请求实际执行 | 原 UI 发起3建档/7记录/2入组；两类真实丢响应、严格原回执 GET、刷新与明确继续均有据；最终12proofs/24业务审计 | 六PG回滚证据与UI实际请求分列，canonical状态不充原操作证明。 |
| 业务结果达到标准 | 本机合成A/B成功明确入组、D筛选失败不入组；固定政策/历史、原生访视任务与零自动采集/答案符合本项标准 | 390只读补证已通过；独立真实证据终核通过，文档同步记录见最终清单；真实临床/生产未验。 |

WF04独立代码与真实证据终核通过，本机合成验收完成；文档及Notion同步、最终哈希见 `evidence/study-workflow-simplification-2026-11-17/wf04/final-manifest.json`。下一项按序为WF05，后续能力仍分别验收。
