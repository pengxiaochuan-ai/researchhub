# 岐研AI自然任务规划 · 本机分层验证

日期：2026-11-11。范围：[规格](../product/ai-natural-task-planning-2026-11-11.md)。仅`wp01_test_full_baseline`专用合成库、原两账号及Study；外部材料为公开PubMed题录/摘要。未改旧服务、角色、Token分配、DDL或页面布局，不发布。

## 四层状态

代码已实现→本机已启用→实际模型规划/真实检索/综合与账本已执行；专业方向内容尚未全部通过。旧快照不迁移，权限/来源/原claim仍核验；技术通过不能代替用户专业验收。

## 真实任务

| 轮次/账号 | Job | Provider次数 | Token |
| --- | --- | ---: | ---: |
| 初轮科研人员 | cmwbx9omr0008luxzlrrivjnr | 2 | 7894 |
| 初轮管理员 | cmwbxasku000rluxznylr5bof | 2 | 5529 |
| 最终科研人员 | cmwbxgv8g0008lu1uvkfvyqwg | 2 | 8343 |
| 最终管理员 | cmwbxhsvf000qlu1u9kpyjlve | 2 | 5693 |

各任务2个真实PubMed工具、6来源，一次UsageRecord.callCount=2且Token与两份真实Provider trace相加一致；累计8请求/27,459Token/账本估算0.089721元。不是供应商发票对账；不触碰未知历史预留。两轮前后角色/额度分配指纹一致，无充值或自动重试。

原句实际日期2025-11-11至2026-11-11，领域组内OR、组间AND；命中407、读取6篇，不保证每个情志病亚类都覆盖。新通用例“近一年正念干预职业倦怠”命中15、读取6篇。原始查询、来源/PMID/链接、工具词/时间/状态及Usage ID均在私有本机证据，不上传凭证。

## 免费及浏览器验证

- 单元/契约/PG/原Worker组合最终458/458、无跳过、110.5秒；命令`node --test --test-concurrency=1 tests/*.test.mjs server/ai-agent/*.test.mjs scripts/ai-command-worker.integration.test.mjs`，完整日志`suite-verified.log`。此前454/457为增补前快照，不叠加重叠计数。
- Chrome：`node --test --test-concurrency=1 scripts/ai-command-ui.test.mjs scripts/ai-conversation-ui.test.mjs scripts/ai-first-entry-ui.test.mjs scripts/ai-context-rail-ui.test.mjs`，25/25，含规划具体澄清/内部错误隐藏与原队列/切换/迟到/身份反例。
- 两账号真实1440×1000、390×844，刷新逐字恢复一份答案、新草稿保留，阅读16/28、0 pageerror；纯回读0会话写请求/0模型。PNG/WebM保留。最初`db-terminal`只是DB终态早于UI轮询，不冒充答案截图；真实答案另有`*-answer-top.png`/`*-result.png`。
- `ai-natural-plan-claim-pg.mjs`只在本轮已完成owner行的回滚事务模拟换claim，使用原assertLiveClaim拒绝旧执行；计划/证据未落库、后续检索0，模拟已知用量回调一次。回滚后整行指纹不变、0真实模型。
- build成功4.52秒，既有chunk告警保留；无新依赖/CSS。未重新测320或原生200%，不声称全站无障碍验收。

## 独立评审与专业待核对

技术三项已RED→GREEN并独立复核：在途claim替换、常见离线/年月条件丢失、具体澄清不可见。月份月底夹取与0篇数量、已知失败一次记账/未知不补造和新旧路由兼容另有测试。

初轮方向“缺乏药物比较”与来源相反、HRV改善被当倦怠改善支持，已收口新directions要求并保留旧回答。最终两项具体矛盾消除，但独立离线专业核对仍发现：

1. admin方向一称“仅文献一为随机对照试验”，文献三摘要/逐篇解释也明确随机分组。
2. admin“当前摘要未提供长期随访数据”过强；文献一有七个月评估，长期阈值应按研究标准判断。
3. owner“未比较长期效果”应限缩为“本次摘要不足以判断”，不能将未报告等同未研究。

以上不靠AI免责声明销项；任务理解/执行技术闭环可交接，专业结果仍待用户核对，不为措辞无限付费。本轮未扩改旧数字句过滤，因此仍可能有子句省略/衔接不顺，不称所有输出规则已统一。

## 证据与边界

`.tmp/ai-natural-task-2026-11-11/`保留各RED/GREEN、两轮live-state及原始回答、video/PNG、billing-readback、claim-pg、readback及最终browser/build/suite日志；`final/`为收口提示后的新任务，旧任务未重写。ESM循环初始化改用独立policy hash；两次补丁上下文不匹配均未应用，已按实际文件修正。

无临床库/旧服务/共享底座变化；九Skill全自主、任意长任务、所有筛选、全文、持续订阅和正式发布不在本轮。
