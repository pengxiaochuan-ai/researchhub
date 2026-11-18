# B03中英检索投影契约

## 入口与作用域

现有`GET /api/hub-sources/publications`、`member/publications`及`agent-retrieval`共用`search-dictionary-v1.json`和`compileHubQuery`。只在本机专用合成装配启用；不改前端布局/审核决定/角色、旧系统或collector，无新表/服务/依赖。完整[规格](../product/bilingual-article-ai-spec-2026-11-02.md)与[技术验证](../testing/bilingual-search-b03-2026-11-03.md)。

`q`沿原筛选、`query`沿AI只读检索。空列表查询不编译（queryPlan=null）；非空2–100字符。非法/超限/跨查询cursor400，当前身份和Agent授权失败仍403；私有/来源响应no-store。不接受客户端提供queryPlan、扩词或tenant；compile在服务端使用固定快照，类型/重复数组参数不隐式当合法单值。

## 投影与匹配

`search-projection.mjs`集中装载快照、参数化SQL/有界投影匹配、原文优先rank与游标。工作簿全部概念条件在SQL `LIMIT/cursor`之前，抽象字段仅在当前展示授权且（AI时）当前AI授权时参加搜索；不因扩词命中被拒绝的摘要。英文保持词边界/忽略大小写，无词干化或新医学诊断扩词。

PMC继续固定首批最多20候选的来源宇宙，先读取最新版本并执行当前字段/用途/整篇可见性投影，然后按同一计划过滤/排序、再参与最终结果分页；不是逐词各取第一页后合并。图片/作者附件不进新AI文字检索。初始五份外部资料使用同一SQL规则，并在确定性hash/来源检查后的真实片段上再匹配，防止未通过结构完整性校验的payload仅凭SQL文本命中。

同概念OR、不同概念AND；标识模式对实际PMCID/DOI相等，不用标题子串替代精确。未知/否定/年份等不安全约束整体literal；Agent不再截取问题前半段重搜，不能丢弃有效约束换取命中。只有获准且当前可读来源进入输出；现有片段offset/hash、提交/历史来源重验不放松。

## 列表分页与响应

原`items/counts/nextCursor`保留，增加`queryPlan`与`counts.matchedRecords`。后者为当前全部命中获准**来源记录数**，不是去重研究数/论文总量；暂存、获准总数仍沿原字段，不冒充命中。前端现有加载条数由真实返回项决定，无前端扩词或演示补数。

先原文命中rank0、再概念映射rank1，相同rank按稳定来源ID排序（PMC前缀在工作簿前）；排序与cursor条件均在数据库结果limit前。合并时工作簿取真实筛选后的一页，PMC最多20的完整有界投影参与排序，最终严格每页1–20。不把全部PMC额外加到第一页。rank只用于内部排序和签名游标，不增入公开items/详情DTO。

新cursor HMAC复用本机已有secret，封存版本/rank/ID、actor/authVersion、tenant/Hub/audience及完整QueryPlan摘要；跨词/词表/身份/可见范围或篡改400，不重用旧条件。旧`rhsr-*`游标只兼容无扩展（空/literal）查询，不供mapped/identifier使用。不保存完整结果或认证材料到cursor，不建立第二套配置。

AI只读返回`meta.queryPlan`，保留实际词形/词表版本/时间/来源。各来源在条件过滤后有界截取，最终原文优先并沿原最多20来源门禁交付；不调用模型翻译、创建会话或入队。新AI真实产物与单篇隔离属于B04以后，不在B03冒充实现。

## 运行注意

装配仅给原SourceReadController传入已有secret。按进程归属校验重启owned19501–19507前，实际核对该合成租户知识入库和问答queued/running均0；不触旧服务或云配置。真实Provider调用0，历史预算账本不重置。完整切片的唯一独立总评审仍留B08，当前是B03技术接线验收，不代签专业效果或生产发布。
