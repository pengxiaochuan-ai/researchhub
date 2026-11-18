# A02 Q01免费复用准入验证

2026-11-13｜**Q01通过，可进入Q02**。用户已确认D02、AU01～04、AF01～03、AI01局部交互及方案模板到独立合成Study B主线；本轮只执行Q01，不把后续动作视为已落地。F-AI仍未批准。当前目录串行、整页独立总评留到Q08，不重复开展每步多代理评审。

## 1. 实际执行与保护边界

专用`wp01_test_full_baseline`双连接及事务marker检查，实际事务`READ ONLY`。原两账号当前数据库身份/authVersion=5，原Study及owner项目关系有效；旧Service读取所需表已有SELECT/INSERT，无新增GRANT。脚本只检查现有权限，**没有尝试写入来证明INSERT可用**。

真实PG前后、浏览器前后全部已有保护字段一致：A01治理10资产/15内容版/39成功事件/trash0/4个已绑定文件；原A02只读10资产/20版；角色、Study/成员、F03两来源及KB、private source/upload/probe文件保持。public完整身份hash仍`53e701e8e24717f5c8c8963978a4fee1e67311e17066849fe28eb01f3a195c91`，沿原精确证明校验，未重建基线；D01及access v2原回执验证通过，owned原fingerprint仍`2e45d306a30c5f513eff0de93170a391cddc754bf68358a072dddd654725aeea`。

本轮新业务对象0、DDL0、角色/权限修改0、新B0、模型/计费任务0、服务重载0。只生成私有待执行fixture-plan（不是业务夹具），文件0600、目录0700；已存在时精确验hash而不覆盖。runtime记录owned PID46020，是验证当时值，不代表未来PID不会变化。登录/登出有正常认证会话/日志，不称整库完全零写入。

## 2. 复用准入结论

| 能力 | 本轮真实执行证据 | 结论/下一落点 |
| --- | --- | --- |
| 固定正文/版本 | 原两账号五类各一的10次真实HTTP GET200；Chrome各五类阅读，owner方案v1历史可见；PG真实版本/hash | 继续用原Artifact/Version及A01 V2 reader；不是旧Service.create已经验证 |
| Markdown渲染 | 实际加载旧renderResearchArtifact，输出真实.md字节/hash/来源/草稿标识；旧artifactExportFilename处理路径字符；无确定性依据sample_size明确拒绝 | 可复用纯渲染器；Q05仍需Hub真实审核状态/合成说明/版权与受控下载适配，不能按旧容器draft冒充Hub审核态；不启用ExportWorker |
| 研究纲要格式 | 实际执行旧buildResearchStudyPlanDraft，输出research-study-plan.v1、requires_methodologist_confirmation和待定方法参数；实际PG JSONB往返与旧canonicalArtifactJson一致 | 底层格式可复用；没有模型产出、未确认PICO/设计、没有创建目标草稿 |
| 文件绑定/完整性 | 4个旧合成文件逐个核对真实asset/version/file父记录、size/hash；用旧StorageService读方法＋受限只读MinIO客户端读取真实字节 | 存储与文件机制可复用；没有触发onModuleInit/ensureBucket，不能创建桶或修改文件 |
| Range | 4个真实对象各读取bytes=0-15并逐字节对比；旧parseKnowledgeSourceRange拒绝越界/多Range/后缀Range | 旧解析/存储partial读取可复用；不是A02受控下载HTTP端点已完成。Q05需把非法Range映射既定416，并明确后缀Range未支持；不悄改旧解析器 |
| 本人草稿创建/版本 | 旧ResearchArtifactsService的create/createVersion/get/fileContent/createExport实际模块可加载；旧public字段/现有应用GRANT核实 | 新目标创建、CAS与原子性尚未执行，Q06必须真实PG/HTTP/UI验证，不用方法存在代替交付 |
| Study B工作台 | 旧Hub local-research-plans明确锁ids.project、rh-plan-20261022前缀、KB/session及来源；不能将新B/资产正文伪装为旧KB来源 | Q06只在Hub补获准资产来源和B目标适配，保留旧窄分支。不得调用该初始化工厂做准入（存在一次性授权副作用），不要求改旧系统/新KB/新付费会话 |
| 讨论/用途/派生 | 旧Review.comment不是通用讨论；A01许可仅read_body/cite，固定单例约束已实查 | 在已批准D02中补两表/精确新族用途及对象键，不放宽旧族；Q02起落地，无额外底座改造 |
| AI | 本轮未创建KnowledgeChatJob、未联网核价、未调用模型 | 新Hub资产输入/结果守门与人工意见可免费实现；Q07真实付费前F-AI另确认，不重置旧预算 |

