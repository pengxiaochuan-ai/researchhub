# T17 S10 固定报告页面检查点

2026-11-12。本检查点只记录本机通用合成数据软件验证。主三渠道受试者、原真实H5提交和主Run均未由本页Agent修改；主S10执行由根保留。临床和生产验收未进行。

## 当前页面与边界

沿原S10单列Panel、研究摘要和8页签接正式`formalReports=1`模式，保留Shell。S01本研究科研产出、S06当前completed/confirmed运行可进入；runId/artifactId互斥，jobId只从实际导出回执附于artifact。只读报告依赖正式report详情与完整原文SHA，未强制Methods读取。正文不可编辑，新报告中文表格与可复核附录分层显示，旧原文在“固定正文与来源”按需展开，原文和摘要未改。

当前服务器capabilities四位与真实状态/来源/DOCX服务状态共同守门；无PDF、公开资产或全站治理扩展。创建、带理由审核、带理由发布、DOCX任务与当前受控下载由实际API执行。最小未知标记仅actor/authVersion/Study/action/target/key，理由、标题、正文和文件不进入浏览器storage。未知仅原GET；当前来源失败清受限内容，普通状态409/503保留未过期理由，POST200但当前未核对亦遵守十五分钟内存限时。

## 已通过的实际证据

证据根目录：`docs/testing/evidence/research-t17-2026-11-12/`。

- `reports-readonly-27ba664a/result.json`：真实reader新中文表格及旧原文合法读取，URL附job仍不发Methods/jobGET，无写动作；owner详情403无正文；互斥模式受限、不回演示。
- `reports-ui-a27f2b52/result.json`：独立新三人真实采集/固定分析来源，S06入口、创建v1、审核、发布、DOCX实际ready、受控下载。4动作各一次POST，原回执与当前状态核对，实际ZIP/SHA/大小/表格/完整小数与附录，刷新原job。
- `reports-recovery-c7ff5f61/result.json`：create/review/release/export分别实际POST200后丢响应，刷新/原GET恢复；原回执200后list/detail/job503清旧正文/文件保标记和理由；404刷新保标记、禁止新写。每动作POST计数1。
- `reports-negative-08522b50/result.json`：实际全缺失列“不可估计”；另一真实审核先完成后的409保理由；changes_requested只回来源、无编辑v2；实际cookie换人清正文/理由；POST200但receipt503后理由保留至模拟15分钟再清，marker保留；真实用途撤回详情409并quiet清内容。另注入实际来源错误码，验证Study404与visit/plan/hash失效清输入和确认。
- `reports-file-safety-5dc9d4ac/result.json`：初版下载实际所有主表格字符串与当前持久Run逐项一致，附录路径/标签/单位完整；成功Blob撤销；另一真实artifact的job200错父链拒绝；实际二进制后注入单字节损坏/最终当前GET503、实际cookie换人均无Blob/交付，无新导出。下载专用fresh读取窄化后的重验待下节记录。
- `reports-visual-e622ce35/result.json`：1440×900与R1同尺寸、390×844、原生Chrome200%（inner720、outer1440、DPR2、scale1），PNG/WebM；主体单列/8页签，14/22操作、16/28正文，全部主数值单行不舍入、表格容器横滚，页面无横向溢出；确认Esc与返回焦点/未保存离开保护。

## 已记录的失败与限制

- 首次mother探查等待被默认pending隐藏的main/header超时；后改观察真实body和隔离母版，`reports-mother-099c6498`通过，不将隐藏态宣称为可用。
- 负向`38e3d4ee`断言误用了“未定义”，实际固定模板为“不可估计”；`d3f5c016`断言漏network的`/api`前缀。只改harness，后`08522b50`通过；失败均保留。
- 视觉`727114bd`、`80d72f6d`把附录中code元素的两个Range矩形也当成数值折行，收窄到实际主表数值后通过，未修改数值或页面字体。
- 文件`057303e6`30秒屏障时file200、最终list200仍在核对；另`5aafb960`90秒无fileGET，定位到显式下载恰遇quiet reader被guard忽略。根已授权下载专用fresh单报告/job并取消旧quiet代际，正在以受控hold读取做RED/GREEN，未用延长等待代替产品修复。
- 390及原生200%顶部既有Shell搜索/身份区拥挤重叠，S10正文、数字、确认和返回仍可操作。本包未修改Shell；按根要求保留为工程兼容限制，不宣称全页无问题。

## 最终冻结

