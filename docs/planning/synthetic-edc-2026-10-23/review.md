# WP06首切片独立文档总评审

2026-10-23。状态：唯一一次fresh-context只读评审完成；**原结论0 Critical／1 Important／0 Minor，主编核实后已补齐文档；无二次独立复签，待用户确认。**

范围：[规格](../../product/synthetic-edc-spec-2026-10-23.md)、[最小授权](authorization-scope.md)、[九步计划](implementation-plan.md)及必要本地代码事实；不写业务代码/库、不运行模型/服务、不读取密钥/远端配置。本轮文档评审不能代替用户批准、实施后C09代码总评审或专业验收。

## 原意见I01：原会话读取缺少新包当前性及授权投影

评审在修订前规格77/89/91行、授权47行及计划39/120行发现：文档要求失权隐藏/旧结果不标current，但仅安排第四任务kind/最终提交，未明确原会话读取两路守门。代码证据为`scripts/local-knowledge-ai.mjs:135–162`：knowledge-state只按知识来源标sourceStatus，knowledge-sources只验会话及知识来源；没有新scope、父包、dataRevision或DQ核对。已完成解释可能经原会话旁路继续读出或标current。

最小建议：仅为新EDC provenance添加只读绑定投影，state/source与包页一致；完成后更正、换父版、撤销scope分别从两入口实测，原三kind保持。

## 主编核实与一次修订

已逐段只读核对上述两条实际路由，接受I01；不是仅凭评审措辞采纳。规格6新增不可变`researchSyntheticEdcResult`、两路scope/父包/数据/DQ/来源重验、restricted隐藏/stale历史、损坏provenance拒绝及队列可见字段无旁路；AC06同步。授权清单M02撤销语义和计划接口/文件边界、C06/C08真实反例对应补齐。只改文档，不修补业务代码或扩为旧会话重构。

原评审对载体/正式表单隔离、软范围/硬类型、版本/CAS/事务、新报告真实来源、真实Agent/预算/四层验收及32＋8小时未发现其他重要缺口。另由主编自检明确块seal/lastChange可选字段；不是新增独立评审结论。

当前处理状态：I01文档缺口已补齐，静态文档验证另记validation.json；不写成代码漏洞已修复或二次评审通过。业务实现/配置/真实执行/专业效果均未开始，C09实施后仍须一次独立代码总评审。原结论与本次修订保留供用户评审。
