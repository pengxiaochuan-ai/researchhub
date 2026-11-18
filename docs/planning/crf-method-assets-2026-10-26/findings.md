# WP08复用核对与设计依据

2026-10-26编制阶段：仅本地源码/文档只读核对，无数据库/模型操作；以下表格为当时取舍依据。用户现已批准实施，V01–V07及唯一原代码评审重要项作者修补复验通过，真实PG/API/Chrome、324/1054及保全证据以implementation-progress.md和专项实测为准；V08本机技术交接、Notion已回读，WP07及本片专业AC10仍不代签。不得把下表编制时私有出口未开放等旧事实当当前实现状态。

| 位置 | 当前事实 | 本片设计影响 |
| --- | --- | --- |
| scripts/local-crf-methods-reports.mjs | createCrfMethodReports仅返回read/create/save/live；loadReport和frozen内部私有；读/写完整验facts/nativeSources，写锁精确run且整行只读 | 须增加窄同事务inReport读取接点，不能在外层事务中调用read另开事务、重新用SQL拼未经验证报告 |
| scripts/synthetic-crf-methods-report-contract.mjs | 新报告rh-synthetic-crf-method-report.v1，facts含config/来源/原真实method/result/coverage/可选实际AI；没有旧run.dataset/seed | 新snapshot/配方，不伪造seed，不把原答案或结果放入可执行配方 |
| scripts/local-synthetic-assets.mjs、synthetic-asset-contract.mjs | 旧rh-synthetic-asset.v1沿synthetic-trials/inReport读取且要求facts.run、simulation.dataset | 不能直接调用旧工厂或buildAssetSnapshot接新报告；复用原产物服务/哈希/血缘思路，旧schema与初始化审计保持 |
| pages/shared/SyntheticAssetWorkspace.jsx | A01/A02现有列表/详情/说明/历史/派生视觉；详情硬编码Q01与simulation.dataset | 复用母版/公共组件/字号与合法交互；新显式分支，不直接塞新schema到旧组件；新回链须到S06固定报告版本 |
| src/synthetic-asset-route.js、knowledge-session.js | 原assetDrafts/assetDraftId和research-asset-drafts白名单只覆盖旧族 | 新互斥路由与精确API白名单，失败不能回退旧seed或demo；不改默认旧族 |
| src/research-design-session.js、platform-shell.js | 显式真实身份/集中页头分流已有模式 | 必须将新A01/A02分支同样纳入，不复制Shell或展示演示身份 |

取舍：原报告整版固定作为受限历史证据，复用配方另为字段白名单，只含原配置/方法/材料定位/局限/人工待确认清单；原报告中的数值仍只证明原运行，不是目标研究结果。人工说明可含专业判断，但不写回机器事实，也不是新AI推理。

授权缺口：R01–R03只覆盖方法/解释/报告，不自动覆盖新资产目的。拟A01–A03用于新候选创建读取/说明/派生，A04仅本轮新增合成反例夹具；不改原角色/Feature/Skill/Assignment。原WP07结果/报告作为来源只读；需要变化时在新WP08具名包/run/report夹具上验证，不能改历史样例凑负例。

UI依据：现行UI/UE V1.1与ADR-0004，操作14/22、Reading16/28/48rem、辅助13/20、元信息12/18。局部Error Recovery检索有明确恢复路径的匹配；CAS/dirty/慢读交叉失权必须沿项目规则具体验证，不引用通用样式生成结果。

同事务不等于源head不会并发变化：新资产写入拟沿授权→本人方案SHARE→本人包SHARE→run UPDATE→报告SHARE→必要父候选UPDATE，所有源仅加锁不改。原报告notes也使用run锁，顺序兼容；源方案/包的原createVersion更新会受SHARE互斥。V03要用两独立连接证实，不能只凭代码设计宣称线性一致。此为本片写契约，不改旧服务/底座。

核对补充：实际旧资产装配在local-synthetic-reports.mjs，向外暴露synthetic.AssetsController；新controller需在local-knowledge-ai与local-knowledge注册。边缘新创建路径已属原synthetic-collections的32KiB规则；新的crf-method-asset-drafts notes/derive须单独限32KiB，沿400错误而非另起413风格。一次误查knowledge-ai-guard.mjs不存在，已定位withCurrentKnowledgeRead来自原retrieval.service.ts；不新增猜测模块。

独立文档评审两项Minor已主编核对补清：spec §4.1逐字段recipe白名单/类型/空值与V01 golden反例；spec §5/V03明确现有withScope经retrieval.service.ts到worker-publication.ts已有official→tenant排他pg_advisory_xact_lock（前者13–47行、后者40–76行），跨根容量/全局键必须保留此事务，不新造锁。research-execution-preparation-contract.mjs第76–92行给原config精确类型/数量/空值，knowledge-ai-contract.mjs第13–15行给原资料定位/hash/version。均只读源码核对，实际锁/容量/哈希仍须获批V01/V03验证。

已批准实施取证：V01真实两报告/Version/Sources/hash与新snapshot兼容，V02同tx桥/12项真实PG和scope4项反例通过；原角色/旧源码/前序行/旧进程/费用保持，未重载服务。现有NestJS10.4.22/Prisma6.19.3/React18.3.1沿用，框架路由参考https://docs.nestjs.com/controllers，事务锁参考https://www.postgresql.org/docs/16/explicit-locking.html#ADVISORY-LOCKS；仅公开文档，不涉及远端运行配置/价格/费用。未来V03还须实际两连接互斥/原子反例，当前不声称已完成。
