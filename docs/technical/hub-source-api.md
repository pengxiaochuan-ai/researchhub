# ResearchHub 来源目录本机 API

## 2026-11-12 P1原提交回执（仅本机合成启用）

`GET /api/hub-sources/review-receipts/:operationId`：当前具名审核员，固定Hub/租户、本人UUIDv4原请求，no-store；返回`{receipt:{kind,input,review}}`。401未登录、403当前无权、404未查到不推定失败/成功；其他故障不自动重发。账号/authVersion仅由服务器principal装配，不接收查询参数身份。

统一`object-reviews`及按篇`pmc-reviews`有operationId时同原事务追加审计回执；原键同规范参数重放原结果，不重复决定；换参数409。PMC旧无键及分项API保留旧契约，不伪造旧回执。对象写仍direct，PMC写仍app，未扩大写权限。

`rh_source.read_review_receipt(text,text,text,integer,text,text)`为本机获批单函数EXECUTE，固定tenant/Hub/具名账号、事务tenant匹配、当前有效账号/租户/authVersion/grant持锁核验，精确action/schema/op/actor查询，仅投影kind/input/review。owner固定、app不能CREATE或替换；PUBLIC无执行。部署仅`node scripts/hub-source-receipt-read.mjs --apply`且严格合成库守门，运行时无DDL。旧审计RLS/普通SELECT不变。Hub无Study上下文；回执INSERT不使用RETURNING，禁止以ORM回读受限为由扩权限。

页面sessionStorage仅存本账号/授权版本原请求元数据，无凭证/正文。结果未知只GET精确回执；匹配后重读队列才解锁。404后仅明确点击原工具栏“重试上次保存”才原键原内容POST。未知/401/403/409不自动提交，不把队列当前状态当原回执。[技术验收与保护](../testing/governance-p1-recovery-2026-11-12.md)。生产另批，不能照本机脚本直接发布。

## 2026-11-02 PMC审核结构化阅读（只读增量）

`GET /api/hub-sources/pmc-review-articles/:versionId`返回`{article:{candidateId,pmcid,versionId,rawSha256,articleVersion,blocks,references,tables,media,targets,supplements,presence}}`，仅原具名当前审核员可读，未登录401、无权403、非当前范围拒绝。无新权限或公共投影；`Cache-Control:no-store`。读取保存的同版JATS前后重验当前账号/租户/Hub/最新版本，校验对象键、8MiB上限、字节数和SHA-256，不返回本机路径，不联网补取。损坏/不可读取503可显式重试，换版409重新核对；不以旧结构或演示文本伪装成功。

解析拒绝自定义实体/内部DTD，外部DTD不请求；限制节点/深度，仅白名单结构JSON交给React，非HTML注入。章节/原引用/图表目标有稳定版本前缀；表格保留真实th/td/跨度，公式为安全MathML或明确源文本降级，上下标不拼接改值。`pmc-review-items`/统一队列详情只增`componentManifest`供精确缺件分类。原POST审核接口、图片读取、资产指纹及页面/AI范围不变。[本轮验证](../testing/source-review-reading-2026-11-02.md)。

## 2026-11-02 统一来源审核与member读取（仅本机合成）

- `GET review-queue`：当前具名管理员的三类审核队列、实际状态、当前内容详情、外部/工作簿指纹；工作簿按批次＋来源分组，异常来源明确受限。
- `GET review-workbook?batchId&sourceRegistryId[&sourceRecordId][&cursor]`：精确范围的内容/重叠决定指纹、合格和异常数量、当前统一状态及30行分页。`review-history/:sourceId?batchId=...`在后端按批次及其成员行过滤，不混入其他批次。
- `POST object-reviews`：`{kind:'external'|'workbook', visibility:'public'|'tenant'|'withheld', expectedFingerprint, operationId:UUIDv4, documentId? ,batchId?,sourceRegistryId?,sourceRecordId?}`。前端不提交field/purpose/confirmedCount/evidence。复用本机既有direct受控事务（现有app角色无来源行锁所需UPDATE权限，不加数据库授权），固定具名管理员/租户/Hub；事务内共同授权锁、对象锁、真实头和指纹CAS后，生成同一`evidence://hub-review/<operationId>/<snapshot>`引用，原子追加原审核表。任何异常整体回滚；同对象同引用同决定重放返回`replayed:true`，不再增版，其他过期指纹409。PMC继续使用原按篇端点。
- 已采用统一决定的对象，旧`reviews`/`external-reviews`接口拒绝拆分覆盖（409 `HUB_SOURCE_OBJECT_DECISION_REQUIRED`）。旧历史不改，未转统一模式的历史对象兼容原契约。
- `GET member/:collection[/:id]`：认证后当前有效同租户账号可读取公开＋租户内容，collection白名单仅publications/external-documents/clinical-registries/guidance-documents；未知组合404。前端原页面经`hubVisibleRequest`读取，401/403仅回退原公共投影；失败不回退示例。公共端点保持匿名仅公开，PMC原租户图片/附件端点继续受控。
- 统一外部决定覆盖当前可验证书目和注册/指南提取，结构化页面与AI均要求同一操作引用；AI只从校验过的实际文字生成来源片段，原Agent授权、来源哈希/审核版本和最终提交重验保持。缺失全文/图片未解析文字不伪造为AI内容。C01/C03/E01/E02/H06及已展开条款监听真实身份事件，立即中断/清理并防迟到回填。

