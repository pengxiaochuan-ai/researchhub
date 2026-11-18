# WP06 C06–C09本机技术交接（AC10待用户专业验收）

当前请求：原累计5元内继续C06及后续合成AI验证，当前目录串行＋唯一C09独立总评审；原两个账号、当前Study、本人新包/报告。此文不是生产发布、专业签收或一期验收结论。

## 当前结论

C01–C09本机技术项已实施和复测。唯一独立代码评审为0确认Critical、5Important、2Minor，原结论“请求修改”保留；主实施者逐项补反例、最小修补、实际复验后关闭七项，没有独立复签。AC10仍需用户用未预运行样例判断专业适用性，不能用下列门禁数量代替。

最后真实体验为`c09-experience-resume-b6ecb907`，一次原Agent/Provider调用成功，当前解释、原会话state/原引用及实际报告/notes均有效，重载不重放。当前费用75笔known、¥1.464417/¥5，余¥3.535583，held0；本轮较原63笔新增12笔¥0.217602，含3笔未交付费用，非供应商最终账单。下方74笔与评审中为过程历史。

### C09修补复验

最终门禁`free-gates-23e717ba`：266/266组合测试、1054/1054原内核、构建、保护基线、空白检查五门通过；75笔账本在免费检查期间逐字节不变，原691源码/Schema/角色/32表16985条保护历史行及旧8进程保持。最终两账号报告API`edc-report-143b7981`、真实Chrome`browser-report-a63e8a97`通过；原消息/报告撤权与logout迟到读取`read-fences-9b38a70d`保持。本机PID44709的7服务ready，未重启/停止旧服务。保留既有Node和Vite警告。

| 问题 | 最小改动与实际证据 |
| --- | --- |
| I01确认串版 | revision/hash双绑定，实际另一页改值后必须重确认；`c09-ack-5ea83895` |
| I02慢分页/丢页 | 列表仅手动刷新，分页/刷新单飞；真实>20项、延迟6.5秒，`c09-pagination-41981868` |
| I03历史复活 | 历史事实与head freshness分开；精确既存真实AI旧版仍stale，`c09-api-history-c0a29dec`；最终体验覆盖仅元数据变化仍有效但historical |
| I04注入未命中 | 新具名包实际PG命中和故意不命中均事务内abort，`atomicity-9290e167`；队列/报告`atomic-submission-db61da2b` |
| I05慢报告轮询 | 实际200延迟6.5秒跨5秒timer仍显示新版本，`c09-report-981805cd` |
| M01无变化幂等 | 明确422、不消费key；成功写后同键幂等、异输入409，`c09-api-notes-ef2a537b` |
| M02旧提示 | 质控页已说明报告草稿入口和只读机器事实，不再显示未接通 |

