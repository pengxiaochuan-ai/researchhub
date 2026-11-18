## 2026-11-17 F1/F2当前实施状态

用户已批准profile-import-admission准确增量。普通新会话Excel已有档案首闭环已在本机合成环境完成：真实上传/原生执行/确认/两份Profile/同页及刷新回看，科研身份按原native权限拒绝；66项定向回归、10项真实PG回滚、TS/构建和独立复评通过。实际2会话/2被试/2上传预检/1计划/1file-task/2Profile/10笔业务审计，0模型调用。用户本人待手册第11节回看；390/200%既有全局布局限制记录为未通过，不扩大Shell。其余模态/模型编排不随本轮自动展开。[本轮证据](../../testing/qiyan-subject-profile-import-2026-11-17.md)。以下前序停点为历史。

## 2026-11-17 精确执行入口子阶段完成

F1前置的旧处理器单任务公开入口、失败传播及仅raw管理员原生授权一致性，已分别获用户批准并实施。50项定向单元/确定性处理回归、TypeScript无输出编译及15项真实app/RLS合成PG验证通过；已完成一次独立总评。新夹具全部回滚且新连接确认0残留；旧当前scope原任务数为0，只能证明该范围摘要一致，不能外推全租户历史保护已实测。未启动poll/bootstrap/recover、未接外部存储/模型、未重载服务/更改角色、未验收浏览器或完整上传/确认链。

下一实施项仍是F1普通新会话与F2档案表专用导入：先补准确持久化关联/确认与自有任务消费规格，复用现有CSV/XLSX暂存及新公开执行器；新增DDL/DML、实际具名上传与局部交互的准确差异获准后再启用。不得将本子阶段写成F1–F4已全部完成。以下原计划/停点保留为阶段历史。

# 岐研AI完整复用旧数据Agent · 续接实施计划

日期：2026-11-17。当前用户要求把旧数据Agent上传被试数据的实际完整能力接入岐研AI，包括视频和Excel。本计划接续已批准的2026-11-12文件/数据规格及P06–P08，不恢复其他项目任务。

## 已核定结论

1. 既有P02–P06完成文献私有库/问答、CSV/XLSX预检、部分固定CRF导入和聚合解释；视频另完成归档/检查/被试登记及带时间引用聊天。不是从零开发，不重复建这些模块。
2. `scripts/local-research-data-imports.mjs`按固定旧session与Study选择层；`scripts/local-session-media-ingests.mjs`及scope校验按固定session/media/subject/visit限制。它们是早期合成验收边界，不能成为正式产品能力。新建普通会话没有因此自然获得完整数据链。
3. 旧Ingest四入口、档案/眼动确认及RawProcessing具备真实数据服务。必须逐项调用这些核心及原当前授权/版本/租约/审计，不将全部data工具直接塞入research白名单。
4. 当前专用合成库只读元数据快照（runtime-capabilities.json）：2个research Agent，实际用于聊天的active v2只有knowledge.search/file.read，无data Agent、无14项数据Skill发布记录。未读env/model/凭据/患者内容，0写入。不能把旧系统默认Skill键当本机已装备能力。
5. 旧fnirs-preprocess仅盘点并提示mne-nirs；harmonize-cohort仅当前统计；档案/整理后眼动/情绪/首注视Skill的某些桥接仅就绪检查。真正眼动/档案导入要走Ingest/Worker。用户已确认先复用实际已有能力，未实现算法另列专项。

## 完整性清单与验收定义

| 能力 | 复用路径 | 必须证明的结果 |
| --- | --- | --- |
| 统一文件入口 | 原AI01上传、签名/大小/分块、本人暂存及原key恢复 | 新会话可用，不要求具名旧session；未知结果不自动重发 |
| Excel/CSV/TSV原始材料 | RawProcessing.processTabular、原分类器/原值/来源 | sheet/行列、脱敏预览、分类及真实needs_review/complete；不把预检当导入 |
| 一般表格→CRF | 已有preflight/mapping/import/native | 按当前Study/表单/访视/同意明确确认，原0/false/null/单位与来源，真实答卷回链 |
| 被试档案Excel | subject-profile-import、confirmProfileImport | 对既有假名被试显式身份映射，subjectProfile真实更新/来源/任务版本；不偷偷建档或入组 |
| 眼动原始Excel | eye-tracking-import、RawProcessing、confirmEyeImport | 可解析单一被试自动处理；歧义身份/工作表人工确认；真实Feature/批次/血缘/质量告警 |
| 整理后眼动/情绪/首次注视 | 原分类路由和真正处理函数 | 只承接确有执行器的路径，盘点/下一步不冒称计算成功 |
| 原始/标准/预处理分层 | ingestRaw/ingestStoredRaw/ingestStoredStandard/ingestPreprocessed | 标准登记不冒充数值入库；CSV/JSON特征导入真实Feature，Excel待映射保持明确 |
| 视频 | 已有session-media/ingests/content/chat与原media triage | 任意获准新会话归档/检查/播放、选Study被试/可选访视登记；内容理解与科研特征分别举证 |
| 音频/图像/压缩包/fNIRS容器 | 旧router、media/archive inspection、processFnirs | 每类真实接收/绑定/处理状态/来源；ZIP仅检查不自动解压入库；不恢复VA/星辰 |
| 任务/日志/质量/报告 | Ingest.listTasks/getTask、原确定性交付/查询/报告 | 会话内看到真实处理结果与失败/待复核，回到正确被试/访视，任务complete≠质量放行 |
| Agent编排与追问 | 当前科研Agent/OpenCode、受控数据服务分支 | 只编排/解释真实结果，模型不制造数值；新附件不改旧任务快照，来源与权限失效停止交付 |

