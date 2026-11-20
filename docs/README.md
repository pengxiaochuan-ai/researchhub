## 2026-11-20 · 正式登录入口与公开Logo

[规格](product/p003-production-entry-2026-11-20.md) · [验收](testing/p003-production-entry-2026-11-20.md)，本机通过，生产未发布。

## 2026-11-20 · 账号三页图片性能

P003/P004/P005本机已复用无损小图与缓存，每页冷图片4.96MB→1.99MB，线上尚未发布。见[规格](product/account-image-performance-2026-11-20.md)和[验收](testing/account-image-performance-2026-11-20.md)。

## 2026-11-19 · 公开页面字号与留白规则

[现行UI规则](ui/portal-typography-v1.0.md) · [实际截图与验收](testing/public-ui-standard-2026-11-19.md) · [统一用户复验](product/用户验证与操作手册.md#公开页面统一排版复验2026-11-19)。本机已应用；生产和客户视觉另验。

## 2026-11-19 · P002其余区段推广减负

[逐区实测与截图](testing/p002-full-page-light-2026-11-19.md) · [统一用户复验](product/用户验证与操作手册.md#p002其余区段推广复验2026-11-19)。首屏/流程获用户确认，后五区及页脚本机已应用，生产另验。

## 2026-11-19 · P002首屏与科研流程减负

[实测与对照截图](testing/p002-entry-light-2026-11-19.md) · [统一复验步骤](product/用户验证与操作手册.md#p002首屏与科研流程减负复验2026-11-19)。本机已应用，用户视觉与生产另验。

## 2026-11-19 独立演示环境已接通

- [独立后端与线上前端实际交付](technical/hub-live-backend-release-2026-11-19.md)
- [真实登录与目录读取验证](testing/hub-live-backend-release-2026-11-19.md)
- [用户统一体验步骤](product/用户验证与操作手册.md#线上独立演示环境登录与查看2026-11-19)

## 2026-11-19 · 当前优先：独立数据库演示交付

[独立交付边界](technical/independent-demo-delivery-2026-11-19.md) · [ADR-0015](decisions/0015-independent-demo-database-first.md) · [12月以后合库待办MB-01](planning/phase1-review-2026-10-19/deferred-database-integration-2026-12.md)。共享首装方案延期；先交付获准资料和明确标识的合成样例，不整库恢复历史测试任务。下方旧主线保留为历史。

## 2026-11-19 · Hub首次安装到共享aisci（方案，未执行）

[实施与原数据保护方案](technical/hub-first-install-production-plan-2026-11-19.md) · [源对象工作库存](technical/hub-first-install-object-inventory-2026-11-19.md) · [生产只读事实](technical/production-readonly-preflight-2026-11-19.md)。开发库不合并到生产；原五步仅已安装基线增量，生产需独立首装包。精确差额、SQL及演练后再提生产审批。

## 2026-11-18 · 发布反馈与五页导航统一

[验收证据](testing/governance-navigation-feedback-2026-11-18.md) · [反馈契约与五页导航差异稿](technical/governance-navigation-feedback-2026-11-18.md) · [统一手册反馈复验](product/用户验证与操作手册.md#2026-11-18--发布成功反馈复验)。F03成功反馈及用户确认的五页局部导航已实施、真实浏览器验证；S11只限治理入口。用户／生产验收另计。

## 2026-11-18 · 课题流程12项优化完成

[最终逐项与整体验收](testing/study-workflow-wf12-2026-11-18.md) · [四阶段/上下文契约](technical/study-workflow-wf12-2026-11-18.md) · [统一完整操作路线](product/用户验证与操作手册.md#17-wf12四阶段完整操作路线)。本机合成范围WF01–WF12全部闭环，历史证据及明确限制保留；临床和生产未验。

## 2026-11-18 · WF11更正影响与重新交付

[验收与失败记录](testing/study-workflow-wf11-2026-11-18.md) · [只读API及来源契约](technical/study-workflow-wf11-2026-11-18.md) · [统一手册第16节](product/用户验证与操作手册.md#16-wf11更正影响与重新交付)。旧交付实际阻断、现有交付优先核定、同计划入口去重与真实身份恢复已核；仅本机合成，继续WF12。

## 2026-11-18 · WF10下载Word

[单动作交付验收](testing/study-workflow-wf10-2026-11-18.md) · [恢复与文件契约](technical/study-workflow-wf10-2026-11-18.md) · [统一手册第15节](product/用户验证与操作手册.md#15-wf10下载word)。两真实私有文件、正文/表格、刷新/身份/原回执与旧行保护已核，仅本机合成；WF11–WF12继续。

## 2026-11-18 · G02常用管理上移

按用户确认，仅前置原常用入口并收紧间距；原路径/权限/业务保持。[规格](product/g02-action-overview-2026-11-11.md) · [两角色/五宽/200%验证](testing/g02-common-order-2026-11-18.md) · [统一手册G02专节](product/用户验证与操作手册.md#g02总览常用管理位置与入口往返)。本机已更新，用户体验待反馈。

## 2026-11-18 · WF09当前分析报告预览

[F03规格V0.2](product/f03-academic-content-publishing-spec-2026-11-17.md)已按确认范围实施G02管理、H01阅读和P002公开活动；[分层验证证据](testing/f03-academic-content-2026-11-18.md)、[接口与运行](technical/f03-academic-content-2026-11-18.md)及[统一手册F03专节](product/用户验证与操作手册.md#f03--学术资讯通知与活动本机待用户验证)已维护。本机3类合成内容真实发布/换版/撤下、权限与恢复、五宽/原生200%有证；真实内容、用户确认与生产另验。

[验收与原失败](testing/study-workflow-wf09-2026-11-18.md) · [接口与保存契约](technical/study-workflow-wf09-2026-11-18.md) · [统一手册第14节](product/用户验证与操作手册.md#14-wf09当前分析报告预览与保存)。本次分析直达预览，再明确保存；后台GET不吞确认，丢响应原键恢复。两新报告待审核，0新计算/导出，原科学与Word保持；仅本机合成范围。

## F03学术资讯、通知与活动：本机已启用，待用户验证

## 2026-11-18 · WF08后台分析与恢复（本机合成）

[验收与原失败](testing/study-workflow-wf08-2026-11-18.md) · [技术与接口](technical/study-workflow-wf08-2026-11-18.md) · [统一操作手册第13节](product/用户验证与操作手册.md#13-wf08离页计算与返回核对)。两真实重启、真实UI停止后三项迟到零发布、科研失权与新计划撤准、81项独立统计复核、双身份五宽/原生200%新增控件通过；原数据与科学Word保持。既有S05概览1024溢出交WF12，临床/生产未验。




## 用户验证与操作手册（持续维护）

[用户验证与操作手册](product/用户验证与操作手册.md)是后续用户验证流程、反馈、修复后复验及稳定操作步骤的统一入口。首批F01-01至24已编写：先核对账号／可用席位及收件箱，再按研究者与管理员双角色操作；当前用户结论待验证，不由开发测试代签。

## 2026-11-17 · F01人工准入审核：本机实施与验收

[F01 V0.3](product/f01-registration-admission-review-spec-2026-11-17.md)已按P1–P5串行实施：原注册字段／验证／P003登录，后台pending，P006本人状态与补充／允许重申，G03管理员审核，全局准入及复合入口守门；无初次说明、自动会话或私有Study提权。P01个人知识库复用K01，执行Study所需组等见[精确配置](product/f01-study-capability-config-2026-11-17.md)。真实注册与审核、未知恢复、独立双连接并发、五宽／原生200%、44后端／PG、1179前端通过（1既有跳过）及构建有证。[实施计划](planning/f01-admission-2026-11-17/implementation-plan.md) · [分层验收](testing/f01-admission-2026-11-17.md) · [技术与回退](technical/f01-admission-2026-11-17.md)。本机合成范围，原租户席位保持；生产及真实外发邮件未验。

## 2026-11-17 · “我的工作台”统一命名

[规格与UI/UE约定](product/my-workspace-naming-2026-11-17.md) · [ADR-0013](decisions/0013-personal-workspace-naming.md)。原“我的科研”导航、标题及帮助/返回文字统一；布局与原功能路径保持，本机验证通过，未生产发布。


[本机验收与截图视频](testing/my-workspace-naming-2026-11-17.md)：全前端1057通过/1既有专项跳过/0失败，后台契约11通过，最终构建通过；双角色五宽、8组稳定几何对照、原生200%及独立复核通过。

## 2026-11-17 · 视频聊天追问

- [实施规格](product/qiyan-ai-video-chat-2026-11-17.md)
- [执行契约](technical/ai-video-chat-2026-11-17.md)
- [验证台账](testing/ai-video-chat-2026-11-17.md)
- [实施进度](planning/qiyan-ai-video-chat-2026-11-17.md)

本机合成技术交接完成：原两账号各1次真实视频问答、来源回放/刷新/计费与独立复核通过；连续多轮、临床质量和生产部署另验。

## 2026-11-17 · 客户范围审查报告（R2）

[灵枢心域ResearchHub客户范围审查](product/client-scope-audit-2026-11-17.md)：按“共同体＝当前ResearchHub、专家工作台＝我的工作台”更新12项审查和F01–F10最小补齐设计。命名统一已完成；C2/C3首份新报告资产链已验，通用来源／队列仍待补；WF02处于离线代码／组件阶段。优先复用K01文档、任务与访视日期、既有报告和资产流程，区分流程缺失、资料待补及可选扩展。本次仅更新报告与索引，不启动新增功能或发布。

## 2026-11-17 · 岐研AI视频内容首切片

- [已批准规格及MC01–MC03](product/qiyan-ai-media-first-slice-2026-11-17.md)
- [P01–P05实施计划](planning/qiyan-ai-media-content-2026-11-17/implementation-plan.md)
- [接口、授权、存储与执行](technical/ai-media-content-api-2026-11-17.md)
- [本机技术证据与体验流程](testing/ai-media-content-2026-11-17.md)

P01–P05本机合成技术交接完成：真实转写/画面/回放、独立总评修补、49项串行回归及最终运行时/HTTP/浏览器检查通过。共享窗口已释放，不冒称自然语言视频问答或生产部署。

## 2026-11-17 · 访视逐按钮方案完整本机验收通过

[完整验收与十项矩阵](testing/visit-flow-final-acceptance-2026-11-17.md) · [现行方案/UX01–05收尾](product/visit-capture-review-flow-2026-11-16.md) · [实施计划](planning/visit-flow-final-acceptance-2026-11-17.md) · [技术合同](technical/visit-capture-review-flow-2026-11-16.md) · [使用说明](product/使用说明书.md)。现场/CSV/本机邮件H5、独立审锁、完访/更正重核/原键恢复、五宽/原生200%及独立总审通过；原数据保持，按用户委托核定，无重复确认停点。未配置项明确不适用，临床/生产未验。

## 2026-11-17 · 视频内容首切片规格与真实合成探针

[最小规格/MC01–03/原区域UI差异](product/qiyan-ai-media-first-slice-2026-11-17.md) · [台账](planning/qiyan-ai-media-content-2026-11-17/progress.md) · [真实转写、画面、点击播放及限制](testing/ai-media-content-probe-2026-11-17.md)。独立本机基础闭环通过，静音与非零PTS失败保留；Hub新表/权限/页面尚待评审，未正式接线或发布。

## 2026-11-16 · 科研资产八项剩余能力启动

[完整收口规格](product/research-assets-completion-spec-2026-11-16.md) · [18步计划](planning/research-assets-completion-2026-11-16/implementation-plan.md) · [60项现状](planning/research-assets-completion-2026-11-16/feature-status.md) · [台账](planning/research-assets-completion-2026-11-16/progress.md) · [实际DDL核定](technical/research-assets-business-migration-2026-11-16.md)。已开始免费契约与专用库只读准入，未迁移/写新对象/调用模型，不代表八项已完成。

## 2026-11-16 · 访视确认中断与结果反馈修复

[实际修复与双角色证据](testing/visit-confirmation-recovery-2026-11-16.md)：确认核对中保持、未发送/未知区分、原弹窗只读找回；新合成三表3提交/3审/3锁/1完访，无恢复重复POST。完整前端886通过/1既有专项跳过，构建与原记录保护通过。用户专业体验待核，长页与角色提示仍留项；未发布。

## 2026-11-16 · ASR/视觉执行器核查与时间来源规则

[本机执行器/缓存/初始化核查](technical/ai-media-executor-audit-2026-11-16.md) · [转写、画面摘要与回放时间契约](product/qiyan-ai-media-content-contract-2026-11-16.md)。仅核查与设计；ASR base可离线初始化，6视觉候选当时未加载，Hub内容理解仍未接通。没有业务写入、模型推理、页面/权限或部署变化。

## 2026-11-16 · A01页头去重与局部状态精修

[UI/UE约定](product/research-assets-ui-polish-2026-11-16.md) · [双角色验收](testing/research-assets-ui-polish-2026-11-16.md)。去重复标题占位，保留原布局/14/22/权限；加载保护、错误恢复、页签状态及禁用配色完成，310+13回归/构建/同轮独评通过，仅本机。

## 2026-11-16 · 科研资产默认全部可访问（本机验证及独评通过）

[现行规则](product/research-assets-home-all-studies-2026-11-16.md) · [只读总览API](technical/research-assets-overview-api-2026-11-16.md) · [双角色验收及限制](testing/research-assets-overview-2026-11-16.md)。默认全部可访问，研究仅筛选；登记归属与真实父研究操作保持，307回归/构建/真实浏览器/独评通过，0资产业务写入和模型，未正式发布。此条覆盖历史默认恢复单研究。

## 2026-11-16 · 视频原件登记与回执（本机技术交接）

[旧流程规格和MVB最小范围](product/qiyan-ai-video-binding-2026-11-16.md) · [六步串行计划与台账](planning/qiyan-ai-video-binding-2026-11-16/implementation-plan.md) · [两角色真实登记/恢复/Range及保护边界](testing/ai-video-binding-2026-11-16.md)。两份原件各登记一次，原件0复制、旧任务0、模型0；原AI区与原被试/访视卡闭环。756纯测/47后端PG/52浏览器/17真实边界及独评修补通过；内容理解、用户业务签收与正式部署另列。

## 2026-11-16 · 上传期间显示视频文件名与旧处理链核查

[视频文件名与旧Data Agent处理核查](technical/ai-video-feedback-2026-11-16.md) · [本机双角色真实页面及回归证据](testing/ai-video-feedback-2026-11-16.md)。仅原状态行补当前文件名；归档/检查与内容理解区分，后续被试关联/转写不冒称完成。

## 2026-11-16 · 视频来源拒绝的独立修补

[最小协议](technical/ai-media-origin-2026-11-16.md) · [真实HTTP/两账号浏览器及保留边界](testing/ai-media-origin-2026-11-16.md)。本机去端口兼容覆盖JSON与二进制；原权限/旧数据/布局不变，用户原视频仍需本人复验。

## 2026-11-16 · 访视采集与集中审阅逐按钮精简（本机技术通过，业务待核）

后续[采集人与独立审阅者实际走查](testing/visit-two-role-walkthrough-2026-11-16.md)已完成：连续填表、一次集中审锁和独立完访生效；确认期间被状态核对/连接提示打断、长页定位及角色提示仍待优化，未判体验全部通过。报告含实际按钮口径、21张新截图与只读审计证明。

[逐按钮方案及逐项实施证据](product/visit-capture-review-flow-2026-11-16.md)：全部VC01–VC09已落实，真实单按钮开始、连续提交、一次集中审锁、独立完成、更正重核、H5必采缺口及丢响应/重启/新标签恢复通过。24个原生完成步骤事务证明、297相关＋10QA纯测、构建与独审有证；旧记录保持。[完整验收与留项](testing/visit-capture-review-flow-2026-11-16.md) · [实施计划](planning/visit-capture-review-flow-2026-11-16/implementation-plan.md) · [技术合同](technical/visit-capture-review-flow-2026-11-16.md)。业务体验待用户核对；临床/生产未验。

## 2026-11-16 · 真正续传、上传意图区分与历史加载

[现行产品规则](product/qiyan-ai-resumable-2026-11-16.md) · [六步实施结果](planning/qiyan-ai-resumable-2026-11-16/implementation-plan.md) · [两账号真实链路、420MiB合成探针和性能证据](testing/ai-resumable-2026-11-16.md)。旧未确定上传保留，普通上传不同文件不再被其阻断；当前原视频由用户复验。仅本机技术闭环，不宣称生产或专业签收。

## 2026-11-16 · 视频上传恢复反馈修复（本机）

“核对上传”现显示进行中及查无回执、未归档、失败或已归档的明确结果；“继续上传”选错原文件、旧请求占用和身份重核都有可见反馈。原操作沿相同身份恢复，等待归档不因慢回执退回重传。原两账号真实接口、36项浏览器回归、738纯测、28后端/PG回滚及构建通过，原六媒体行未变，无新媒体/模型或权限改动。[本轮证据与用户复验路径](testing/ai-video-recovery-2026-11-16.md)。

## 2026-11-16 · 已审核报告资产科研问答：R1纠正，沿用v2优先

用户已选择首切片为A02进入、绑定来源Study，仅检索当前研究内已审核且有AI用途许可的报告资产；先用原admin报告验收，不纳入跨Study/其他类型。已形成[实施规格](product/research-assets-agent-qa-2026-11-16.md)及[六步计划](planning/research-assets-agent-qa-2026-11-16/implementation-plan.md)，建议3天实施＋1天缓冲，前半天先做免费复用准入。

R1已区分测试执行边界、实际材料权利依据和正式AI用途许可：旧“不开放AI”文字是Agent写入的合成验收说明，不能据此认定真实版权禁令或必须增版。撤回强制v3/扩至3版提案，默认沿用既有v2及两版/12事件上限；许可新增/续期/撤销只变更许可记录，实际内容或封存字段确需实质修改才另评资产版本。依据须责任人核对，真实材料禁用仍阻断；旧文字保留并单独澄清，不由纠正文档自动授予AI。优先核验既有用途复用，新表仅为候选，具体差异在免费准入后冻结。AQ-M01～M04按R1及AQ-F01仍待批准。本轮仅文档，无代码/页面/DB/许可/会话/模型/费用/部署改动。

## 2026-11-16 · A02长报告阅读区A方案完成（本机）

按用户确认，仅正式资产“内容概览”以卡宽840px切换：1280/1440正文净宽152→448、286→582px，1920维持736px双栏；来源、用途和适用限制在正文前完整显示，其余信息/摘要窄区在后。正文16/28、来源与表格14/22，宽表格局部横滚及键盘可达。外500px辅助栏、顶部信息、七Tab、权限/API/DB/旧分支与共享样式/Markdown保持。

184后端/781前端/4.77秒构建，原两账号五类型、三宽及小数边界、503/注销迟到200、原生403及受控摘要受限验证通过；唯一独评1项验收缺口已集中补齐。32对象/27registry/旧事实/角色/账本保护一致，0资产业务写/模型/费用/重载。原生200%仍继承Shell最小1280的横向溢出，不称全站窄屏/放大通过。

[已批准设计](product/research-assets-a02-reading-2026-11-16.md) · [本机验证与边界](testing/research-assets-a02-reading-2026-11-16.md)。此前正文偏窄留项以本轮局部修补接续关闭；用户专业确认和正式部署另列。

## 2026-11-16 · 岐研AI视频首片（本机合成技术交接）

[产品规格与MV01–MV03](product/qiyan-ai-video-ingestion-2026-11-16.md) · [串行实施计划](planning/qiyan-ai-video-2026-11-16/implementation-plan.md) · [复用核查](technical/ai-video-reuse-2026-11-16.md) · [Accepted ADR-0012](decisions/0012-session-media-archive.md) · [六文件真实Chrome/HTTP/PG及免费门禁](testing/ai-video-2026-11-16.md)。原入口私有视频归档、检查、播放与刷新恢复已在19501验证，原两账号共6份合成视频，无模型/Token/被试写；内容理解、用户专业签收和生产未完成，退役检测不恢复。

## 2026-11-16 · Excel选择后无反馈修复

[最小修复范围](planning/qiyan-ai-file-data-2026-11-12/upload-focus-fix-2026-11-16.md) · [根因/独评/隔离与双账号真实验证](testing/ai-upload-focus-2026-11-16.md)。同身份核验保选择，一次上传/预检；原权限/布局/正式入库规则保持，0模型/本会话重载。

## 2026-11-16 · 任职月份与旧QA脚本修补，本机技术验证完成

已审核当前任职DTO保留起止月和current；R01原机构行、R02已有日期位显示明确任职月份，同机构多任职共用唯一主要项选择，歧义不猜，不改布局／权限。两项旧团队脚本已补同一已审核fixture缺失ID恢复及精确写集合断言；只读实际恢复与反例通过，不重放旧保存／审核。

19相关／748当次前端、真实PG日期回滚0残留、7.42秒构建，PID94703真实新DTO、管理员两页五宽及原科研人员原生200日期可见验证通过；唯一独评1Important已集中RED→GREEN修补，无未决Important／新增Minor。未改CSS／旧系统／共享入口，无模型或持久夹具写。

资料事实纠正：当前已提交档案无当前任职起始月份；旧“已核验未显示”是回滚用例缺口，不能当真实档案已补录。受控锁争用复现HTTP503/P2010与PG55P03，回滚释放后200且资料不变；仅确认一种触发路径，历史那次仍不称根治。真实月份数据准备、历史503观测、前轮HTTP来源回执Minor、用户业务签收和正式环境仍单列。 [report](testing/governance-directory-closeout-2026-11-16.md).

## 2026-11-16 · 目录与AI来源检索隔离负验完成

两项真实PG集成负验（原app角色、正向命中对照、撤回旧引用拒绝）及0残留通过，admin／owner／匿名实际HTTP和Chrome只读验证通过；13相关／731前端、6.59秒构建完成。仅修旧测试的会话版本与输入上限假设，没有产品／布局／权限／持久数据／模型／重载改动。目录展示审核不自动授权AI；本机检索工具负验留项关闭，不外推模型回答、其他工具或生产。任职月份投影、旧团队两项脚本及未复现GET503仍留账；独评无未决重要问题，新增HTTP来源ID／版本回执增强Minor另记。 [report](testing/governance-directory-isolation-2026-11-16.md).

## 2026-11-14 · 邀请异常真实合成闭环完成

用户已批准原P2 Study4条具名邀请；failed／unknown／expired真实入关注，正常captured排除。原S11精确定位后两次重发／一次撤销均HTTP200，刷新回读及返回总览3→2→1→0，撤销框Esc取消不提交。6封本机捕获回执及审计一致；原5条邀请全字段摘要、原两账号授权、全部角色和当前Study成员未变，无新账号／成员／角色、外发邮件、模型、重载或产品代码修改。

35定向／729当次前端、9.43秒构建及6组真实Chrome（五宽）通过；相同产品版本原12组只读／原生200%证据保留。唯一总评2Important已修补，无第二次总评。本项OV03本机合成技术交接完成；用户签收、正式环境／真实邮件及原P1留项另列，P4／伦理材料／多中心仍延期。以下较早日期的“待确认／未验”是历史阶段，当前以本节为准。 [current evidence](testing/invitation-exceptions-2026-11-13.md).

## 2026-11-13 · 邀请异常与定位

[实施与具名确认](planning/governance-module-2026-11-12/invitation-exceptions-implementation.md) · [复用API／安全URL](technical/invitation-exceptions-2026-11-13.md) · [代码／回滚／12组只读验证](testing/invitation-exceptions-2026-11-13.md)。真实异常处理待4条测试邀请批准，未整体验收或生产放行。

## 2026-11-14 · 原位字段映射本机启用与真实恢复验证

[原位选择计划](planning/qiyan-ai-file-data-2026-11-12/inline-mapping-implementation.md) · [版本与恢复](technical/ai-inline-mapping-2026-11-13.md) · [目标守门/双账号真实页面及验收边界](testing/ai-inline-mapping-2026-11-13.md)。最终代码已加载，原位选择与旧记录保护/恢复通过，本会话重载0；共享页面新空白访视的持久成功导入仍未执行，不用拒绝路径或PG回滚替代。

## 2026-11-13 · 一般表格带单位真实写入完成（本机）

[双账号真实提交、固定kg答卷与来源、失败恢复和保全证据](testing/ai-general-unit-write-2026-11-13.md) · [已批范围及W01–W06结果](planning/qiyan-ai-file-data-2026-11-12/authorization-general-tabular-write.md)。4份实际合成CRF，模型0；前序仅预检/待写入状态为历史。

## 2026-11-13 · P7整链验收与缺口

[串行验收台账](planning/governance-module-2026-11-12/p7-integration-acceptance.md) · [接线技术边界](technical/governance-p7-integration-2026-11-13.md) · [AC01–10／交付原件／用户验收路线](testing/governance-p7-2026-11-13.md)。当前本机技术复核通过，邀请异常／定位、旧目录留项和用户签收／生产未销项。

## 2026-11-13 · 岐研AI一般研究表格

[本轮实施范围](planning/qiyan-ai-file-data-2026-11-12/p06-general-tabular-implementation.md) · [字段/单位/兼容契约](technical/ai-general-tabular-2026-11-13.md) · [真实预检、独审与保留项](testing/ai-general-tabular-2026-11-13.md)。中英编号、唯一标签、声明单位/确定换算与基础列质控已接原AI01；真实双账号CSV/XLSX预检和原批次回归有证，0模型/正式导入/新增权限。单位正式写入样例、用户专业签收及生产仍待后续，不恢复全Study质量工作台。

## 2026-11-13 · P6系统配置

[实施台账](planning/governance-module-2026-11-12/p6-system-implementation.md) · [只读状态API与来源](technical/governance-system-2026-11-13.md) · [PG与浏览器验证](testing/governance-p6-2026-11-13.md)。复用原Token，G05统一入口，脱敏服务状态不虚报在线；用户签收／生产待验，P4延期、P7未自动执行。

## 2026-11-13 · P5本机技术收口

[P5交接与完整视觉证据](testing/governance-p5-2026-11-13.md) · [API及安全投影](technical/governance-audit-2026-11-13.md) · [完成台账](planning/governance-module-2026-11-12/p5-audit-implementation.md)。G04获批窄屏适配已复验，旧遮挡记录为历史；P4延期、P6未自动执行，用户签收／生产独立。

## 2026-11-13 · P4延期与P5真实审计

[P5台账](planning/governance-module-2026-11-12/p5-audit-implementation.md) · [API与证据白名单](technical/governance-audit-2026-11-13.md) · [真实验证及窄屏未完成项](testing/governance-p5-2026-11-13.md)。P4新工作台延期，不移除既有质量链；P5桌面真实链已接通，窄屏待批准最小适配，不标整页完成。

## 2026-11-13 · 岐研AI P06概览／基础质控／固定结果解释

[实施范围与O01–O06](planning/qiyan-ai-file-data-2026-11-12/p06-overview-quality-implementation.md) · [API／结果／队列与Token契约](technical/ai-research-data-analysis-2026-11-13.md) · [实际验收与独审修补](testing/ai-data-analysis-p06-2026-11-13.md)。仅本人P05原固定导入批次，概览/免费链路和原两账号各一次真实解释已完成本机技术核对，2328 Token实际结算、原记录/152笔旧预留保持。无新表/角色/额度/旧app改造/云/生产；不恢复延期的质量工作台，不销项全部数据Agent或用户专业签收。

## 2026-11-13 · P4最小实施规格评审包

[完整规格](product/governance-p4-quality-spec-2026-11-13.md) · [M01–M07/F01授权](planning/governance-module-2026-11-12/p4-authorization-2026-11-13.md) · [Q01–Q16计划](planning/governance-module-2026-11-12/p4-implementation-plan-2026-11-13.md) · [一次独评](planning/governance-module-2026-11-12/p4-spec-independent-review-2026-11-13.md) · [Proposed ADR-0010](decisions/0010-study-quality-extension.md)。待用户批准，未实施，F01另确认。

## 2026-11-13 · 岐研AI P05一次确认入库技术交接

[真实验收与独审修补](testing/ai-data-import-p05-2026-11-13.md) · [两表／两条父链／HTTP与事务](technical/ai-research-data-import-2026-11-13.md) · [已批准M01–M05](planning/qiyan-ai-file-data-2026-11-12/authorization-p05.md) · [操作说明](product/使用说明书.md)。原两账号、当前Study的4被试/4独立入组访视/4CRF已在本机合成环境验证；一次确认、固定来源、恢复和S03/S09回链可用。P06数据AI、用户专业签收与生产未完成，无模型调用/角色或Token扩大；下方P05准入为历史。

## 2026-11-13 · P4研究质量准入核对

[QL01–14复用／缺口、权限与实施边界](planning/governance-module-2026-11-12/p4-admission-2026-11-13.md)。当前只读核对完成，实施未开始；不重做疑问／更正／审阅／快照，不把合成3例或空卡当通用质量能力。无业务写／权限／模型调用或服务重载，完整规格及最小授权待确认。

## 2026-11-13 · P3内部方案审核本机技术交接

[逐项验收](testing/governance-p3-2026-11-13.md) · [接口／既有数据契约](technical/governance-p3-protocol-review-2026-11-13.md) · [串行台账](planning/governance-module-2026-11-12/p3-protocol-review-implementation.md) · [一次独审](planning/governance-module-2026-11-12/p3-independent-review.md)。G01真实列表、固定S07审核／回流、真实决定历史及原回执只读恢复已通过本机合成技术验收；用户签收／临床／生产未验，P4未启动。原两账号不改，无新权限／费用／云／旧服务操作。下方P2／P3未完状态为历史阶段。

## 2026-11-13 · P05 Study与最小导入准入

[真实Study／I01–I08计划](planning/qiyan-ai-file-data-2026-11-12/p05-minimal-implementation.md) · [待确认M01–M05](planning/qiyan-ai-file-data-2026-11-12/authorization-p05.md) · [只读与契约证据](testing/ai-data-import-p05-preparation-2026-11-13.md)。保留原Study/角色/页面；正式导入未启用。

## 2026-11-13 · 岐研AI数据暂存与只读预检

[产品规格](product/qiyan-ai-file-data-ingestion-2026-11-12.md) · [已批两表/限定DML](planning/qiyan-ai-file-data-2026-11-12/authorization-p04-staging.md) · [HTTP与数据库契约](technical/ai-research-data-staging-2026-11-13.md) · [本机验收](testing/ai-data-preflight-2026-11-13.md)。仅专用合成环境，不把预检当正式导入；P05真实Study父链与数据权限待精确确认。

## 2026-11-13 · 治理P2受控账号回执

[接口／数据库契约](technical/governance-account-receipt-2026-11-13.md) · [真实验证／独审](testing/governance-p2-account-receipt-2026-11-13.md) · [当前实施](planning/governance-module-2026-11-12/p2-reuse-implementation.md)。仅回执层本机后端验证，未接HTTP/G03或完成P2；原账号／席位／旧服务不变。

## 2026-11-12 · P1数据治理研究者依赖闭合（本机技术交接）

R01整页与必要R02只读已沿获批规格完成：真实目录GET、搜索/筛选/排序/分页、同ID详情/关系依据及团队返回；不再显示1256或演示人物。主要团队仅取唯一显式主项，无已审核方向不声称AI归纳。原布局保留，用户批准的52px Tab保护和两页窄屏移动导航/纵排已验证。无新表、GRANT、角色/Study授权、持久化夹具或模型费用。

最终507前端、真实PG/纯回归、5.32秒隔离构建、科研/管理员Chrome、五宽/原生200%及G02团队只读回归通过；一次独审集中修补后一个Minor任职起始月份展示暂缓，原团队阶段留项不冒称根治。DG01–10可提交本机体验验收，不是整个治理模块、完整R02协作、专业签收或生产发布；P2未启动。下方旧R01 pending/等待依赖确认仅为历史快照，以本段为当前状态。

[P1研究者闭环交接](testing/governance-p1-researcher-2026-11-12.md) · [实施计划](planning/governance-module-2026-11-12/p1-researcher-implementation.md) · [独审](planning/governance-module-2026-11-12/p1-researcher-independent-review.md)。

## 2026-11-16 · 方法报告到科研资产上下文

[已批准规格与五步计划](product/research-assets-report-context-2026-11-16.md) · [接口与自有约束](technical/research-assets-report-context-api-2026-11-16.md)。仅具名合成Study/admin固定报告；实际1新资产/2版/6事件，私有已审核；S10/G02/A01/A02及单次独评修补、异常恢复通过。[技术交付与原件](testing/research-assets-report-context-2026-11-16.md)，不开放共享、发布、导出或AI，不代签专业/生产验收。

## 2026-11-12 · 科研资产A01整页实施准入

[整页规格](product/research-assets-a01-spec-2026-11-12.md) · [一次最小确认](planning/research-assets-product-2026-11-12/a01-authorizations.md) · [C01～C07串行计划](planning/research-assets-product-2026-11-12/a01-implementation-plan.md) · [Proposed ADR-0009](decisions/0009-hub-asset-governance-extension.md)。仅免费只读PG/浏览器与规格，未开启登记/治理/共享或建表；原10/20不动、原布局保持。新增D01/A-W/F/I待本轮确认，不将此前串行顺序同意当作全部权限开放。

## 2026-11-12 · P1团队审核写链与R01依赖

[真实验证与未决项](testing/governance-p1-team-2026-11-12.md) · [一次独立总评](planning/governance-module-2026-11-12/p1-team-independent-review.md) · [串行计划](planning/governance-module-2026-11-12/p1-team-implementation.md)。唯一新合成团队/机构/负责人及4/4/5额度已获批并实际验证，原布局/资料不变。团队写链/T01/T02、31后端/489前端/构建/五宽200%有证；R01未接，DG10/P1不完整、不进入P2。2项脚本Minor及503未定位留账，无新费用/权限/云/发布。

## 2026-11-12 · 科研课题T17固定报告闭环

[S10与真实Word验收](testing/research-t17-2026-11-12.md) · [API/恢复](technical/research-t17-2026-11-12.md) · [检查点](planning/research-study-workflow-2026-11-11/t17-ui-checkpoint.md)。本机通用合成通过，公共Shell窄屏顶部兼容限制保留；T18主报告、更正与用户业务核对继续。

## 2026-11-12 · 科研课题T16分析闭环

[描述统计验收](testing/research-t16-2026-11-12.md) · [API/执行装配](technical/research-t16-2026-11-12.md) · [S06检查点](planning/research-study-workflow-2026-11-11/t16-ui-checkpoint.md)。本机通用合成通过；T17/S10与T18整链继续。

[同例贯通验收工作稿](testing/research-study-workflow-2026-11-12.md)记录主三渠道、实际Methods、跨租户只读拒绝和未完成门槛；主报告与更正后新结果、用户业务核对仍待验，不代表19项全部完成。

# 岐研项目文档中心

## 2026-11-12 · 科研资产A02最小依赖代码阶段

[技术规格](product/research-assets-a02-read-slice-2026-11-12.md) · [本机分层证据](testing/research-assets-read-code-2026-11-12.md) · [固定版本阅读说明](product/使用说明书.md)。获批10份/20版、两账号20次浏览器与真实PG/HTTP/P01隔离通过；同1910母版网格/七Tab/七卡槽一致、Reading16/28，491前端/35相关及隔离构建/独评通过。专业体验与其他视口等未验，不当作完整A02/60项已交付；下一步集中A01。下方“仅文档/未实施”属前序记录。

## 2026-11-12 · 资产实施顺序已确认

[计划](planning/research-assets-product-2026-11-12/implementation-phases.md)已记录：不改旧系统、不以全KB工具为前置；A02只读最小依赖→集中A01→完成A02顺序获同意。首种真正应用仍为建议而非已选定，最小业务授权不由顺序确认自动扩大；本轮无代码实施。

## 2026-11-12 · P1来源审核原提交恢复

[本机技术交接](testing/governance-p1-recovery-2026-11-12.md) · [受控读取契约](planning/governance-module-2026-11-12/p1-source-receipt-contract.md) · [API](technical/hub-source-api.md)。DG01–05来源页已完成获批原提交恢复与真实浏览器验证，进入团队页；P1整体未完成，不是生产发布。下方待最小授权为前序停线历史。

## 2026-11-12 · 知识库复用差异与资产估算V1.1

[26项能力对照及60项资产映射](product/knowledge-hub-asset-reuse-matrix-2026-11-12.md) · [修订PRD](product/research-assets-prd-2026-11-12.md) · [准备/工期](planning/research-assets-product-2026-11-12/implementation-phases.md)。不重复开发旧KB底座、不删既定功能，完整资产条件估算96～132h＋16h缓冲；知识库已识别缺口另列情景与闭合门禁。仅文档，非新功能/工具权限或交期批准。

## 2026-11-12 · 科研资产完整模块（待评审）

[完整PRD](product/research-assets-prd-2026-11-12.md) · [60项逐页面功能清单](product/research-assets-feature-inventory-2026-11-12.md) · [开发准备/分期/工期](planning/research-assets-product-2026-11-12/implementation-phases.md) · [只读核查与证据](planning/research-assets-product-2026-11-12/findings.md)。推荐先以研究方案模板完成经治理的独立Study真实应用；不改原布局、不自动延期已有区域，不将旧本人候选/AI核对当正式资产中心。本轮仅产品评审包，无新功能启用。

## 2026-11-12 · 管理与治理完整模块（已批准，P1实施中）

[完整模块PRD](product/governance-module-prd-2026-11-12.md) · [逐子页功能清单](product/governance-subpage-feature-inventory-2026-11-12.md) · [分期与11月目标风险](planning/governance-module-2026-11-12/implementation-phases.md)。总览定稿；伦理材料管理、多中心管理延期至2026年12月份以后的版本。用户已批准P1先串行实施，来源选择保留已验证；[原提交恢复最小读取授权](planning/governance-module-2026-11-12/p1-source-receipt-contract.md)待确认，未切团队/P2。[本机验证/停线证据](testing/governance-p1-source-2026-11-12.md)。优先现有服务/表，不扩通用治理底座，不是完整模块或正式发布。

## 2026-11-12 · 来源展示/AI状态文案

[当前规格](product/source-review-workspace-spec-2026-11-02.md) · [本机实测、独立评审及全量未绿边界](testing/governance-source-copy-2026-11-12.md)。

## 2026-11-12 · 来源审核左侧定位

[本轮限定规格](product/source-review-workspace-spec-2026-11-02.md) · [RED/GREEN、术语核对与验收边界](testing/governance-source-position-2026-11-12.md)。

## 2026-11-12 · G02方案待审整合完成本机技术交接

[七类事项V2规则及既有方案审核边界](product/governance-item-rules-2026-11-11.md) · [394前端/41相关契约/构建、17组真实Chrome与独立评审修补](testing/governance-integration-2026-11-12.md)。四适配器同一待办列表，内部方案审核不等于外部伦理审批；四类缺失汇总及方案历史明示。无新业务写入/权限/模型/旧服务/云或发布；用户体验与生产独立。11月11日共同文件暂停已获用户同意解除，历史证据保留。

## 2026-11-11 · G02七类事项规则与最小接入

当前未最终交接：发现另一轮同时改动G02并接方案审核，保留双方改动，暂停共同版本最终验收，待确认合并范围；此前三适配器通过结果不代表当前版本通过。

[七类触发/角色/动作/完成/去重排序与复用清单](product/governance-item-rules-2026-11-11.md) · [本机实测、独立评审及未接能力](testing/governance-item-rules-2026-11-11.md)。来源/团队/Token对账复用现有GET能力，归数据治理/系统配置；另五类汇总明确尚未提供。待处理/需关注互斥、单一模块筛选和合法返回位置保留，无新增后端/权限/模型或发布。下方初版总览为前序历史。

## 2026-11-11 · 首页预览与完整课题目录统一（本机技术验收）

P01最多5项同源预览，列表后“查看更多课题 →”进入完整Q02；撤除新增侧栏二级链接和首页卡片顶部双入口。历史/受邀研究与新课题/研究同一授权目录、真实绑定去重、服务端搜索分页及精确总数，原任务/本人草稿保持。[实施契约](planning/research-study-workflow-2026-11-11/directory-unification.md) · [当前产品规格](product/research-study-creation-2026-11-11.md) · [API与运行](technical/research-study-creation-runtime-2026-11-11.md) · [本机19501验收与保留项](testing/research-directory-unification-2026-11-11.md)。本轮专项84、装配4、构建4.38s、实际API71请求/42主入口、最终Chrome8组及标准视口/原生200%8组有据；旧overview/业务hash保全，0业务写入/模型。仅本机功能，非生产/专业签收或全站无障碍。

## 2026-11-11 · G02待办总览精简

[规则与小步实施结果](product/g02-action-overview-2026-11-11.md) · [真实两角色/三类定位/失败恢复/五视口/原生200%及独立评审修补](testing/g02-action-overview-2026-11-11.md)。368前端、构建与10组浏览器通过，仅本机专用合成环境，无新审核/结算/模型/权限/Schema/旧系统或发布变化；用户最终体验待确认。

## 2026-11-11 · Hub Token本机最小闭环

用户已确认规格及局部UI，已进入本机技术交接：[规则](product/hub-token-accounting-2026-11-11.md) · [验证/保全/限制](testing/hub-token-accounting-2026-11-11.md) · [API/持久机制](technical/hub-token-accounting-2026-11-11.md) · [独立代码总评与作者修补](planning/hub-token-accounting-2026-11-11/code-review.md) · [小步计划](superpowers/plans/2026-11-11-hub-token-accounting.md) · [进度](planning/hub-token-accounting-2026-11-11/progress.md)。0付费调用，原15笔与未知12保全，非生产或真实模型专业验收。下方设计待评审是前序历史。

## 2026-11-11 · Hub Token最小结算与本租户对账（设计评审）

[已批准规则及状态](product/hub-token-accounting-2026-11-11.md) · [实施设计/API/持久回执/局部UI及B01–B06](superpowers/specs/2026-11-11-hub-token-reconciliation-design.md) · [独立设计评审与修订](planning/hub-token-accounting-2026-11-11/design-review.md)。租户管理员本租户对账权限已批准，新UI交互待确认；仅规格，未实现启用，不恢复旧开发金额/次数门槛。

## 2026-11-11 · 课题入口并入我的科研常用导航（前序，已由本轮收敛替代）

从[我的科研首页](http://127.0.0.1:19501/pages/p01/)原“我的课题”卡片新建或查看全部；侧栏“我的科研→课题与草稿”直达持久列表。原研究设计入口与后台授权保留。[规格](product/research-study-creation-2026-11-11.md) · [导航验收](testing/research-common-navigation-2026-11-11.md) · [本轮边界](planning/research-study-workflow-2026-11-11/common-navigation.md)。

## 2026-11-11 · 科研课题创建统一19501

统一[原19501入口](http://127.0.0.1:19501/pages/q02/)和原账号，可新建/查看已保存课题。19611/19612独立实例已停止，历史数据保留。[19501实测与范围](testing/research-study-19501-2026-11-11.md) · [接入边界](planning/research-study-workflow-2026-11-11/19501-integration.md)。下文独立验证为前序历史，不代表当前需另开站点。

## 2026-11-11 · 科研课题创建首批进入代码验收

[创建living spec](product/research-study-creation-2026-11-11.md) · [API/数据库/独立运行入口](technical/research-study-creation-runtime-2026-11-11.md) · [真实PG/API/Chrome证据及限制](testing/research-study-creation-2026-11-11.md) · [独立代码评审](planning/research-study-workflow-2026-11-11/creation-code-review.md) · [ADR-0008源码复用](decisions/0008-research-project-source-reuse.md)。用户已批准调用方式和代码；下方“仅文档”为前序阶段历史，不再代表首批当前状态。

## 2026-11-11 · 科研课题模块复用与开发任务（仅文档）

[13模块复用清单](product/research-study-module-reuse-2026-11-11.md)逐项列出现有HTTP/Service入口、直接调用、适配、新增及副作用；[19项开发任务](planning/research-study-workflow-2026-11-11/implementation-plan.md)按对象/权限、创建、方案采集、问卷/导入、快照分析与交付排序，含文件/接口交接和四层验收。[源码核对与评审](planning/research-study-workflow-2026-11-11/reuse-review.md)区分现有与拟新增入口，未实施或部署功能。

## 2026-11-11 · 科研课题全流程设计（待评审）

[设计草案与现状依据](product/research-study-workflow-design-2026-11-11.md)梳理课题创建、正式研究与方案、受试者、访视/eCRF/自填问卷、导入与质控、更正审阅、分析快照及成果交付。以现有页面和旧底座契约为基础，明确合成切片与正式能力差距；当前仅文档，不代表已创建正式研究、启用采集或发布。

## 2026-11-11 · 本人资产核对权限恢复

[规格](product/asset-applicability-current-access-2026-11-10.md) · [真实PG/两账号浏览器与AI额度边界](testing/asset-applicability-current-access-2026-11-11.md)。原两账号当前Study不再受旧WP09测试期限额外阻断；旧记录/账本保留。下方P01未恢复说明为前序历史。

## 2026-11-10 · P01本人任务与草稿

[实施规格](product/p01-task-draft-closure-2026-11-10.md) · [真实接口/浏览器、独立评审及授权阻断](testing/p01-task-draft-closure-2026-11-10.md)。原区域任务直达、分页、七类工作台复用和三类报告原位阅读；WP09适用性原U01未恢复，不称整页全部完成。

## 2026-11-10 · 登录飞轮与光场放大、整体上移

按用户确认及landing-page-design/figma-designer复核，P003宽桌面图500→560px、左侧文字图示静态上移32px、光场四周扩展；紧凑桌面24px，窄屏保持原间距/表单优先。减少图下冗余空间抵消增高，右卡片/认证/导航/权限/P004/P005保持；不另建Figma或改变已确认背景风格。

295项前端、构建、7尺寸＋3短屏Chrome和两账号真实登录通过。无新依赖、费用或真实发布，最终视觉签收待用户确认。[规格](product/p003-expanded-visual-2026-11-10.md) · [验证](testing/p003-expanded-visual-2026-11-10.md)。

## 2026-11-10 · 登录左侧科研光场轻背景

按确认方案仅P003左侧加入低对比蓝紫光晕、静态细线和四边淡出，复用首页无人像/文字的抽象背景素材。保留居中飞轮及尺寸、原动效/系统reduce，右卡片、认证/导航/权限和P004/P005不改。无需新图片生成、依赖或付费服务。

293项前端、构建及7尺寸真实Chrome、两账号实际登录通过，无业务新对象或正式发布；最终浓淡待用户签收。[规格](product/p003-light-field-2026-11-10.md) · [验证](testing/p003-light-field-2026-11-10.md)。

## 2026-11-10 · 登录页左侧居中成组

用户确认后仅调整P003专属CSS：标题/说明/飞轮居中同轴，标题36px，宽桌面飞轮500px、紧凑屏自适应，收掉冗余图下留白；右卡片、认证/导航/权限/P004/P005及默认动效不改。

本机7尺寸Chrome与两账号真实登录、39项视觉/认证/布局定点回归、构建及独立复审通过。首轮其他检索测试失败保留，相关文件经并行工作更新后最终全量293/293通过；本轮未修改检索模块。无模型调用或真实发布，最终视觉签收待用户确认。[规格](product/p003-centered-layout-2026-11-10.md) · [验证及已知失败](testing/p003-centered-layout-2026-11-10.md)。

## 2026-11-10 · 登录飞轮默认播放与左侧审查

按用户新要求移除P003暂停/继续按钮及其手动状态，默认动效；系统减少动态效果仍通过CSS自动静态。不改图尺寸/对齐、右表单、认证、导航或P004/P005。图下保留原留白，避免牵动右卡片。

本轮实测发现标题字形靠左、飞轮居中且缩图内文字偏密，建议统一成组并适度放大图/收敛标题；此布局建议待确认，未擅自实施。285项前端、构建及7尺寸真实Chrome和两账号实际登录通过；无模型调用或真实发布。[规格与建议](product/p003-autoplay-audit-2026-11-10.md) · [证据](testing/p003-autoplay-audit-2026-11-10.md)。

## 2026-11-10 · 登录页科研飞轮与轻量动效

P003左侧按用户确认A复用首页科研飞轮，取代四胶囊并移除英文装饰标签，保留中文主标题与一句说明。仅图内慢光轨和节点呼吸，支持暂停/播放及系统减少动态效果；标题、表单不动，图失败不影响登录。右侧原表单/认证/导航/权限及P004/P005不改，无依赖/付费服务。

277项前端、构建、7尺寸真实Chrome及两账号login201→我的科研通过；独立复审无阻断。右卡片DOM/尺寸保持，y仅0.1875px亚像素差。仅本机启用，无模型调用或正式发布，最终视觉签收待用户确认。[规格](product/p003-research-wheel-2026-11-10.md) · [验证](testing/p003-research-wheel-2026-11-10.md)。

## 2026-11-08 · 首页底部文字可读性与对齐

P002仅修补底部：保留原图并加深蓝遮罩，避免白光干扰浅色正文；统一三项图标占位，标题与正文顶部对齐。窄屏保留原纵向卡片，字号、导航、七区顺序、文案与入口不变。275项前端、构建及六尺寸真实Chrome通过，最坏白底正文对比6.36:1。无后端/数据库/权限/费用或真实发布变化，最终视觉签收待用户确认。

[规格](product/p002-join-readability-2026-11-08.md) · [验证](testing/p002-join-2026-11-08.md)。

## 2026-11-08 · 团队审核阻断与重复录入

[修补规格](product/team-review-friction-2026-11-08.md) · [真实PG与浏览器验证](testing/team-review-friction-2026-11-08.md)。本机已启用；用户原草稿只读核对，未代审或正式发布。

## 2026-11-08 · 开放首页真实入口与阅读层级

P002保留原七区顺序、品牌、插图、配色和全局导航结构。首屏统一免费注册＋了解科研流程，移动菜单补登录/注册；取消把关键词跳章节冒充内容检索的搜索框，移除仅保存浏览器草稿的预约入口，尾屏次动作改帮助中心。原草稿存储未删除，不新增邮件/预约服务。流程标签为“查看中”，人群文案不重复、选择不授角色。门户字号角色统一，AI及情志病短语完整换行、主次按钮等高，减少无内容满屏留白；工作区与权限不改。

272项前端、构建及五尺寸真实Chrome路径/截图录屏通过；本机0业务写、0模型调用，无正式发布。真实预约渠道及用户视觉验收仍待后续确认。[规格](product/p002-marketing-2026-11-08.md) · [验证与边界](testing/p002-marketing-2026-11-08.md)。

## 2026-11-08 · 团队审核状态与局部精简

关闭审核弹窗后刷新实际列表，保留已应用的查询/页码和焦点；未点击查找的新输入不被自动应用。刷新失败保留旧列表并提供窗内/窗外重试。已审核且本地/范围未改的资料先只读核对，没有待审变更时显示禁用“已审核”；待审草稿、本地编辑或范围变化仍可按原规则审核。弹窗只留一个对象标题，审核范围与选填备注归入第三组，成员姓名不重复。全局导航、配色、权限、来源、公开确认、历史与后端协议不变。

本机272项前端、68项相关真实PG、构建与真实Chrome保存/审核/失败恢复通过，独立评审两项P2已修。原用户团队未修改，无付费调用或正式发布，用户业务验收待进行。[规格](product/team-status-ui-2026-11-08.md) · [测试证据](testing/team-status-ui-2026-11-08.md)。

## 2026-11-07 · 团队审核备注改为选填

“核实说明（必填）”改为“审核备注（选填）”，不填也可主动审核。后台仍记录实际审核人、时间、展示范围和具体变更，旧备注/来源哈希/回执不改写；其他目录决定接口原理由要求不变。空备注不编造核实依据，底层决定记录动作“审核通过（未填写备注）”。沿用原布局、权限、公开确认及大小保护；只在原独立合成夹具验证，不代审用户原团队。此节覆盖此前强制填写核实说明的页面规则。 [规格](product/team-review-optional-note-2026-11-07.md)。


## 2026-11-07 · 团队维护取消固定操作次数上限

用户明确要求移除开发验收遗留的100次操作门槛；保存与审核不再按累计次数阻断。不删除、截断或重置历史，不自动审核用户待审团队；保留原权限、来源、版本/CAS、回执幂等、事务审计及250000字节保护。前端超限提示改为真实的资料/历史大小问题，布局不变。此节覆盖此前保留100次保护的现行约定，历史记录不改写。 [规格](product/team-operation-limit-removal-2026-11-07.md)。


## 2026-11-07 · 团队列表与编辑审核弹窗

列表操作统一“审核”，取消当前页“其他目录维护”入口；编辑、新建、核实及审核集中在站内弹窗，窄屏全屏。保存留窗，审核成功并回读/刷新后关闭；未保存站内确认、失败保输入、未知提交原回执恢复和焦点/查询恢复均保留。仅本机合成环境：268项前端、62项串行真实PG、真实Chrome保存/审核/丢响应回执闭环通过；用户批准新增一个独立合成团队（team上限2→3），其余权限与保护不变。原团队未改写，无付费调用或发布；用户专业验收待进行。 [规格](product/team-review-dialog-2026-11-07.md) · [证据与限制](testing/team-review-dialog-2026-11-07.md)。



## 2026-11-07 · 团队维护移除补充资料依据

本轮用户确认取消整个补充资料依据模块，不用折叠/选填继续占用常规流程；原三段位置、机构编辑、一份核实说明和审核范围/按钮不变。历史evidence/notes/来源/审核/审计保留，旧资料模式不静默切换，后端及权限不改。强化“一看就懂、少操作、少内部概念”的正式设计规则。仅当前页实施，未扫改其他页面。下方此前“选填折叠保留”为历史方案，由本节覆盖。[规格](product/team-review-simplification-2026-11-07.md) · [本机验证](testing/team-review-simplification-2026-11-07.md)。


## 2026-11-07 · 团队机构原位编辑与核实区精简

团队所属机构选择处可展开完善资料，当前选项与编辑内容绑定同一档案/版本；下方不再重复机构档案。默认管理员本人核实，一份核实说明，补充依据折叠选填，历史资料及来源模式保留。保存只写团队草稿，原审核后才追加机构版本；同ID一次修订，已审核机构不静默恢复或扩围。并发冲突原位对照并明确保留用户修改，未改字段采用最新资料。原布局/角色/表结构/旧服务不变，仅合成对象验证，真实团队未代审。[规格](product/team-institution-inline-2026-11-07.md) · [本机验证与独立评审](testing/team-institution-inline-2026-11-07.md)。


## 2026-11-06 · 团队维护全部业务确认统一站内弹窗

更换/移除人员、未保存切换/新建团队及使用服务器草稿全部复用站内确认。取消/Esc保留输入，确认才执行原动作，不自动保存或审核；页面布局与权限不变。系统规则已沉淀：其他页面在后续功能开发时逐页替换，不全站扫改。关闭标签或刷新时浏览器强制未保存保护保留。真实Chrome合成环境桌面/390/320通过，冲突恢复为明确标注的HTTP409受控验证，无真实团队或数据库业务变更。[规格](product/team-page-confirmations-2026-11-06.md) · [验证](testing/team-page-confirmations-2026-11-06.md)。

## 2026-11-06 · 团队移除人员改为站内弹窗

已关联人员的“移除人员”改用共享ConfirmDialog，显示姓名和影响，取消/Esc保留人员，确认仅更新当前表单，仍须原保存/审核才能生效。默认焦点取消、Tab约束、关闭焦点返回，窄屏14/22和44px按钮实测；无浏览器默认弹窗或额外二次确认。未关联新行原行为及其他确认框不变，页面布局、权限、数据库、旧系统不改。仅具名合成环境验证，真实团队未操作。[组件、实测与评审](testing/team-member-dialog-2026-11-06.md)。

## 2026-11-06 · 知识资料页DOM稳定性

[K01稳定性规格](product/k01-dom-stability-2026-11-06.md) · [定位与串行计划](planning/k01-dom-stability-2026-11-06.md) · [原生栈、RED/GREEN、216路由及独立评审](testing/k01-dom-stability-2026-11-06.md)。只修已复现挂载所有权缺陷，原布局和业务规则不变；历史两条无栈异常仍不强行归因，无旧服务/云资源/正式发布变更。

## 2026-11-06 · 实际Chrome登录来源403修补

已复现实际Chrome去端口Origin被误拒，非管理员权限不足；仅本机19501在loopback/Host/完整Referer/独立Fetch Metadata/会话专用头等全部证明满足时兼容，正式Origin/CORS和12h/撤销/权限不放宽，旧系统/数据库/布局不改。来源403与业务403区分，用户不再为此被告知账号无权；实际Chrome合成凭据已进入原账号校验，原两个合成账号去端口完整HTTP流程通过。管理员刷新登录页后用admin@example.org及原密码重试，不添加末尾标点。[验证与交接](testing/session-origin-fix-2026-11-06.md)。

## 2026-11-06 · 页面遗留开发说明清理

[页面清理规格](product/page-copy-cleanup-2026-11-06.md) · [串行计划与台账](planning/page-copy-cleanup-2026-11-06/task_plan.md) · [逐页浏览器、门禁及已知问题](testing/page-copy-cleanup-2026-11-06.md)。仅清理用户界面研发叙述，原布局与业务规则不变；历史数据不重写，无新模型/权限/云资源或发布。

## 2026-11-06 · 12小时活动会话本机技术交接

ResearchHub自有认证适配已在本机独立环境启用：Cookie/令牌12h同截止，真实前台活动（含知识资料同源操作区）续期，后台读取/轮询不续；过期刷新受保护页进入原登录，登录后安全返回原页面及允许的Study上下文，不重放业务写入。网络/403/5xx不注销或清空已核验身份及内存输入；停用、密码版本变更及本sid退出阻断续期。旧无sid凭证需重新登录一次；未保存内容仍不承诺跨过期登录恢复。没有页面布局、旧系统、数据库表/权限或正式发布变更。成功节流60秒，失败侧连续真实输入节流为非阻断待优化。下方“仅规则、当前2h”等为实施前快照；正式域名尚未部署。[实现、验证及边界](testing/session-policy-2026-11-06.md)。

## 2026-11-06 · 正式产品统一会话规则（已确认，待实现）

ResearchHub Cookie与认证会话均12小时，实际用户操作滚动续期，后台轮询/心跳不续期；过期刷新受保护页进入原登录页，重新登录安全返回原页面。网络故障、超时、5xx和业务403不误当退出；账号/租户停用或密码版本变更不能续期。保持原页面布局，不修改旧系统。当前本机JWT仍2h，尚未完成该规则代码/目标环境/浏览器验收，不将产品规则确认当运行生效。[规则与验收](product/session-policy-2026-11-06.md)。

## 2026-11-06 · 本机目录事实40条限制已移除（现行）

按用户批准，仅删除本机assertion:40配置及旧检查脚本对应断言，不清理历史，不换成更大数字。机构3/团队2/研究者4、草稿100次及大小、当前授权、租户隔离、来源、版本、审核和审计仍保留；页面布局、登录会话、旧服务和数据库权限不改。目标环境已重载，真实合成接口达到42条，审核决定仍33条；原事实、真实团队草稿及公开展示不变，未代批真实团队。下方36/40余量不足等为历史快照，不再是现行事实数量门禁。管理员继续在原页核对资料并明确审核，不因移除数量限制自动通过。[本机验证](testing/directory-fact-limit-removal-2026-11-06.md)。

## 2026-11-06 · 同页联合人工核实技术交接

[本机实现、真实浏览器及独立评审后作者修补](testing/team-admin-review-2026-11-06.md)。原布局不改，资料依据区本人核实及团队/成员/待审机构一次审核；真实团队未代批，本机剩余事实额度不足其下一笔审核，需单独确认保护调整。以下待实施描述为历史快照。

## 2026-11-06 · AI01阅读区与输入框

AI01真实工作台移除开发接线横幅，实际加载/失败/受限与选段风险仍保留；显式演示与其他页面不改。单篇输入默认两行，随文字/列宽增缩，达到视口内上限后内部滚动，底部提示与发送按钮紧凑排列；保持2–100字、明确点击才发送、原权限/Token/来源规则。1440×900解读区233→419px、表单252→170px；正文16/28、输入14/22不缩字。见[规格](product/ai01-reading-layout-2026-11-06.md)与[真实浏览器/独立评审/技术交接](testing/ai01-reading-layout-2026-11-06.md)。仅本机合成环境，0新模型调用；不以技术测试代签阅读舒适度或生产发布。

## 2026-11-06 · 单篇AI三档处理（现行）

按用户批准改为确定性修复、内容局部标注、控制面必须停止。新任务固定rh-article-response.v3，术语/年份/研究计数核对应原文；未核实测量或计算不作为结论交付，不再因一个数字令整篇失败。无有效段/不可解析协议仍明确未交付。任务字段绑定策略，提交/刷新重建回执，越权/来源撤回/版本不匹配/篡改仍阻断；旧v1/v2结果、失败、预留和账本不回写。原四段阅读区/16px字号、角色及业务Token链不改，无新计算服务。见[简短矩阵](product/article-response-matrix-2026-11-06.md)与[技术交接及专业边界](testing/article-response-matrix-2026-11-06.md)。本节覆盖下方历史整篇数字拒绝规则，不表示通用语义核验或生产发布。

## 2026-11-06 · 本人核实与同页联合审核（业务已确认，实施待评审）

[确认记录](product/team-admin-verification-2026-11-06.md) · [技术/局部交互规格](technical/team-admin-joint-review-2026-11-06.md) · [串行实施及独立评审计划](planning/team-admin-joint-review-2026-11-06.md)。团队、成员、待审机构留在同页，不改变列表/三段表单；新依据尚未启用，不假报真实团队已可无资料审核。

## 2026-11-05 · 本机审核次数限制移除

[用户批准的固定20条限制最小移除与真实验证](testing/directory-review-limit-removal-2026-11-05.md)。保留历史和其他保护，不涉及费用/权限扩充/界面改动；此前20/20不是当前操作前置。

## 2026-11-05 · 单篇数值来源与语境核验

[现行规格](product/article-numeric-evidence-2026-11-05.md) · [串行计划](planning/article-numeric-evidence-2026-11-05/implementation-plan.md) · [本机验证与边界](testing/article-numeric-evidence-2026-11-05.md)。不再用“一例”一刀切拒收；新数值原文引用可追溯，仍不允许LLM计算或自由改写科学数值，不改布局/权限/计费或历史失败。 首个有限随访语法仅支持完整肯定限制句并保守拒绝整段明确别文/否定语境，不是通用数值语义判断。最新本机304纯测/21真实PG/build及同次独立复核通过，新任务cmw3r2i130004lu1m730c225r真实交付2项原文依据、5224 Tokens按原业务结算；两次新失败与全部旧预留保留，专业验收仍由用户确认。

## 2026-11-05 · 团队原位审核

[已批准规则及实现](product/team-review-inline-2026-11-05.md) · [真实审核/夹具恢复、PG/Chrome、独立评审](testing/team-inline-review-2026-11-05.md)。普通审核不再重复弹窗，公开新增曝光才简短确认；其他布局和治理保护保持，仅本机未发布。

## 2026-11-05 · AI取消开发临时限额

[现行业务Token规则](product/business-ai-quota-2026-11-05.md) · [串行实施](planning/business-ai-quota-2026-11-05/task_plan.md) · [真实浏览器/Token结算与评审](testing/business-ai-quota-2026-11-05.md)。原5/10元、次数、临时报价不再控制产品入口，历史取证保留；未增Token/权限/充值或改布局/旧服务/临床库/云/发布。

## 2026-11-05 · 团队编辑基准409修补

[原因、两处最小前端修补、真实PG/Chrome/来源与并发回归、唯一评审](testing/team-edit-revision-2026-11-05.md)。不改变页面布局、后端CAS或权限；真实团队未代保存/批准。

## 2026-11-05 · 验收发现的团队保存403

[修补方案、真实Chrome保存刷新、HTTP反例及独立评审](testing/team-origin-rejection-2026-11-05.md)。仅本机团队写链路，不改变页面/角色/CORS/数据库/旧服务；用户未提交输入已恢复，真实团队未代审核。

## 2026-11-05 · 团队维护减负

[批准规格](product/team-maintenance-usability-2026-11-05.md) · [串行计划](planning/team-maintenance-usability-2026-11-05/implementation-plan.md) · [实测交接](testing/team-maintenance-usability-2026-11-05.md)。仅当前G02，原三个分区保留；审核集中一次确认、资料/人员直接操作、异常保输入。减负规则写入AGENTS/UI-UE，跨页仍逐页确认。

## 2026-11-04 · 新病例真实复验合格，本机技术交接

获批13034本机技术Tokens已一次性同事务配对记入租户父账并全部分给owner，只有一份新增可消费量；其他账号／旧预留／原人民币账本不变。独立续价只绑定原owner病例、95笔／2次attempt／18任务前缀，至多2个新任务，不续其他模块价。随后仅1次真实Provider产生合格新病例：保留残余症状、主观测量和因果局限，无停药误译／科学数值／普遍疗效推导；原合格综述当前回放也通过。两篇达到本机技术交接和本次作者支持度核对条件，不代签研究者AC07／甲方验收或生产发布。321纯组件＋20真实PG/build／保全和真实Chrome回读通过；累计保守2.166210元／10、17/19实际请求、19/20任务、在途0。已停止主动付费，只余1个新任务名额；不改旧历史／权限／页面布局，不自动充值或续额。新报告统一记录两级额度、原目的续价、真实病例、两篇支持度与剩余用户验收，旧失败证据保留。[完整证据与专业边界](testing/article-ai-b08-case-accepted-2026-11-04.md)。

## 2026-11-04 · 具名对账完成，病例误译修补与剩余前置

用户批准的B08具名1笔已通过原BillingService实际结算2248 Tokens并释放10040多余预留；其他历史预留、原角色、额度和人民币账本不变。owner随后真实调用1次、6片完整输入，新任务completed但专业核对发现“治疗结束”误译“停药后”，不通过AC07／B08。已免费补真实反例与拒绝校验、保留原回答和费用，不自动改词或重试；318纯／组件＋20真实PG/build及双账号真实浏览器回读通过。现累计保守2.134782元／10、16/19实际请求、18/20任务、在途0；原目的报价自然过期。owner可用11542低于12288，未再次清旧预留或增Token。仅提出剩余2任务的一次有界技术额度补足13034 Tokens，**尚未授权／执行**；不把10元预算当新额度许可。本轮仅精确结算、病例真实复验和免费误译修补；历史证据保留。[本轮证据与限制](testing/article-ai-b08-settlement-and-case-2026-11-04.md)。

## 2026-11-04 · 团队维护精简与共用省市选择

[已批准规格](product/team-maintenance-refinement-2026-11-04.md)、[API/字典/组件兼容](technical/administrative-divisions-2026-11-04.md)、[实施计划](planning/team-maintenance-refinement-2026-11-04/implementation-plan.md)、[一次评审/作者修补](planning/team-maintenance-refinement-2026-11-04/code-review.md)、[最新技术交接与真实截图](testing/team-maintenance-refinement-2026-11-04.md)。第8项仅当前页；T01/T02布局保持、2024官方快照明确版本、仅合成库，无真实团队批准/付费/生产发布。

## 2026-11-04 · 累计10元追加复验与配额阻断

用户批准累计10元；本轮追加最多5个新任务／请求（累计19请求／原20任务上限），原两合成账号／Study／两篇PMC不变，不充值、不续旧模块价或权限。独立目的守门已在本机启用，原93笔及旧B07/B08收据／历史保全。新综述真实6片输入、四段JSON与弱推荐／阶段／人群限定通过作者支持度核对；owner新任务在Provider前Token配额拒绝，没有调用或费用。现累计保守2.103291元、15/19实际请求、17/20任务、在途0；病例新产物和研究者AC07仍待，B08不销项。仅提议将B08具名2248 Tokens失败预留经原BillingService对账，未擅自执行／增额度／动其他历史。新增用途许可技术记录、追加验收报告和G01–05计划见下方链接；历史失败与旧页保留。详见[最新测试与确认项](testing/article-ai-ten-yuan-acceptance-2026-11-04.md)。

## 2026-11-04 · 完整输入修补与一次真实续行

用户明确同类问题无需重复确认，本轮在原范围内完成Hub单篇完整消息／Provider前逐片指纹、四段定性JSON及逐段来源／数值／推荐等级守门；不改旧全局限额、来源／角色、页面布局或共享底座。剩余一次admin真实请求证明6片完整进入模型，原14任务／助手与历史92笔保全，新任务completed；新增保守0.028998元、累计2.073564元，14/14请求／15/20任务、held0。实际新回答仍遗漏弱推荐并有方法范围泛化，专业AC07／B08未通过；发现后免费补缺级拒绝、实际回复回放与两篇人工参考，未改写历史，不把最新门禁的免费通过冒称新模型质量通过。311契约组件＋20PG/build及真实浏览器恢复／来源／隔离／超限有证；当前请求额度用尽，不自动续额。详见[本轮结果](testing/article-ai-input-repair-2026-11-04.md)；11月中旬目标与11/06余量复估保持，不虚减工期／恢复其他主线。


## 2026-11-04 · B08新真实复验失败停线

[真实失败／专业支持度／Provider二次裁切诊断](testing/article-ai-b08-rerun-2026-11-04.md)、[追加目的费用与停线契约](technical/article-ai-b08-fee-2026-11-04.md)、[本轮计划与状态](planning/bilingual-article-ai-2026-11-02/b08-real-rerun-2026-11-04.md)。实际仅1新请求、无新助手交付，第二篇未运行；累计13/14请求／14/20任务／保守2.044566元，剩余1次暂停。免费300＋20PG/build及双账号Chrome有证，不代表AC07／B08通过；原页面／权限／原两份历史不改。

## 2026-11-04 · 一页式团队资料维护本机技术交接

[三分区产品规格](product/team-maintenance-spec-2026-11-04.md)、[最小API/数据库兼容扩展](technical/team-maintenance-api-database-2026-11-04.md)、[实施计划](planning/team-maintenance-2026-11-04/implementation-plan.md)、[唯一评审及作者修补](planning/team-maintenance-2026-11-04/code-review.md)、[真实浏览器/PG/布局证据](testing/team-maintenance-2026-11-04.md)。仅专用合成环境，T01/T02布局保留，真实团队未批准，用户体验待确认；不恢复其他专项。

## 2026-11-04 · B08最小免费修补技术交接

[v2选片／定性输出／v1历史契约](technical/article-ai-v2-2026-11-04.md)、[作者修补与真实免费验证](testing/article-ai-b08-remediation-2026-11-04.md)、[批准后的实施清单](planning/bilingual-article-ai-2026-11-02/b08-remediation-2026-11-04.md)。四Important免费技术关闭，296契约组件＋20PG/build／两账号Chrome通过；旧回答／包／来源不改，新模型调用0，原12/12与预算不变。专业AC07未通过，不声称两份解读已重新生成或独立二次复评。

## 2026-11-04 · B08评审与两份专业核对（未通过）

[唯一独立总评审／4 Important／最小待确认修补](planning/bilingual-article-ai-2026-11-02/b08-independent-review-2026-11-04.md)、[两份逐结论支持度核对](testing/article-ai-b08-professional-review-2026-11-04.md)。免费282契约组件＋19PG/build和真实Chrome回读通过，但JATS正文映射漏段／截断／章节局限覆盖／定性输出契约仍有问题，AC07未通过，B08未关闭。原回答／代码／审核保留，0新模型／费用／发布，原12请求已尽；真实重跑另批。

## 2026-11-03 · B06免费负例与B07真实AI

[B06实际网络/身份负例](testing/bilingual-article-ai-b06-2026-11-03.md)、[B07真实工具/模型/产物及费用](testing/article-ai-b07-2026-11-03.md)、[费用与回读契约](technical/article-ai-b07-2026-11-03.md)、[执行台账](planning/bilingual-article-ai-2026-11-02/implementation-progress.md)。两账号各一篇真实解读可读，刷新/来源/互读隔离/超限拒绝已验证；累计保守2.012004元，原12请求已用尽，无续额。282契约组件＋19PG/build及Chrome有证；AC07专业核对和B08唯一总评审未代签，不称全站/生产交付。

## 2026-11-03 · B05单篇原位接线与恢复

[接口与前端契约](technical/article-ai-b05-2026-11-03.md)、[真实浏览器/测试与限制](testing/article-ai-b05-2026-11-03.md)、[串行台账](planning/bilingual-article-ai-2026-11-02/implementation-progress.md)。原E02按钮→AI01固定文章/证据/同版原文位置回链，刷新只GET，E01原反馈显示实际中英词；260契约组件＋19PG与双账号/匿名/原生200%Chrome通过、0Provider/持久新任务。B06完整负例、B07真实AI与B08唯一独立总评审未销项，不称单篇中文回答已可用。

## 2026-11-03 · B04固定单篇证据包

[接口/提交契约](technical/article-evidence-b04-2026-11-03.md)、[本机技术交接及证据](testing/article-evidence-b04-2026-11-03.md)、[执行台账](planning/bilingual-article-ai-2026-11-02/implementation-progress.md)。245契约/组件＋19真实PG与构建通过，原两账号真实只读上下文/1440及390原页面Chrome核对。原数据/权限/费用保全，0Provider；B05界面、B06整片交互、B07真实模型和B08唯一独立总评审未完成，不称已可单篇AI体验。

## 2026-11-03 · E01研究论文筛选闭环

[产品规格](product/paper-filters-spec-2026-11-03.md)、[接口/分类存储](technical/publication-filters-api-2026-11-03.md)、[技术交接及证据/限制](testing/publication-filters-2026-11-03.md)、[串行台账与独立评审](planning/paper-filters-2026-11-03/task_plan.md)。原布局内接真实分类/组合筛选/全量计数，217契约/组件＋15真实PG/前序链/预检和15组Chrome验证；旧夹具失败明确保留。仅本机合成，原件/审核/权限不变，0付费调用或真实发布；专业标签仍待用户抽查。

## 2026-11-03 · B03中英检索真实接线

[技术交接/实际证据](testing/bilingual-search-b03-2026-11-03.md)、[API/分页与投影契约](technical/bilingual-search-api-2026-11-03.md)、[使用说明](product/使用说明书.md)。原E01中文筛选已实际命中获准英文论文，Hub Agent只读检索共用B02计划，原布局/权限/审核保持，0Provider/云/发布。B04单篇AI隔离与后续UI/总评审尚未完成，不用代码测试替代真实执行或用户效果。

## 2026-11-03 · B02纯查询计划阶段完成

[B02规则/快照/证据](testing/bilingual-query-plan-b02-2026-11-03.md)、[已批计划/实际台账](planning/bilingual-article-ai-2026-11-02/implementation-progress.md)。S08技术交接后串行完成，0页面/装配/权限/模型变化；新规则尚未接API，不误称用户双语检索或单篇AI上线。

## 2026-11-03 · S08整页技术交接

[技术交接/证据与限制](testing/study-tasks-s08-2026-11-03.md)、[唯一独立总评审与作者修补](planning/study-tasks-s08-2026-11-02/final-review.md)、[API/运行实现](technical/study-tasks-api-2026-11-03.md)、[使用说明](product/使用说明书.md)。原批准01–11技术收口，无需重复确认；AC10用户体验不代签、S10仍暂停，已批B02纯词表/QueryPlan按序继续。8/8具名合成任务、0模型/外发/真实发布；下方旧中间状态保留为历史。

## 2026-11-03 · 双语/单篇AI已批与B01准备记录

[规格](product/bilingual-article-ai-spec-2026-11-02.md)/[八步计划](planning/bilingual-article-ai-2026-11-02/implementation-plan.md)/UI/M已批准，F01另批；B01现有能力复用3项PG探针通过，新行全回滚，167前端/构建/原资料链6组Chrome留证。[实施台账](planning/bilingual-article-ai-2026-11-02/implementation-progress.md)和[预检交接](testing/bilingual-article-ai-preflight-2026-11-02.md)区分准备与新功能。仍按串行规则待S08闭环，不改业务页面或调用模型，B02以后未开始。

## 2026-11-02 · 双语检索与单篇AI方案待评审

当前新增[最小规格](product/bilingual-article-ai-spec-2026-11-02.md)、[八步计划](planning/bilingual-article-ai-2026-11-02/implementation-plan.md)及[独立文档评审/作者修订](planning/bilingual-article-ai-2026-11-02/design-review.md)。推荐复用47词/PG/旧科研Agent，固定单篇多片段证据，3＋1有效工作日；UI/M/实施待批准，F01核价/调用另批。本轮只读与文档，无代码/页面/DB/服务/权限/模型变更，不取代正在实施的S08或恢复S10。

## 2026-11-02 · S08范围获批，实施计划待确认

用户本轮已批准[S08完整规格](product/study-tasks-s08-complete-spec-2026-11-02.md)、UI01–06与S01–S07。当前评审入口为[11步实施计划](planning/study-tasks-s08-2026-11-02/implementation-plan.md)，执行结果见[台账](planning/study-tasks-s08-2026-11-02/implementation-progress.md)（全部未开始）；首4h复用/影响核对、4＋1有效工作日，继续串行完成S08再下一页。S10暂停，不因规格批准宣称已启用或已验收；下方待批状态为前次快照。

## 2026-11-02 · 当前主线：S08整页设计待评审，S10暂停

已确认[租户管理员长期默认本租户全部业务权限](decisions/0006-tenant-admin-default-business-authority.md)，不跨租户、不跳业务状态或审计；具体模块尚未自动启用。[S08完整规格](product/study-tasks-s08-complete-spec-2026-11-02.md)、[授权清单](planning/study-tasks-s08-2026-11-02/authorization-scope.md)及[源码/只读环境证据](planning/study-tasks-s08-2026-11-02/findings.md)供确认。预计4工作日＋1缓冲，保持母版并明确UI01–06交互差异；本轮不写代码/权限/业务数据。先完成S08全页再下一页，旧R1-01记录保留，R1-02～06暂停，不沿历史计划开工S10。

## 2026-11-02 · R1-01首半天复用验证通过（未接新页面）

用户确认规格/I01–I03/D01后，[R1-01实测](testing/own-tasks-method-reports-preflight-2026-11-02.md)完成两账号旧方法报告v1/v2真实GET、跨本人403、PG hash/父scope、D01精确两任务与重跑不增验证。收尾165项测试/构建及独立只读代码复核通过，保留端口/chunk告警；S08/S10 1440/390母版基准与原S06历史报告观察留证。没有新增权限/费用/共享底座或布局改动；S08/S10新的只读API/页面尚未接通，后续R1-02～06及专业验收仍未做。[实施台账](planning/own-tasks-method-reports-2026-11-02/implementation-progress.md)。

## 2026-11-02 · S08/S10最小只读规格（待批准，未实施）

[R1规格](product/own-tasks-method-reports-spec-2026-11-02.md)、[授权核对](planning/own-tasks-method-reports-2026-11-02/authorization-scope.md)、[16h＋8h计划](planning/own-tasks-method-reports-2026-11-02/implementation-plan.md)已形成。原布局保留，原S10缺少选择阅读交互，I01–I03原槽位适配须显式批准；不借只读新增写权限。合成库READ ONLY核对两账号必要读权限具备、受派任务均0、方法报告候选12/8；逐份可读性未验证，至多2条具名任务夹具D01待授权。不新增RBAC、付费/云/远端配置/发布，不能标为页面完成。

## 2026-11-02 · 剩余页面母版与接口缺口（当前源码盘点）

[逐页清单](planning/page-template-api-gaps-2026-11-02.md)覆盖其余41页，并补原11页残余缺口；[52页机器快照](planning/page-template-api-inventory-2026-11-02.json)记录原组件/19份实际PNG/入口/条件分支/接口族，[一致性结果](planning/page-template-api-inventory-check-2026-11-02.json)核对唯一覆盖和路径。默认pending27中9页已有有界真实分支，另18页无真实业务分支；“已还原布局”不等于“业务接完”。12族现有本机接口与8族旧服务候选分列，优先建议本人任务/已有报告只读，不开放正式采集/审批/共享/发布。仅文档与源码盘点，未实施推荐切片或改变授权/工期承诺，下方旧剩余数量按历史理解。

## 2026-10-31 · 情志病领域独立采集项目（设计待确认）

用户已选择与 ResearchHub 平级、独立定时进程与部署的路径 A，并确认“官网免费正式接口＋获准网页采集”双路径互补；网页框架定为 Scrapy 主引擎、Scrapling 按站点需要增强，见 [ADR-0005](decisions/0005-collector-web-framework.md)。[采集项目设计评审稿](superpowers/specs/2026-10-31-hub-collector-design.md)保留 39＋8 词原检索式、首批来源顺序、逐站权利门禁、隔离候选与 Hub 审核桥、幂等和四层验收；不启用反爬绕过。用户随后授权[建立本地独立项目骨架](superpowers/plans/2026-10-31-collector-bootstrap.md)：`../researchhub-collector/` 已有独立 Git、可安装 Python/Scrapy 环境、离线 CLI 和测试，来源/任务默认关闭。逐站核验后，ChiCTR/ITMCTR 自动获取仍阻断，首个 PMC OAI-PMH 单条元数据离线适配器已实现；尚无真实请求、Hub 入库、展示或 AI 放行，见[来源核验记录](../../researchhub-collector/docs/source-review-2026-10-31.md)。首个获准网页站点、实跑来源、数据库/Hub 写权限与业务验收仍待确认；未采集、未部署、未触碰旧服务或付费 AI。

## 2026-10-30 领域来源目录首切片范围已确认、合并计划待评审

[ResearchHub独立来源目录与导入批次设计](superpowers/specs/2026-10-30-hub-source-catalog-design.md)记录用户确认的 Hub 公共来源与旧知识库独立 Study 边界、两份文献表候选入库及授权审核门禁、开放全文小试点和数据处理专项 `DP-01` 网络采集待办。首个交付范围已合并为“全行隔离暂存→管理员审核→获准字段 E01/E02 真实展示与受权 AI 检索”，见[合并实施计划](superpowers/plans/2026-10-30-hub-source-first-slice.md)；旧[仅暂存计划](superpowers/plans/2026-10-30-hub-source-staging.md)保留为历史。本次仅文档，未建表或导入；与[其余页面计划](planning/phase1-review-2026-10-19/remaining-pages-2026-10-29.md)及[倒排](planning/phase1-review-2026-10-19/reverse-schedule.md)联动。

## 2026-10-29 S02 Study 设计草稿真实入口

[实施规格](product/study-design-entry-real-2026-10-29.md)与[本机实测](testing/study-design-entry-2026-10-29.md)：S01授权入口进入S02本人服务端方案草稿列表，复用原Q02/S07能力，不增加权限或模型调用；其余26条未接线业务页仍在[范围计划](planning/phase1-review-2026-10-19/remaining-pages-2026-10-29.md)中，不把本机技术验证冒充全站或生产验收。

## 2026-10-29 其余页面接线进展

[范围与串行计划](planning/phase1-review-2026-10-19/remaining-pages-2026-10-29.md)盘点52条路由；本轮首个[S01规格](product/study-overview-real-2026-10-29.md)与[本机实测](testing/study-overview-2026-10-29.md)已落实P01→真实授权Study只读概览。其余业务页面继续分片接入；领域内容页按用户确认必须导入可追溯的真实来源记录，空态不能代替验收。仅本机专用合成环境，不代表生产或专业验收。

## 2026-10-28 P01我的科研真实数据首页

[实施规格](product/my-research-overview-spec-2026-10-28.md)、[本机实测](testing/my-research-2026-10-28.md)、[使用说明](product/使用说明书.md)：P01不再展示前端固定研究/AI/入组数据，改读当前账号授权的研究组、项目、本人草稿和待办；未邀请账号无私有Study。仅本机专用合成环境，旧系统/临床库/云/发布不动，0新增模型调用；个人简报和入组预测无可核实结果时明确不展示。

## 2026-10-26当前实施 · WP09免费后端K01–K04通过，F01待确认

用户已批准规格/八步/U01–U04。[实施台账](planning/asset-applicability-2026-10-26/implementation-progress.md)、[阶段实测](testing/asset-applicability-2026-10-26.md)及[一期覆盖清点](planning/asset-applicability-2026-10-26/ai-coverage.md)记录原子新记录、声明规则、人工意见/历史与K05免费契约/原队列探针。最新370/1054、构建/保全通过，0新模型/费用；原79笔账本/691旧源码/115表41128前序行及旧服务保持。

K05真实模型与消息投影、K06页面/真实Chrome、K07全链、K08唯一代码评审及用户AC10未完成。F01核价/调用仍须确认，真实付费开关false；原累计5元不充值续额。下方同日“仅文档待批”等保留为历史，不代表当前状态；不将主链技术通过当一期完整交付。

## 2026-10-26当前 · WP09资产适用性AI核对待确认（仅文档）

用户选择先编制“本人科研资产适用性AI核对＋人工复用建议”：[规格V0.1](product/asset-applicability-spec-2026-10-26.md)、[U01–U04/F01](planning/asset-applicability-2026-10-26/authorization-scope.md)、[八步24＋8h计划](planning/asset-applicability-2026-10-26/implementation-plan.md)。固定双端→声明差异→原Agent定性解释→人工意见，只写新核对记录；前序资产/目标/数据/会话只读，不自动应用、共享或跨Study。

一次独立文档总评审原With fixes（3 Important/1 Minor），主编已补契约与测试落点，无第二复签；[评审/处理](planning/asset-applicability-2026-10-26/review.md)、[源码核对](planning/asset-applicability-2026-10-26/findings.md)、[编制进度](planning/asset-applicability-2026-10-26/progress.md)。规格/U项和实施待用户批准；F01先获准核价再批准调用（或一次明确有条件批准两者）。当前无代码/PG/模型/权限/服务改动，0费用，不扩底座；3天＋1天、首4h止损及11/04/11/06复估、11月中旬目标保持。WP08技术交接/AC10待用户不变，下方旧下一步仅历史。


## 2026-10-26当前 · WP08本机技术验证通过，专业AC10待用户（未发布）

按用户批准规格/八步/A01–A04串行完成方法报告固定版→本人资产候选/列表/配方条件→说明历史/派生→精确报告回链。唯一原代码评审With fixes（3 Important/1 Minor）后，作者三Important一次RED→GREEN修补，最终324纯测试/1054原内核、构建/保全及Chrome整链28组、读失败14组/细分授权10组通过；原结论保留、无第二评审，M-1提示优化延后。

入口/限制见[使用说明](product/使用说明书.md)，[本轮实测](testing/crf-method-assets-2026-10-26.md)、[代码评审及作者关闭](planning/crf-method-assets-2026-10-26/code-review.md)、[实施台账](planning/crf-method-assets-2026-10-26/implementation-progress.md)。仅专用合成环境，原两账号/当前Study/本人新候选和A04新夹具，前序只读；0新模型/费用、旧源/角色/Schema/旧服务及79笔账本保持。专业AC10、完整WP08/一期/生产不由本片代签；交接同步/最终门禁见台账，下方旧状态仅历史。

## 2026-10-26最新 · WP08已批准实施，V01通过、V02进行中（未发布）

用户已批准[规格](product/crf-method-assets-spec-2026-10-26.md)、[A01–A04](planning/crf-method-assets-2026-10-26/authorization-scope.md)及[八步计划](planning/crf-method-assets-2026-10-26/implementation-plan.md)，当前按序串行，唯一代码总评审留V08。V01已用两个原账号的真实报告/Version/Sources通过复用核对，5项新契约与307纯测试/1054原内核、构建/保全通过。V02同tx报告桥和scope验证进行中；尚无新资产前端入口或浏览器验收，不代表完整WP08/专业AC10。具体见[实施台账](planning/crf-method-assets-2026-10-26/implementation-progress.md)。

仅合成库、原两账号/当前Study/本人新候选与本轮新夹具；前序只读，原权限/691旧源/32表18212前序行/旧进程/79笔账本保全。0新增模型/费用，不扩共享底座/云/远端配置/发布；3＋1有效工作日和首4h止损保持。下方“待确认/仅文档”是原编制历史。

## 2026-10-26最新 · WP08首切片规格、最小授权及计划待确认（仅文档）

按本轮请求编制“真实方法报告→本人科研资产候选与复用准备”：[实施规格](product/crf-method-assets-spec-2026-10-26.md)、[A01–A04最小授权](planning/crf-method-assets-2026-10-26/authorization-scope.md)、[八步实施计划](planning/crf-method-assets-2026-10-26/implementation-plan.md)。复用原产物、版本、来源和审计；用独立新来源契约承接WP07，不把旧seed候选冒充新报告资产，不自动创建Study/方案或执行分析。

24小时实施/验证/交接＋8小时修补缓冲，3＋1工作日；首4小时复用不成立即停。仅专用合成环境、原两账号/当前Study/本人候选；A04只申请本轮新建具名测试夹具的必要写入，前序数据/报告只读。规格、A01–A04和实施均待用户批准；本轮0模型调用/费用，不连接数据库或改变代码/权限/服务。WP07技术交接及AC10待用户状态保持；不扩大共享底座或自动缩减一期。

[源码核对与取舍](planning/crf-method-assets-2026-10-26/findings.md)、[独立文档评审及主编处理](planning/crf-method-assets-2026-10-26/review.md)、[编制进度](planning/crf-method-assets-2026-10-26/progress.md)。本节为当前请求，下方旧“下一步/待批准/已实施”属于各阶段历史，不自动恢复。

## 2026-10-26当前 · WP07首切片技术收口，AC10专业验收待用户（未发布）

WP07首切片D01–D07技术检查完成，唯一D08独立原评审及重要项作者复验完成。真实CRF→Python→原科研Agent解释→新方法报告草稿已接通；入口、限制、证据以本片规格/八步计划/实施台账/测试报告及使用说明书为准。AC10用户专业验收未完成，不代表完整WP07/一期交付。原累计79笔known/¥1.518966/¥5，本片4次请求全部用完，不自动追加。仅本机专用合成环境，不恢复其他旧台账或扩大共享底座。




D08唯一独立原结论With fixes（0严重/3重要/1轻微）；三重要项已由主实现一次RED→GREEN修补：第五意图英文/Unicode数量禁入禁出，慢读失权同步释放busy/reading，比较补真实输入修订与双方范围观察。新Chrome交叉失权恢复/迟到200/五视口通过；最终302组合＋1054原内核及构建/保全通过，原Node/chunk告警保留。未追加模型请求，原With fixes与作者关闭分开记录；一处旧“待接入”提示Minor延后。代码/本机启用/真实请求与用户专业AC10四层分列，技术交接不等于完整WP07、一期、生产或专业验收。后续新样例如需新增AI请求，先另确认次数/有效价格，不自动动用余额。下方旧阻断/旧PID/待批均为历史。

## 2026-10-25当前 · 存储修正已验证，模型输出未通过（未发布）

WP07终态只读存储修正已批准并验证；当前停点已转为真实模型正文引用不合格，而非原入队23514。D05–D08仍未完成，原R01方法可用，不恢复其他历史任务。

本轮新增1笔known费用¥0.012051；累计76笔/¥1.476468/原¥5，余¥3.523532、预留0。原75笔与报价保持，原3次已用1次、余2次；要保持原三项目标至少仍需3次，额外1次计划待确认，不自动重试/续额/续价。详见[当前实测](testing/synthetic-crf-methods-2026-10-25.md)；下方此前“0模型/待存储确认”均为历史记录。


## 当前停点：WP07 D05关联存储规格修正待确认

F01已批准/核价；真实原Queue/PG因终态run.artifactRefs不可变拒绝AI入队。0新增模型/费用，原75笔/¥1.464417保持。已暂停本片付费入口，R01方法结果保留；D05未完成，不进入D06–D08。[待确认最小修正](planning/synthetic-crf-methods-2026-10-25/d05-terminal-binding-adjustment.md)、[核价与费用](planning/synthetic-crf-methods-2026-10-25/pricing-revalidation-2026-10-25.md)、[实时台账](planning/synthetic-crf-methods-2026-10-25/implementation-progress.md)、[阶段证据](testing/synthetic-crf-methods-2026-10-25.md)。下方待批费用或已通过D01–D04均为阶段历史。

## 当前：WP07 D01–D04方法执行检查点（2026-10-25）

规格/八步/R01–R03已批准，免费方法链已接到S06；[阶段报告](testing/synthetic-crf-methods-2026-10-25.md)、[实时实施台账](planning/synthetic-crf-methods-2026-10-25/implementation-progress.md)、[操作](product/使用说明书.md)。只专用合成环境/原两账号/当前Study/本人新对象，不扩共享底座。F01公开核价/付费AI仍未批准，D05–D08和专业AC10未完成，不称完整WP07。下方待确认标题均为历史编制记录，不恢复旧任务。

## 待确认：WP07真实合成CRF方法执行与AI解读（2026-10-25）

- [实施规格V0.1](product/synthetic-crf-methods-spec-2026-10-25.md)、[最小授权R01–R03/F01](planning/synthetic-crf-methods-2026-10-25/authorization-scope.md)、[八步计划](planning/synthetic-crf-methods-2026-10-25/implementation-plan.md)：本人真实CRF冻结→旧质控Worker窄投影→S06结果/比较→原Agent解释→新方法报告。
- 24小时实施＋8小时缓冲，3天＋1天；只现有专用合成环境，原两账号/当前Study/本人新对象，不扩共享底座。规格/权限/收费调用均待确认，本轮仅文档，未改代码/库/配置或调用模型。
- [源码核对/取舍](planning/synthetic-crf-methods-2026-10-25/findings.md)、[独立文档评审](planning/synthetic-crf-methods-2026-10-25/review.md)、[编制进度](planning/synthetic-crf-methods-2026-10-25/progress.md)。旧Worker固定阈值/全Study计数及旧seed不能冒充新CRF标准。
- 前序[WP06技术交接](testing/synthetic-edc-c06-c09-2026-10-25.md)已留真实证据，专业AC10待用户。下方“待确认WP06”和其他旧下一步为历史，不覆盖当前状态，也不自动恢复。

## 待确认：WP06合成EDC采集与更正＋AI质控解释（2026-10-23）

- [实施规格V0.1](product/synthetic-edc-spec-2026-10-23.md)：冻结WP05配置→独立合成演练记录包→真实保存/完成/更正→确定性DQ→原Agent解释→报告草稿；不冒充正式EDC。
- [最小授权M01–M03](planning/synthetic-edc-2026-10-23/authorization-scope.md)、[九步计划](planning/synthetic-edc-2026-10-23/implementation-plan.md)、[独立文档评审](planning/synthetic-edc-2026-10-23/review.md)、[编制进度](planning/synthetic-edc-2026-10-23/progress.md)。32小时＋8小时缓冲，4～5工作日；费用/有效核价另门槛。
- 本轮仅文档，未改业务代码、数据库、权限、页面或运行环境，没有模型调用/新费用/云/远端配置/发布。待用户确认后才实施；原两合成账号/当前Study/本人范围及WP01暂停边界不变，不将主线演练替代一期全部能力。


## 2026-10-23 · 执行准备真实AI、核对意见与修订链

E01–E07已在原两账号/当前Study/本人草稿与专用合成环境完成真实验证：新材料入库审核→PICO→方案→人工访视/CRF/映射与试填→原科研Agent一致性核对→分批意见/历史/显式重绑。配置修订后旧AI/质控/报告/资产保守失效；真实在途撤审阻断assistant交付。技术门禁、E08唯一总评审/修补及专业AX09状态统一以[实测与交接报告](testing/research-execution-preparation-2026-10-23.md)为准，不据此声称完整WP05/一期或生产交付。

本轮获准原累计5元内核价/调用，63笔known、保守¥1.246815（新增11笔¥0.261936），含失败费用；原52笔前缀/旧源/旧服务/正式表/角色保持。没有新权限、充值、续额、云/远端配置/发布操作。下一步仍由用户用未预运行合成材料评阅；正式Study/Protocol/EDC、完整联网与其余AI入口另规格、授权和验收，不扩大共享底座。

原28＋4小时是本片有效工作预算，不把同日自动化测试换算为节省人日或全项目完工率；本片交接后按专业反馈复估下一最小业务切片，11/04和11/06仍核对全量剩余范围，2026年11月中旬目标不变。下方E04零费用/费用待确认/待批准/旧排期均为当时历史，不作为当前阻断或恢复指令。

## 2026-10-23 · ResearchHub WP05第二切片E04检查点，AI待费用确认

规格/八步计划已批准；E01–E04本人配置、真实工作台、人工映射/确定性检查/不持久化试填已在本机技术验证。206/206相关测试、1054/1054原内核、构建、两账号五视口/原生200%及17项免费检查记录通过，见[阶段报告](testing/research-execution-preparation-2026-10-23.md)。

本片0新增调用/费用，原账本¥0.984879/¥5保持；E05付费授权/有效报价待确认，E06–E08及唯一独立代码总评审/专业验收未完成。无扩权、正式采集写入、旧源码/旧服务/云/远端配置/发布操作。原28＋4小时预算保持，剩余任务预算14小时＋4小时缓冲，等待另列；11月中旬总体目标仍须11月4日/6日复估。下方“仅文档/待批准”为历史，不再代表当前状态。


## 2026-10-23 · WP05第二切片执行准备规格（仅文档，待批准）

[实施规格V0.1](product/research-execution-preparation-spec-2026-10-23.md)与[八步小步计划](planning/research-execution-preparation-2026-10-23/implementation-plan.md)拟补本人方案版本→结局/访视/CRF配置草稿→确定性规则及AI核对说明→人工修订/历史/显式重绑。复用旧表单纯契约和原Agent/产物/授权事务，不调用会写正式对象的模板/Protocol服务；不是EDC、正式研究启动或完整科研Agent交付。

28小时实现/验证/交接＋4小时缓冲，共4工作日；若10月26日获批且无等待，目标10月29日本机技术交接，专业验收另列。后续EDC、完整联网/其余AI及11月中旬总体交付仍需11月4日/6日按真实剩余量复估，不自动删一期范围。

本轮只编制规格/计划及一次独立文档总评审、同步Notion；不改业务代码/运行配置、不连接PG或调用付费模型。原两账号/当前Study/本人草稿、专用合成环境及当前目录串行方式保持；新增费用/权限/云/远端配置/真实发布另确认。原首切片技术证据与专业待验状态保留；使用说明、旧客户更新页和运行接口不变，业务实施待用户确认。

## 最新交接：WP05首切片本机技术验证与评审修补完成

T01–T09真实实施验证及T10唯一一次独立代码总评审已完成；3项Important、2项Minor均由主实现核对修补复测，无第二次独立签认。最终190/190相关测试、1054/1054既有编译内核、构建及25项综合门禁通过（gates-6d67fff7），含两角色新材料全链各9项、实际在途来源撤审、五视口/原生200%、慢轮询及复制晚到反例。完整证据与用户专业体验A09见[最终实测报告](testing/research-design-workbench-2026-10-23.md)。

交接仅指本机合成技术能力，不是用户专业验收、完整WP05/一期或生产交付。累计52笔均known，保守¥0.984879/¥5，原33笔与旧源/旧服务/历史对象保持；无新权限、Schema、充值、自动续额或云/远端配置/发布。报价至2026-10-24 14:12:50北京时间，过期/费用未明停新调用。本次收尾不再调用模型。下一检查点为用户体验核对，不自动扩大业务范围；2026年11月中旬总体目标仍须逐片复估。

以下按阶段保留原记录；旧段落的“评审中/待批准/186项/22门禁”均为当时历史，当前结论以上段及最终报告为准。

## 最新：WP05 T01–T09本机技术验证，独立代码总评审中（2026-10-23）

[实施规格](product/research-design-workbench-spec-2026-10-23.md)、[任务/进度](planning/research-design-workbench-2026-10-23/task_plan.md)、[真实实测报告](testing/research-design-workbench-2026-10-23.md)、[使用说明](product/使用说明书.md)。原两账号各全新材料已通过真实浏览器设计→质控→报告→资产草稿链；来源失效/并发/历史/字体与原生缩放另有本轮证据。仍只本机合成范围，不扩共享底座/权限/云/发布，专业验收待用户；本轮累计保守¥0.984879/¥5含失败。下方为各阶段历史。

## 当前：WP05已批准，T01/T02本机验证（2026-10-23）

- [批准规格](product/research-design-workbench-spec-2026-10-23.md)、[十步计划](planning/research-design-workbench-2026-10-23/implementation-plan.md)、[当前跟踪](planning/research-design-workbench-2026-10-23/task_plan.md)：纯契约与本人真实草稿工作台已接通，下一步T03证据表，后续T04–T10尚未完成。
- [部分实测报告](testing/research-design-workbench-2026-10-23.md)：120项套件/1054项内核、6组API、24项Chrome/五视口/原生200%及构建；本片最终独立代码总评审留T10，专业验收待用户，不用旧文档评审代替。
- [体验说明](product/使用说明书.md)：19501原账号→K01科研Agent→“我的研究设计草稿”→Q02继续原Q01。新增调用/费用0、无新增权限/Schema/旧服务改动；原报价到期，真实AI前需确认核价及原累计5元范围调用。下方同日“待批准”是批准前历史。

## 待评审：WP05研究设计工作台与AI辅助方案完善（2026-10-23）

- [实施规格V0.1](product/research-design-workbench-spec-2026-10-23.md)、[十步小步计划](planning/research-design-workbench-2026-10-23/implementation-plan.md)、[文档评审](planning/research-design-workbench-2026-10-23/review.md)：本人草稿工作台→固定资料证据表/人工处置→逐节建议→人工采纳/版本差异→原合成质控/报告/资产。
- 预计36小时＋4小时缓冲，按5工作日安排；规格/计划待用户批准，当前仅文档，不是业务已开工或能力验收。当前目录串行＋独立总评审，仅原两合成账号/当前Study/本人草稿；不扩共享底座、不增权限/费用/云/远端配置/发布。
- [跟踪](planning/research-design-workbench-2026-10-23/task_plan.md)区分文档交付与未来实施；下方WP02及六阶段本机技术证据保持，不被新规划重写。

## 当前：WP02账号与邀请本机技术闭环（2026-10-23）

- [已批准规格](product/account-invitation-spec-2026-10-23.md)、[八步实施计划](planning/account-invitation-2026-10-23/implementation-plan.md)、[进度](planning/account-invitation-2026-10-23/task_plan.md)：注册/找回/最小Study邀请及真实身份已在专用合成环境实现；不直接暴露旧管理员建号/重置接口，原角色/原Study不变。
- [实测报告](testing/wp02-account-invitation-2026-10-23.md)、[独立评审关闭](planning/account-invitation-2026-10-23/review.md)：113项套件、1054项既有编译内核、52页身份、真实HTTP/SMTP/Chrome、竞争/分页/200%与自有七端口重启。初评3项Important先红后绿；专业体验待用户。
- [操作说明](product/使用说明书.md)、[邮件运行说明](technical/wp02-account-mail-runtime.md)：19501登录、19507私有收件箱；独立.env只读capture，填真实参数不外联/verify/外发。注册零自动私有授权；新Study仅只读邀请，无AI/审批/共享/锁库/发布/导出。新增费用0，生产/远端配置仍另批。
- 下方六阶段主链是已验证的上一切片；其状态和冻结证据不因本设计草案改变。

## 当前：六阶段合成科研主链联调（2026-10-22）

- [联调规格与实测](testing/research-flow-e2e-2026-10-22.md)：原两账号各新材料完整走到私有资产候选；实际Agent/费用和原TS-Python数值/来源/版本全链核对，非SQL造方案或旧产物拼接。
- [实施记录](planning/research-flow-e2e-2026-10-22/task_plan.md)：资料缺口与PICO意图、新run报告版本残留、K01窄视口搜索遮挡三处最小修补；110单元、828既有编译内核、真实Chrome/200%/权限/恢复及构建通过。
- [体验说明](product/使用说明书.md)、[本机环境](technical/local-knowledge-runtime.md)：新增6笔保守¥0.097488，累计33笔¥0.566010/¥5，不新增权限/云/发布；原记录与1053冻结证据保全。专业效果待用户，不开放共享/审批/锁库/发布/导出。下方为前序切片历史。

## 当前切片：报告 → 私有资产候选（2026-10-22）

- [实施规格](product/synthetic-asset-slice-2026-10-22.md)：原两合成账号本人候选创建、查看、说明修订、派生；保留根报告/原Source/软件配方/父版本血缘，无正式资产、共享/审批/锁库/发布/导出。
- [真实验证](testing/synthetic-asset-2026-10-22.md)：107项单元、828项旧编译内核、API9、两账号Chrome各8、安全10、重启7、分页/200%及51路由只读烟测；独立评审3项Important已RED→GREEN关闭。仅合成技术验证，专业验收待用户。
- [实施记录](planning/synthetic-asset-2026-10-22/task_plan.md)、[操作说明](product/使用说明书.md)、[常驻环境](technical/local-knowledge-runtime.md)：19501→Q01报告封装或A01我的资产候选；0新增模型/费用，原27次保守¥0.468522/¥5账本不变。下方为前序切片历史。

## 当前切片：质控结果 → 可追溯报告草稿（2026-10-22）

- [实施规格](product/synthetic-report-slice-2026-10-22.md)：复用原产物/Source/版本/CAS/审计，只读机器事实与单独人工说明；原两账号、本人本轮草稿，无审批/锁库/发布/导出。
- [真实验证](testing/synthetic-report-2026-10-22.md)：100项相关单元、828项既有编译内核、API10、两角色各8、边界7、延迟/放弃恢复2、自有重启5与真实200%；独立评审两项Important已RED→GREEN关闭。
- [实施记录](planning/synthetic-report-2026-10-22/task_plan.md)、[操作说明](product/使用说明书.md)、[常驻环境](technical/local-knowledge-runtime.md)：原5元累计账本不变，新增模型0元。仅本机合成技术验证，专业效果待用户验收；下方为前序切片历史。

## 最新切片：方案草稿 → 合成试运行与质控（2026-10-22）

- [实施规格](product/synthetic-quality-slice-2026-10-22.md)：方案/来源/数据版本绑定，原ResearchMethodRun、TS契约和独立Python确定性算子复用；仅原两账号本人派生夹具，无审批/锁库/发布/导出。
- [真实验证](testing/synthetic-quality-2026-10-22.md)：94项契约、828项既有编译内核、原Python4项、API13项、两角色Chrome各8项，在途失效/并发/200%和重启恢复。本片新增模型0次，原27次/保守¥0.468522/¥5账本不变。
- [实施记录](planning/synthetic-quality-2026-10-22/task_plan.md)、[使用说明](product/使用说明书.md)、[常驻环境](technical/local-knowledge-runtime.md)：19501→K01继续本人方案→Q01合成质控。技术实测，专业效果待用户验收；非临床统计、完整科研AI或生产验收。

## 最新切片：已审核资料 → PICO确认 → 方案草稿（2026-10-22）

- [实施规格](product/research-plan-ai-slice-2026-10-22.md)：原科研Agent/知识/会话队列与产物版本复用；两具名合成账号、当前研究、本人候选最小权限，不开放审批/发布/导出。
- [真实验证](testing/research-plan-ai-2026-10-22.md)：88项契约、828项既有编译内核、两角色各8项付费Chrome主链，来源失效/真实CAS/200%与重启恢复；共用原5元累计账本，失败请求计费不抹除。专业效果待用户确认，不是完整Protocol/生产交付。
- [本轮实施记录](planning/research-plan-ai-2026-10-22/task_plan.md)与[使用说明](product/使用说明书.md)：19501真实登录→K01科研Agent→形成或继续本人草稿。仅合成环境，旧服务/源码/历史任务保全，不恢复T03–T24。

## 最新切片：知识资料 AI 问答（2026-10-22）

- [AI问答规格](product/knowledge-ai-slice-2026-10-22.md)：原科研Orchestrator KB分支/会话/工具复用，只读已审核资料，引用快照与提交重验；仅合成owner/admin必要授权。
- [真实AI验证](testing/knowledge-ai-2026-10-22.md)：前端76、既有编译内核828、真实付费主链8项、生成期变更拦截及UI5项；5元累计上限内保守已用约0.13元，重启不重置。不冒充完整OpenCode/科研Agent、生产或专业验收。
- [当前使用说明](product/使用说明书.md)与[本机运行说明](technical/local-knowledge-runtime.md)：19501登录后进入K01科研Agent；仅合成材料。下方“AI未启用/服务配置待提供”为先行切片历史，报价到期仍需核对，不自动续费或续额度。

## 最新切片：知识资料前端（2026-10-22）

- [知识资料实施规格](product/knowledge-frontend-slice-2026-10-22.md)：K01复用旧UI/API与真实研究授权，不修改旧项目源码，保持现有Shell/字号/权限。
- [真实浏览器验证](testing/knowledge-frontend-2026-10-22.md)：前端64、Chrome15检查及后端9组通过，含真实导入/检索、只读/无成员/撤权、409、任务恢复和200%实际缩放。仅本机合成环境，不代表完整AI、常驻配置、生产发布或专业签认。
- [使用说明](product/使用说明书.md)已补入口与恢复方式；下方旧“知识前端待接线/服务配置待提供”保留为历史，以当前切片和服务复用报告为准。新增费用/权限/云/发布仍需确认，T03–T24继续暂停。

## 当前执行：业务优先与开发准入（2026-10-22）

用户已批准暂停T03–T24完整排空协议，保留T01/T02及既有安全修补。当前[开发准入与业务优先计划](planning/development-admission-2026-10-22/task_plan.md)的本机合成安全准入已通过，自动进入账号/知识/科研AI，不再等待T03身份方案。下方旧“待提供专用库/不恢复其他包”为历史，不作为当前指令。

- [更新倒排](planning/phase1-review-2026-10-19/reverse-schedule.md)：10-22至建议11-13共17个周一至周五；正式目标仍11月中旬，不缩减注册/找回/邀请及全部已确认AI入口。
- [真实会话首切片](product/account-session-slice-2026-10-22.md)：P003的login/me/logout在专用合成环境通过真实两角色浏览器验证；未部署，不代表注册/邀请或全工作台完成。操作见[使用说明](product/使用说明书.md)，接线见[前端架构](technical/frontend-architecture.md)。
- 下一真实发送/AI探针需获准的专用邮件、模型、解析和向量服务配置引用；不隐式复制全部旧配置或新增供应商/云资源。云、旧服务停线、真实发布及新增范围仍停线确认，WP01整体/生产保持partial。

## 当前工作：WP01首批代码已验证，真实共享库验证待准备

2026-10-20用户已批准[WP01规格](planning/wp01-shared-boundary-2026-10-20/spec.md)与[实施计划](planning/wp01-shared-boundary-2026-10-20/implementation-plan.md)，选择主实现串行＋独立总评审。Task 1部署/认证/租户控制面先红后修，包级41项及6项新浏览器通过，重要评审问题已修，见[首批记录](testing/wp01-shared-boundary/report.md)。真实PG/RLS、后台隔离与生产未验收；用户选择已有专用测试库，待提供配置路径，不自行建环境，不恢复其他工作包。

本目录是产品、设计、技术与测试规则的唯一文档入口。新页面、压缩包接入和自动化修改必须先读取相关规范，不允许从某个历史页面反推新的全局规则。

## 当前一期评审入口（2026-10-19）

2026-10-22 本机知识资料体验：[常驻环境说明](technical/local-knowledge-runtime.md)与[实测记录](testing/local-knowledge-runtime-2026-10-22.md)。回环 19501 登录后访问 K01；仅合成材料，账号密码保存在本机私有文件，不写文档。不是生产发布或完整科研 AI。

前端实施必读：[UI/UE实施与验收规则](ui/frontend-ui-ue-rules-v1.0.md)（2026-10-20）。统一已有视觉/字号来源、组件、UE01–UE10交互状态及任务级证据；门户与工作区分别验收，不代表现有50页已全部达标。

现行V1.1已由E02/Q01/Button样板和[本轮浏览器实测](testing/ui-ue-validation-2026-10-20/report.md)收口；新增[Reading角色ADR](decisions/0004-scoped-reading-typography.md)与[样板使用说明](product/使用说明书.md)。后续逐模块推广，不把样板或DOM冒烟当作全站体验验收。

[一期方案评审包](planning/phase1-review-2026-10-19/README.md)统一归档用户确认，建议先读台账，再按顺序评审：

1. [总体方案](planning/phase1-review-2026-10-19/overall-design.md)：独立部署、共库共表/租户隔离、整域复用和旧后台改动边界。
2. [AI专项设计](planning/phase1-review-2026-10-19/ai-special-design.md)：旧科研基线、全部页面18项归并能力、A0主验收及效果评价。
3. [开发准备清单](planning/phase1-review-2026-10-19/development-readiness.md)：物料/责任、G0风险验证/G1启用门槛及集中待决项。
4. [倒排工期](planning/phase1-review-2026-10-19/reverse-schedule.md)：11月中旬目标、纵向交付包、10-23/11-06复估点及正式验收。

已确认共享实例/库/表、租户管理共用、注册默认新租户且私有Study另邀；一期注册/找回/邀请和全部页面AI、L2/L3二期、不迁历史研究数据。WP01已进入上述首批代码实施，其他技术包仍待相应评审/实施，未部署。历史冲突以当前确认台账为准；[ADR-0003](decisions/0003-shared-database-tenant-boundaries.md)记录已确认架构约束，不代表真实隔离通过。

## 目录

| 目录 | 作用 | 必读文档 |
| --- | --- | --- |
| `product/` | 产品架构、术语、用户旅程和页面职责 | `product-baseline.md`、`product-changes.md` |
| `ui/` | Design Tokens、Shell、页面头、布局实施和组件规范 | `demo-ui-foundation-v1.0.md`、`navigation-page-header-standard-v1.0.md`、`page-layout-practice-v1.0.md` |
| `technical/` | 工程结构、页面接入、公共模块和运行方式 | `frontend-architecture.md` |
| `testing/` | 构建、浏览器、视觉和交互验收标准 | `ui-acceptance.md` |
| `decisions/` | 不应被重复讨论或随意推翻的架构决策 | `0001-freeze-global-ui-foundation.md` |
| `reference/` | 页面编号、路由和上下文映射等查表资料 | `page-context-map.md` |

## 文档优先级

1. 用户本次明确要求。
2. `docs/decisions/` 中状态为 Accepted 的 ADR。
3. `docs/ui/` 和 `docs/product/` 的已发布版本。
4. `docs/technical/` 与 `docs/testing/`。
5. 历史页面源码和旧压缩包。

当源码与规范冲突时，应修正源码或记录例外，不能复制冲突继续扩散。

### 开放门户可读性（2026-10-19）

- [门户排版与可读性规范](ui/portal-typography-v1.0.md)：区分工作区与门户字号；给出桌面、手机、辅助文字、对比度及重排要求。
- [P002 UI 与字号审查](ui/audits/2026-10-19-p002/审查报告.md)：保留修改前的七区截图、实际字号与问题清单。
- [P002 代码整改与验收](testing/p002-ui-remediation-2026-10-19.md)：角色字号、窄屏重排、图片加载与前后截图；含未测边界。
- [UI 验收规范](testing/ui-acceptance.md)：按当前页面清单及 Shell/门户类型验收，避免沿用固定 19 页范围。

功能、业务逻辑或业务模型变化时，更新 `product/product-baseline.md` 的现行条款，并在 `product/product-changes.md` 追加记录。`product/` 中两份 Workshop 恢复文档是历史材料，不作为现行模型。

## 灵枢心域整合入口

- [开发基准](technical/integration-baseline.md)：唯一工程、页面入口与快照边界。
- [门户功能设计V1.1](product/lingshu-portal-design-v1.1.md)：注册、登录、学术发起、帮助中心；尚未实现项标为设计建议。
- [原始附件与首页母版](reference/lingshu-v1/README.md)：原始V1.0资料保留不改写。

## 页面链路与补缺审查

- [功能补缺方案V1.0](planning/lingshu-page-gaps-v1.0/页面链路与功能补缺方案_V1.0.md)：32个现有页面、八步验证与六批补缺顺序。
- [页面串联地图](planning/lingshu-page-gaps-v1.0/page-chain-map.html)：打开现有入口、分类筛选与本次截图。浏览器打开可使用；预览服务地址可在地图中修改。

这些材料是审查与拟定实施方案，不代表新增业务功能已实现。

## 前端补缺实施状态

当前50个登记页面，新增18个门户与科研流程入口。本机演示的实现与验证见 [实施记录](testing/frontend-gap-implementation-v1.0.md)，原补缺审查地图保留为32页历史快照。真实服务接入边界与待完成能力在实施记录中列明。

## 灵枢心域用户路径与产品重定义 V2（2026-10-14）

用户已确认岐研多机构/多Hub及Hub跨机构共建；首期仍以灵枢心域领域体验为主。

- [产品需求PRD V2](product/lingshu-product-prd-v2.0.md)：对象、身份/权限、数据增量、治理与首期范围。
- [四类用户路径与页面功能 V2](product/lingshu-user-journeys-pages-v2.0.md)：四条路径、全部50页映射、7个拟定缺口职责与验收。
- [开发路线 V2](planning/lingshu-development-roadmap-v2.0.md)：通用底座、首个Hub、研究闭环与后续多Hub运营。

V2为后续目标方案，不是正式后端上线记录。原Hub创建无审批资料与V1.1门户建议保留为历史来源，与V2冲突时以后者目标为准；具体政策需评审后实施。

### V2.0专业材料修订R1

三份V2.0已按教授资料和“无EDC需建设采集”的确认更新。[专业材料分析与待确认事项](product/lingshu-professional-review-v2.0.md)记录2页PPT、文献表规模/质量、检索范围差异、代表注册研究核实结果及所需输入。原PPT/XLSX保持不变；未把资料分析当成科学去重或患者数据上线。

## 既有项目功能复用评估

[aisciencesys → 灵枢心域复用评估 V1.2](planning/aisciencesys-reuse-assessment-v1.0.md)：本地完整app/字典复核及后续用户确认；整域复用、共享表租户隔离、无历史迁移、全部AI范围与真实验证，不是从零开发。

- [数据库覆盖与字典增补](planning/reuse-review-2026-10-19/database-inventory.md)：111模型索引、8模型字段增补、迁移/RLS/手写SQL边界；未连接运行库。
- [模块能力与测试证据](planning/reuse-review-2026-10-19/capability-evidence.md)：Agent/知识/解析/数据/研究执行的实际实现、依赖和离线测试，不把Mock当作生产能力。
- [交付初评历史快照](planning/reuse-review-2026-10-19/delivery-readiness.md)：保留后续回复前的初评；原7组问题已归档，不再要求重复回答。现行准备与日期见一期评审包。

本轮只更新调研与计划，未改业务代码、迁移数据或缩减已确认产品需求。

[首期范围与复用决策补充](product/lingshu-scope-decisions-2026-10-14.md)：确认旧研究基础与公开活动栏目，列出配置资料需求及第2–4项推荐策略。

[三角色、数据更正与旧库核查](product/lingshu-data-policy-and-database-check-2026-10-14.md)：保留历史仓库检查，已更新为旧历史不迁、限定PG配置核查；现行确认以一期台账为准。
## 2026-11-16 · 真实任职资料准备

[来源与录入入口局部方案](product/researcher-tenure-entry-spec-2026-11-16.md)：拟在原G02人员区增加选填任职月份，沿用原保存／审核；待首批真实资料及局部交互确认。尚未补录或修改代码。