当前可体验（合成科研人员账号）：[本人合成记录与AI报告](http://127.0.0.1:19501/pages/s05/?syntheticCapture=1&studyGroupId=rh-kb-local-b0e2af9d-group&researchProjectId=rh-kb-local-b0e2af9d-project&researchPlanId=cmvku2pp90024lusa277s10nh&collectionId=cmvnaf4sg001oluhxf846d0xq)。原管理员账号不能读取该私有包，应从本人研究准备建立自己的新包。体验账号见本机私有`/Users/mac/aisciencesys/.tmp/researchhub-knowledge-local/体验账号.txt`，文档不复制凭证。

## 四层状态

| 层次 | 当前证据/限制 |
| --- | --- |
| 代码实现 | 原Queue/Orchestrator/KbTools/Provider第四互斥任务；最终提交与原state/source读取校验；独立EDC事实报告/说明版本 |
| 目标环境配置 | 仅19501–19507本机独立环境、`wp01_test_full_baseline`；已有scope，仅显式启用付费标记；原角色/Agent授权未改 |
| 真实执行 | 两账号全新合成材料完整Chrome链，实际Provider与工具/usage、实际PG/Source/Audit、原生缩放/旧Python算子；见下表 |
| 用户业务标准 | AC10未签认；研究方案、访视/字段合理性、AI解释的专业适用性和阅读体验由用户评阅，不用断言数量代替 |

## 当前结果与证据

父目录：`/Users/mac/aisciencesys/docs/test/evidence/2026-10-23-researchhub-wp06-synthetic-edc/`。每组包含result或保留failure，浏览器组含PNG/WebM。

| 验证 | 当前证据 |
| --- | --- |
| 真实解释、逐项引用、原旧两读取路径、编辑后stale | `answer-edc-ai-200f3fef-a8c` |
| 真实Provider在途修改已保存数据，拒绝assistant发布 | `inflight-edc-ai-35f93d55-c39` |
| 管理员浏览器、scope失效、来源、重载无重放 | `browser-ai-52599716`（复用已完成任务，无额外收费） |
| 动态报告API与两账号说明/CAS/历史UI | `edc-report-f848a86f`、`browser-report-340b4571` |
| 新材料端到端 | `e2e-owner-aa1dff3f`、`e2e-admin-82946ebd`，各7组 |
| 1440×900/1366×768/1920×1200/390×844/320×844＋原生Chrome200% | `layout-da6a0cbf`，两账号12组，非DPR仿冒；computed操作14/22、Reading16/28/48rem |
| 旧账号/邀请入口/知识/WP05/旧报告资产、实际本机Python | `legacy-ee491ff5`，旧对象只读，纯合成算子请求单列，不混作本包结果 |
| 真实父版本失效/真实源在途撤审及历史消息/报告隐藏 | `boundaries-235c9f59`、只读续验`boundaries-resume-c4d21edd` |
| 原QueueRecords及Artifact真实PG尾部失败全回滚 | `atomic-submission-479f905e`，认证为测试桩，当前授权另由真实HTTP/Chrome证明 |

C08历史检查点：`read-fences-33531086`、`write-envelope-87b78b4f`、`edc-report-6f1013c9`、`browser-report-c1f52dc4`及`free-gates-1ece1338`保留；C09修补后最新证据以上方当前结论为准。C01–C05早前证据仍见[原阶段报告](synthetic-edc-2026-10-25.md)。

## 预算与边界

官方人民币价格核对于2026-10-25T02:59:56Z，现用deepseek-v4-pro按高峰非缓存输入9/输出27元每百万token保守计账，[官方价格](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/)。不换模型、不启用Search/Fetch；原63笔前缀原样保留，累计上限5000000微元不变，报价到2026-10-26T02:59:56Z停止新增调用，不自动延期/续额/充值。

最终75笔均known、¥1.464417，较原63笔¥1.246815新增12笔¥0.217602，包含3笔已发生但未交付费用（在途改数据、输出拒绝、在途撤审），0未核对预留；不是供应商最终账单。调用失败不自动重试或静默降级成功。来源与协议均纯合成，不送患者材料。没有新表/角色/Skill/Worker、云资源、远端运行配置访问或真实发布。

## 失败与修复不得抹平

完整事故台账见[实施ledger](../planning/synthetic-edc-2026-10-23/implementation-progress.md)。特别是首轮原子故障注入代理错误，确实留下1条本轮新任务；已暂停本机端，精确CAS隔离为failed并保留审计，0模型调用。不能用后来通过覆盖此事实。`fault-fixture-isolation`与后续真实回滚证明分开；未改历史任务/旧服务/原691源码、角色、Schema或16985条保护历史行。

最终体验首轮因撤权测试安排重叠而入口403，未入队/预留/调用Provider；`c09-experience-48d1c876/failure.json`保留。显式核对同包job/pending=null、74笔未变、scope恢复后，只继续该未入队样例，一次真实请求成功，未重试任何收费任务。费用/撤权等共享状态验证以后严格串行；不能用成功续验抹去测试安排错误。

已知Vite大chunk及Node localstorage warning保持记录，不称“零告警”。没有复制/共享/发布/导出入口，不适用其剪贴板成功用例；不是正式EDC、审批、锁库、全量WP06或生产验收。C09已执行唯一一次全代码独立评审，主实施者修补复验另列；技术断言不能替代用户专业体验验收。
