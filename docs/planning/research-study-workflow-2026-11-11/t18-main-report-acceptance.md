# T18 主样例 S10 报告验收合同（准备态）

2026-11-12。本合同仅准备主三例已确认 Run 的 S10 固定报告交付验收；当前未创建报告、审核、发布、导出或下载。执行器必须保留 `FAIL_CLOSED`，待 S10 页面最终冻结、主循环独立审阅脚本和明确放行后才能解除。合成软件验收不代表临床或生产。

## 固定输入与只读预检

从 benchmark、main-capture、main-basis 和 main-method 成功指针读取原文件及 SHA256，确认同一 Study/原计划/原 snapshot、方法 completed/confirmed、唯一原三人和 fixed ref1。generic-v2 独立 Python oracle SHA256 固定 `f0dafb552f6ffc43340a61c11c2fe7abc661cc15059a9b7a43b26d5fb8737f3b`，H5 原始证据哈希按 oracle 核；不重发邮件、不写原主数据。GET 当前三 assignment/visit 和各固定 revision，核当前 response.version、锁定批准、原答案/日期、原 ref、visit completed/current；H5 revision 的全部 h5Original 字段相等，CSV import receipt 与来源/行相等。当前批准计划、快照和 Run 必须与已冻结证据匹配，固定 manifest 的 fieldKey→key 对照 oracle；数值直接比较实际确定性 Worker 输出，不由 LLM 重算。读取原成功 Worker trace，证明该 Run 唯一 dispatch、200 与固定版本。HTTP 账号 `/auth/me` 必须与当前真实 admin 会话一致，精确保存 accountId/authVersion；不输出 cookie。

目标是原已确认 Run 的新报告，优先受控检查既有 successful pointer/journal；已有已确认主报告只读核对，未记录的同源现有正式报告或不明中间态停线交根审，不自行新建重复报告。

## 显式 UI 操作、恢复与防重复

真实 S06 回链进入 S10 后，由相同 admin 完成 create、review approved、release 和 DOCX export 四次显式页面确认。标签必须取最终冻结 S10 合同及源码，不提前猜测。每次业务 POST 的浏览器路由仅允许当前已 armed 的精确路径、动作、target 与必要 body；在实际放行前读取官方 runtime 文件，核 ready、原 PID、完整 ids/tenant；先持久化原 requestKey、动作、目标、body 和原 actor/authVersion，再复核 runtime 后放行。只有正常 `/api/auth/renew` 例外。锁定原 Run/artifact/version/status/contentHash 等确认条件，用户界面和服务各自重验。若出现意外 POST、runtime 变化、响应不明或认证变化，禁止再发新业务 POST；仅同原 actor 的原 GET receipt，严格核 key/action/Study/target 及 artifact/job，随后停线给主循环审；404/409/503 均不当作未发生。已确认各步 GET 原回执与当前详情，生成 queued 不冒称 ready，独立 GET 当前 job 状态；不自动调用全局 resume。

同一 admin 是明确测试约束而非授权规则。proof 对 create/review/release/export 分别记实际 `{sessionRole:'admin',accountId,authVersion}`、原 key、action 与 target；原 Method create 由原 researcher，Method review 由原 admin，只读按原 actor 获取。任何确认中身份或版本改变停线，禁止用管理员代读其他 actor 回执。

## 真实 DOCX 和交付证据

仅 released、当前 report 与能力允许且服务 available 时，用户显式生成 DOCX。确认原 export receipt 后以真实 GET 核相同 artifact/version/job/format 和 ready file。页面上的显式受控下载通过 Playwright `download` 事件保存实际 bytes；核下载文件大小、服务 file SHA256、合法 DOCX ZIP、`word/document.xml` 中真实 Word 表格，并逐变量与每项指标比对固定 Run 输出的 JS 原始字符串（含 0 和不可估计，原路径/来源附录完整）。中文显示名/单位从固定表单映射，不能仅验证表格存在。浏览器 GET 只调用同源受控 file，不提供预签名 URL、存储 key 或发送邮件。保存 PDF/PNG 如为本机转换的审阅衍生物须如实标注，不代表新增产品 PDF 功能。

输出唯一目录含PNG/WebM、真实网络状态、实际 Run/报告/任务的安全 DTO、Worker trace、原回执、确认 journal 副本、DOCX及 ZIP/XML/逐值校验和摘要；证明不含 cookie、密码、邮箱或原始密钥。结果按 correction 输入结构提供 `studyId,artifactId,runId,snapshotId,versionNo:1,status:'released',contentHash,createRequestKey,reviewRequestKey,releaseRequestKey,exportRequestKey,actors,job:{jobId,artifactId,status:'ready',format:'docx',file:{id,sha256,sizeBytes,mimeType,filename}},downloadPath`，并绑定 capture/basis/method 文件与 oracle 摘要。`passed:true` 和 `t18-main-report-current` 仅在所有上述技术验证及根逐页检查 DOCX 可读性后写；主循环可把技术证据保持 provisional，单独补根 QA 再批准最终 pointer。失败留原失败记录与 pending，不覆盖成功依据。

## 验证与范围

只创建合同、执行器与纯离线守门反例，`node --check` 可运行；不启动浏览器、不请求 API、不连接数据库、不触运行实例。真实报告写入、DOCX/MinIO/Worker 和最终页面/专业验收由主循环审核后执行；不得将脚本准备或 mock 标为已经交付。用户需的全链仍按 19 任务逐页推进。

既有列表可包含其他独立 Run 的历史报告：逐条核当前详情的 runId；若 blocked 仅对该返回 artifact/version 做受保护只读 PG 绑定检查。只在同 Study 且同主 Run 或不可确定时停线，不要求整个 Study 的报告列表为空。列表达到当前50上限时无法证明完整性，应停线而非猜测无重复。


## 当前已验源码守门（共享目录并行编辑增量）

另一个用户会话正在修改共享登录返回的A02分支，原S10四核心源未变；不得为追逐SHA自动吸纳未验证依赖。根只在独立审阅与真实begin/end同源窗口通过后写私有 `t18-ui-freeze-proof.json`（approved、manifest路径及精确摘要）。报告验收器启动一次读取该证明，随后每次业务POST前、原键写journal之后再次校验同一manifest和其中各源字节；有漂移即禁止新写、保原journal，按原GET交主循环核对，不换键重放或自动更新证明。最后交付亦核同一源码证明。此守门不暂停/修改其他用户会话，不表示要求共享目录永久不再修改，也不将本页证明扩称为所有旧页面源码冻结。