## 3. Q02必须处理的已批准owned约束

真实`rh_asset.asset_registry`仍有`UNIQUE(tenant_id,study_group_id,research_project_id,owner_account_id,asset_kind)`，加上check_registry_parent中的A01确切key。新A02基础资产及副本不能仅改前端就写入。D02已批准“既有owned约束/函数仅为新manifest支持用途/事件/对象键”；Q02需作独立具名迁移，精确处理该单例约束，并以旧族确切键/原public租户幂等唯一＋新族精确manifest父链保持唯一和数量边界。

不得改写D01原SQL/审计、不放开前缀任意建对象，不改public/RLS/旧GRANT；迁移及新族实写放Q02/Q06，Q01没有试执行DDL。对原A01同类型重复、陌生key、超cap、旧用途扩权的负例必须先RED后GREEN，不能因为新族需要多资产就拆掉所有旧守门。具体真实约束名及定义见[schema-admission.json](../planning/research-assets-product-2026-11-12/evidence/a02-q01/schema-admission.json)。

## 4. 精确待执行manifest

[公开摘要](../planning/research-assets-product-2026-11-12/evidence/a02-q01/fixture-plan-summary.json)与私有计划hash一致：`393e97998a50c3ae7eca845b49d9be2cadfa3c4b1c6666429a9c2cdaa968a797`。

- 新族16候选：两账号五类型基础10＋五类型覆盖副本6；基础每份最多4版、副本每份最多2版，共52版；每份24成功操作、全批≤384。
- Study B仅1个，原owner既有researcher项目关系且非默认；admin不增成员；本人应用方案草稿4份（各2、每份≤2版），不激活Protocol或改源Study。
- 原创TXT/MD新文件4个，每个≤1MiB、全批≤4MiB；评论8条（各4，含同版回复）、每条≤3事件；下载/导出成功各≤4，计入资产操作cap。
- 所有资产初始私有未审、无初始许可；许可/审核是后续明确动作，不由manifest或重启自动恢复。原A01四文件不作新文件额度，原历史任务/probe不重置。

## 5. 测试与真实浏览器

6项新manifest边界测试先RED（缺实现）再GREEN；精确账号/租户、对象键/用途/cap/来源文件/回复版本及目标替换均拒绝。资产相关后端**118/118**，当前前端全量**635/635**，隔离Vite构建**5.43秒**通过；保留已有大包和Node `--localstorage-file`告警，不掩盖为无告警。

真实Chrome1910×1075，两账号各读五类固定版、切原七Tab；500px侧栏、**原A02外层gap9px**、正文段落16/28、无根级横溢。截图人工核对与真实HTTP相符。只是当前只读能力准入，评论/文件/引用复用/相关研究仍占位，变更Tab仍旧版本列表，AI/实际复用按钮未接线；**不把“能点击Tab”记为整页功能完成**。窄屏/200%/新增动作键盘与鼠标闭环留后续，不能使用本轮桌面截图代替。

[owner截图](../planning/research-assets-product-2026-11-12/evidence/a02-q01/owner-overview.png)、[admin截图](../planning/research-assets-product-2026-11-12/evidence/a02-q01/admin-overview.png)、[真实浏览器记录](../planning/research-assets-product-2026-11-12/evidence/a02-q01/browser.json)。实时recordVideo为owner9.92秒/admin8.56秒，原WebM与H264 MP4均保留，完整解码通过；看过角色截图及中/尾帧。admin中间导航帧是实际白屏加载，末帧页面正常，不剪除加载、不拼截图冒充录像。[录屏元数据](../planning/research-assets-product-2026-11-12/evidence/a02-q01/video.json)。

## 6. 失败、修正与限制

保留首次运行记录：测试脚本误给ResearchArtifact include不存在的sources、误按event_id排序（实际复合主键），按真实schema修正；第三次存储读取使用了预发布profile桶，核实local-knowledge实际设置owned key桶后修正，未创建桶/改服务。最终两次live均通过，浏览器前后保护hash一致。

首次浏览器脚本误套A01外栏gap16，真实A02母版是9；并将Reading字号检查改为实际正文段落（规则只定义p/li）。只修验收脚本，不改CSS来迁就断言。失败文件保留，不当成产品修复或省略事故。

本轮专业业务验收、A02新增能力实际启用及目标B写入均未完成；结论是Q01准入通过，没有新增确认项。下一项为已批准Q02：固定详情/版本比较/标签/真实变更记录及D02具名约束迁移，仍不调用付费AI。
