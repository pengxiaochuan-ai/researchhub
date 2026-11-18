## 2026-11-16 · Excel选择后无反馈修复

仅用户当前“Excel选后无反应/无错误”问题，[最小修复](upload-focus-fix-2026-11-16.md)本机技术闭环：18隔离/726纯前端/7.28秒构建、唯一独评集中修补及共享窗口解除后的双账号真实上传/预检通过。原4份单位答卷/旧事实/152预留保持，业务对象/模型/本会话重载0；不恢复I04新空白访视或其他历史任务。[证据](../../testing/ai-upload-focus-2026-11-16.md)。

## 2026-11-14 · 原位字段映射本机启用与真实恢复验证

[原位映射增量](inline-mapping-implementation.md)最终规则已由真实HTTP证明加载，本会话重载0；双账号各一具名暂存/预检，真实选列→原已提交访视拒绝覆盖→GET/刷新保选择通过。原4份答卷/旧事实/152预留保持，模型0。I04获准样本页面部分通过，新空白目标→成功计划/提交的共享正链仍未执行，不据PG回滚销项；I05独评集中修补/文档/保全技术工作完成，专业签收另行。[当前证据](../../testing/ai-inline-mapping-2026-11-13.md)。

## 2026-11-13 · 一般表格带单位真实写入完成（本机）

用户“允许”后，按[已批准增量](authorization-general-tabular-write.md)完成W01–W06，原两账号在唯一新Study准备4例并各一次页面确认，实际4份CRF/4revision，0/2500g→0/2.5kg及false/true、原行追溯通过。一次独评集中修补、真实浏览器/失败恢复/旧事实保全已完成，0Provider；原P05不变，不扩大共享底座。[技术交接](../../testing/ai-general-unit-write-2026-11-13.md)。下方原阶段“未写入/待授权”保留为历史，不恢复其他任务。

# 岐研AI文件与数据接入 · 串行执行计划

> 执行方式：用户已明确“按拆分顺序串行推进”，主代理当前目录按superpowers:executing-plans实施，一次独立总评审。不创建worktree，不并行写产品文件，不恢复旧专项，不提交/清理用户脏工作树。已确认规则不重复询问。

**Goal:** 统一上传→文献私有知识分析；研究数据识别→一次确认具体课题/Study→真实被试入库与解释。

**Architecture:** Hub最小关联/确认适配，复用旧知识/附件/数据服务、原科学算子和Token链。普通Hub检索仍只已审核，个人草稿用固定来源独立读取；data工具在专用服务分支运行。

**Tech Stack:** 现有React/Vite、Nest服务装配、PostgreSQL、对象存储、私有解析/向量服务、OpenCode/DeepSeek；不增加框架或外部服务。

**Spec:** `docs/product/qiyan-ai-file-data-ingestion-2026-11-12.md`（已批准）。

## Global Constraints

- 仅专用合成库wp01_test_full_baseline；原owner/admin及当前Study；旧服务、前序材料和历史任务不变。
- 原AI01两栏/按需证据栏、Shell、14/22操作与16/28长文；一个上传入口，常规同批一次确认，不叠同义弹窗。
- 上传不偷偷调用模型/联网，不自动published/reviewed，不改原工具目录让research通配data能力。
- 知识入库复用private owner范围；数据确认前零Subject/Enrollment/Visit/Feature/正式ProcessingTask写入；Study可读不等于可采集/导入。
- 新DDL/GRANT、原账号/Agent新增授权、付费验证、新云/远端配置/旧后台/发布差异执行前停线确认。禁止自动充值、补额或对账。
- 只跑明确的纯/回滚/具名合成用例，不跑持久fixture通配；正常业务账本不引入新的开发门禁。
- 阶段产物可留源代码/测试待启用，不能以测试或页面按钮存在宣称业务接通；每步记代码/配置/实际执行/业务结果。

## Review Focus

