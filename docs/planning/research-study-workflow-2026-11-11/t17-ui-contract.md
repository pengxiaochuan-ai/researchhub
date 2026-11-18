# T17 S10 固定报告 · 同页最小差异合同

2026-11-12。承接已授权13模块19任务中的T17，T16整页与根产品文档/Notion已收口。根确认保留S10原Shell、摘要、8页签和单列Panel，不引入三栏或新页。本合同先于产品代码；主循环保留主Run和主S10验收执行权，UI仅使用独立D6只读参考与本页新独立可失效样例。

## 已观察与必要差异

已实际查看R1 `s10-motherboard-1440.jpg` 与原回归图：原单列Panel是标题、自由正文、复核勾选、保存、产出列表。当前真实默认S10属于pending，main被隐藏；没有现成正式审核、发布、版本或下载区域。第一轮只读探查等待隐藏main超时，不算页面可用；另以body/真实pending和隔离演示上下文保存母版证据。根已明确确认下述差异属于T17授权。

- 摘要与8页签保留；正式页只显示当前研究实际信息，原研究页签按当前Study接已有正式路径，不把固定示例或其他研究作为回退。无当前正式能力的科研资产页签保持明确受限，不扩A01/A02/G01。
- 原标题/正文区域承接可选默认报告标题及已确认Run来源，创建后展示固定v1与安全Markdown正文。正文不可编辑，无数值输入；使用既有安全Markdown/GFM renderer，禁raw HTML与图片外部请求，不新建渲染器。对原contentMd校验SHA；按原字符串分出“可复核附录”在details按需展开，原文/hash/导出内容不改。
- 原确认/保存位置承接带理由审核、发布和共享站内确认；下接固定版本、真实审核历史、DOCX生成/状态/受控下载与最近报告列表，仍按单列顺序。changes_requested保留理由/历史，只回当前来源；不造编辑v2/重新送审能力。重新分析后由新Run生成新artifact的v1。

## 路由与入口

互斥 `formalReports=1&studyId`，可选runId或artifactId，二者互斥；仅artifactId下可选jobId。严格参数白名单、唯一及合法ID，错误模式进入正式受限态，不回demo。jobId只由真实export回执生成，精确核当前Study请求路径、artifactId、versionNo=1、format=docx与当前权限，不从URL猜能力或发现其他任务。刷新只读恢复当前任务，不自动创建/重派。

S06当前已核对completed/confirmed Run增加“生成固定报告”回链；S01既有研究准备/科研产出入口只带本Study。S10可回本研究S01、当前Run S06及分析依据。常规用户不编辑ID、摘要、请求键、存储key或JSON路径。窄header/正式模式/安全登录返回适配不改Shell样式、尺寸、身份区或其他模式。

## 服务与当前状态

统一当前Study `/analysis/reports` list/create/read/reviews/releases/exports，`/analysis/report-receipts/:key?action=&targetId=`，`/analysis/report-exports/:jobId`及`/file`。消费真实list/read顶层canCreate/canReview/canRelease/canExport四位、docxExportStatus与当前状态/来源；权限位不代表审批/发布/服务可执行，不猜role。列表明确最近最多50，blocked仅元数据，不取旧正文。只读reader合法正文与导出权限分开；caps.canExport=false时即使URL带jobId也不读取/显示文件，不据job参数推断能力。owner列表可能200 blocked、详情403仍拒绝正文，uninvited404。

既有artifact正文仅依赖正式report GET及原文SHA校验；服务端已重验basis/Run/审阅/数值，不强制Methods GET Run或snapshot才能显示合法报告。只读reader未获Methods专用Session/Agent/Skill时仍可阅读已授权报告；只有不含artifactId的runId生成上下文读取Methods当前Run。

创建须当前已确认Run与有效固定来源，POST只传原key/runId/可选标题，模板只复制实际Worker结果。人工审阅只in_review，decision approved/changes_requested且理由；发布只approved当前版且理由。每次确认绑定当前artifact/version/hash/status及输入，当前来源/对象变化取消旧确认，不把新内容静默套入旧审批。已发布只表示本研究固定报告可交付，不称公开发表或自动资产沉淀。

DOCX仅在当前canExport、released、服务available时显式生成；queued/rendering展示真实状态并只GET核对，failed/unknown不自动建新任务。POST响应queued不当成ready。GET状态不启动worker，页面不调用全局resume。没有PDF不显示假PDF下载。未知或不匹配job不提供文件/自动重派，保留错误及回报告正文路径。

## 未知结果与数据保护

最小标记仅actor/authVersion/Study/action/targetId/requestKey；create target为Run，其余为artifact。正文、数值、标题、理由、文件及凭证不入浏览器storage；未确认正文/理由仅内存十五分钟，包含POST200但原回执/当前状态未完成核对的分支。过期清输入与确认态，原标记保留。刷新/未知只原GET，严格核key/action/Study/target/version及返回artifact/job，再GET当前list/详情/任务/来源；404仍未知且禁写，无新POST/重算/派送。