无需Schema/角色/公共底座变更，不触发模型或外部资源请求。规格及验收边界见[来源审核工作区](../product/source-review-workspace-spec-2026-11-02.md)。

## 2026-10-31 S07人工引用增量（无来源权利扩张）

本机新增`GET/POST /api/research-plan-drafts/:id/guidance-citations`，经原Study/本人artifact.read/edit授权。GET无参数读取head，可选唯一`versionNo`读取精确历史block，200均no-store，返回`version/currentVersion/readOnly/sourceStatus/canEdit`、服务端完整段落坐标/hash、当前获准三来源及受控解析引用；原方案restricted不返回任何段落/选源正文。

POST严格add/remove字段见[引用规格](../product/guidance-plan-citation-spec-2026-10-31.md)，客户端不传原文、页码或账号。复用封存版本的`guidanceCitations`字段，只存精确来源/提取/hash/审核版本、目标UTF-16完整段落/hash及服务端建立人/时间。source文档同键锁、当前双审核、CAS/审计和版本原子；未知字段400，版本/来源变化409，非当前本人401/403。响应`{appliedVersionNo,replayed,view}`；同键同输入先验当前授权，再重解析当前view，不重放旧原文。同一来源撤回再批准不自动恢复旧关系。解除外部失效关系允许，但原方案restricted/stale仍禁止。无新表/迁移/grant、原文下载或AI用途；[真实验证](../testing/guidance-plan-citations-2026-10-31.md)。

## 2026-10-31 PMC 按篇决定增量（覆盖下文旧逐组件操作口径）

本机合成库只增 `rh_source.pmc_article_decision`（强制 RLS；应用角色仅 SELECT/INSERT，采集角色无权），保留旧 `pmc_review_decision` 历史。`GET pmc-review-items` 增 `articleDecision` 与 `assetFingerprint`。原 `POST pmc-reviews` 新请求为 `{versionId,rawSha256,visibility:'public'|'tenant'|'withheld',expectedVersion,expectedAssetFingerprint}`；公开/租户放行必须带预览返回的 SHA-256 指纹，提交时资产清单变化则 409 强制刷新。`withheld` 无需指纹且不受图片/附件预览上限阻断，确保随时可撤回。仅具名当前 Hub 审核员可用。提交同事务重验账号、租户、Hub、当前文章版本/哈希和 CAS，追加不可覆盖决定；无须字段、用途、组件、HTTPS 依据或第三方逐件勾选。旧逐项契约仅对尚无按篇决定的文章兼容；按篇决定一旦出现即优先，包括 `withheld`，旧写入拒绝，不回落旧批准。

公开 `GET publications`、`GET publications/:id` 及 `GET pmc-images/:id`、`GET pmc-assets/:id` 只接当前 `public` 决定；新增需登录的 `GET tenant-pmc-publications[/:id]`、`GET tenant-pmc-images/:id`、`GET tenant-pmc-assets/:id` 仅接当前 `tenant` 决定，并在每次读取重验活跃账号/租户。AI 原 `hub_source_search` 对 `public` 和 `tenant` 当前决定均可检索，但仍须原科研 Agent 授权，引用持决定版本/文章哈希在模型前后、最终提交和历史读取重验。一个决定同时开放当前已暂存字段/组件的页面读取及可解析文字检索；缺件不能获准，图片不进入文字检索。图片字节读取仍持候选锁、验本地对象大小/SHA、安全 MIME，不回退外站。仅本机技术接线，未作 PMC 持久放行或生产发布。[规格](../product/hub-source-catalog-spec-2026-10-30.md)。

