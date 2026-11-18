# 岐研AI · 一次确认到研究数据入库

2026-11-13。本文件只描述已批准P05、本机专用合成库和原两个账号；[产品规则](../product/qiyan-ai-file-data-ingestion-2026-11-12.md)、[M01–M05授权](../planning/qiyan-ai-file-data-2026-11-12/authorization-p05.md)、[验收与限制](../testing/ai-data-import-p05-2026-11-13.md)。未发布，不代表完整数据Agent或P06分析可用。

## 两条父链与最小复用

原普通Hub会话、上传、P04预检继续属于来源group/project；目的Study通过服务端resolver取得真实执行project、executing v2、BASELINE计划、已发布Form及政策版本。不能把AI01当前来源项目当入库项目，也不迁移会话。显式来源列`study_id`或`研究编号`非空时逐行核对目标Study；即使该列不属于CRF映射也不能忽略，冲突返回`DATA_IMPORT_STUDY_MISMATCH`。

`research-data-imports.mjs`负责源文件原件重读与SHA、固定目标/映射/逐行版本、当前授权、事务与回执；`ai-research-data-import-native.mjs`适配旧Subject、Enrollment、Visit、Form/Assignment/Response服务。Hub capture只提取内部typed-row规划，CSV严格转换与XLSX原生类型保留，不绕CSV中转丢失0/false。`subject_code`兼容原模板，重复编号列仍拒绝歧义。

新建档案只创建Subject，未入组不自动造Enrollment/Visit。访视表只写入已合法存在的固定访视，调用原分配和submit；沿原同意/排期/模式/schema/评分/修订/锁/审阅/审计。值不交给模型生成或补齐，提交CRF不等于完成访视。M05本轮合成入组/访视准备是显式独立步骤。

## 两张隔离表

| 表 | 责任 |
| --- | --- |
| `rh_ai.research_data_import_access` | 真租户/账号/Study/来源会话、能力与本轮对象集合、scopeKey、到期/CAS/管理员审计；不是角色或Token额度 |
| `rh_ai.research_data_imports` | 原P04批次/version/hash、目标执行快照、字段/行manifest、不可变requestKey、计划状态/CAS及原子receipt |

FORCE RLS；应用仅本表必要SELECT/INSERT/UPDATE，无DELETE/TRUNCATE或schema CREATE。基准SQL hash `4419fd2f80b300ca68cb11d1369d019d464b940fd2ce58de5c35668310a66b1f`；guard v2 hash `6d89c1e650ceaa0fc8a6b1d2e5b950f59a8cb82b4dcbc591208404c319e393c4`。迁移先验证已有catalog/COMMENT和具名合成库，guard v1只能受控升级到本版本，不盲目替换旧材料/P04结构。

owner使用唯一7天许可，严格限定本人/本Study/本轮对象；admin复用真tenant_admin权限，不伪造成员。许可撤销与导入共用租户当前授权锁，撤销先完成则拒绝，导入先持锁则先原子提交再撤销；后续读取仍查当前授权。管理员显式恢复只能恢复同一未到期身份/集合/能力/原到期时间，CAS/审计递增，不自动续期。

旧app只适配`formal-response-assignment.ts`、`formal-response-commands.ts`两个已批准点：可选服务端授权回调携带真实visit/form或assignment/action，仅P05 submit；默认入口仍原生鉴权，不能接客户端自报许可。S03有限读取只覆盖当前许可和本人本轮真实receipt对象，普通新建仍403；S09使用原固定revision/hash路由。

## HTTP契约

所有路由以`/sessions/:sessionId`为前缀，沿当前Cookie身份及原来源scope headers；GET no-store，写入校验当前Origin。body不接受tenant/role/authorized或客户端路径。目的地从studyId解析。

| 方法与后缀 | 语义 |
| --- | --- |
| GET `/research-data-import-targets` | 当前有权目标Study，不以来源项目自动代替 |
| GET `/research-data-imports` | 仅当前P04批次对应的最近计划，避免旧批次新操作遮住当前结果 |
| POST `/research-data-imports` | requestKey、studyId、preflightId/version；生成固定核对计划，未提交业务数据 |
| GET `/research-data-imports/:id` | 当前本人、原来源会话、真实目标和当前授权下读取 |
| GET `/research-data-imports/receipts/:key` | 查询同一原操作，不创建新计划/自动重试 |
| POST `/research-data-imports/:id/confirmations` | version＋hash精确匹配；原件/来源/目标/权限/行版本重验，业务写、审计、receipt同事务 |
| POST `/research-data-imports/:id/cancellation` | 只取消未提交计划，CAS；不回滚已导入Study记录 |

确认冲突/失效409、范围无权403、非本人/非会话404；未接数据分析请求在模型任务入队前409。没有审批/锁库/共享/发布/导出端点。

P04取消前在同一真实来源事务检查所有scopeKey下本人的依赖计划，planned返回`DATA_IMPORT_PENDING`，committed返回`DATA_ALREADY_IMPORTED`；保持P04状态/version/hash不变。本机启动必须装配此守门，不把它做成静默可选旁路。取消预检从来不是撤销业务入库。

## 页面与失败恢复

沿原AI01内联预检区、Shell和输入区：唯一目标自动展示Study名称/方案版本，多个目标才一次选择；显示实际被试/访视/字段/未写入列，主动作“确认导入”。成功后同区显示真实结果，并通过现有helper回S03和固定S09。

发送前保存原requestKey及来源版本。未知结果先GET原key，手动“核对状态”只GET；无结果才显式重试同一次，不新增key。来源或身份切换丢弃迟到响应。读取失败/未知时禁止确认、重新预检或取消源批次，保留待核对标记；已提交时隐藏取消，不错误宣称“整批未导入”。明确准备校验拒绝后可修正源数据，不被未知状态永久锁住。

14/22正文、共享Button与原回链样式。窄屏沿现有会话/消息独立滚动，不扩成全站布局改造。P06未实施，研究数据不会转送文献问答模型，页面诚实提示该会话数据AI分析暂不可用。

## 本机装载与交接

owned环境`local-knowledge.mjs`仅本机19501–19507、专用合成库；正式迁移/云/旧服务/发布仍未授权。运行身份核验后受控重载，保留凭证/数据库/历史任务。当前已创建4Subject、独立准备4Enrollment/4Visit、4提交CRF；未新增模型调用，Token账本不变。后续验证优先只读复查，不重新运行已完成的setup、具名准备或并发夹具。具名持久验收记录存在时，创建回滚测试主动保护跳过，不能将其称为本轮再次通过。