旧公开分片入口Excel实际25MiB，不按raw router的500MiB常量宣传Excel容量。视频/音频按各实际入口独立验证。旧系统没有实现的科研算法不因复制Skill键而完成。

## 串行实施顺序

- F0 核对现有实现、旧真实执行器与当前环境元数据，更新逐项清单和遗漏；完成免费代码审查，不修改共享底座或扩大原角色。
- F1 统一来源/目标解析：保留来源会话私有scope，目标从当前有采集/导入权的真实Study取得；替换正式路径对旧fixture白名单依赖，旧测试许可及历史来源保持。一般表格和视频先贯通普通新会话，覆盖当前Excel未确认上传恢复。
- F2 Excel专用分支：先档案表，再眼动原始及专用整理格式；复用原mapping/confirm及事务。每支做到上传→确认→实际结果→回链，才切下一支。
- F3 四种数据层入口与音频/图像/ZIP/fNIRS容器承接，复用处理/任务/报告；建立只认领Hub明确新任务的消费边界。旧RawProcessing按tenant扫描，不能直接启动旧全量轮询或租约恢复。
- F4 队列/工具/结果卡及视频、表格混合材料联调；串行一次独立总评，集中必要修补，真实浏览器及原生PG/处理器验证，文档同步。不用临时夹具或Mock销项实际能力。

## 实施与授权边界

授权延续：当前目录串行＋独立总评，专用合成库，旧数据只读，保留原页面布局/权限/审核/科学规则。当前请求授权完整整合工作，不代表允许给旧研究Agent全局新增file.upload/subject.bind、全租户扫描、补额或真实发布。

可直接推进：源码核对、纯契约/单元测试、无副作用适配设计、只读目标/配置核查、现有授权下接线。目标解析必须保留原native权限，不把可读Study当可导入，也不把tenant_admin当可读他人私有会话。

出现实际依赖时必须先给准确差异：新增表/列及本表DML、原两账号或Agent新增授权、旧源码定向执行入口修补、Worker新认领配置、具名合成对象/任务写入清单、付费AI任务/预算。确认前不执行这些增量；不借旧P05/MVB固定夹具批准泛化所有历史对象。

本轮尚未更改角色/AgentConfig/表/Worker/运行服务，0模型/业务写。原用户已确认先完整复用实际已有能力，未实现算法另列专项；不因默认Skill名称暗增算法范围。

## 2026-11-17 当前停点与证据

- F0源码及严格合成元数据核对已完成。F1只完成新来源/目标解析契约，尚未装配/启用；F2–F4尚未完成，不能据此宣称完整复用已交付。
- `server/ai-agent/data-agent-targets.mjs`及测试独立复核后修补来源失权不得吞空列表、来源/目标principal分离及缺失身份/回调检查。新6项和旧导入/媒体定向共15/15，见`free-contract-tests.tap`；只是纯契约，不是RLS/浏览器证据。
- [精确执行器准入](raw-executor-admission.md)与拟议patch已备，`git apply --check`通过且旧源码等于checkpoint，未应用。等待用户确认旧1源文件/原测试修补与原admin/A-B回滚验证；不新增权限/费用/历史任务消费。独立复核对心跳、事务连接和文件日志边界的意见已并入申请。
- 不再把原Excel个例路径未补视为整体停工条件；原文件成功恢复仍待实际选择验证，不将隔离harness当成真实文件入库证明。
- 产品living spec/基线/变更/版本已记录本轮真实状态；使用说明不增加尚未启用操作。Notion规划页：`41b56479-ab58-81de-90fb-e239911ce891`。
