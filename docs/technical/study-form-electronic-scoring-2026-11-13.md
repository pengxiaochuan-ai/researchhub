# 表5/PHQ-9：固定版本、计分装配和渠道契约

日期：2026-11-13。适用ResearchHub；不修改旧系统源码/配置/服务。

## 固定内容

`server/research-capture/source-profiles.mjs`只读取固定白名单JSON，返回独立副本：PHQ-9原件SHA256为09a8afdec1546b54162850faae7b9bc43d53879e9cbe8b8e1263e67ff254b095；方格表5原件为5e34d90ff887e801d3635ecfb2e216227b5510c540302082694d352ee6def3f1。原文逐项比对见source-profiles.test和fang-table5-policy.test。

PHQ源profile含9个有choices的整数题及无编号、不计分的功能困难附加题。schema.presentation保留title/recallPeriodPrompt/instruction/attribution，数值choices为value/label；禁止默认0、字符串数字、离散值域外答案。旧无metadata的schema兼容。没有新增表、字段迁移、GRANT、环境变量或外部服务。

表5是14个必答select：原12项的present/absent/not_applicable/uncertain，以及tongue_category/pulse_category的met/not_met/uncertain；空值仍是漏答。权重和>=20及组合是源常量，答案和调用方参数不能覆盖。projectPolicy包含status/categoryMode/pulseCooccurrence/inapplicable/reviewedBy/reviewedAt；当前profile已按用户确认记录设为confirmed（project-policy-v1），历史pending快照保留。只有明确确认的固定项目策略、条目与类别可判定且非双脉同时有，scoreComplete才为true。

## 实际写入路径

旧formal-response-writer和H5服务静态导入旧policy；仅替换CSV预览函数不会改变正式revision。ResearchHub的form-core-adapter为formal-response-writer、formal-response-commands、study-outreach.service建立私有CommonJS实例图，把study-forms-policy依赖替换为ResearchHub纯policy，其余原授权、锁、同意、幂等、哈希、审阅与事务核心复用。不改全局require.cache/exports、不挂旧Controller，TypeScript编译hook不可用时启动失败，不静默回退旧计分。

ResearchStudiesController的现场/更正/CSV写入口使用私有commands，CSV预览使用同一policy；local-knowledge的H5实例使用同一私有Service。当前只有本机目标环境实测；生产部署须携带旧核心源码和现有依赖及ResearchHub模块，不能仅发布静态页面后宣称能力已生效。

## 分数与状态

complete仅表示14个必答字段均作答；scoreComplete表示足以产生完整总分及判定。processingStatus为awaiting_policy/review_required/incomplete_data/scored。前三种total/diagnosis/classification为null，不适用和无法判断可提交留存；漏答正式提交仍被旧writer拒绝，草稿允许。两脉同时有始终待复核，修正后重新计算，不自行共计或去重。

scored返回源总分、thresholdMet、composition(primary/secondary/tongueOrPulse)及classification positive/negative；前端只映射这些服务端结果，不重算。score和处理状态共同进入正式revision的内容哈希。正式答卷完成度与临床标签可用性分开，履约satisfied不能代替scoreComplete。

## API/页面连带影响

GET /api/research-studies/:id/configuration的forms增加allowedCaptureModes：表5仅researcher，PHQ及旧通用表为researcher/patient_h5。原协议POST/PUT validateRefs按固定版检查模式，拒绝表5H5或混合配置，400 FORM_CAPTURE_MODE_NOT_SUPPORTED；不新增角色或端点。FormalPreparation原选择框过滤支持项，旧不兼容值保留占位、要求显式改选，不用画面默认值掩盖底层值。

CaptureFields共享原文radio与缺失清空；CaptureAssignment/CaptureHistory及更正对照按不可变版本的field映射标签。H5只显示原文和提交状态，没有量表诊断/计分反馈。管理员沿现有配置/预览/审阅界面和服务端实际身份授权，未创建另一套管理表单。

## 发布/回退

本轮profile只安装到guard校验的本机合成Study并记录来源/审计；canonical表5项目规则现已confirmed；实际临床Study仍未绑定/启用。无生产或真实研究绑定。不能回退适配器后继续接收这些新固定版本的答卷：旧policy不识别表5算法且会丢presentation。若需回退，应先停止新答卷写入、保留固定版/历史和证据，再恢复正确版本；不降级为0或无算法分数，不删除修订。

完整执行证据见[验收报告](../testing/study-form-electronic-scoring-2026-11-13.md)。

## 项目操作规则v1确认

用户直接回复已采用首版三条规则，确认记录位于docs/planning/study-form-electronic-scoring-2026-11-13/rule-confirmation-v1.json。新versionTag显式区分项目策略版本；旧专用验收脚本读取归档pending原件，以便重放历史而不篡改旧证据。更新文件不覆盖DB已发布固定版；本轮无需前端/共享入口改动或服务重载，新Study配置由安装后的DB版本读取。
