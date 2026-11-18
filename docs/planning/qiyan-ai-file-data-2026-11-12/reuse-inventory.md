# 岐研AI文件与数据能力复用清单

2026-11-12，仅本轮静态源码/规格核对；全部“目标未验”，不是已上线声明。主规格：`docs/product/qiyan-ai-file-data-ingestion-2026-11-12.md`。

| ID/旧能力 | 原实现依据（相对aisciencesys根） | Hub现状/实施落点 |
| --- | --- | --- |
| K01个人私有库/文档版本 | app/server/prisma/schema.prisma KnowledgeBase/KnowledgeDoc；knowledge.service visibilityWhere | 已有模型/API可复用，自动归库及本人上传绑定未接 |
| K02原件安全上传与分块 | sessions.controller/sessions.service、chat-chunk-upload、chat-upload-policy/inspector/signature | 原安全能力有效；Hub上传禁用，需同源限定适配，不放任意storageKey |
| K03解析/OCR/表格/元数据 | knowledge/doc-extract.service、knowledge-file-policy、KnowledgeImportService | 已有独立parser及Node降级分支，实际当前格式/质量目标待核 |
| K04导入任务/索引/审核/回收 | knowledge-import.service、ingestion.service、KnowledgeDocVersion | 原draft/reviewed=false不变；不得自动发布以满足分析 |
| K05本人未审核材料分析 | 新Hub受控工具复用上述解析及固定材料 | 当前通用知识/Hub检索不允许，需独立读取范围与权限，不改公开检索 |
| K06Agent、引用与业务计费 | researchhub/server/ai-agent及billing；scripts/local-knowledge-ai | 当前只读Hub/文章已接；附件、固定版本、排队引用与真实模型链待接 |
| D01数据文件识别/内容检查 | sessions/chat-upload-inspector、ingest/raw-triage、tabular-skill-classifier | 复用签名/容器/表头检测，先做零业务写的预检 |
| D02课题、被试、访视绑定 | sessions/upload-interaction；Ingest.assertConversationUploadBindingAvailable；Subject/Enrollment/Visit | 现有Subject强绑定执行项目；Hub须由用户一次确认Study，统一解析非首项目兜底 |
| D03原始数据导入 | Ingest.ingestRaw/ingestStoredRaw、sessions.bindAttachment | 有写入副作用，确认前禁止调用；确认后复用当前授权/幂等/事务 |
| D04标准/预处理导入 | Ingest.ingestStoredStandard/ingestPreprocessed | 保留既有映射、值/单位与数据层，不把raw当preprocessed |
| D05被试档案表 | ingest/subject-profile-import、confirmProfileImport | 保留假名化/映射/任务版本；Hub预检归并不等于自动确认身份 |
| D06眼动原始及映射 | ingest/eye-tracking-import、confirmEyeImport | 按旧提取/确认契约，精确源sheet/行/列；目标样例待验 |
| D07眼动行为/主观情绪/首次注视 | tabular-skill-classifier及RawProcessing的实际路由 | 分类key分别eye-task-behavior-import/subjective-emotion-import/first-fixation-latency-import；分类命中不等于专门算子已执行，逐项核实执行/落库 |
| D08一般表格/未知文件 | raw-tabular-orchestration/raw-file-triage | 结构预览、明确缺项/未支持，不伪造通用算法或科学结论 |
| D09fNIRS接收/处理 | raw-fnirs-orchestration及已发布确定性Skill/Worker | 上传、结构识别、实际预处理分开验；配置/算子不可用明确未完成 |
| D10音频/视频/图像/压缩包 | raw-skill-router、media-inspection、archive-inspection | 保存/检查/绑定/状态沿旧能力；不恢复VA/星辰检测，不自动宣称ML/诊断分析可用 |
| D11处理查询/日志/报告 | Ingest.listTasks/getTask、RawProcessing、task.read/artifact.read/db.query/skill.invoke | 当前权限下读真实处理结果、由AI解释；统计/特征仅真实算子值，失败/缺失保留 |
| D12工具权限与全部有效能力 | common/tool-catalog、RuntimeContext、Orchestrator、Skill发布/装备 | data的file.upload/subject.bind不可直接加research全局目录；Hub服务端受控数据分支逐项复用，需要新授权时停线 |

“全部能力”的收口方法：实施前从当前data Agent有效配置/已发布Skill和执行器生成逐项快照，对照D01–D12补齐遗漏；发现原系统已存在但本清单漏项须补入，不擅自排除。新算法/退役检测或未配置能力标明差异，不冒称原有效能力。

私有库有tenant/group/project/owner范围，不能因为visible或管理员身份而绕过；用户无合法工作区时需明确未完成入库。本人私有草稿读取是新边界，需要针对向量/关键词、工具、历史、原件下载完整负例。

执行前准备：核对源码/依赖版本和parser/vector/storage实际可用性；复用统一Study解析；列明最小DDL/GRANT/角色/Skill差异待确认；新合成文件/被试按具名命名、原数据只读。当前0模型、0上传、0库写、0配置变化，不开启旧扫描器。