## 2026-10-31 PMC 首批候选增量（仅专用合成环境）

独立 collector 只写 `rh_source.pmc_run`、`pmc_candidate`、`pmc_candidate_version`、`pmc_asset`；`pmc_collector_binding` 把专用角色固定到本机合成租户/Hub/campaign，`pmc_review_decision` 只由当前具名 Hub 管理员追加。六表均强制 RLS，不改旧来源表。每次官方请求先经 `reserve_pmc_request` 持久预约，完成后经 `complete_pmc_request` 留状态/响应哈希；新首跑在标记 ESearch 成功前先保存受限原响应，`set_pmc_query_translation` 校对账本摘要并在候选落库事务内记录实际翻译。2026-10-31 已执行的首次发现发生在此修正前，账本保留原响应哈希但没有原始 ESearch 响应对象，故数据库 `query_translation` 暂空；不能把此前只读预检的翻译冒充同一次正式响应。后续恢复不自动重发已成功请求。

`GET /api/hub-sources/pmc-review-items` 只供当前具名 Hub 来源审核人，返回首批最多20条及当前文章版本/原件/组件、哈希、许可和逐用途审核状态；不返回原件字节。`POST /api/hub-sources/pmc-reviews` 要求精确 `versionId/rawSha256`、字段或组件 SHA、`purpose`（`display`/`download`/`ai_retrieval`）、`audience`、决定、HTTPS 权利/内容依据、显式确认和 CAS；当前账号、租户、Hub、版本及第三方组件权利在提交时重验。

原 `GET publications`/`GET publications/:recordId` 增加 `pmc-PMC…` 只读分支：书目公开展示决定有效才返回文章，摘要/正文/表格各自需要展示决定；图片/补充材料需要展示与下载双决定。`GET /api/hub-sources/pmc-assets/:assetId` 只从本机受限目录返回已双准组件，持有当前候选行与审核版本锁至响应完成，校验对象键、大小与 SHA-256；未审/撤回统一404，缺文件或哈希不符503，`no-store`、`nosniff`、附件下载，不提供全文章 PDF。Hub 科研 Agent 的 `hub_source_search` 另需书目及实际片段字段的 AI 决定；检索、模型前后、最终提交及历史读取重验版本、审核和片段哈希。图片或未确定性解析的附件不被伪装成 AI 文本。

图片只读增量：`GET /api/hub-sources/pmc-review-images/:assetId` 仅供当前具名 Hub 审核员，对本机受限图片先重验当前版本、对象 SHA/大小及安全图片格式，再以 `inline` 预览；不构成公开批准。`GET /api/hub-sources/pmc-images/:assetId` 仅供书目与该图片公开展示、原件下载决定均有效时内嵌阅读，沿用原件接口的当前锁、完整性及失效规则。两者均不代理官方 URL、不提供 SVG/HTML 等可执行格式、不缓存。公开文章投影的图片依 JATS `media_refs` 补图号、图注、原文图序；额外未引用组件不伪装成正文图片。

**范围**：当前仅本机合成库与既有两账号；新 PMC 文章尚无具名权利放行，公开页与 AI 均无此批结果。真实正向展示/下载/AI/撤回浏览器验收要在管理员逐件确认后进行；无审批、共享、正式发布或付费模型调用。

## 2026-10-31 指南／标准关键条款增量

新增公开只读 `GET /api/hub-sources/guidance-documents/:documentId`。ID为原三份不可变 `rhed-…`，同一SQL快照选择当前源v1/固定SHA、最新有效书目展示决定、当前提取及其最新展示决定；非本范围、书目未审/撤回或源换版统一404。200返回 `{item:{…原元数据,clausesStatus}}`，状态为 `approved|pending_review|unavailable`；仅摘录当前获准才有 `clauseDetails`。不返回原PDF字节或审核依据，`Cache-Control:no-store`。列表 `guidance-documents`、外部目录和AI投影不扩大。

