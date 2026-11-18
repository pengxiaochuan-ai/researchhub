# 访视采集、集中审阅与完成 · 本轮验收

2026-11-16。需求是按[逐按钮方案](../product/visit-capture-review-flow-2026-11-16.md)执行全部VC01–VC09。原阶段仅设计；本轮增加代码、目标19501装配和真实合成执行，不把“开始/继续采集＋提交后衔接”当整套交付。S09仅是现有“访视与数据录入”页面内部编号。

当前：全部VC01–VC09代码及本机19501真实合成技术验证通过；用户业务体验待核，不能标为用户业务验收通过。无生产发布、临床数据、外发邮件或模型调用。[最终10份实际结果与SHA索引](evidence/visit-capture-review-flow-2026-11-16/runtime-final-manifest.json) · [四层交付状态及冻结源码核对](evidence/visit-capture-review-flow-2026-11-16/technical-delivery.json)。

## 范围和原记录保护

只在新独立合成Study `rh-study-1a7303bf-2980-4a5b-999c-a7959d1676eb` 执行，run `rh-visit-qa-d3646f9f`；原表单版本、字段、临床规则、独立审阅政策及原生单项服务复用。没有新DDL/grant、旧系统源代码改造或统计/报告重算。原验收Study只读。

每阶段fresh比较原316笔统计完整行及相关1104审计、48答卷修订、39子快照、36科学文件和原Word。Word为22581字节，SHA-256 `e961a2b57679f1ae9bd40a37bd49c16b268323826b58cc68fef98be208b21bb7`；比较完整行哈希，不只比较数量。保护证据在 [preservation](evidence/visit-capture-review-flow-2026-11-16/preservation/)。凭证、原始会话和邀请令牌仅保存在工作区私有.tmp，不进入文档。

## 已执行验证

