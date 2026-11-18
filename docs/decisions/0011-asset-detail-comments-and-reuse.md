# ADR-0011：资产详情讨论与实际复用的最小扩展

## 状态

Accepted，2026-11-13。用户已确认最小清单并启动Q01；批准不等于已执行。原提案依据：[A02整页规格](../product/research-assets-a02-spec-2026-11-13.md)及[D02/AU/AF/AI清单](../planning/research-assets-product-2026-11-12/a02-authorizations.md)。未执行DDL/新用途/夹具/Study创建或付费调用。

## 背景

ADR-0009与A01已实现固定版治理/限期正文与引用许可，但A02完整PRD还需要版本讨论、派生/实际应用、附件/导出、AI解读。旧Review.comment是审核决定的附言，不能承载讨论历史；旧createExport需要启用Worker和artifact.export，直接调用会越过现有批准；原F01十个确切键禁止创建第二个同类型副本。不能通过放开旧底座、硬删历史或覆盖已有用途解决。

## 建议决策

继续复用ResearchArtifact/Version/Source/File、科研Agent/KnowledgeChatJob/Billing及旧Markdown纯渲染器。Hub-owned rh_asset只新增asset_comment_event和asset_reuse_record两张追加式业务表；对原owned约束/函数作版本化具名升级，仅新A02 manifest扩用途/键，原A01边界不变。源/目标真实授权与新草稿/血缘同事务；旧public结构/RLS/角色/Service不改。

本轮导出推荐固定Markdown，用旧纯渲染器经Hub当前授权响应，不启用旧扫描Worker，也不宣称执行旧导出Job。后续需要DOCX/PDF时另按旧ExportJob完整前置准入，不引新渲染或任务设施。AI仅新Hub资产输入/结果守门，旧执行链复用；新增付费单独确认。

## 替代方案与后果

- 全塞Audit/contentBlocks：难以约束同版回复、修订历史、目标原子父链与分页授权，不采用。
- 复用Review为讨论、直接克隆已审核资产：混淆科学/权利审核与用户意见、继承不合法状态，不采用。
- 扩建通用知识/权限/导出服务：违背当前业务优先及不扩大共享底座边界，不采用。

代价为两表及受控迁移/当前授权/浏览器验证；收益为正文、任务、文件和费用系统不重建。新增用途/数据/局部弹窗仍待明确批准，生产不由本ADR自动启用。具体字段、数量、接口与保护基线均以规格/清单为准，避免多个文档各自定义不同上限。