`clauseDetails` 为 `{externalKey,schemaVersion:1,extractorVersion:"pdf-ocr-visual-v1",pageCount,editionNotice,transcriptionMethod,clauses:[{id,heading,quote,pdfPage,printedPage,anchor}],fileName,extractionId,extractionVersion,sourceSha256,payloadSha256,reviewVersion}`。页码1-based，物理/印刷分别保留；只允许与三份本机逐页复核摘录清单完全一致的JSON指纹。清单仅用于服务端校验和受控导入，不是无DB时的正文回退。

`GET external-review-items` 仅具名当前admin增 `guidanceExtraction`（精确提取/哈希、受控正文/页码、当前review），对应 `guidance_clauses/display` 决定追加在 `decisions` 中；原事件计数仍只计原表。`POST external-reviews` 新分支要求 `fieldKind=guidance_clauses,purpose=display`，沿原必填项加 `extractionId,payloadSha256`、匹配精确当前提取并按新表决定版本CAS。复用原grant/账号/租户及文档提交锁，错用途/非指南标准、失权、旧提取/源/哈希/CAS拒绝，不改其他分支。

新增 `rh_source.guidance_clause_extraction`（应用仅SELECT）与 `guidance_clause_review`（SELECT/INSERT，无UPDATE/DELETE），FORCE租户RLS、同租户/Hub复合FK、唯一约束及精确策略全集准入。导入器只认 `wp01_test_full_baseline`，核对DB原件字节及本地SHA、文档锁内幂等插入3条；不改旧表。原admin已真实记录三条本机摘录展示批准，新表版本5/6/7，原五份书目158–162和注册详情7/8不变；跨表版本号不可混算。[规格](../product/guidance-clauses-spec-2026-10-31.md) · [测试](../testing/guidance-clauses-2026-10-31.md)。

## 2026-10-31 两条注册结构化详情增量

`GET /api/hub-sources/clinical-registries/:documentId` 在原公开书目门禁上新增 `structuredDetailsStatus=approved|pending_review|unavailable`。仅当前源版本/固定SHA、最新有效书目展示批准与当前提取展示批准同时满足时，返回 `structuredDetails`；否则不返回未审字段。源版本、书目决定、最新提取及其最新决定由一条SQL同快照选择，不再多查询混合授权状态。404、`no-store`与列表契约不变，AI检索不取这些详情。

`structuredDetails` 包括 `schemaVersion=1`、`extractorVersion=chictr-mhtml-v1`、`registrationNumber/sourceUrl/snapshotDate`、`extractionId/extractionVersion/fileName/sourceSha256/payloadSha256/reviewVersion`，以及 `design[]`、`arms[{id,name,sampleSize,intervention}]`、`outcomes[{id,name,englishName,type,timepoint,method}]`。每个字段为 `{key,label,value,status,source:{tableIndex,rowIndex,cellIndex,line,column,sourceLabel,quote}}`，定位均1-based、行列属于解码后HTML；空字段value为空、status为not_reported。只允许确定键集合，不返回联系人、原始metadata或MHTML字节。

`GET external-review-items` 仅向当前具名来源管理员增 `structuredExtraction` 受控字段、提取身份/hash及当前review；review亦纳入 `decisions` 的 `registry_details/display` 组合。原 `reviewDecisionCount` 仍只计原外部书目/摘要/全文表事件，不与新表identity版本混算。`POST external-reviews` 新分支只允许 `fieldKind=registry_details,purpose=display`，除原参数外要求 `extractionId,payloadSha256` 匹配当前源及提取头，CAS比较新详情决定版本。复用当前grant/account/tenant锁与文档锁，非临床来源、错用途、旧版本/哈希/提取和失权拒绝；其他分支不变。

局部新增 `rh_source.clinical_registry_extraction`（应用仅SELECT）和 `clinical_registry_detail_review`（应用SELECT/INSERT，追加式）。两表FORCE租户RLS、复合同租户/Hub外键及精确策略/唯一约束准入；导入仅固定本机合成库，验证DB原件字节及本地SHA后幂等插入2条，不改旧表。原admin经真实G02写入两条详情展示批准（新表版本7、8），前序五条书目批准158–162不变。[规格](../product/clinical-registry-structured-detail-spec-2026-10-31.md) · [测试](../testing/clinical-registry-structured-2026-10-31.md)。

## 2026-10-31 当前五份持久展示批准

