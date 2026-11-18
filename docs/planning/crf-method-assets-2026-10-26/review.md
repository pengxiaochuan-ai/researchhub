# WP08首切片独立文档评审与主编处理

2026-10-26，仅规格/授权/计划可实施性评审；**不是实施批准、未来V08代码总评审、目标环境验证或AC10专业签认**。本轮唯一fresh只读评审`/root/wp08_spec_review_20261026`，无实施代理、无第二次评审/独立复签。主编对建议核对源码后修改文档，原结论保留。

## 独立原结论（保留原意与分级）

**Approve with Minor：0阻断、0 Important、2 Minor。** 规格足以让有经验的builder在既定边界实施；没有必须先问用户的技术问题，但开工仍待用户确认。

1. Minor，原spec第44行/plan第40行：reuseRecipe仍是类别描述，建议V01把允许路径、类型和空值规则固化为最小JSON或契约表，并对额外字段拒绝，不能只检测几个禁用键。业务边界已明确，不需扩大授权。
2. Minor，原spec第56行/plan第104行：应注明跨根容量及全局requestKey依赖原授权事务的tenant级排他advisory lock。源码链plans.withScope→withCurrentKnowledgeRead→withAuthorizationMutation→lockAuthorizationMutation已使用pg_advisory_xact_lock；设计可串行化同tenant不同根写入，补明可防实施者误换普通事务破坏容量/幂等。

独立确认：A01–A04明确待批、前序报告只读/A04新夹具才可变、无新付费；新旧schema隔离，原Artifact/Version/Source/Audit可复用，inReport可窄增；条件R02/父链/当前head/祖先/CAS/422/重试容量/精确回链/身份恢复均有AC映射；历史证据与recipe分离，不把派生当新研究；24＋8h仅带首4h止损的建议窗口，非已验证工期或生产承诺。

V01待实证gate：原权限/sourceRoots、真实Source/hash兼容性、同tx桥、目标环境保全。现阶段缺运行证据不构成文档缺陷；不能据文档评审宣称真实验证已通过。评审者报告全程只读文件，未改文件、运行测试或操作DB/服务/浏览器/模型。

## 主编核对与处理（不是独立复签）

| 原项 | 主编处理 | 留给获批实施的验证 |
| --- | --- | --- |
| Minor 1 | spec §4.1补闭合逐字段表、类型/空值/来源；排除config.notes，严禁spread后删黑名单。对照原normalizePreparationConfig、Knowledge资料snapshot及Prisma KnowledgeDoc.version确认为Int，未创造新源字段；plan V01补golden及逐层unknown-key/嵌套答案反例 | 实现前RED→GREEN，实际报告配方与历史事实分别核验；本轮没有golden代码/运行结果 |
| Minor 2 | spec §5/plan V03补原official→tenant排他事务锁依赖及跨根/跨动作两连接反例。主编定点读取retrieval.service.ts第13–47行、worker-publication.ts第40–76行和local-research-plans的locked确认现状，不修改旧源码/新造锁 | 实际两连接容量/键/source head与事务回滚；原链不成立首4h停止，不默认补共享底座 |

主编自检：规格/授权/八步依赖与24＋8h一致；A01当前阅读与A02历史权限分列；新A04夹具、费用次数、原授权撤销隔离副本与实际浏览器scope负例分别留证。原Approve with Minor不改写成独立“无问题通过”，两项文档澄清已补，不据此勾V01–V08或用户AC10。

## 最终停点

交用户确认[规格](../../product/crf-method-assets-spec-2026-10-26.md)、[A01–A04](authorization-scope.md)、[八步计划](implementation-plan.md)。本轮仅文档与Notion同源同步；无业务/数据库/权限/运行配置/服务改动，0模型/费用，无云/远端运行配置/真实发布。确认前不实施。
