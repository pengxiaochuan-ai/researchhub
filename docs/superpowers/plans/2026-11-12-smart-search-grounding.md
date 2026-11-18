# 智能搜索来源一致性修复 Implementation Plan

> REQUIRED: superpowers:executing-plans。当前目录串行实施＋独立只读总评，不提交/切分支/清理已有改动。

**Goal:** 区分原文事实与AI推论，修补NCCIH盲法及WHO授权两项问题，验证新回答。
**Architecture:** 既有智能搜索工具和权限不变；新v2逐段依据契约、局部处理与来源回执；v1历史兼容。
**Tech Stack:** 现有Node mjs/OpenCode/React Markdown/专用合成PG，无新增服务或依赖。
**Spec:** [获准修复规格](../../product/smart-search-grounding-2026-11-12.md)。

## 全局约束与评审重点

仅本机/原两账号/当前Study/本人新任务；不触碰临床库、旧服务、云、远端配置或生产。原布局/Token业务规则不改。原句匹配不是语义蕴涵证明，不把缺依据事实降成推论，不把来源存在等同授权；旧回答和旧计费不回写。

### G01 · 契约与局部交付

Files: server/ai-agent/smart-search-contract.mjs、对应test及新增smart-search-grounding.mjs/.test.mjs。
- [x] RED：NCCIH真实选段无盲法、WHO无授权、伪引文/跨源/空依据、否认授权、有效事实/推论保留。
- [x] GREEN：严格claims契约、连续短引校验与局部提示；原位Markdown呈现及回执，数值规则不放宽。

### G02 · 真实执行与历史

Files: smart-search-runtime.mjs、smart-search-session.mjs及测试。
- [x] RED：真实执行强制新输出，不允许退回旧自由文本；v1历史可读/篡改拒绝，新父链按v2输出。
- [x] GREEN：新旧策略显式兼容，提交/回读绑定对应策略及逐段回执，不新增表或授权。
- [x] 完整免费596/596、29Chrome、构建4.52s；本机自有在途0后加载新后端，保留旧服务；新任务/旧历史实际PG/API回读有据。

### G03 · 新回答实测、复审与文档

Files: scripts/smart-search-grounding-live.mjs、docs/testing/smart-search-grounding-2026-11-12.md及living文档。
- [ ] 两账号各一个新具名真实任务，公开网页读取→新回答→逐句原句/推论人工核对→API/数据库/Chrome刷新→原UsageRecord/预留结算，截图/WebM。出现失败记录，不自动重试。
- [ ] 独立只读代码/结果评审，同范围修补；更新产品基线/变更/版本/使用/九Skill、技术/验收与Notion，明确未测/专业待确认。

## 当前结论

最新：用户已批准并完成仅catalog-fixed-v2失败收口/2273Token实际结算/释放10015预留；14项免费测试、真实PG回滚及提交、两角色Chrome刷新通过，0新模型调用。目标指令由既有扫描器同步failed，其余消息无变更，详见[单笔证据](../../testing/smart-search-interrupted-close-2026-11-12.md)。下文待确认是历史；G03专业总体验收仍部分完成，不自动重跑或扩大范围。

G01/G02及代码独立复审完成，596免费/29Chrome/build4.52s与v1原两历史真实回读通过。G03仅部分完成：NCCIH通过，WHO单源partial，Harvard完整页失败；最后固定快照新模型已返回2273Token但09:52:48服务重启、未发布，Job/active预留保持，停止新增调用。只免费回放，不重跑/改状态/清账。恢复与仅此笔对账待用户确认；不能整体销项。详见[验收状态](../../testing/smart-search-grounding-2026-11-12.md)。

独立smart_grounding_review共发现4类边界，作者均补RED→GREEN，同评审复核关闭；实际NCCIH、WHO及未发布提议已逐段专业核对，不以短引匹配代替科学语义。Notion规则41656479ab58814395c6f153f02401cc、计划41656479ab58810596d9d59691a9d461、验收41656479ab5881f19557fb342962fb64及既有5产品/技术页同步完成。最后Job失败收口和按真实用量对账未执行，不自动扩大生产恢复协议。