| 层/场景 | 实际结果及证据 |
|---|---|
| 原页面基线 | Chrome1440，4业务GET、0业务写，[原截图与录屏](evidence/visit-capture-review-flow-2026-11-16/baseline-77107eb6/) |
| 相关纯测 | 58文件297PASS；[运行清单/哈希](evidence/visit-capture-review-flow-2026-11-16/regression/pure-final.json)与pure-final.log。该数量不代替PG集成 |
| QA保护契约 | 10项纯测通过：显式窗口/独立新scope、旧完整行保护、loopback邮件目标、所有导出runner不能绕过门禁、原生独立登录及/api cookie、xmin错误事务拒绝。与297生产相关纯测分开计数 |
| 新代码独审 | 曾发现1P1/2P2，已修；独立43项纯测通过，无剩余P0/P1/P2，[最终审查与10源码哈希](evidence/visit-capture-review-flow-2026-11-16/independent-review.json) |
| 构建 | pnpm build通过，4.83秒，仅现有chunk大小提示；regression/build-after-review.log |
| 实际PG/API | 六场景：CSV三表与0、独立审核/管理员、他人私有回执拒绝、自审拒绝、更正重核保留完成日期、旧固定ref遇并发更正拒绝、选采0/false不新增门禁、部分处理留2未领取；[网络和结果](evidence/visit-capture-review-flow-2026-11-16/api/result.json)、api/native-proof.json |
| H5原链 | 本机SMTP19506→测试箱19507→实际390 Chrome按原PHQ-9填写提交并刷新回看；[结果](evidence/visit-capture-review-flow-2026-11-16/h5-browser/result.json)。没有调用env.prod外部邮箱，也没有重发既有用户邀请 |
| MAIN页面主链 | 原MAIN明确继续→真实顺序Fang/HAMD/PHQ原题提交并继续→另一reviewer三份手选→一次审核锁定确认→单独完成；实际8次审阅至完成操作，completed/current，console/pageerror/意外原生弹窗均0；[结果](evidence/visit-capture-review-flow-2026-11-16/main-browser-resume/result.json)。未重发首次已成功start |
| 丢响应/重启/刷新/新标签 | 真正advance200后丢弃响应，owned88615→95366；刷新及真正新标签仅GET找回原批次，明确继续仅剩2份；每原成员native review/lock各1次、访视未自动完成、他人回执拒绝；[结果](evidence/visit-capture-review-flow-2026-11-16/recovery-browser-retry/result.json) |
| 真实明确未受理409 | 另一reviewer实际审核后，原create请求不变地送后端，SUMMARY_CHANGED+typed标记、清原pending、无header/自动POST；同owner peer先推进1份后，原旧hash实际BATCH_CHANGED，保留parent、仅GET、显式继续2份；[结果](evidence/visit-capture-review-flow-2026-11-16/rejection-browser-retry/result.json)。无伪响应、无手工marker |
| H5集中审阅与非表单门禁 | 原H5 PHQ答卷不重邀、不换mode/ref/答案；现场补两表，另一reviewer手选三表一次确认审锁。唯一未满足项仍必采tongue，UI无完成按钮，真实complete409 VISIT_REQUIREMENTS_MISSING且原生行/审计不变；[结果](evidence/visit-capture-review-flow-2026-11-16/h5-review-browser/result.json) |
| 一次开始采集 | 另取原未动H5.BASELINE，先GET证明planned/0assignments/首项明确允许现场；用户只点一次“开始采集”，真实start200＋系统assign200进入原Fang表，无填题/提交；[结果](evidence/visit-capture-review-flow-2026-11-16/single-start-browser/result.json)。不将MAIN早先失败与补跑拼成一次成功 |
| 五宽度/原生200% | MAIN记录1440/1920/1366/390/320，正文14/22，documentScrollWidth与innerWidth一致；另补稳态1440和原生200% raw CDP PNG均1440×913，200%=CSS720/DPR2，审阅区域left269/right663.5，0业务POST；[完整截图/metrics](evidence/visit-capture-review-flow-2026-11-16/stable-visual-browser/result.json) |
| 更正及重核UI | 原解锁/更正均只发生一次；原键回执及revision2精确核实后，作者只读查看影响、另一reviewer仅手选新PHQ修订审锁、带原因重新核对；完成日期与旧依据/旧修订保持，新增当前依据；精确S05与历史回看无写，[结果](evidence/visit-capture-review-flow-2026-11-16/correction-browser-resume-9e6f4f0f/result.json) |
| 真实PG事务证明 | 24个成功FINISH、47条原生review/lock审计；同成员FINISH与native审计同xmin，claim/operation同xmin且与FINISH分离；[证明](evidence/visit-capture-review-flow-2026-11-16/atomic-proof/result.json)，查询0业务写 |

独审修复：恢复标记绑定完整身份/访视范围；未受理409只清确属原键的pending，未知/已提交不清；展开与revision变化重新取清单并取消旧选择；集中显示文件等其他必采缺口，定位原文件区。逐份仍复用原权限、CAS/ref、独立审阅、来源及审计。

## 真实页面试跑中的测试夹具问题

MAIN首次“开始采集”实际start HTTP200，但QA将登录cookie注为Path=/，与原生Path=/api不符。页面活动触发真实renew200后出现同名双cookie，原鉴权按既有规则拒绝，后续/auth/me401并返回登录。此时MAIN为in_progress/version1、0 assignments，未写答案；原数据保护通过。首轮failure.json/PNG/WebM保留，不冒称通过。

仅修正QA会话取得/注入方式：每个浏览器使用原生登录的/api cookie，与harness/peer分离，不关闭续期、不改产品鉴权。后续沿原MAIN明确“继续采集”，只做此前未发生的分配/提交，不重发start、不重建对象。表单填写顺序按当前真实formVersion确定，不按脚本假设PHQ先。补跑与独立新访视单次开始路径分开记证。

