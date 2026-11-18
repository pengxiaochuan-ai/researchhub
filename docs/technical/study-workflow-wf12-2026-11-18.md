# WF12 · 四阶段任务入口与研究上下文契约

2026-11-18。原12项串行计划的最后一项；仅本机合成范围，最终状态以同日验收报告及final-manifest为准。没有新左侧菜单、schema、公开写API或统计模型。

## 原页与权限

S01原研究准备卡内使用“准备研究→完成访视→分析结果→审核交付”。依次沿原S11、当前页今日待访视锚点、S05正式分析及S10报告；所有跨页链接保留Study。导航不推断全研究完成，不替代临床门禁或人工决定。今日待访视原区域补“查看全部访视”，查看不分配、不启动采集。

`authorizeStudy`沿当前账号、F01准入、RLS、项目/组成员及角色读取，独立返回`workflowCapabilities`三个严格布尔值：canReadVisits、canReadAnalysis、canReadReports。保守依原生执行成员范围；管理员按原租户规则。分析还需data.analyze；报告还需artifacts菜单及artifact.read。原capabilities.canCollect=false等不变；只读提示不能授予操作权。无权阶段保留名称而无链接，缺/混合上下文提供重新读取。

新组件`StudyWorkflowNav`和纯函数`studyWorkflowStages`不产生写请求。S01原固定第三行改为可随内容增高，原卡片/栏位顺序保留；本导航内焦点接近固定页头时居中，四入口分别以实际Tab/Shift+Tab及三点命中验证。不修改Shell或其它页面的固定行高。

## 报告元数据

当前Study事务已读取的project_intent.title作为内部studyTitle传递，不重复GET overview。T17普通和整课题共用的list/detail/preview仅增加可选studyTitle，合法非空字符串上限300；旧服务缺字段兼容。前端list/detail/preview分别验证，可核定后显示纯文本“当前课题”。当前详情/预览元数据优先于列表；身份、来源、DTO校验失败后不保留旧名称。

studyTitle不是固定报告正文或统计输入，不加入contentHash/sourceSnapshotHash/previewHash，不回写旧版本、不改Word内容。真实PG新fixture在savepoint内改课题标题，证明显示变化而固定正文/摘要不变，再回滚；不更名既有课题。

## 分析与错误呈现

仅formalAnalysis的S05标题、面包屑及document.title使用“研究分析”，Shell可能附加“｜岐研”；formalCapture数据疑问仍为原数据质量标题。PARTICIPATION_CAPTURE_BLOCKED仅在经过锚定的analysis/report路径改为对应任务文案，原HTTP状态、code、权限失效回调及阻断保持；采集及其它错误保留原义。

1024真实诊断发现两层原因：内部网格最小尺寸，及旧missing-pages样式的html/body/root min-width1280、main min-width1086。覆盖仅以.rh-formal-analysis限定；中等宽度卡片换行、主栏minmax(0,1fr)，表格仍可独立横向滚动，14/22、不裁切正文、不缩字。旧S09更正提示仅改为按本研究审阅分工办理，政策中的独立审阅不变。

## 验收与保护边界

本项整体贯通复用已验普通/真实课题合成模拟的原记录，和WF01–11先前真实写证据建立映射；不称本轮新建/新完成四访视。现场/H5原修订来源回看，CSV沿原form.import回执追溯（revision.source按原生研究者源保存，不虚造第三种source）。旧运行不在最近50条时，从原固定报告的分析来源链接追溯，不为演练再建运行。

目标原部署rh-kb-local-b0e2af9d，主PID9185受控重载为23888；仍19501，文件仅本机MinIO19402。旧15条非终态MethodRun逐ID/MD5等于WF11封板，真实ExecutionJob在途0，未恢复旧任务。所有旧业务行、591项KnowledgeJob、原科学Word及WF10文件按原保护器核定。

唯一新业务预算为复用两就绪文件各一次GET的2条原生下载审计；0新任务/文件/报告/运行/审批/发布。独占意图文件防止盲重播；文件前后原权限/来源校验仍执行。保护只投影排除逐条验证的新审计ID，任何旧行不能排除。认证审计另按精确注册身份核对。

根串行实施/自审；子Agent仍受用量限制，未冒称独立评审。临床规则批准、真实受试者、生产及不相关的全站Shell问题不在本项核定范围。