按本轮用户决定，既有具名admin经原 `POST /api/hub-sources/external-reviews` 写入五条v1 `bibliographic/display/public` 批准，版本158–162。未改API门禁或角色，其他字段/AI用途未新增。当前 `external-documents` 返回5条、`clinical-registries` 返回2条、`guidance-documents` 返回3条，两条注册详情返回200。工作簿论文接口仍0条，AI检索仍0命中。前序“当前0条批准”是历史检查点；当前真实回执和HTTP验证见[本轮记录](../testing/initial-five-display-2026-10-31.md)。

## H06 指南与研究标准公开只读接口（2026-10-31）

`GET /api/hub-sources/guidance-documents` 返回 `{items:[{documentId,documentType,externalKey,title,sourceTargetCondition,hubTopic,sourceName,sourceUrl,reviewVersion}]}`；仅首批五份中 `research_standard` 和 `clinical_guideline` 的当前 v1 文件 SHA 及最新有效 `bibliographic/display=approve/public` 条目。匿名公开只读、`Cache-Control: no-store`；不返回原 PDF、未审正文、审核依据或 Study 内容。当前持久合成库 0 条具名批准，响应 `items:[]`。[规格](../product/guidance-source-real-spec-2026-10-31.md)。

## C01/C03 临床注册来源公开只读接口（2026-10-31）

`GET /api/hub-sources/clinical-registries` 返回 `{items:[{documentId,documentType,externalKey,title,sourceTargetCondition,hubTopic,sourceName,sourceUrl,reviewVersion}]}`；只选五份初始来源中类型为 `clinical_registry` 的两份，且当前 v1 文件 SHA 匹配、最新有效 `bibliographic/display=approve/public`。`GET /api/hub-sources/clinical-registries/:documentId` 以 `rhed-` 加 40 位十六进制不可变 ID 重新核验同一门禁，返回 `{item}`，未知/未审/撤回/换版统一 404。两接口公开只读、`Cache-Control: no-store`；不返回原文、未审字段、审核依据或任何 Study 内容，不增 grant。当前合成库仍 0 具名批准，列表为 `items:[]`；非空审核仅用回滚 PG 夹具验证。[规格](../product/clinical-registry-real-spec-2026-10-31.md)。

## 五份外部来源逐项审核决定（2026-10-31，本机合成）

`GET /api/hub-sources/external-review-items` 增补 `versionId`、`fileName` 和当前版本六个字段/用途组合的最新 `decisions`（字段、用途、决定、受众、版本、依据、审核人、时间）；仅当前具名审核人可读，不返回原文。`POST /api/hub-sources/external-reviews` 接收 `{documentId,versionId,sha256,fieldKind,purpose,decision,evidenceRef,expectedVersion,confirmed:true}`，`fieldKind` 为 `bibliographic|abstract|fulltext`，`purpose` 为 `display|ai_retrieval`，`decision` 为 `approve|revoke`，受众固定 `public`。服务端仅允许部署中具名合成管理员、按不可变 ID＋类型＋外部编号锁定的五份来源当前版本；持有 grant/账号与来源决定提交锁，支持的版本导入器同取文档锁，重验 `source.review`、版本指纹和同组合 CAS。依据仅接受 HTTPS 链接；未建受控登记前拒绝 `evidence://`。撤回必须有当前批准。401/403/404/409/400 分别表示无会话、无审核权、非本范围、过期决定/文件、请求无效；响应 `Cache-Control: no-store`。

应用角色仅追加 `external_review_decision`，不能 UPDATE/DELETE，不能读取 `external_document_payload`。本切片没有把这些决定作为 H01/C01/H06/AI 的实际内容投影；后续必须对真实提取字段、当前版本/决定和原授权另做交付重验。管理员身份本身不是内容权利凭据。当前合成库尚无这五份的真实审核决定，故不能称内容已公开或供 AI 检索。[规格](../product/h0-five-source-review-spec-2026-10-30.md)。

## 五份外部来源待审核预览（2026-10-30，历史检查点）