1. 多个有权Study但AI01当前取首项目：上传存放scope与导入目的地分开；P01/P04/P05测试。
2. 未审核private草稿经共享向量/旧knowledge.search泄漏：保持公共检索零命中；P02/P03测试。
3. 上传/入库提交成功但响应丢失：只查同key回执，不再次上传/调用模型；P02/P05/P07测试。
4. 同会话排队时增删附件/改文：各命令快照固定，后续更改不改旧任务；P03/P07测试。
5. 同构表格批次部分行/文件出错：预检明确实际范围，确认后业务PG全回滚；P04/P05测试。

## P01：复用/授权/接口与浏览器基准

Files：本计划、`preflight.md`、`authorization-slice1.md`；新增纯能力/固定材料契约及其测试前先落实命名。浏览器脚本`scripts/ai-file-material-baseline.mjs`只读产品页面，不上传/发问题。

- [x] 读状态并确认本机七服务ready、合成DB标记；DB事务强制READ ONLY，核原两个账号当前权限、AgentConfig、私人库及现有表约束。
- [ ] 用真实Chrome按两账号进入AI01及当前K01，截图/WebM/字号/禁用上传/空会话无自动写；已留基准，但K01原自动建会话POST两次被只读阻止，故“不自动写”未过，不冒称绿色或扩修旧K01。
- [x] 固定首片API及快照边界，新session-material-contract完成11个RED→GREEN；含原件/文档父链、显式删除状态、跨账号/课题/会话和队列快照。未接执行链；参见preflight.md。
- [x] 用户明确批准新增表后，仅在专用合成库创建rh_ai.session_materials及必要约束/索引/trigger/RLS；独评3Important作者一次RED→GREEN修补，真实PG/重入/无应用新权通过。[DDL证据](../../testing/ai-session-material-schema-2026-11-12.md)。
- [x] 用户本轮要求按顺序继续：已执行此前明确列出的限定表DML和原Agent file.read v2，真实应用隔离/最小ACL通过；不扩角色/数据写权/费用。P01原K01只读基准partial保留，不掩盖，也不据此无限阻塞P02。

## P02：文件上传→本人私有库→状态恢复

Files：`server/ai-agent/session-materials.mjs`及独立tests、受控migration；`scripts/local-knowledge-ai.mjs`最小装配/独立controller；`pages/shared/HubAgentPanel.jsx`、新局部材料组件及`src/knowledge-session.js`传输。

Interfaces：材料引用只为`{materialId,version}`，实际tenant/account/session/kb/source/import/doc/hash由后端关联核对。开始/完成同key返回同记录，同key不同hash/大小/用途409；GET回执/列表分页不触发导入。正式路径以实现前契约为准，不是已存在API。

- [x] 原文件检查、原子关联/导入、同key回执、跨账号及真实应用RLS、未知结果恢复；原始RED/修补证据保留，不重传已成功项。
- [x] 复用KnowledgeImport/DocExtract与当前授权，private/draft/未审；只原两账号和当前真实scope，不作Study导入决定。
- [x] 沿原上传按钮、紧凑真实状态/刷新/K01；安全确认复用原保存决定，warning仅人工查看不进AI，不删除历史文件。
- [x] F01/R01本机首片：两账号4格式共8份＋1具名安全样例；Chrome截图/WebM/数据库草稿及边界、K01及刷新通过。最终既有9条只读重走新增上传0、页面/控制台异常0、模型0；免费576通过。P03前临时拒绝两提交入口，真实409/零Message/Job。不是完整数据Agent或专业验收。

## P03：固定本人材料→真实Agent分析

Files：新`server/ai-agent/private-materials.mjs`及tests，`conversation-commands.mjs`、`session-skill-routing.mjs`、本机执行装配和共用输入/消息来源消费者的最小扩展。

Interfaces：命令保存固定材料版本集合；`prepare/validate/project`同一来源hash及当前身份；私有工具只接受本轮签发ID，返回确定性片段/页段位置和实际阅读范围。