恢复首轮脚本将pending按钮出现误当实际响应已丢弃，过早退出；只读已核原批次`visit-batch-ddf2ae64-3869-46d6-9a31-9d37c1724e76`仅header/create回执、0claim/0FINISH/0原生执行，保留为失败历史，不冒造恢复标记。修正为等待实际拦截200及丢弃完成，并使用持久浏览器profile后，明确新选同一尚未审锁的三份，完成上表真实恢复；原0执行header与原键不改、不重放。见recovery-browser/failure-readonly-proof.json和recovery-browser-retry/。

409首轮QA更新私有journal误用了首次创建的wx，EEXIST使拦截请求在peer fetch前终止。原键GET404、operation0且peer未审核已另行核定；失败日志保留。只修QA写文件语义，再用新attempt完成上表真实409，未改产品错误分支或伪造服务响应。

更正首轮QA在wire200后立即goto，中断原页面尚在进行的回执及状态核对；新页正确显示原pending并阻止后续按钮。原unlock/correct各一次已通过原collector精确correct回执200、当前ref/version5和完整旧依据只读核实。补跑只执行尚未发生的审锁/reverify，路由明确禁止再次unlock/correct；原失败及前后证据保留，后续QA在实际保存核对提示、busy结束及pending清除后再离页。未改产品阻断规则。

原生200%首版Playwright PNG采集为720宽、内容按DPR2绘制，出现物理视口左半裁切，不作为内容完整证据；保留初版错误图。现已补CDP无clip原始截图及layout metrics并目视核对，集中区能完整换行；没有为截图问题修改产品CSS。既有全局Shell的品牌/搜索区在200%仍有重叠，小屏原浮动导航仍存在；本轮按方案保留Shell，不扩为全站改版，不宣称全页/全站无障碍通过。

## 保留的广域回归失败

前次广域运行320项、318通过、2失败，原日志为regression/combined.log：`protocol-migration-lock-pg.test.mjs`旧夹具未提供现行requestKey/expectedVersion，触发FORM_CAS_REQUIRED；`protocol-migration-preview-pg.test.mjs`旧身份无authVersion，现行鉴权先拒绝。两项均未导入本轮workflow；本轮未修改其旧服务或放松校验以掩盖失败。不是“所有测试全绿”，也不将297纯测等同广域320全部通过。

## 最终状态与使用核对

本轮之后按用户要求完成了[双角色体验走查](visit-two-role-walkthrough-2026-11-16.md)：采集人现场提交三表、另一审阅者集中审锁并独立完访，刷新保持完成。实际各10次主流程按钮操作（分别含重试/交接，口径见报告），权限核对拦截和完访连接提示各增加一次重试，长页定位与角色状态仍有负担。本次新截图与原生审计单独留证，不覆盖上表技术验证；完整流程可完成，但体验未全部通过、用户业务签收仍待核。没有修改生产源代码。

本轮真实执行项均已取得上表证据；最终保护为preservation/fresh-check-c33626ce.json，完整旧行/审计及原件保持；QA10纯测在evidence/visit-capture-review-flow-2026-11-16/qa-pure-final.log留痕。所有本轮Chrome/PG/HTTP已关闭，owned95366七服务ready，共享19501协调已向三个已授权会话解除；根不再占运行窗口。没有提交或部署共享工作区其他改动。

用户可沿[使用说明](../product/使用说明书.md)按采集人→独立审阅者体验新版访视。核对重点为原题填写与下一项衔接、逐份选择及一次确认、最终完成仍独立、缺口与结果未知可恢复；业务体验尚未替用户签收。[实施计划](../planning/visit-capture-review-flow-2026-11-16/implementation-plan.md)区分技术闭环与用户核对。

技术执行与用户专业验收分别记录；本机合成结果不代替临床或生产。没有本次用户专业签收前，不使用“整套业务验收通过”。客户更新中心不适用：本轮是本机开发与受控合成验证，未发布客户版本。