`GET /api/hub-sources/external-review-items` 复用当前 `source.review` 授权和固定租户/Hub 的 RLS 事务，只返回 `selection_basis=user-selected-initial-data-2026-10-30` 的最多 20 条目录元数据及最新版本。响应为 `{items:[{id,documentType,externalKey,title,sourceTargetCondition,hubTopic,selectionStatus,sourceName,rightsStatus,versionNumber,sha256,sourceUrl,sourceUpdatedOn,reviewDecisionCount}]}`；不返回 `metadata` JSON、原文件 payload 或联系人，设置 `Cache-Control: no-store`。无会话或不匹配部署租户的令牌 401，当前来源审核授权缺失 403，失效授权不得读取。当前五条 `reviewDecisionCount=0`，此接口只读，不授权公开展示或 AI 检索；外部来源审核写入契约尚未开放。[规格](../product/h0-five-source-admin-preview-2026-10-30.md)。

## 2026-10-30 · 旧科研 Agent 会话适配（仅本机合成）

- `POST /api/sessions/hub-source`：体为 `{agentId,hubKey:"lingshu-xinyu"}`；必须带当前合成 Study 的既有请求头和有效登录/科研 Agent 权限，只建立本人 `hub:lingshu-xinyu` 独立会话，不赋予新的 Study 权限。
- `GET /api/sessions/:id/knowledge-state`、`POST /api/sessions/:id/knowledge-messages`、`GET /api/sessions/:id/knowledge-sources/:messageId/:index` 复用旧会话队列接口；Hub 模式发送体的 `kbIds` 必须为 `[]`，问题最多 100 字，无附件。私有知识库会话仍为 `kb:<id>`，两类会话不可互用。
- Hub 适配仅占用旧 Orchestrator 固定的只读 `kb_search` 执行槽；实际执行 `hub_source_search` 当前投影，持久化 `hubSources/hubTools`、`sourceType=hub-reviewed-publication`，不写旧 `knowledgeDoc/Chunk`，不向模型声称是 Study KB。
- 无当前已审核可检索来源时在模型前失败；模型前/后、最终提交事务、历史及来源读均重验。撤审、失权、版本/片段/引用变化时不交付原回答。`GET /api/knowledge/ai-status` 的既有本机预算/报价门禁仍挡住新付费调用；本轮未调用真实 Provider。
- 自然问句检索先用原文，再用从原问句确定性截取的主题短语回退一次；没有模型查询扩写。最终 assistant INSERT 所在事务设置租户上下文，锁定对应 `source_registry` 行 `FOR SHARE` 并重验引用；管理员审核使用同一行 `FOR UPDATE`，两者串行。Hub 历史读取在一个只读事务中顺序检查每条回答的全部来源，失效则隐藏内容；不为多条回答同时新建多个 PG 连接。
- 来源许可的 `expires_at` 在 SQL 投影中按数据库实时 `clock_timestamp()` 判断，覆盖事务开始后才到期的情况；同一事务跨到期的合成 PG 测试须拒绝旧引用。历史分页在 60×6 来源极限下仍需批量化压测，超时不会回退演示答案。

2026-10-30 状态：仅本机专用合成环境。所有路径都经既有 HttpOnly 登录会话、部署租户范围守门及服务端当前账号/Hub 授权核对；不接受客户端传入租户或 Hub 来扩大范围。当前 Hub 固定为本机 `lingshu-xinyu`，未来多 Hub 需另做显式上下文，不把单 Hub 写成平台通用假设。

## 管理审核与当前投影（仅本机合成环境）

五份外部来源的条件式投影使用单独的 `external_document`/当前最高 `external_document_version`，不并入工作簿论文。`GET /api/hub-sources/external-documents` 为公开、`Cache-Control: no-store`、当前版本书目展示决定有效时才返回白名单元数据（类型、编号、题名、原始疾病、Hub 主题、来源与原始 URL）；无真实批准时 `items: []`，不返回原件、文件名、SHA、审核人或依据。旧 Hub `agent-retrieval` 可返回带 `externalDocumentId` 的独立元数据引用，但还须当前版本书目 AI 用途决定及现有 Agent 授权；来源快照的版本/SHA、两项决定、题名/编号/类型/URL、片段哈希在模型前后、最终提交和历史读取重验。最终提交对外部文档取与审核/导入相同的事务 advisory lock；撤回或导入新版本后旧引用失效。摘要/全文没有受控提取文本，当前一律不投影。