- [x] RED→GREEN：本人未审allow可读、tenant/shared/他人/blocked/版本变化不可读；新附件不进旧排队任务，真实app回滚PG与JSONB往返通过。普通Hub已审检索规则未放宽。
- [x] 受控读取及Skill/OpenCode/Token/提交/历史代码装配本机34812；固定引用K01核版，独评1Important/1Minor作者修补。免费核心67、旧交互59、材料14、原生12及浏览器组件6通过，各组不累加。
- [x] 免费验证后，用户批准原owner/admin各一次真实合成问答；目标Chrome各一次Enter，真实DeepSeek/OpenCode各一次、completed且settled，实际2273/2380 Token；四份本人未审资料引用/同版K01/刷新通过。未重试、充值、补额或人工对账。
- [x] P03首片技术验收：两账号引用真实固定资料/来源与事实核对通过；安全warning不入模型、管理员跨owner拒绝；长文开中尾、失权/改版/迟到保持免费/受控证据，不冒充本次真实长文或容量试验。完整混合数据、并发业务及最终用户专业验收仍归P04–P08。

2026-11-13用户批准owner/admin各一次真实合成资料问答，要求验证真实回答、引用一致性与原业务Token结算后继续P04。沿用原9份资料、原两会话，不重传；每账号仅一次Enter/真实模型请求，提交前后写回执，未知结果只查原命令，不自动重试、充值、补额或对账，不添加常驻开发门禁。下段为实际执行结果；通过后进入P04只读预检，不提前写被试库。

实际结果：`.tmp/ai-file-data-2026-11-12/p03-real-approved-2026-11-13/`保存两任务、Provider用量、原生预留/尝试/封口、真实回答/证据包及截图WebM。owner任务cmwe9tcpy000eluy0sit5ier6、admin任务cmwe9uija000xluy0no0wooas；合计4653 Token，均无未知/不一致用量、无需人工对账。原文缺失/零/false/无疗效主张一致，AI推论及解析范围分开；admin一段非科学计数被原数值规则局部移除，未阻断核心解释，保留原回执，不为涂绿重跑。P03首片本机技术闭合，用户专业验收不代签，继续P04免费预检。

## P04：研究数据只读预检＋课题Study选择

Files：新Hub数据预检/计划模块及tests、统一Study resolver适配、AI01内联确认组件；不先修改旧导入逻辑。

Interfaces：`preview({files,targetStudy?,mappingEdits?})`返回固定计划版本、可确认实际范围/异常；无正式数据副作用。目的地服务只返回当前有导入资格的真实课题/Study，不把read标成collect。

- [x] 核心内部验证CSV/XLSX、0/false/缺失/未知单位、同编号跨Study、多Study/访视及错误行；原生签名400、合批容量413回归，不静默填补或截断。
- [x] 获批两表/限定DML与旧材料表重入兼容；原生无写预检、本人文件/计划、原件SHA重验及当前授权、刷新/取消/失败恢复已接原AI01。
- [x] 内联只读汇总区、折叠工作表原值、分页清单及固定批次重新预检；真实当前无导入目标，明确尚未导入，不伪造Study。
- [x] 真实app回滚PG、两账号Chrome真实上传/预检/刷新/取消与原回执恢复、403/503/切身份受控边界；零模型、零正式数据/Job/Token新增。一次独评4Important/1Minor均测试先行修补；见当前P04测试报告。
- [x] P05授权后已接真实Study目标/字段访视映射及一次确认，见下节；P04原只读阶段没有有权目标的事实保留，不将其倒称P04完成过实际写入。

P04隔离暂存授权已批准并落地，本片只读技术交接，不再将两表列等待。旧session_materials仅knowledge，旧Ingest会写正式记录，不挪用。原两账号无data.upload、当前执行项目Study绑定0；正式Study父链、数据写权及映射确认留P05单列精确授权，不因预检成功自动放开。见[已批边界](authorization-p04-staging.md)与[本机证据](../../testing/ai-data-preflight-2026-11-13.md)。

## P05：一次确认→正式导入→被试/访视回链

