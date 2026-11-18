# 研究论文筛选接口与分类存储

## 范围

仅本机专用合成环境，复用原Hub来源目录/审核投影和B03中英QueryPlan；不改旧系统、采集项目、原审核接口、角色或GRANT。正式部署仍需单独授权。产品规格见[筛选闭环](../product/paper-filters-spec-2026-11-03.md)。

## 只增数据库字段与提取

`rh_source.canonical_publication.classification JSONB NULL`及`rh_source.pmc_candidate_version.classification JSONB NULL`。既有表RLS和权限保持，不新建平行论文/标签底座。SQL位于`server/hub-sources/publication-classification.sql`，仅使用受控`node scripts/publication-classification-local.mjs --apply`在已标记的`wp01_test_full_baseline`执行。

提取对象固定当前合成租户/灵枢心域；PMC固定首批campaign、上限20版本；工作簿最多20,000规范记录的库存保护，不静默截断。当前15,725规范记录含既往具名合成行，并不等于15,725篇已获准或去重论文；原两工作簿15,697原始行不变。

JSON包含schemaVersion=1、extractorVersion=`paper-facets-rules-v1.3`、原sourceHash、publicationDate及dateRange精度区间、claims数组。claim字段facet/value/field/quote/rule，仅原题名/获准摘要及原JATS本篇front元数据；日期和语言来自源声明，不按文本猜语言。图表、参考文献不参与设计分类。

应用层只有SELECT/原INSERT，无新UPDATE授权；回填用现有受控direct事务，逐批核对源hash、参数化更新，仅新classification列变化。原文件字节/主字段/版本/审核决定/ACL及RLS摘要保全。重复执行同版本无更新；新导入而未完成提取的记录明确未识别，不从前端造标签。新来源批次接入时应复用此提取入口；本轮不新增独立采集调度或后台服务。

投影只交付当前sourceHash/提取版本一致的结果；题名/摘要claim的原句必须仍在当前可见字段中。摘要撤回则其标签和依据同时消失，分面SQL共用相同判定，不能经数量反推不可见摘要。临床人群/疾病标签对动物上下文保守留空；二次研究、综述、Protocol与Letter不继承讨论中的RCT。算法提取不等于专业人工认证或证据评级。

## GET契约

原`/api/hub-sources/publications`与需当前身份的`/api/hub-sources/member/publications`，原q/cursor/limit保持；新增可选`filters` URL编码JSON，最多3000字符，未知键/枚举、null、无效日期和反向区间400。请求无写入、无模型调用。

```json
{"year":"any","from":"","to":"","types":["original","systematic"],"designs":[],"people":[],"methods":["acupuncture"],"diseases":["depression"],"languages":[],"fulltext":"any"}
```

- year：any/1/3/5/custom。近N年为当前UTC年及之前N-1个发表年份；custom至少提供from或to，ISO真实日期1800–2200，保留精度而不伪造日。只有已知发表日期区间完全落入筛选边界才匹配。
- types/designs/people/methods/diseases/languages：枚举见`src/publication-filters.js`；每组另有unknown表示当前字段未识别。其他≠未识别，不把未知归为其他。
- fulltext：any/readable/unavailable，readable指当前获准非空正文；不表示PDF、图片或补充材料都完整。
- 同组OR，跨组AND，与关键词QueryPlan再取AND。limit1–20且真正生效；签名游标绑定原tenant/hub/account/authVersion/audience/queryPlan及完整规范化filters/UTC年。换账号或条件后从第一页重检。未过滤的旧字面rhsr游标仅在原兼容边界内可用。

返回原items/nextCursor/queryPlan/counts，增加appliedFilters/filterYear/facets，items增加classification（可见values/claims/来源日期）。matchedRecords是完整当前组合匹配来源记录数，不是当前页数或去重后论文数。

facets包含每组每个已知/unknown选项数量；计算时排除本组条件，保留关键词及其他组。例如已勾原创时仍能看到“综述”的可扩选数量，不是把综述显示0。year没有custom数量，因为未指定日期区间不能给一个通用数量。缺少合法期刊分区数据，不开放虚假Q1/Q2条件。

工作簿使用授权/关键词eligible CTE、当前允许的分类值、SQL组合WHERE、全量分面聚合、最终LIMIT与rank/id游标，eligible MATERIALIZED防止多组选项重复计算分类。PMC仍只对固定首批最多20的当前获准投影使用同一JS契约，再与工作簿真实页合并；不是对已返回20条做前端过滤。

## 前端与错误

原左栏控件接draftFilters，提交后filters驱动请求；URL仅保存公开的检索条件用于详情返回。清空/移除条件回到第一页，未应用输入不改变计数；身份变化清内容/计数，generation与Abort拒绝旧结果回填。403按原公开读取回退规则，503显示原错误/重试而不造空态；保留输入、当前已应用条件与计数的区别。

右侧原“研究设计”Tab可展开原句依据；原列表标签槽位展示真实分类。没有创建新的审核/编辑工作流。排序、图表、保存检索、检索历史、导出、期刊分区和单篇AI并未因本轮接通。

## 回退与验证

安全回退为还原本轮应用代码、保留兼容可空分类列与原件，不执行DROP、撤审或改角色。当前实现需要先执行字段升级再重载本机独立服务；脚本有本机进程归属检查，旧服务不得重启。

测试：`node scripts/publication-filters-free-gates.mjs`；浏览器：`node scripts/publication-filters-browser.mjs`。本机仅13公开文章，浏览器分页检查将实际发往原API的limit改为2，不替换响应或伪造记录；原正常页仍20。具体证据、旧夹具失败和专业验收边界见[技术交接](../testing/publication-filters-2026-11-03.md)。