- `GET /api/hub-sources/review-batches`：仅当前具名 Hub 来源审核人；返回最多 50 个本 Hub 批次及原始行/错误计数。未授权 403、无会话 401。
- `GET /api/hub-sources/review-batches/:batchId/sources`：仅审核人查看该批来源与可审核/异常计数。
- `GET /api/hub-sources/review-batches/:batchId/sources/:sourceRegistryId/rows?cursor=`：仅审核人按页预览原始行与字段可用性；不向普通读者暴露未审正文。
- `GET /api/hub-sources/review-history/:sourceRegistryId`：返回该来源最多 200 条追加决定的版本、范围、字段、用途、依据引用、审核人、时间。无授权不暴露正文。
- `POST /api/hub-sources/reviews`：只接受 `batchId`、`sourceRegistryId`、可选 `sourceRecordId`、`fieldKind`（`bibliographic`/`abstract`）、`purpose`（`display`/`ai_retrieval`）、`audience`（`public`/`tenant`）、`decision`（`approve`/`revoke`）、`evidenceRef`（HTTPS 或受控 `evidence://` 引用）、`confirmedCount`、`excludedCount`、`expectedVersion`；批量范围还必须 `homogeneousRightsConfirmed=true`。服务端重算同来源有效行和排除数，错误行/缺字段不批量放行；以来源行锁和当前版本 CAS 追加决定，撤回不覆写历史。无依据/数量不符 400、失权 403、版本冲突 409。

- `GET /api/hub-sources/publications?q=&cursor=&limit=`：公开只读，本机固定租户和 Hub；仅当前获准公开展示的书目及独立获准摘要。返回 `items`、`nextCursor`、`counts`（`stagedRows`、`approvedDisplayRecords`、`approvedAiRecords`），`Cache-Control: no-store`。其中暂存数不能当作结果数。
- `GET /api/hub-sources/publications/:recordId`：公开详情，当前授权已失效或未审返回 404，不返回原始未审正文；`Cache-Control: no-store`。
- `GET /api/hub-sources/agent-retrieval?query=`：要求有效会话与既有科研 Agent 使用权限，返回与旧 KbTools 同形的只读 `{result, mutated:false, meta}`，`meta.sources` 含来源记录、原始行哈希、规范版本、书目展示/AI 及摘要展示/AI 审核版本、实际片段字段与 `snippetHash`、工作簿/行号、DOI/来源 URL。发送前再经当前授权投影重验；内部 `assertCurrentAiSources` 已用于独立 Hub 会话的模型前后、提交前和历史读取，除版本/片段外也逐项核对引用元数据。独立 GET 本身只做确定性 PG 检索、不产生模型费用；会话模型链路目前只以免费替身验证，真实 Provider 未执行。

本 API **不自动审核**两份第三方工作簿。当前审计决定数为 0，页面与 AI 可用数仍为 0；管理员需本人确认具体来源、字段和用途权利依据后才可提交。审核人身份本身不是许可。`fulltext` 本切片接口明确拒绝，因为工作簿无全文。

审核历史取**最新 200 条**后按版本升序返回；CAS 使用该范围内精确字段/用途/行或批次的最新版本。单行撤回在同字段/用途的有效批次批准之后可覆盖该行，其他同批行继续可见；同一来源审查写入按来源行串行。写事务通过 `rh_source.hold_review_grants_for_commit()` 受控函数持有 grant 事件表 SHARE 锁，并锁住账号/租户行至提交；不向应用角色授予 grant 表 UPDATE。查询端在 SQL 中限制分页与过滤，计数在 SQL 聚合，避免把全部已准记录传到 Node。

## 数据库边界

`rh_source` 七表启用且强制 RLS：`review_grant_event` 单独管理 Hub 审核授权；来源、批次、原始行、规范候选、来源关联、追加审核决定不改旧共享表。`review_decision` 只增 `audience` 与 `expires_at`（旧决定默认租户范围，不自动变公开）；原始行和快照不变。`display_allowed`/`ai_allowed` 暂存默认均 false，列表/详情/检索读取最新有效审核决定而非只读这两个布尔值；撤回、过期及失权不能命中。API/页面不得输出原始未审正文给普通用户。
2026-10-31 补充：`pmc_article_decision.asset_snapshot` 为提交时图片/附件 ID 与 SHA-256 清单，页面投影及原件读取只交付与最新快照一致的组件；同版本后补件可由管理员以相同 visibility 和最新 expectedVersion 再确认。已有按篇决定时，旧 `POST /pmc-reviews` 逐项形态拒绝 `HUB_SOURCE_ARTICLE_DECISION_REQUIRED`（409），旧历史只读保留。合成库采用只增列迁移，不改旧系统共享表。