2026-11-13：M01–M05已批准，实际复用Study b3fa…f090/执行v2/BASELINE/发布Form。两表、owner唯一7天限定许可及两处旧授权依赖已落地；admin沿原权限。原两账号4新Subject、独立4入组/访视、4CRF，AI01一次确认/原key恢复与S03/S09固定回链已真实执行。一次独审2Important已集中修补；[最终验证](../../testing/ai-data-import-p05-2026-11-13.md)。P06未开始、用户专业验收另行签收，不将本片当全部数据Agent。

Files：数据计划提交模块/回执tests、旧Ingest必要最小事务适配（若需修改旧源码另列差异确认）、现有S03/S04/S09数据适配。

Interfaces：`confirm({planId,version,hash})`不信客户端角色/对象，原requestKey已绑定计划；重验Study/权限/同意/源hash与现有数据版本，复用旧导入核心。

- [x] 同key原回执、失权/源变化/计划变化拒绝、半批故障全回滚；未知先查原key，未确认状态不可取消来源。
- [x] 原子提交、保留原更正入口/冲突/锁定规则，不自动入组或完访；对象存储与PG状态分开。
- [x] 本首片成功摘要回真实S03/S09固定对象；不造处理任务或开放S04编辑/新更正能力，后续按授权逐项接入。
- [x] 两账号真实PG/HTTP/Chrome一次确认、丢响应恢复/重复提交/0及false校核；M01–M05内最小许可，不全权补齐。
- [ ] 本机技术交接后由用户按实际科研任务专业验收；不是完整D01–D12全部能力销项。

## P06–P08：旧全部有效能力→联调→总评审

2026-11-13一般研究表格增量已按[最小计划](p06-general-tabular-implementation.md)推进：带版本的字段/单位/基础质控、原预览/映射摘要、真实双账号CSV/XLSX预检与旧批次回归已核对；独审3Important/1Minor集中修补，0模型/正式导入/新授权。现有Study/原来源许可不扩，新单位实际正式写入与用户专业签收仍另验，不将本片销为全部D08/D01–D12或恢复全Study质量工作台。[本片实测](../../testing/ai-general-tabular-2026-11-13.md)。

2026-11-13 P06首片本机技术交接：[数据概览/确定性质控/聚合AI解释O01–O06](p06-overview-quality-implementation.md)。本人P05固定数据只读，16HTTP/13视图、唯一独审集中修补及真实入口RLS回归通过；原owner/admin各一次实际解释completed/settled，合计2328 Token，来源/刷新/隔离通过。强READ ONLY逐条确认P05对象、原许可/角色及152笔旧预留保持。本片技术层关闭，用户专业签收另行；不销项下列全部D01–D12，不恢复其他延期专项。[当前验收](../../testing/ai-data-analysis-p06-2026-11-13.md)。

- [ ] P06先固定data Agent当前有效工具/Skill/执行器配置快照，按reuse-inventory的D01–D12逐项接入/测试；眼动/档案/一般表格/fNIRS/媒体/压缩包分开证明接收、处理与结果。不可用不假装已分析，退役检测不恢复，新增算子不暗增范围。
- [ ] P07两账号/多会话不同材料、同session排队/编辑/刷新、任务/用量一一对应及未知状态联调；只具名新合成对象，非容量压测。
- [ ] P08一次独立总评审；Important由主代理RED→GREEN修补，Minor登记；原用户真实任务和操作次数验收，更新living/使用说明/技术/测试/Notion，四层结果分开。不在全链未完成时标全部上线。

## 执行记录与工期

当前目录脏工作树按用户选择保留，不stage/reset/commit其他任务。每阶段只修改本片文件，记录当前差异和测试命令；构建用独立临时outDir，不覆盖运行服务或其他任务产物。

P05及P06首片本机技术交接已完成；P06双账号各一次真实合成解释及2328 Token实际结算已按报告登记。原角色/许可/额度/历史资料及旧预留不变；无旧服务/临床/云/发布操作。其他P06模态/算子与P07–P08仍待逐项实施，用户专业签收不代签；P02–P05为前序历史，不恢复其他专项。
