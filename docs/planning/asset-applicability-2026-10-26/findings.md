# WP09首切片复用核对

2026-10-26实施更新：用户已批准U01–U04及八步。K01首4h内真实专用PG/原服务准入通过；333/1054/构建/保全通过。K02双端桥与独立会话反例进行中；0新模型/核价，F01仍未批。下文静态表为编制阶段记录，不改写成完整交付。只服务当前WP09首切片。

## K01/K02实施发现

- 原plans工厂只导出withDraft/inDraft而非public read。新harness首次误用read产生TypeError（basis-session-417c7dee/189d874c），修正测试装配使用原withDraft，未改原服务API或权限；basis-session-d1f94061两账号通过。
- 原inAsset只读桥复用stored/view/完整来源及祖先校验；双连接在原授权锁下串行。派生目标和新Session由原服务在事务内创建后全部回滚，原确认来源引用保留，不称新AI/专业确认。
- 新目的scope缺审计、跨账号/错目标、原A02隔离副本撤销均拒绝；新context未登记真实record时拒读，generic-send拒绝。尚未实际装配HTTP消息入口，不把这些内部契约冒称全接口门禁已启用。
- 保护集扩大为全部115表/41128前序行，以及691旧源码、三旧scope、Schema、8旧进程与79笔整账本；目前verify通过。
- K03/K04实际记录/Source/回执及意见已验证，固定规则顺序修JSONB渲染；K05的原Queue五点回滚探针通过。两个本轮注入器漏拦的新免费任务已精确终止且保留，不派Worker/模型，原任务不动。完整失败/修正及真实费用与专业未验边界见[实测](../../testing/asset-applicability-2026-10-26.md)。

## 已有事实

- WP08方法资产为`rh-crf-method-asset.v1`、`research_report/draft`，历史事实与闭合`reuseRecipe`分离；没有资产适用性AI执行或目标方案自动应用。
- WP08、WP07及WP05的专业验收仍待用户，不因本稿自动签认。18项AI及正式治理/EDC/导出/联网/目标环境须继续全量复估。
- 目标先限定同一当前Study/本人原两个账号，不增加跨Study或跨人授权。前序方案/候选/会话/报告/数据均不得为本片测试而修改。
- 本片拟产物是新的核对记录和人工建议，不写资产父候选或目标方案；运行上下文/来源当前授权须同时覆盖两端。
- 原累计5元账本不重置。前序WP07已耗尽其4次许可；账本余额不等于本片付费许可。当前不核价或调用。

## 精确源码核对（静态，不冒充PG兼容已验证）

| 源码 | 已核事实及设计后果 |
| --- | --- |
| `scripts/local-crf-method-assets.mjs` | 返回create/read/list/save/derive/Controller，无inAsset；read走plans.withScope另开tx。stored/view同时验seal/报告固定facts/原生Source/祖先；新桥必须复用这些私有函数，不把public read嵌入另一提交事务。 |
| `scripts/local-research-plans.mjs` | withScope/inDraft已存在；loadPlan限定protocol_draft原prefix、真实本人knowledge session与kb:绑定；确认PICO和保存方案要求真实候选，不可SQL造AI。前序读取不调用create/run/save/confirm。 |
| `app/server/src/sessions/sessions.service.ts:645` | ensureKnowledgeSession对已存在context做update恢复/title，不能当读。原方法允许新非空context；新purpose可使用原表新Session，但本机adapter原own/ownInTx/send使用kb:解析，需新严格登记分支而非全局放宽。 |
| `scripts/local-crf-methods-ai.mjs` | 原onJobCreate和validateTurn已证明可沿旧队列原子绑定；WP07 paid容量已耗尽，不借它的approval或调用额度。新结果存Message，不动terminal方法run或来源head。 |
| `scripts/local-knowledge-ai.mjs` | restrictedTools实际执行一次kb_search，turn sources是真实检索+封存片段；state/source有现有类型投影，新增任务必须先做双端投影，不能落通用KB路径旁路。onModuleInit未调用，不自动恢复历史job。 |
| `scripts/synthetic-crf-methods-ai-contract.mjs` | 原第五意图去数值/严格引用/JSON具有可借鉴模式，但意图数组仅旧五类。新第六类需要全局入口两两混合检查，保留旧分支；不是只多拼一段prompt。 |
| `scripts/crf-method-assets-contract.mjs` | reuseRecipe仅原配置/方法/覆盖/材料元数据，不含PICO；源PICO来自已验证snapshot.historicalFacts.pico。原config结构没有独立eligibility字段，故不能假造结构化入排核对。 |

来源/目标不同KB：本片AI仅检索目标KB封存片段，资产结构声明以typed来源供模型；不将其他KB原文偷偷拼接或称全文核读。U04派生测试目标须保留来源版及原真实确认出处，标derived_reference_only，不把复制当新AI/新专业确认；如原loadPlan不能无损表达即首4h停线，不改旧确认规则。

## 主编决定及代价

1. 只写新核对记录，不写原目标/资产：缩小治理风险；代价是本片尚未自动应用模板。
2. 独立新purpose会话而非复用旧会话写入：满足前序全行只读；代价是本机装配需精确识别新context/消息投影，K01不能兼容即停。
3. 声明比较不猜临床语义；源PICO从历史事实取、入排缺字段未检查：代价是需研究者确认专业适用性。
4. U项与F01分开、4job/8Provider双上限待核价：代价是费用许可/输入不足时技术切片可能等待，不假称已完成。
5. 只编制阶段做一次文档总评审，未来K08另一次代码总评审：代价是文档通过仍不能证明运行能力。
