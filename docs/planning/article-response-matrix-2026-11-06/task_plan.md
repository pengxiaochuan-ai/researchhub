# 单篇三档处理实施计划

> 主实现当前目录串行，执行小步计划；独立总评审只读。用户已要求据矩阵实施，不再次循环确认同一范围。不创建worktree、不提交整个dirty工作区，不恢复旧计划。

**Goal:** 让有据数字正常解释，局部未核实不再整篇失败，系统可信边界仍硬校验。

**Architecture:** 新响应策略模块复用封存包/数值原文receipt；原单篇适配器接入，新provenance字段在最终提交和历史读取重验。旧输出模块仅用于历史回放，不修改旧Agent/Billing内核。

**Tech Stack:** 现有JS/Node Intl/Markdown/PG；无新依赖/DDL/计算服务。

**Spec:** docs/product/article-response-matrix-2026-11-06.md。

## 任务与验收

- [x] P01 分类与处理：14项新策略纯测GREEN，边界负例先RED；接口articleResponseMessages/articleResponseInputProof/parseArticleResponse/verifyArticleResponse已实现，独立评审重要项关闭，不声称通用语义核验。
- [x] P02 链路：新任务payload独立固定v3策略，最终提交/历史GET按任务字段重建回执，双marker删除仍拒绝。旧v1/v2不重算。新增真实合成PG回滚探针、Provider/前端恢复负例；319纯测/21PG/build/旧源码与账本保全通过，0模型调用。
- [x] P03 免费全链与真实浏览器：最终321纯测/21合成PG/build通过，免费故障注入与真实请求分开留证。新真实Sjögren任务cmw4f3tst0004lufib1mxpyub成功交付、4516 Tokens按业务规则结算；刷新/身份隔离、1440/390截图录屏及16/28字号验证通过。先前4814 Tokens失败仍保留，修补后主动另建新任务，没有自动重试。详docs/testing/article-response-matrix-2026-11-06.md。
- [x] P04 唯一独立总评审：沿同一只读审查者完成重要问题修补及36项独立纯测复核，最终Ready；代码Ready不等于专业正确。产品基线/说明/版本/技术/测试已同步，Notion新增3个同源页并对10个既有页最小追加现行说明，均无warnings；四层本机技术交接见测试文档，专业签认未代办。

## Review Focus

模型伪造的“已验证”状态不得入库；数字术语必须词界匹配，年份不能从无关时点借用；局部剔除不允许把半句串成反义；缺来源不能借其他段/跨篇补引用；历史不回写，当前权限与来源始终重验；没有有效段不得假成功。每项有针对性反例。