- `reports-readonly-683e65a2/result.json`：在上述reader/owner基础上补真实uninvited Study404无正文/目录；管理员S01科研产出仅带本研究进入S10，S10 header返回按钮与breadcrumb均精确返回当前Study，无演示回退、无业务POST。
- `reports-download-race-7bee7f16/failure.json`是真实RED：hold旧quiet列表GET，显式下载被旧guard忽略，无fileGET。末次`reports-download-race-e9310420/result.json`为GREEN：先实际fetch旧列表200再hold，显式动作取消旧代读取，独立fresh身份/报告/job/SHA交付；下载后释放原旧200（`original200_fulfilled_after_delivery`），当前正文、同job、可用下载及无错误仍保持，业务POST为0。中间`799b92c7`为15秒事件屏障不足，保留失败；未重放业务。
- `reports-file-safety-55442043/result.json`为末次正式文件验证：交付期间目录GET计数0，前后仅fresh身份/同报告/同job/file。共用加强Word验收器已按实际Run、snapshot、固定字段与来源映射新expected，逐21格主数值、每表标题/单位/全部路径、字段版本/hash、rowCount、Run、算子、snapshot与basis精确比对；错真实父job、单字节篡改、二进制后最终详情503、实际cookie身份变化都无Blob/交付。成功Blob及时撤销。`88d22dd1`记录共用验收器升级时旧expected缺rowCount的harness失败，未回退验收器。
- `reports-visual-9fbc7173/result.json`为最终产品源三视口：1440×900、390×844、原生200%（inner720/outer1440/DPR2/scale1）；全部8tab保留顺序，窄屏横滚且不压缩。14/22操作、16/28长文、完整数值单行/容器横滚、确认与下载、Esc/焦点保护通过。Shell顶部既有兼容限制仍按上一节保留。
- 全量前端489/489通过；隔离Vite构建8.56秒通过，输出`/tmp/researchhub-t17-ui-final-build`，未覆盖共享dist。保留构建已有chunk大小提示，未扩展打包改造。
- 业务写窗口已关闭，产品源不再修改。`docs/testing/evidence/research-t17-2026-11-12/ui-freeze/manifest.json`记录本页精确源码、合同/检查点、全部成功与失败PNG/WebM/DOCX/JSON和日志SHA；独立reviewer另行核对，不将单元代签浏览器或专业验收。

本页技术集成已实际验证，主S10基线仍由根执行。根完成living spec、基线、版本、手册、专项API/测试和Notion回读后才标整项闭环；临床与生产仍未验收。建议下一项：根沿原主三渠道固定来源执行主S10报告与更正不改旧版反例，完成T18同例贯通验收与19项任务收尾（编号T00–T18）。

根于11:25:04 UTC只读确认官方runtime已从50403换为91477、ready且lease0，未由根或本页Agent重启。主S10此前尚未执行。683e65a2等原浏览器证据未保存当时PID，保持原文件，不将当前PID追填为历史测试进程；freeze另存当前只读runtime witness，主S10须按当前PID重新fresh预检，禁止回放旧写请求。

## 冻结后的共享依赖漂移复验

原5095 manifest保持原字节。根发现`session-lifecycle.js`由c0341560变为6e75e9ce：仅新增a02资产路由分支和纯helper导入，移除两行后精确还原冻结SHA，旧/现源码与diff已归档。资产helper仅纯声明，predicate严格a02；S10身份/正式return分支、unknown/no-replay/fresh交付等产品源未变，本包未开展A02资产功能。

当前源全量前端490/490、隔离构建8.12秒通过，输出`/tmp/researchhub-t17-ui-drift-build`；真实只读`reports-readonly-896f1b50/result.json`在当前环境重验reader/owner/uninvited、S01同Study与header/breadcrumb精确返回及互斥模式，业务POST为0。独立reviewer36项纯测通过，无S10新阻断。`ui-freeze/post-drift/manifest.json`独立记录新session/dependency SHA、精确diff/旧源码、当前测试/构建/只读、原检查点和本次窄文档/runtime修订，不覆盖5095或回放业务写。

随后共享session只将asset静态import移至第二行，SHA为f1290f9e；新asset依赖为226e2bf7。根选择按实际稳定窗口验收：`reports-readonly-5a8134b7/result.json`开始/结束同时记录session f129、asset226e及PID91477，前后完全一致，全部6项只读角色/入口通过、0业务POST；当前491/491全量前端及隔离构建7.66秒通过（`/tmp/researchhub-t17-ui-import-order-build`）。226e依赖窄审与最终SHA核对由独立reviewer单独记录。唯一新最终快照为`ui-freeze/post-drift/final-manifest.json`，保留5095与6abb原字节和全部失败，不循环回放业务写。根主executor每次新POST前核对已验快照SHA；若再漂移则禁止新写、保原journal只核原结果，不自动追逐新源继续。