回执已保存与当前可用分开：原GET200后任意list、详情、当前来源或job GET503，均停止旧正文/旧文件展示，保留原marker和未过期输入，不假称当前已核对；捕获发生在readView返回前亦如此。普通状态409/503保留未提交理由与上下文，真实身份/用途/来源失效清受限内容。10秒/focus quiet复核不闪busy、不重置输入；读写互斥、当前身份/authVersion/代际守门防迟到覆盖。共享ConfirmDialog支持取消/Esc/焦点恢复；跨页未保存与beforeunload保护保留。

下载由用户显式触发：先fresh读取当前报告/caps及原job，核artifact/version/docx/ready/fileId/filename/MIME/size/SHA；只取该job受控同源file端点，不暴露key/预签名URL或凭证。读取二进制后核大小、响应摘要及实际SHA，再核当前身份、报告和同一job/file；失效立即丢弃内存字节。仅成功时创建短寿命blob URL交浏览器保存，随后撤销。失败只可重读同一受控文件，不暗中导出新任务；无导出权不因合法阅读报告而假称有下载权。

## 验收与收口

先契约/纯逻辑RED→GREEN，独立前端reviewer并行窄审；实际管理员完整create→review→release→DOCX真实ready→受控下载（保存并校验真实Word包与固定数值/真表格），只读reader无写/无文件，owner/未入研究账号拒绝；精确job错父链与模式互斥。独立新来源进行用途撤回/失权/来源变化，未知create/review/release/export、刷新404、回执后list/detail/job503、TTL包含已POST200、状态竞争保留理由、身份切换、0/null与安全Markdown。每动作仅一次显式POST，未知只原GET；不改旧角色/主3人/原H5/主Run/D6依赖来源。

桌面1440/390/原生Chrome200% PNG/WebM，同母版单列比较，14/22操作正文、长文16/28、完整数字单行/表格横滚，无页面横向溢出、无raw HTML执行与假统计。全量前端与独立tmp构建、源码/证据SHA、失败记录、checkpoint和独审齐后，由根同步living spec/基线/版本/手册/API/测试/Notion；文档未完不标整功能完成。临床和生产验收仍单独未验。不据兼容矩阵启动G01/A01/A02或公开资产。

## 实施顺序与文件边界

1. `src/formal-reports-session.js` 与 `tests/formal-reports-session.test.mjs`：先RED，再实现严格路由/六字段marker/回执/DTO/完整SHA/状态cap组合/固定正文分片/精确DOCX文件验证。源依据来自上述实际controller与T17服务，不建通用框架。
2. `pages/shared/useFormalReports.js`：当前身份与授权读取、创建/审核/发布/export及未知原GET、TTL、并发代际、只读reader分权和fresh受控下载；后台保持不改。
3. `pages/shared/FormalReportsWorkspace.jsx`、`formal-reports.css`：原单列母版、安全Markdown与站内确认/离开保护；`workflow-main.jsx`、正式模式/安全返回、窄header及S01/S06入口最小接线。每片运行纯前端测试与独立tmp构建，实际只读检查后再开独立合成写验收。
4. 本页独立UI fixture/harness：管理员全链与只读reader/owner/未入研究、恢复/TTL/409/503/source/撤回、实际DOCX受控下载、桌面390/原生200图像与视频；不能重复POST未知原操作。已完成case及时关闭context；故障屏障先等actual200，不把环境连接中断归产品。
5. `t17-ui-checkpoint.md` 与本页freeze manifest：保留失败与新旧源SHA、全量前端/tmp构建、独审。根同步产品/专项/Notion后才切下页，不修改全局治理/资产/原主样例。

## 下载窄化复核（根确认，2026-11-12）

只读实测10份报告时，全列表GET约3494ms、单报告详情756ms、单job757ms。初版下载两次readView各重新读取全列表，并行验收时30秒事件屏障超时（file已实际200、最终list200仍核对中），失败证据保留。根确认交付依据采用fresh身份、精确单报告当前权限/来源/正文SHA和同job/file；下载前后不遍历全列表。此前已授权列表仅作页面元数据，任一实际GET失败仍清正文/文件，不建Blob或新导出。普通页面和未知恢复继续完整list当前重验及各503反例。

显式下载可中止旧代quiet只读，再重新核验上述全部交付依据；不排队业务写或自动重发。受控hold quiet GET的`reports-download-race-7bee7f16`已真实RED，无fileGET，旧guard静默忽略点击。另根图像复核要求本页窄视口8页签不可压缩并横滚；仅S10 scoped CSS，不变更其他Shell布局或页签数量/顺序。
