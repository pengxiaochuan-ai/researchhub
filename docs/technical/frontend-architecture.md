## 2026-11-17 · 个人入口显示名称统一

原“我的科研”显示名统一为“我的工作台”；共享导航映射与所有使用该名称的返回/状态/登录文字同步，p01、API、storage、组件与权限不变。首页个人问候保留，帮助start条目明确入口。无新增运行依赖、后端或数据库迁移；当前验收见[规格](../product/my-workspace-naming-2026-11-17.md)。

## 2026-11-17 · 视频内容局部接线

AgentMedia在原文件列表外、同一视频展开区呈现AgentMediaContent，避免原90px列表裁切；Shell、历史、输入、右栏和登记不改。按identity/session/media/version隔离响应，原键恢复；时间证据与版本核验后由原播放器定位，来源410/失权清内容与播放器。原生图片用Cookie和精确本机scope读取，不要求img附自定义头，交付前校验SHA。真实图片加载及回放/刷新已测，追加迟到、离线、来源撤回清播放器及私有路径拒绝已验证。

仅新视频factory/Controller/生命周期及真实状态接线，装配失败局部unavailable，原上传/播放保留。私有执行日志位于前端根之外，正式多实例/分发另列。[接口与存储](ai-media-content-api-2026-11-17.md) · [本机证据](../testing/ai-media-content-2026-11-17.md)。

## 2026-11-16 · 视频原件登记与定向读取

AgentMedia在原视频区域内联AgentMediaIngest；useAgentMedia传当前身份/会话及真实登记状态，客户端GET/POST仅允许精确登记路径。准备/确认以原key恢复，组件currentRef/epoch/viewKey隔离迟到响应；确认状态未知冻结原意图，不自动重试。ResearchSubjects仅填充原相关文档，CaptureFiles只在匹配文件行附同源回执；两者独立读取client使登记403不会清掉原父页权限，失权清播放器/回执。14/22、原Shell与任务布局不变。

服务端源/目标双scope与当前许可/真实父链重验，原件锁+事务内ModalityFile/Audit/回执；同原件其他计划409，同原操作回放原回执。原件SHA/Range交付前后重验、未交付流关闭。新登记factory失败仅局部unavailable，状态接口明确，原上传播放保留；页面不显示开发路径或配置。两张Hub表的guard修正需显式匹配旧SQL/catalog，启动不自动迁移。[完整证据](../testing/ai-video-binding-2026-11-16.md)。

## 2026-11-16 · 上传期间显示视频文件名与旧处理链核查

AgentMedia将本次File.name与目标sessionId仅放内存，导出还需visible、uploading和sessionId一致。null→本次懒创建保留，真切篇/身份变化清理；暂停隐藏、恢复重验，结束清理，拒绝的写操作不影响原上传。复用原状态行，React转义与overflow-wrap:anywhere，无新字段/接口/权限/模型输入。

[处理链核查和本片设计](ai-video-feedback-2026-11-16.md) · [真实UI及回归](../testing/ai-video-feedback-2026-11-16.md)。

## 2026-11-16 · 视频写请求同源契约

仅媒体POST使用session-media-v1标记与fetch mode=same-origin/credentials=same-origin/redirect=error；原文献/Excel的XHR不变。二进制片仍1MiB/3并行，进度只按成功响应确认，不自动重试。后端本机去端口分支须真实loopback/Host/Referer/Fetch Metadata/marker/路由与类型联合成立；不改全局认证或正式HTTPS规则。

[真实边界与浏览器证据](../testing/ai-media-origin-2026-11-16.md)。

## 2026-11-16 · 岐研AI续传与独立历史

AgentMedia保留原元信息/内容身份和当前scope，WebCrypto按1MiB有界核验；回到原会话只补快照缺片，未知归档保留原key，最终摘要后重验身份，慢读不能退回传输阶段。主上传的新选择与显式继续区分，原同文件终态恢复不造副本。AgentHistory不等待正文，SPA重挂重新请求轻量当前授权，保留原DOM防闪烁，401/403清私有状态；未增加授权缓存、表或索引。后端普通历史省略无用job查询，文章最新任务排序/hash语义不变。

[完整协议及本机证据](../testing/ai-resumable-2026-11-16.md)。

## 2026-11-16 · 视频上传恢复反馈修复（本机）

“核对上传”现显示进行中及查无回执、未归档、失败或已归档的明确结果；“继续上传”选错原文件、旧请求占用和身份重核都有可见反馈。原操作沿相同身份恢复，等待归档不因慢回执退回重传。原两账号真实接口、36项浏览器回归、738纯测、28后端/PG回滚及构建通过，原六媒体行未变，无新媒体/模型或权限改动。[本轮证据与用户复验路径](../testing/ai-video-recovery-2026-11-16.md)。

## 2026-11-16 · G02待处理事项加载优化

分类读取完成即显示；其余类别保留加载提示，失败和无权限不计为成功空列表。邀请按原Study／游标最多3并发；方案队列仅请求内预取25条授权目录，逐Study当前授权和原v1续读保持。布局、导航、排序、审核与原权限不变。`loadGovernanceResults`逐项不可变状态发布，保留20秒deadline、身份卸载失效和迟到结果拒绝。邀请合法scope先核验，最多3 worker、child abort、错误整体拒绝且按原scope顺序合并。`reviewDirectory`只供队列内部用，每条游标从SQL原始微秒timestamp生成，不改变public DTO或跨请求缓存。非第一页在所选类别加载完成前不交付临时错页；完成后仍原排序／去重。[本机验证与证据](../testing/governance-loading-2026-11-16.md)。

## 2026-11-16 · Excel选择后无反馈修复

HubAgentPanel同身份重核保留会话，Agent能力/已有session读取成功后ready；创建使用独立上下文与generation，真实换源/卸载失效。AgentMaterials内存暂存选择，读取sequence与上传generation分离；核验暂停旧读和分析，保留在途上传，按当前文件类型能力及当前data回调继续。原恢复键不变，不增加授权或自动重传。撤销Agent清理受保护状态，消息/历史仅ready交付。[验证与四层边界](../testing/ai-upload-focus-2026-11-16.md)。

## 2026-11-14 · 邀请异常真实合成闭环完成

用户已批准原P2 Study4条具名邀请；failed／unknown／expired真实入关注，正常captured排除。原S11精确定位后两次重发／一次撤销均HTTP200，刷新回读及返回总览3→2→1→0，撤销框Esc取消不提交。6封本机捕获回执及审计一致；原5条邀请全字段摘要、原两账号授权、全部角色和当前Study成员未变，无新账号／成员／角色、外发邮件、模型、重载或产品代码修改。

35定向／729当次前端、9.43秒构建及6组真实Chrome（五宽）通过；相同产品版本原12组只读／原生200%证据保留。唯一总评2Important已修补，无第二次总评。本项OV03本机合成技术交接完成；用户签收、正式环境／真实邮件及原P1留项另列，P4／伦理材料／多中心仍延期。以下较早日期的“待确认／未验”是历史阶段，当前以本节为准。 [current evidence](../testing/invitation-exceptions-2026-11-13.md).

## 2026-11-13 · 邀请异常与安全定位

invitations只读适配器取合法Study／WP02全分页，仅异常入关注，processed不造历史。S11有target才跨页，普通页仍原首页／加载更多。安全URL分开主page／attentionPage；身份门禁／seq／父signal抑制旧身份迟到。只加行定位框、focus与治理返回，原母版及接受页保留。[契约](invitation-exceptions-2026-11-13.md) · [验证与待确认](../testing/invitation-exceptions-2026-11-13.md)。

## 2026-11-14 · 原位字段映射本机启用与真实恢复验证

ResearchDataImport复用prepare的mapping_required响应，按需fieldset与共享Button；严格绑定账号/会话/预检版本，未提交选择只存本会话，不含原始行。明确失败保留可编辑标记、未知请求先原key GET，身份/来源切换拒绝迟到响应。仅重复label显示key区分，并保留到确认摘要；唯一label不露key。14/22/原生select高度与组件六宽有证；实际双账号页面1440/1024/390选择/409恢复及最终指纹守门已验证，本会话未重载，不改Shell/原三栏。[契约](ai-inline-mapping-2026-11-13.md) · [当前验证](../testing/ai-inline-mapping-2026-11-13.md)。

## 2026-11-13 · 一般表格带单位真实写入完成（本机）

ResearchDataAnalysis仅在固定结果/表单存在非空unit时投影该字段，ResearchDataOverview与程序事实标签一致显示；旧无单位对象/hash保持。原页面结构与确认次数不改。双账号真实CSV/XLSX→固定S09及13视图回看通过，0模型；窄屏原AI工作区未重设计，不宣称全页UE验收。[契约](ai-general-tabular-2026-11-13.md) · [真实写入证据](../testing/ai-general-unit-write-2026-11-13.md)。

## 2026-11-13 · P7处理结果与实际导航

GovernanceOverview原history复用protocol-decisions／parseDecisionPage，按真实决定ID去重、createdAt排序及原版本回链；G02返回只保留governance上下文，G01的reviewTab严格互斥保持。platform-shell真实context-nav事件使用固定governanceNavTarget修正data/system/centers目的地，actions／demo保持。未新增API或改布局。[技术边界](governance-p7-integration-2026-11-13.md) · [九组实测与未决](../testing/governance-p7-2026-11-13.md)。

## 2026-11-13 · 一般研究表格列描述与映射摘要

沿原ResearchDataPreview表头按需显示真实unit/profile，原值单元格保持；ResearchDataImport在原确认前展示summary.transforms，字段名称使用真实label，不新增页面、导航、选择器或确认。旧无profile/transforms响应保持原渲染。14/22和原表格横滚不变；不能把受控组件六宽当目标业务已启用，真实Chrome/API与原AI窄屏布局限制见[报告](../testing/ai-general-tabular-2026-11-13.md)。

## 2026-11-13 · 系统配置状态与统一入口

真实G05安全归一到G02现有Token工作区，显式演示保持；末尾GovernanceServiceStatus按身份／sequence和client generation清旧值／阻断迟到。HTTP401／403先分类，再解析成功响应五项严格白名单，状态错误与账本读取独立。原布局／Shell／Table／Dialog保留，只给原核对动作增加loading守门。[接口与状态来源](governance-system-2026-11-13.md) · [实测](../testing/governance-p6-2026-11-13.md)。

## 2026-11-13 · G04复用既有移动导航

仅将获批G04加入source-real／Hub mobile导航白名单与现有响应式CSS选择器；本页排除重复workflow开关，不复制导航或改Frozen Token。桌面与其他页分支保持，新的遮挡命中／Tab／焦点／Esc和原生200%完整截图见[实测](../testing/governance-p5-2026-11-13.md)。P4延期不改变此审计只读职责。

## 2026-11-13 · P06当前固定数据概览与来源

`ResearchDataOverview`位于原导入区折叠内容，按身份/session/import版本绑定读取；未知清旧、显式GET恢复，迟到不得覆盖新账号。`research-data-import-session`只增加精确GET analysis白名单，保留写/query/export拒绝。dataAnalysisReady与真实概览就绪共同决定能否发送，原会话队列保留服务端选择；智能搜索与私有数据解释互斥，不加开发费用门禁。

`ResearchDataSources`在原回答来源区显示R1整体程序结果及D1等固定记录S03/S09回链，不让模型生成URL或冒称逐行阅读。没有Shell/导航/布局重做，保持14/22、共享按钮和焦点规则。当前范围及四层状态见[P06契约](ai-research-data-analysis-2026-11-13.md)、[验收](../testing/ai-data-analysis-p06-2026-11-13.md)；不等于P06全部旧算子已启用。

原两账号各一次真实解释与S09来源/刷新恢复已在目标Chrome完成，2次实际Provider共2328 Token均结算；只读恢复不新增任务。最初`result.png`可能处于前端轮询中，最终展示以`refreshed.png`及保存的真实回答为准，不以接口completed替代浏览器实际渲染。

## 2026-11-13 · AI01研究数据P05确认与恢复

`ResearchDataPreview`原位接`ResearchDataImport`与`research-data-import-session.js`，沿现有client/身份/来源session边界；唯一目标默认展示，多个才选择，不改Shell/会话/上传布局。固定preflight ID/version、Study、requestKey与plan hash；切身份/切批次丢弃迟到结果。未知写先查原key，手动状态核对仅GET；未确认当前状态时禁止确认、源取消/重预检。后端源取消在原事务拒绝依赖中的planned/committed导入，客户端禁用不能替代此守门。

成功回执使用原S03/S09 helper及固定revision/hash，来源项目和执行项目分开；S03限定读取不等于通用新建授权。P06未接数据分析时不送文献模型。新增API/表/事务与授权见[技术契约](ai-research-data-import-2026-11-13.md)，实际HTTP/Chrome和独审修补见[验收](../testing/ai-data-import-p05-2026-11-13.md)。

## 2026-11-13 · 表单固定版展示与私有计分装配

本轮复用共享CaptureFields/ReadAnswers及原页面框架；PHQ原文radio/缺失/标签与表5服务端状态分层，H5不增加诊断反馈。现场/H5/管理员预览/固定历史、实际HTTP/PG/Chrome及原生200%见[本轮记录](study-form-electronic-scoring-2026-11-13.md)。舌脉操作策略和真实临床业务未签认，最新全量1项并行资产失败保留；不将局部技术验证称为全站/临床验收。

## 2026-11-13 · G01内部方案审核

G01在missing-main真实分支渲染GovernanceProtocolWorkspace，保留原Shell／页头，批准的两列表正文只读；复用DirectoryState身份、research-projects客户端、共享Button及14/22。protocol-review-queue重建已打开范围以替换旧集合；G01焦点／可见重核、失败撤下旧行，epoch与渲染身份阻止迟到结果。固定S07的reviewTab仅pending/processed，与G02上下文互斥，按钮／面包屑／安全登录返回一致。S07未知先只读查回执，再允许明确原键重试。仅G01复用既有窄屏根宽／移动导航，不更改Frozen Token或全站布局。[API与数据](governance-p3-protocol-review-2026-11-13.md) · [本机证据](../testing/governance-p3-2026-11-13.md)。

## 2026-11-13 · AI01研究数据预检增量

HubAgentPanel在原消息区接ResearchDataPreview；原AgentMaterials上传自动区分文献与CSV/XLSX，Shell/布局不重做。research-data-session限定路由与固定批次契约，身份/会话上下文渲染前门禁加epoch丢弃迟到结果；当前源失败即撤下旧值，400/413清明确拒绝的pending，未知保原key查回执。清单支持nextCursor，重新预检用服务器固定files，不从列表前20猜批次。表格按sheet分别列名，14/22、窄屏内部滚动，操作复用原Button并限定局部样式。数据分析受限由后端409守门，不开数据写权。[完整API/数据库契约](ai-research-data-staging-2026-11-13.md) · [证据](../testing/ai-data-preflight-2026-11-13.md)。

## 2026-11-12 · P1来源审核原提交恢复完成本机技术验证

DG01–05来源页原提交回执/同键防重/未知恢复/显式原键重试已接通；角色、公开/租户页面及真实AI检索、失败/409/原来源保护均已验证。469前端、14相关后端、隔离构建、三类五宽与原生200%、一次独审及问题RED→GREEN有证。只增获批单函数EXECUTE，未改旧RLS/旧服务、无模型/费用/云/发布；用户专业签收和生产未验。下一页为DG06–10团队页，不启动P2。[当前技术报告](../testing/governance-p1-recovery-2026-11-12.md)。此前“待授权/候选未接入”是历史停线点，不再代表当前。

## 2026-11-12 · 获批P1来源页阶段进展（未完整交付）

同身份切回窗口保留未提交审核选择，工作簿单行/批次切换仍清范围草稿；真实账号切换清管理员内容。仅本机：459前端、13相关、隔离构建、三类型五宽及原生200%通过，PNG/WebM留存；原62项来源状态不变、浏览器0业务写。原提交结果恢复因Hub审计回执受原RLS隐藏停线，候选未接入Controller；须单独批准最小只读函数EXECUTE，不改旧RLS、不启用新权限。来源页未闭环，不切团队/P2。[验证及未决项](../testing/governance-p1-source-2026-11-12.md)。

# 前端架构与页面接入

## 2026-11-12 · 研究问题不静默截断

AgentCommandComposer与旧Hub直发移除maxlength=100，复用共享agent-question.js码点校验；超限aria-invalid/描述及原位alert，按钮与Enter/Hook先拒绝，编辑保存同契约，不截取或覆写输入。原AgentQuestion自适应/CSS与队列路径不改；Article旧session发送也同规则。普通/单篇两账号三尺寸14/22、60→148→60及真实4000请求/编辑/刷新验证；历史回读、后端和额外合成测试夹具边界见[验收](../testing/ai-question-length-2026-11-12.md)。

## 2026-11-12 · 来源审核用户文案投影

source-review-queue.js的sourceReviewCopy仅解释partial；基于当前版本decisions及当前提取review，核对有效期、范围和统一引用（注册含hub-display，指南沿hub-review），不作为授权守门。governance-overview/HubSourceWorkbench共用summary/label；原status、过滤、动作、请求体、CSS和服务端不变。[38相关/浏览器/全量边界](../testing/governance-source-copy-2026-11-12.md)。

## 2026-11-12 · 来源队列局部滚动

HubSourceWorkbench以queuePositionRequested限定深链/显式核对/切换/续审/窄屏返回定位；ready布局后只移动左ul.scrollTop，hidden队列保留请求到返回。原右标题focus逻辑和CSS/接口不变；组件自身背景GET不拉回手滚，不据此声称全局身份重核已修好。[真实RED/GREEN和边界](../testing/governance-source-position-2026-11-12.md)。

## 2026-11-12 · 智能搜索原位开关与可信来源链接

HubAgentPanel/AgentCommandComposer/useAgentCommands发送时冻结networkIntent；编辑与未知重试保留原快照，切会话/身份/Study及刷新OFF，同身份焦点校验不误重置。原布局、队列与14/22操作、16/28阅读不变。AgentMessages仅snapshot状态的assistant传递服务端网页证据中实际来源/失败URL给共享Markdown的可选trustedLinks。

`src/knowledge-reuse/components/Markdown.tsx`该参数默认空，其他消费者继续禁用模型URL和图片；精确白名单HTTPS、无凭据、默认端口才渲染外链，target=_blank与noopener/noreferrer。受限投影不因正文含相同URL而解锁。29真实Chrome回归＋最终4专项、三宽/原生200%与真实来源回读有据；非全局链接放开或页面重设计。[接口与限制](qiyan-smart-search-2026-11-12.md) · [完整交接](../testing/qiyan-smart-search-2026-11-12.md)。

## 2026-11-12 · G02四适配器统一与S07返回边界

governance-overview.js将protocols映射到ethics，复用原parseReviewPage/formalUrl和GET protocol-reviews；空游标页继续、重复cursor/Study-version拒绝整类读取，20s/取消贯穿分页。GovernanceOverview取消独立方案组件挂载，pending四能力一批并共享attention；processed仅原三能力，伦理处理结果明确缺口且不请求假历史。governanceCoverage以所选模块计算ready/partial，不能用别类ready掩盖本类403。

S07正式路由仅新增枚举governanceModule/正整数governancePage，其他正式页不接这组参数；formalHeader/BackHref和platform-shell仅该来源治理面包屑消费同一安全返回，不继承protocolId到G02。FormalPreparation原未保存捕获同样复用安全返回，保留同期externalDirty、原审核/启用及防丢失。后台/API/Schema/权限和CSS未改；原独立组件文件保留但总览不再导入。[规格](../product/governance-item-rules-2026-11-11.md) · [394/41/17组证据及边界](../testing/governance-integration-2026-11-12.md)。

## 2026-11-11 · G02七类规则与三适配器投影

状态：本轮规则与纯契约已实现，最终共同版本未交接。另一轮并发增加GovernanceProtocolReviews，尚未与三适配器统一支持状态/去重排序/规则、权限和浏览器验收整合；保留其文件及改动，停止共同文件继续修改。独立评审1 Important已作者修补待最终浏览器，2 Minor尚未修补，详见本轮报告。

governance-overview.js追加module/disposition/reason/actionLabel/eventKey/scopeLabel确定性契约；选择函数先按ready适配器与模块/归区筛选，再稳定去重、跨类真实日期排序。GovernanceOverview的pending单批读取供待办与需关注共用，处理结果展开才另读；单一模块筛选，不新增REST/Schema/角色。原失败/403/超时/取消和identity重挂载隔离保留，原处理页仍是授权与提交权威。

governanceModule/governancePage控制总览，overviewModule/overviewPage传递原详情返回上下文；G02Page原返回按钮和platform-shell仅G02面包屑恢复合法位置。session-lifecycle只为G02增加严格白名单的safeGovernanceReturn，拒绝任意URL、未知/重复参数、hash和错误类型selector，不修改会话认证。未连接模块支持状态静态来自规则清单，不能把未实现/拒绝/5xx转成成功0条；不请求猜测Study/中心。[契约与规则](../product/governance-item-rules-2026-11-11.md) · [证据](../testing/governance-item-rules-2026-11-11.md)。原CSS/八Tab/其他页面保持。

## 2026-11-11 · 文献方向v3原文线索修复

本轮仅后端固定证据分句/调查时点/随访同义校核及原回答内必要核对提示，前端组件、CSS、Shell和接口不改。新输出回执使用hub-direction-consistency.v3，旧v1/v2/无策略及v3历史投影都不重加工，当前授权/证据hash仍校验。新增免费只读回放与Chrome脚本：真实旧历史读回和隔离GET测试响应投影分别保存，不重写数据库，不称真实新Provider执行。33/515/25及build、1440/390与Reading16/28、独立总评有证。[记录](../testing/ai-followup-fix-2026-11-11.md)。

## 2026-11-11 · C01仅列表及旧hash归一

RealClinicalRegistries删view state与非列表placeholder，原列表无条件渲染；main删C01 MapView/TrendView导入/专用分支，chrome ViewTabs仅原list。root前首次归一并监听hashchange，仅#map/#trend replaceState去片段、保pathname/search；其他hash不动，无事件递归。共享地图/趋势源码及C02别名不改。专项17/PG与HTTP6/build4.17s及双角色/演示/389px通过，全量375/376的P01旧fixture失败未改；无CSS/后端变化。[完整记录](../testing/c01-list-only-2026-11-11.md)。

## 2026-11-11 · G02只读待办聚合

真实G02总览独立组合GovernanceOverview，governance-overview.js复用来源review-queue、team-workspaces和reconciliations；按完整分页与既有状态投影，不新增后端接口、DDL或权限。每种模式Promise.allSettled独立错误，20秒读取兜底、取消/identityKey重挂载与迟到隔离；已处理展开才读取，5项前端分页。三处理页只增加reviewKey/team/record受控定位，未知对象无自动替换或提交。原演示母版和共享Shell保持；platform-shell只改G02真实总览description/actions，不动八Tab/子页布局。

368前端与构建、10组真实两角色Chrome/五宽度/原生200%及一次独立评审后作者修补有据；未新增模型或业务写入。[规则](../product/g02-action-overview-2026-11-11.md) · [完整证据与未测](../testing/g02-action-overview-2026-11-11.md)。

## 2026-11-11 · C01保存与导出入口移除

RealClinicalRegistries删除两个disabled按钮及空reg-meta-actions；chrome FilterBar删按钮/未用图标，useRegistryState移除专用saved/onSave，无其他消费者。字段设置所在wrapper保留；真实三视图及演示列表/地图共用区均覆盖，趋势无独立入口。不改CSS，工具栏自然缩短约10px，原14/22及表格保留。新SSR2项RED→GREEN，完整368/6及build4.45s、实际浏览器与独立评审有据。[证据及局限](../testing/c01-no-save-export-2026-11-11.md)。

## 2026-11-11 · C01招募入口精简

RealClinicalRegistries和演示main原招募select/td/th移除，chrome FILTERS/COLUMNS无recruit但样例/内部兼容状态不删。C01 MapView显式showRecruitment=false，模式/点/图例/指标/明细/招募卡不渲染，其他消费者默认true保持；仅C01默认页头不再承诺招募检索。研究状态保留，11列/4控件及原14/22，原flex自然收紧，不改CSS/后端。366前端/6相关后端HTTP/build4.36s及真实双角色/演示/389px有据。[验证与局限](../testing/c01-no-recruitment-2026-11-11.md)。

## 2026-11-11 · 研究方向固定来源校核（无布局变更）

沿原AI01接口/消息Markdown及来源位置，前端/CSS/导航/队列无修改。新方向综合input增加服务端directionFacts及范围约束；新输出回执携带directionPolicyVersion=v2、来源hash、原句field/offset/hash、被移除原始命题/offset/reason/checkedSourceIds及交付hash。全局排他判断使用全部已读材料，局部所引范围不能由句中主语缩窄。先检查完整原始命题再走既有qualitative数值规则；没有额外模型请求或DDL。

project仍以原Evidence/文本hash及当前来源/权限回读，不重算旧历史。19专项、相关历史/换版/撤源测试与485组合、25Chrome/构建、owner真实1440/390/刷新Reading16/28通过。初轮v1双账号结果留存；最终v2 admin因业务额度不足未调用，不声称双账号最终通过。[证据与专业限制](../testing/ai-direction-consistency-2026-11-11.md)。

## 2026-11-11 · C01日期原位区分

ClinicalRegistryRow原第10个td两行，注册只读approved studySummary.registeredOn，来源更新读sourceUpdatedOn；缺失各未提供。只修表头语义及原末句快照时效，不增列/样式。1421×1419工具栏几何差0、日期14/22、表宽自然+33.03px，原横滚保持；389px日期/键盘末列可达。354前端、13相关后端、2HTTP/构建及总评通过，无新写入/AI。[实测与未测](../testing/c01-source-dates-2026-11-11.md)。

## 2026-11-11 · AI自然规划与具体澄清

沿原接口/Composer/布局，仅AgentMessages对可信HUB_LITERATURE_PLAN_CLARIFICATION在原状态位显示≤300字具体问题，未知内部错误仍安全摘要。新请求v2在原Sessions预留后OpenCode规划，后端编译追加Job.payload.hubNaturalPlan（request/route/policy/hash/CAS），再真实检索/综合；一个UsageAccumulator汇总两次用量。新v2复用原assertExecution，同事务assertLiveClaim；旧快照按原schema重算。

无DDL/CSS/权限/旧内核改动。25项Chrome、两角色1440/390与刷新16/28有证；专业待核对不由技术测试销项。[契约与证据](../testing/ai-natural-task-planning-2026-11-11.md)。

## 2026-11-11 · C01获准选项与过滤纯函数

clinical-registry-filters.js负责原值Set去重、原文多组匹配、三条件/原关键词AND、成功重读选择reconcile和确认身份key。ClinicalRegistryFilters复用原search＋5select＋reset，3项65px原宽/title启用，2状态仍禁用；RealClinicalRegistries成功then同批重验选择，abort保护保持，不改后端。普通同账号认证事件不清条件，实际身份变化才清。

347前端、13相关后端、构建4.01s、双角色同篇/刷新/恢复和1045/389px实测；默认工具栏最大差0.07px、原列/字号保持。未增加筛选跨页/重载持久化，无AI/写入/重启。[完整证据](../testing/c01-reviewed-filters-2026-11-11.md)。

## 2026-11-11 · C01最小研究字段消费者

RealClinicalRegistries保持原请求/取消/身份刷新/搜索/视图切换，仅原行抽为ClinicalRegistryRow。只有studySummaryStatus=approved时使用studyType、逐组intervention与leadInstitution，旧响应/失效不残留字段，其他4列未提供。原12列/顺序/链接/工具栏/CSS不改；自然内容宽1219→1585px、首行+22px沿原横滚，不伪称几何完全相同；1045/389px与双账号/搜索/详情/键盘末列实测。341前端/29相关后端、构建及评审修补有据，仅本机。[完整证据](../testing/c01-reviewed-study-fields-2026-11-11.md)。

## 2026-11-11 · AI正常发送与队列呈现分流

`agent-command-view.js`纯分流：无实际active任务/全局paused/uncertain/restricted且首项未编辑时，首个waiting为primary，其余仍为waiting操作列表。`AgentCommandComposer`保留原useAgentCommands，仅通过稳定setState回调给Hub/Article线程；卸载清理，不加轮询。`AgentPendingMessage`仅呈现真实id/text，同id已在messages即不重复，局部线程滚动不移动页面。

真实进度行已存在则Hub不重复通用running；单篇不再展示idle“尚未发送”，非idle、失败/来源与权限路径保留。无API/数据库/Worker/权限/计费修改。[规则](../product/ai-send-status-2026-11-11.md) · [证据](../testing/ai-send-status-2026-11-11.md)。

## 2026-11-11 · G02受控仅展示状态与注册页交接

ReviewDecisionActions仅服务端canUpdateDisplayOnly时在原select附public_display选项，请求转visibility=public+mode=display_only；不增加控件/CSS。public_display标签“公开展示；AI未获准”，纳入已决定过滤/计数/下一项，保存通知及说明准确。仅两条clinical且AI未有效批准可用，其他来源原交互不变。旧身份/冲突按原错误恢复。

原admin实际恢复200293，202558原审核/AI不动。H01/C03两账号往返及G02真实保存、389px键盘均有据；1421×1419原5KPI/6卡/5列最大差0.000023px，正文14/22。329前端/28相关后端、构建及独立无阻断。仅本机，未做320px/200%或发布；下方待恢复为历史。[最终验证](../testing/h01-registry-metadata-2026-11-11.md)。

## 2026-11-11 · 注册元数据投影（待用途恢复）

RealHub消费新增clinicalRegistries，HubRegistryPreview复用原五列、链接、卡片和CSS，只用approved摘要渲染日期/单位，状态未报告。RegistryStructuredDetails仅原快照来源details内加入三SourceField。G02/C03同一组件，未新增默认展开模块。当前单条1421×1419外部几何及列宽保持，双条最终及窄屏未完成。

实际G02统一public审核使原无AI的200293首次可检索，保全失败后已原流程withheld；该条公开暂隐藏、202558正常。受控仅展示更新及审核卡局部用途表达是待确认方案，尚未实现，不绕过旧分项接口保护。[规格](../product/h01-registry-metadata-2026-11-11.md) · [失败和保全](../testing/h01-registry-metadata-2026-11-11.md)。

## 2026-11-11 · AI首次空入口惰性建会话

HubAgentPanel的workbench输入不再因无session禁用，但`selectedId&&!session`历史恢复仍阻塞。`ensureQueueSession()`复用creationKey调用原sessions/hub-source，仅当前active有效才交付；commands保持原requestKey/显式未知恢复。onRefresh读取selectedId ref，避免创建前闭包漏读。

RealAiWorkspace的created可传`preserveComposer:true`，只首次创建保留内部instanceKey，不向URL/API暴露；避免URL更新造成组件重建吞掉后写草稿。navigate/popstate和显式新建仍用原会话实例key；身份/Study仍独立provider key。无API/DDL/Worker/权限/计费改动。[规格](../product/ai-first-entry-2026-11-11.md) · [真实验证](../testing/ai-first-entry-2026-11-11.md)。

## 2026-11-11 · AI右栏条件装配

`RealAiWorkspace.renderContext(content)`只包装真实内容，移除默认卡片/能力URL投影。Hub工作台不注入右栏；ArticleWorkspace仅ready、非paused且非restricted的文章构造上下文，真实rail才加`workspace-with-context`。CSS默认248px＋1fr，有rail加300px；中屏220px＋1fr/260px；<=1050回两列并将资料置后，<=760沿用纵向布局。只加布局条件，不改全局Shell/Token、来源投影或状态机。

普通来源继续由AgentMessages/LiteratureSources按当前元数据呈现，文章仍用封存证据优先、原文定位与范围。无API/DDL/Worker/权限/计费变更。[规格](../product/ai-context-rail-2026-11-11.md) · [真实验证](../testing/ai-context-rail-2026-11-11.md)。

## 2026-11-11 · H01领域动态紧凑预览

按用户明确要求，仅本卡片的论文题名单行省略、现有作者/期刊/来源简介最多两行。完整文本保留，悬停可看全文，点击原题名链接进入完整详情（触屏/键盘同样可达），不是新增或生成摘要。原字号、卡片外部几何、滚动、来源/审核与13条来源/前6项/11篇领域论文均不变。同视口外部11块几何差0，列表内容高度1538→568px，顶部同时可见标题1→2；1045/389px及键盘末项/详情返回实测通过。完整前端319、相关后端/PG11、真实HTTP5、构建与独立只读评审通过，仅本机、无费用/权限/发布变化。此条覆盖下方本预览“全部自然折行”的历史规则，不推广其他页面。

[本轮验证与限制](../testing/h01-source-compact-2026-11-11.md)。

## 2026-11-11 · 历史时间与首次问题投影

`AgentHistoryProvider`缓存已确认commands的首问/时间，与迟到历史GET和已加载分页合并，不为标题整列重取。`agent-history-timeline.js`纯函数负责本地日历互斥分组、12 grapheme截取与局部确认合并；CSS仅左栏13/20分组、14/22单行标题。身份/Study仍通过原provider key隔离，文章恢复链接不变。

`hubHistoryQuery`仅关联当前租户每会话最早user消息，`projectHubHistory`取原始输入并只返回title/hasPrompt与旧字段，不返回消息/meta。新消息创建与限定本人active Session的updatedAt在原授权事务内提交，count不符回滚，幂等旧编号提前返回。无DDL、模型调用、旧内核或权限改动。[规格](../product/ai-history-timeline-2026-11-11.md) · [414回归/16浏览器及双账号真实证据](../testing/ai-history-timeline-2026-11-11.md)。

## 2026-11-11 · H01论文预览局部滚动（批准后本机验证）

用户已批准仅来源预览内部滚动。原6条完整题名/作者/来源与详情、目录入口均保留，来源13条、领域纳入11篇不变；不缩字。实际1421×1419下原五KPI及六内容卡片位置/尺寸全部恢复，首行359.48px；仅论文列表滚动，Tab/Home/End可用，无焦点陷阱。1045/389/358px有效视口验证末项可达、无主内容横向溢出；正文14/22、元数据13/20保持。真实200%缩放及320px未验证，不以替代尺寸冒称。

前端314、相关后端/PG11、真实HTTP5项及构建通过，独立只读总评无阻断；两账号/访客目录与论文详情导航有实际证据。仅本机专用合成环境，无新增费用/权限/后端改动或发布；加载/失败/空态由组件测试验证，本轮未做浏览器故障注入。下方“布局待确认”是批准前历史，不代表当前停止状态。

[本轮完整实测与限制](../testing/h01-source-scroll-2026-11-11.md)。

## 2026-11-11 · 岐研AI普通模式与状态投影

AI01原commands接口不变，`paused + pauseCode=HUB_SKILL_CLARIFICATION`与waiting分开呈现；空闲waiting显示准备，已有运行显示排队。新增server-owned `hub-general-conversation`路由，`hubSkillRoute.skill=null`明确非Skill；policyHash/上下文/消息文本哈希绑定，`KnowledgeChatJob.payload.hubGeneralContext`仅本人同会话最近六组已完成普通消息。knowledge-state普通回答经专门授权/完整性投影，`sourceStatus=not-applicable`、hubSources/hubTools为空；不走必须有文献来源的旧投影，也不伪造来源。只有当前原子提交/校验通过后展示，刷新不重发。三栏和既有科研/文章分支不重排，无DDL或旧内核改动。[规格](../product/ai-general-conversation-2026-11-11.md) · [真实执行证据](../testing/ai-general-conversation-2026-11-11.md)。

## 2026-11-11 · 适用性当前授权适配

本机`createAssetApplicability`显式注入`createApplicabilityCurrentAccess(ids)`；无access的旧测试构造保持原期限模式。新策略在既有共享授权事务内读取当前实际成员角色、authVersion、项目成员、独立模式登记审计及本人双端父对象；stored/list仅旧模式应用approvedAt过滤。P01既有canOpen回调沿同策略恢复入口，非通用产物绕过。A02仅AssetApplicabilityDetail业务confirm迁共享ConfirmDialog，保留beforeunload；其余DOM/CSS/母版无重组。无新表/角色/权限，未修改旧内核。[规格](../product/asset-applicability-current-access-2026-11-10.md)。

## 2026-11-11 · H01论文来源补漏（数据通过，布局待确认）

总览原仅查表格来源，已复用PMC公开投影补齐13条来源记录、最多6条预览，顶部仍11篇领域纳入；来源/审核/AI许可与权限不变。313前端、40后端、5项真实HTTP及独立代码评审通过，原28排队任务/源审核指纹保全。真实浏览器发现长题名/作者撑高三栏359→1612px、拉长地图并下推后续内容；未改CSS，拟仅论文列表卡片内滚动以保留原高度，待用户批准。当前不标页面完成、不自动切下一页。[规格与停止点](../product/h01-source-catalog-2026-11-11.md) · [实测](../testing/h01-source-catalog-2026-11-11.md)。

原来源卡片抽出HubSourceCatalog纯组件，RealHubOverview就地使用，原成功DOM/列表/链接及CSS未变；sources=null按error区分加载/失败，[]才显示真空态。失败不回退演示。卡片内滚动交互尚未批准/实施。

## 2026-11-10 · H01论文规则V2（无前端源码变化）

用户确认两项明确次要结局纳入，仅后端版本化清单变更，既有HubMetrics按pendingVisibleCount=0使用原“按已确认领域规则纳入”分支，当前value=11。无新DOM/CSS/布局/交互/权限或API端点；新增组件测试保留通用pending2分支并核验11/0。原V1历史结果不覆写。[规则补充](../product/h01-publication-secondary-outcomes-2026-11-10.md) · [验证](../testing/h01-publication-secondary-outcomes-2026-11-10.md)。

## 2026-11-10 · H01论文纳入指标

原HubMetrics论文卡沿同一status/scope/安全整数契约消费真实publications.value和pendingVisibleCount；“9篇／规则纳入·待核验2项”，不新增模块、路由、交互或字号。待核验按身份组不冒称独立论文数，0/null/错误/加载仍分开；既有说明占高与换行规则保持，桌面几何最大差0。来源目录E01仍13条，不同步过滤或改写其结果语义。[规则](../product/h01-publication-count-2026-11-10.md) · [实测/独立评审与完整回归边界](../testing/h01-publication-count-2026-11-10.md)。

## 2026-11-10 · P01本人记录闭环

`PersonalOverview`保留母版结构，将原两个折叠列表委托`PersonalRecordList`。`GET /my-research/overview`新增独立draftPage/taskPage及pagination；每次当前授权事务内同租户、本人owner/assignee过滤、固定take5及时间＋ID排序，批量读取至多5个精确当前产物版本，只投影路由必要字段。

`my-research-draft-workspace.mjs`以真实创建族＋typeKey＋当前版本marker＋本人创建归属识别七类专用工作区和方案入口。`my-research-draft-route.js`统一生成已知站内URL，不接收任意href；导航提示不是来源有效性证明。适用性核对复用`applicability.authorized(tx,actor,'U01',原asset-target pair)`及原登记核验，确切目的授权403投影为不可用，其他错误上抛；不初始化/续期/扩权。

`PersonalReportPreview`仅对三类质控/方法报告通过原固定版本GET读取，检查真实id、版本、current/stale及来源行后只读Markdown渲染，禁图片。翻页/卸载/收起以abort＋sequence拒绝迟到响应；分页401/403与报告401经根状态清整页，报告局部403只清正文。网络失败保留登录状态并可重试。新按钮和标题样式限定于原列表内，不修改公共Shell。[规格](../product/p01-task-draft-closure-2026-11-10.md) · [实测](../testing/p01-task-draft-closure-2026-11-10.md)。

## 2026-11-10 · H01五卡真实指标

RealHubOverview消费既有overview.metrics，拆出纯HubMetrics组件沿原五卡DOM结构/顺序和14px说明、28px数字，成功非负安全整数且scope/status有效才显示数量；null/加载/失败/非法值不变0。刷新清旧指标、epoch拒绝迟到响应，错误沿原重试。仅说明行增加span与局部grid/不可见原说明占位规则，自适应保留母版文字原占高；span限定normal换行及min-width:0覆盖母版nowrap，1280/1367/1421/389实测。桌面五卡几何差0，不改Frozen Token或布局。机构/研究者档案与下方活跃度未核验分开，无新路由或权限。[规格](../product/h01-metrics-2026-11-10.md) · [证据与既有假链接边界](../testing/h01-metrics-2026-11-10.md)。

## 2026-11-10 · H01研究团队地图

用户确认原机构地图实际统计团队。H01仅原卡片替换为HubTeamMap（平台身份＋DirectoryClient地图GET＋请求失效）和纯HubTeamMapView，新增validateHubTeamMap防守DTO；只新增hub-team-map作用域样式，原底图投影和六卡片外层几何保持。城市排名合计，不把省级兜底当城市；详情进入T01地图，未知Hub不误导详情，其他指标仍未核验。后端/DB/权限/旧系统未改。304前端、92目录PG、构建/真实浏览器/独立评审有据，用户最终验收与发布独立。[规格](../product/h01-team-map-2026-11-10.md) · [实测与边界](../testing/h01-team-map-2026-11-10.md)。

## 2026-11-10 · 登录飞轮与光场放大、整体上移

按用户确认及landing-page-design/figma-designer复核，P003宽桌面图500→560px、左侧文字图示静态上移32px、光场四周扩展；紧凑桌面24px，窄屏保持原间距/表单优先。减少图下冗余空间抵消增高，右卡片/认证/导航/权限/P004/P005保持；不另建Figma或改变已确认背景风格。

295项前端、构建、7尺寸＋3短屏Chrome和两账号真实登录通过。无新依赖、费用或真实发布，最终视觉签收待用户确认。[规格](../product/p003-expanded-visual-2026-11-10.md) · [验证](../testing/p003-expanded-visual-2026-11-10.md)。

## 2026-11-10 · 登录左侧科研光场轻背景

按确认方案仅P003左侧加入低对比蓝紫光晕、静态细线和四边淡出，复用首页无人像/文字的抽象背景素材。保留居中飞轮及尺寸、原动效/系统reduce，右卡片、认证/导航/权限和P004/P005不改。无需新图片生成、依赖或付费服务。

293项前端、构建及7尺寸真实Chrome、两账号实际登录通过，无业务新对象或正式发布；最终浓淡待用户签收。[规格](../product/p003-light-field-2026-11-10.md) · [验证](../testing/p003-light-field-2026-11-10.md)。

## 2026-11-10 · 登录页左侧居中成组

用户确认后仅调整P003专属CSS：标题/说明/飞轮居中同轴，标题36px，宽桌面飞轮500px、紧凑屏自适应，收掉冗余图下留白；右卡片、认证/导航/权限/P004/P005及默认动效不改。

本机7尺寸Chrome与两账号真实登录、39项视觉/认证/布局定点回归、构建及独立复审通过。首轮其他检索测试失败保留，相关文件经并行工作更新后最终全量293/293通过；本轮未修改检索模块。无模型调用或真实发布，最终视觉签收待用户确认。[规格](../product/p003-centered-layout-2026-11-10.md) · [验证及已知失败](../testing/p003-centered-layout-2026-11-10.md)。

## 2026-11-10 · 登录飞轮默认播放与左侧审查

按用户新要求移除P003暂停/继续按钮及其手动状态，默认动效；系统减少动态效果仍通过CSS自动静态。不改图尺寸/对齐、右表单、认证、导航或P004/P005。图下保留原留白，避免牵动右卡片。

本轮实测发现标题字形靠左、飞轮居中且缩图内文字偏密，建议统一成组并适度放大图/收敛标题；此布局建议待确认，未擅自实施。285项前端、构建及7尺寸真实Chrome和两账号实际登录通过；无模型调用或真实发布。[规格与建议](../product/p003-autoplay-audit-2026-11-10.md) · [证据](../testing/p003-autoplay-audit-2026-11-10.md)。

## 2026-11-10 · 登录页科研飞轮与轻量动效

P003左侧按用户确认A复用首页科研飞轮，取代四胶囊并移除英文装饰标签，保留中文主标题与一句说明。仅图内慢光轨和节点呼吸，支持暂停/播放及系统减少动态效果；标题、表单不动，图失败不影响登录。右侧原表单/认证/导航/权限及P004/P005不改，无依赖/付费服务。

277项前端、构建、7尺寸真实Chrome及两账号login201→我的科研通过；独立复审无阻断。右卡片DOM/尺寸保持，y仅0.1875px亚像素差。仅本机启用，无模型调用或正式发布，最终视觉签收待用户确认。[规格](../product/p003-research-wheel-2026-11-10.md) · [验证](../testing/p003-research-wheel-2026-11-10.md)。

## 2026-11-08 · 首页底部文字可读性与对齐

P002仅修补底部：保留原图并加深蓝遮罩，避免白光干扰浅色正文；统一三项图标占位，标题与正文顶部对齐。窄屏保留原纵向卡片，字号、导航、七区顺序、文案与入口不变。275项前端、构建及六尺寸真实Chrome通过，最坏白底正文对比6.36:1。无后端/数据库/权限/费用或真实发布变化，最终视觉签收待用户确认。

[规格](../product/p002-join-readability-2026-11-08.md) · [验证](../testing/p002-join-2026-11-08.md)。

## 2026-11-08 · 团队审核局部修补

ProvinceCitySelect不再输出字典技术说明，内部版本码保留。TeamWorkspaceFields默认新手填人员沿用团队机构，跨机构项收起；setTeamOrganization仅联动未关联且沿用原机构的人员，不改既有研究者和明确不同机构。服务端plan按事实携带audience，public graph核验机构真实公开可用性并纳入planHash，锁来源后重验；review在一个事务内按范围生成核实记录、追加事实及决定。未审核机构人工替换不锁无效旧依据，仍保留历史；已审核机构原依据需锁定。

未新增表/角色或改旧系统；验证见[报告](../testing/team-review-friction-2026-11-08.md)。

## 2026-11-08 · 开放首页真实入口与阅读层级

P002保留原七区顺序、品牌、插图、配色和全局导航结构。首屏统一免费注册＋了解科研流程，移动菜单补登录/注册；取消把关键词跳章节冒充内容检索的搜索框，移除仅保存浏览器草稿的预约入口，尾屏次动作改帮助中心。原草稿存储未删除，不新增邮件/预约服务。流程标签为“查看中”，人群文案不重复、选择不授角色。门户字号角色统一，AI及情志病短语完整换行、主次按钮等高，减少无内容满屏留白；工作区与权限不改。

272项前端、构建及五尺寸真实Chrome路径/截图录屏通过；本机0业务写、0模型调用，无正式发布。真实预约渠道及用户视觉验收仍待后续确认。[规格](../product/p002-marketing-2026-11-08.md) · [验证与边界](../testing/p002-marketing-2026-11-08.md)。

## 2026-11-08 · 团队审核状态与局部精简

关闭审核弹窗后刷新实际列表，保留已应用的查询/页码和焦点；未点击查找的新输入不被自动应用。刷新失败保留旧列表并提供窗内/窗外重试。已审核且本地/范围未改的资料先只读核对，没有待审变更时显示禁用“已审核”；待审草稿、本地编辑或范围变化仍可按原规则审核。弹窗只留一个对象标题，审核范围与选填备注归入第三组，成员姓名不重复。全局导航、配色、权限、来源、公开确认、历史与后端协议不变。

本机272项前端、68项相关真实PG、构建与真实Chrome保存/审核/失败恢复通过，独立评审两项P2已修。原用户团队未修改，无付费调用或正式发布，用户业务验收待进行。[规格](../product/team-status-ui-2026-11-08.md) · [测试证据](../testing/team-status-ui-2026-11-08.md)。

## 2026-11-07 · 团队审核备注改为选填

“核实说明（必填）”改为“审核备注（选填）”，不填也可主动审核。后台仍记录实际审核人、时间、展示范围和具体变更，旧备注/来源哈希/回执不改写；其他目录决定接口原理由要求不变。空备注不编造核实依据，底层决定记录动作“审核通过（未填写备注）”。沿用原布局、权限、公开确认及大小保护；只在原独立合成夹具验证，不代审用户原团队。此节覆盖此前强制填写核实说明的页面规则。 [规格](../product/team-review-optional-note-2026-11-07.md)。


## 2026-11-07 · 团队维护取消固定操作次数上限

用户明确要求移除开发验收遗留的100次操作门槛；保存与审核不再按累计次数阻断。不删除、截断或重置历史，不自动审核用户待审团队；保留原权限、来源、版本/CAS、回执幂等、事务审计及250000字节保护。前端超限提示改为真实的资料/历史大小问题，布局不变。此节覆盖此前保留100次保护的现行约定，历史记录不改写。 [规格](../product/team-operation-limit-removal-2026-11-07.md)。


## 2026-11-07 · 团队列表与编辑审核弹窗

列表操作统一“审核”，取消当前页“其他目录维护”入口；编辑、新建、核实及审核集中在站内弹窗，窄屏全屏。保存留窗，审核成功并回读/刷新后关闭；未保存站内确认、失败保输入、未知提交原回执恢复和焦点/查询恢复均保留。仅本机合成环境：268项前端、62项串行真实PG、真实Chrome保存/审核/丢响应回执闭环通过；用户批准新增一个独立合成团队（team上限2→3），其余权限与保护不变。原团队未改写，无付费调用或发布；用户专业验收待进行。 [规格](../product/team-review-dialog-2026-11-07.md) · [证据与限制](../testing/team-review-dialog-2026-11-07.md)。



## 2026-11-07 · 团队维护移除补充资料依据

本轮用户确认取消整个补充资料依据模块，不用折叠/选填继续占用常规流程；原三段位置、机构编辑、一份核实说明和审核范围/按钮不变。历史evidence/notes/来源/审核/审计保留，旧资料模式不静默切换，后端及权限不改。强化“一看就懂、少操作、少内部概念”的正式设计规则。仅当前页实施，未扫改其他页面。下方此前“选填折叠保留”为历史方案，由本节覆盖。[规格](../product/team-review-simplification-2026-11-07.md) · [本机验证](../testing/team-review-simplification-2026-11-07.md)。


## 2026-11-07 · 团队机构原位编辑与核实区精简

团队所属机构选择处可展开完善资料，当前选项与编辑内容绑定同一档案/版本；下方不再重复机构档案。默认管理员本人核实，一份核实说明，补充依据折叠选填，历史资料及来源模式保留。保存只写团队草稿，原审核后才追加机构版本；同ID一次修订，已审核机构不静默恢复或扩围。并发冲突原位对照并明确保留用户修改，未改字段采用最新资料。原布局/角色/表结构/旧服务不变，仅合成对象验证，真实团队未代审。[规格](../product/team-institution-inline-2026-11-07.md) · [本机验证与独立评审](../testing/team-institution-inline-2026-11-07.md)。


## 2026-11-06 · 团队维护全部业务确认统一站内弹窗

更换/移除人员、未保存切换/新建团队及使用服务器草稿全部复用站内确认。取消/Esc保留输入，确认才执行原动作，不自动保存或审核；页面布局与权限不变。系统规则已沉淀：其他页面在后续功能开发时逐页替换，不全站扫改。关闭标签或刷新时浏览器强制未保存保护保留。真实Chrome合成环境桌面/390/320通过，冲突恢复为明确标注的HTTP409受控验证，无真实团队或数据库业务变更。[规格](../product/team-page-confirmations-2026-11-06.md) · [验证](../testing/team-page-confirmations-2026-11-06.md)。

## 2026-11-06 · 团队移除人员改为站内弹窗

已关联人员的“移除人员”改用共享ConfirmDialog，显示姓名和影响，取消/Esc保留人员，确认仅更新当前表单，仍须原保存/审核才能生效。默认焦点取消、Tab约束、关闭焦点返回，窄屏14/22和44px按钮实测；无浏览器默认弹窗或额外二次确认。未关联新行原行为及其他确认框不变，页面布局、权限、数据库、旧系统不改。仅具名合成环境验证，真实团队未操作。[组件、实测与评审](../testing/team-member-dialog-2026-11-06.md)。

## 2026-11-06 · AI01本人历史、线程与输入

新增AgentHistory（当前账号/Study只读分页）、AgentMessages（后端投影消息及任务状态、最新消息ID变更定位）、AgentQuestion（两行/60→148px、视口20%上限、宽度变化重算），文章及Hub工作台共用。Hub恢复sessionId与articleId/requestKey/inputHash互斥，登录安全返回校验同步；恢复/阅读均GET-only。明确访问/上下文失效废弃epoch并清交付/禁发，保输入，不当全局注销；历史分页刷新同样废弃迟到页。未实现多轮模型记忆/全部旧Agent工具。[接口与范围](../product/ai01-agent-workbench-2026-11-06.md) · [真实验证](../testing/ai01-agent-workbench-2026-11-06.md)。

## 2026-11-06 · 知识资料页DOM稳定性

Shell.stableSlots默认false，仅K01显式启用；Header/Sidebar渲染空React容器并标记data-platform-react-slot。公共挂载器只append自有子树、不replace React容器。rootObserver仅K01额外检查缺失侧栏，沿原RAF调度恢复一套导航，不吞原生异常。无CSS/全局Shell迁移/API/DDL/依赖变化。受控局部Fast Refresh先稳定失败后通过；历史无栈事件不作同因断言。[实现规格](../product/k01-dom-stability-2026-11-06.md) · [测试/评审](../testing/k01-dom-stability-2026-11-06.md)。

## 2026-11-06 · 实际Chrome登录来源403修补

已复现实际Chrome去端口Origin被误拒，非管理员权限不足；仅本机19501在loopback/Host/完整Referer/独立Fetch Metadata/会话专用头等全部证明满足时兼容，正式Origin/CORS和12h/撤销/权限不放宽，旧系统/数据库/布局不改。来源403与业务403区分，用户不再为此被告知账号无权；实际Chrome合成凭据已进入原账号校验，原两个合成账号去端口完整HTTP流程通过。管理员刷新登录页后用admin@example.org及原密码重试，不添加末尾标点。[验证与交接](../testing/session-origin-fix-2026-11-06.md)。

## 2026-11-06 · 页面遗留开发说明清理

新增纯展示函数showWorkspaceNotice：常规真实页面不注入开发提示，显式演示及既有合成/私有分支保留提示与原导航容器。大部分改动是文字值，台账按文字归一化AST核对；不改CSS/路由事件/业务条件。knowledge-session只精确映射一条遗留403消息，保留原status/code/onAccessLost；非JSON仍拒绝。并行会话/认证改动不纳入本次归属。无API/DDL/新依赖。[规格](../product/page-copy-cleanup-2026-11-06.md) · [测试及边界](../testing/page-copy-cleanup-2026-11-06.md)。

## 2026-11-06 · 12小时活动会话本机技术交接

ResearchHub自有认证适配已在本机独立环境启用：Cookie/令牌12h同截止，真实前台活动（含知识资料同源操作区）续期，后台读取/轮询不续；过期刷新受保护页进入原登录，登录后安全返回原页面及允许的Study上下文，不重放业务写入。网络/403/5xx不注销或清空已核验身份及内存输入；停用、密码版本变更及本sid退出阻断续期。旧无sid凭证需重新登录一次；未保存内容仍不承诺跨过期登录恢复。没有页面布局、旧系统、数据库表/权限或正式发布变更。成功节流60秒，失败侧连续真实输入节流为非阻断待优化。下方“仅规则、当前2h”等为实施前快照；正式域名尚未部署。[实现、验证及边界](../testing/session-policy-2026-11-06.md)。

## 2026-11-06 · 正式产品统一会话规则（已确认，待实现）

ResearchHub Cookie与认证会话均12小时，实际用户操作滚动续期，后台轮询/心跳不续期；过期刷新受保护页进入原登录页，重新登录安全返回原页面。网络故障、超时、5xx和业务403不误当退出；账号/租户停用或密码版本变更不能续期。保持原页面布局，不修改旧系统。当前本机JWT仍2h，尚未完成该规则代码/目标环境/浏览器验收，不将产品规则确认当运行生效。[规则与验收](../product/session-policy-2026-11-06.md)。

## 2026-11-06 · 同页联合核实

TeamVerificationFields在原第三资料区读取去重机构并按需展开完整概况，TeamFields传递ready/已读快照；Workbench默认本人核实但仅审核前必要保存，未编辑浏览不误标dirty。prepareTeamReview将预检jointInstitutions完整profile与已读快照比对，发现变化回调刷新并停止审核、保输入/理由，不能仅以ID相同或onSaved自动重读放行。普通仍一次明确审核，公开新增曝光才沿原简短dialog。T02原来源区只增诚实人工核实标签/时间/范围，无Shell/Token/母版变动。[交接](../testing/team-admin-review-2026-11-06.md)。

## 2026-11-06 · AI01阅读区与输入框

AI01真实工作台移除开发接线横幅，实际加载/失败/受限与选段风险仍保留；显式演示与其他页面不改。单篇输入默认两行，随文字/列宽增缩，达到视口内上限后内部滚动，底部提示与发送按钮紧凑排列；保持2–100字、明确点击才发送、原权限/Token/来源规则。1440×900解读区233→419px、表单252→170px；正文16/28、输入14/22不缩字。实现仅ArticleAgentPanel的ref/effect、fitArticleQuestion与article CSS作用域；受控恢复、ResizeObserver列宽变化和window resize重算，卸载清理监听。platform-frontend仅AI01真实main跳过/移除data-demo-capability，不改公共Shell或其他页。无API/DDL/依赖变化。见[规格](../product/ai01-reading-layout-2026-11-06.md)与[真实浏览器/独立评审/技术交接](../testing/ai01-reading-layout-2026-11-06.md)。仅本机合成环境，0新模型调用；不以技术测试代签阅读舒适度或生产发布。

## 2026-11-06 · 单篇AI三档处理（现行）

按用户批准改为确定性修复、内容局部标注、控制面必须停止。新任务固定rh-article-response.v3，术语/年份/研究计数核对应原文；未核实测量或计算不作为结论交付，不再因一个数字令整篇失败。无有效段/不可解析协议仍明确未交付。任务字段绑定策略，提交/刷新重建回执，越权/来源撤回/版本不匹配/篡改仍阻断；旧v1/v2结果、失败、预留和账本不回写。原四段阅读区/16px字号、角色及业务Token链不改，无新计算服务。见[简短矩阵](../product/article-response-matrix-2026-11-06.md)与[技术交接及专业边界](../testing/article-response-matrix-2026-11-06.md)。本节覆盖下方历史整篇数字拒绝规则，不表示通用语义核验或生产发布。

## 2026-11-05 · 单篇错误原因原位呈现

article-ai-session只按后端安全errorCode映射数值未核实/来源变化/截断/未知失败，不直接显示errorMessage或栈；输入、原请求与刷新恢复不变。新回答数值引用由后端作为普通Markdown渲染，原ArticleWorkspace/CSS/Shell/字体无修改，非新增审核或数字编辑控件。[规格](../product/article-numeric-evidence-2026-11-05.md)与[验证](../testing/article-numeric-evidence-2026-11-05.md)。 首个有限随访语法仅支持完整肯定限制句并保守拒绝整段明确别文/否定语境，不是通用数值语义判断。最新本机304纯测/21真实PG/build及同次独立复核通过，新任务cmw3r2i130004lu1m730c225r真实交付2项原文依据、5224 Tokens按原业务结算；两次新失败与全部旧预留保留，专业验收仍由用户确认。

## 2026-11-05 · 团队原位审核与例外公开确认

`TeamReviewControls`在原操作区显示范围/必填理由，`TeamWorkspacePreview`仅原位缺项/零变更反馈，不再复制表单。`TeamReviewDialog`只处理新增公开曝光的简短影响确认。`prepareTeamReview`仍只准备、不自动审批；用户明确点击后的编排使用本次返回版本提交。共享perform维持原请求键、未知恢复及身份epoch；onSaved保留理由/范围，确认固定请求且遇编辑/身份检查失效。GET字段publishedAudience沿用服务端有效范围。仅当前页审核区CSS变化，列表、三段表单、Shell和其他页不改。[证据](../testing/team-inline-review-2026-11-05.md)。

## 2026-11-05 · 业务Token状态原位接线

Article/Hub/KB及方案/设计/准备/EDC/方法/资产AI面板改读后端quota，不再以旧budget阻断。单篇execution与通用knowledge-state携带新鲜quota，缺失/不可查失败关闭，人工确认/保存和历史读取不受费用预检阻断。仅文案/状态/按钮条件变化，无CSS、Shell和布局调整；[现行规格](../product/business-ai-quota-2026-11-05.md)与[本机验证](../testing/business-ai-quota-2026-11-05.md)。

## 2026-11-05 · 团队页编辑快照

`team-review-flow.js`新增teamEditRevision，将手动保存和审核前续存统一到本次已读currentRevision；baseRevision仍表示存档来源，不能拿它做新编辑的并发基准。未修改表单布局、字段或后端。编辑后真正变化仍409，保留原显式对照/原key恢复；没有后台自动rebase或自动批准。[本机验证](../testing/team-edit-revision-2026-11-05.md)。

## 2026-11-05 · G02团队审核原位减负

`team-review-flow.js`仅串联必要保存→回读→预览，绝不发审核；`TeamReviewDialog`原生dialog集中范围/理由/确认并归焦。`TeamDirectoryWorkbench`保留身份epoch、CAS、原key未知提交恢复与真正reviews命令。来源直接添加/精确标识恢复题名、已有人物摘要只改角色、高级管理按需挂载；省市仅折叠来源说明。公共Shell只改本叶子说明文案，不改布局。[规格](../product/team-maintenance-usability-2026-11-05.md)。

## 2026-11-04 · 团队维护精简与共用省市

G02 directory-review叶子仅配置数据治理active/面包屑/标题/操作和跳过data-demo-capability，其余叶子不改。TeamWorkspaceList负责列表，TeamDirectoryWorkbench保留原事务恢复；TeamWorkspaceFields机构仅下拉/新增条件输入。ProvinceCitySelect通过administrative-divisions客户端只读同源PG字典，清省清市、迟到失效、错误重试、旧文字保留；不内置演示省市，不调用第三方地图。只在当前页接入，不自动更改其他页。[接口与字段兼容](administrative-divisions-2026-11-04.md)。

## 2026-11-04 · 完整输入修补与一次真实续行

用户明确同类问题无需重复确认，本轮在原范围内完成Hub单篇完整消息／Provider前逐片指纹、四段定性JSON及逐段来源／数值／推荐等级守门；不改旧全局限额、来源／角色、页面布局或共享底座。剩余一次admin真实请求证明6片完整进入模型，原14任务／助手与历史92笔保全，新任务completed；新增保守0.028998元、累计2.073564元，14/14请求／15/20任务、held0。实际新回答仍遗漏弱推荐并有方法范围泛化，专业AC07／B08未通过；发现后免费补缺级拒绝、实际回复回放与两篇人工参考，未改写历史，不把最新门禁的免费通过冒称新模型质量通过。311契约组件＋20PG/build及真实浏览器恢复／来源／隔离／超限有证；当前请求额度用尽，不自动续额。详见[本轮结果](../testing/article-ai-input-repair-2026-11-04.md)；11月中旬目标与11/06余量复估保持，不虚减工期／恢复其他主线。


## 2026-11-04 · 单篇AI新复验失败，原布局保持

只变本机费用状态、不改JSX／CSS／公共Shell：ARTICLE_VALIDATION_HALTED显示当前停止原因、禁发；原key只读恢复失败或原completed，失败无新助手正文，旧回答仍绑定旧v1包。两账号真实Chrome／390失败恢复及回链见[本轮报告](../testing/article-ai-b08-rerun-2026-11-04.md)。注意封存包与实际Provider输入仍有二次裁切缺口，右栏不是全部已读证明，专业未通过；不因此擅自改版或宣称新解读交付。

## 2026-11-04 · 单篇历史证据与新预览分离

ArticleWorkspace仍使用原三栏／控件／样式；当前回答sourceStatus=current时，右栏只读它的provenance.articleEvidence，不能把当前v2预览显示为旧v1模型的输入。无回答时读当前预览；发送清回答后回到新包，既有恢复状态机／权限及版本校验不变。SSR反例和两账号真实Chrome逐段比对旧包、新v2HTTP／E02高亮、刷新／16/28通过。[契约](article-ai-v2-2026-11-04.md)、[免费交接](../testing/article-ai-b08-remediation-2026-11-04.md)。没有新增事实卡、修改CSS或重新生成旧回答。

## 2026-11-04 · G02一页式团队维护

TeamDirectoryWorkbench负责当前身份、选团队、CAS保存、未知回执/比较及集中审核，TeamWorkspaceFields负责三组表单/稳定可访问名称/完整预览；CSS仅team-workbench作用域，沿14/22和原Token。DirectoryWorkbench原逐条维护折叠保留；G02入口名称改团队资料维护，路由/总览/公共Shell/T01/T02不动。客户端只增精确同源team-workspaces族。保存/审核复用原目录命令但共享事务，不把UI组装成独立多次提交；[技术契约](team-maintenance-api-database-2026-11-04.md)、[本轮证据](../testing/team-maintenance-2026-11-04.md)。

## 2026-11-03 · B07真实终态回读修补

`article-ai-session`在state读取时同步核对当前完整pack与execution，终态立刻禁用无剩额发送；记录用户是否改过未发问题，完成任务的GET不覆盖新草稿，整页刷新仍恢复实际原输入。正文复用既有安全Markdown、headingOffset2/禁止模型URL和图片，局部正文16/28，不改原三栏/Shell或旧通用Hub。两账号真实结果刷新/同版回链、原key201/新key429/账本不变有浏览器证据；模型只在前序实际两次执行，本轮回读0新调用。[接口](article-ai-b07-2026-11-03.md)、[证据及专业限制](../testing/article-ai-b07-2026-11-03.md)。

## 2026-11-03 · B05独立文章分支，不改通用Hub

`article-ai-session`封装四字段绑定/严格URL、canonical输入hash、GET恢复及任务/assistant精确对应，未知结果不自动重发；`ArticleAgentPanel`填入原AI01三栏，React18 Effect代次和同步paused遮蔽旧证据。`RealAiWorkspace`根据受控articleId分流，身份/Study/文章/恢复键切换重挂载，原HubAgentPanel不改；登录安全回跳只接限定参数。

E02原按钮只跳转，摘要/正文offset映射原始空白后高亮并焦点，表格只字段锚点；新版冲突不静默替换。E01仅原反馈追加QueryPlan说明。局部Button/14/22、Reading16/28，源DOM无dangerouslySetInnerHTML、无正文浏览器缓存；只读接口白名单不扩成任意Hub写接口。[契约](article-ai-b05-2026-11-03.md)、[实测](../testing/article-ai-b05-2026-11-03.md)。单篇付费仍禁发，B06–08未代签。

## 2026-11-03 · T01目录真实分支与UI07局部窄屏

原T01／T02组件仅新增真实分支，`TeamDirectory`／`TeamDetail`保持原卡片四列、筛选及详情双栏／Tab位置；`directory-session`固定同源、Abort／身份代次、原键回执及无自动重试。`DirectoryWorkbench`只在G02新增叶子，候选／事实／审核精确对象和加载禁审；未知操作保留原body/key，确定冲突后比较当前版本再恢复编辑。matchedAffiliations明确命中、不篡改默认机构或独立城市；checking／unavailable同步遮蔽DTO。

用户明确批准UI07：只有T01／T02加入现有移动导航／来源响应式消费者白名单，≤900px局部筛选、卡片、详情列及Tab滚动，桌面规则不改。Tab需flex:none/min-height52，避免scroll容器的flex shrink塌陷；成功空error不得返回兜底错误。五视口、原生200%、焦点圈与真实返回已测，[验证报告](../testing/t01-directory-implementation-2026-11-03.md)。R01仍pending，不把真实分支启用等同全站接线完成。

## 2026-11-03 · E01原位筛选接线

原EvidenceFilterSkeleton现为受控原生条件组件，枚举来自共享publication-filters纯契约、数量仅读服务端facets。RealEvidence区分draft/applied、归一化后应用、URL恢复详情返回、原位chips/清空/加载更多，generation/Abort阻止迟到响应和跨身份私有计数回填。分类展示只读后端values/claims，不从前端摘要推断；原“研究设计”Tab核对来源依据。只增局部换行/焦点/标签样式，不改三栏/Shell/原导航/动作位置。[API](publication-filters-api-2026-11-03.md)及[技术实测](../testing/publication-filters-2026-11-03.md)。

## 2026-11-03 · B03仅后端投影变化，E01原交互不变

E01原`hubVisibleRequest(publications?q=...)`无需前端改版即可读取QueryPlan筛选后的真实结果，仍按应用后生效、原列表选中/右侧预览/E02详情/重试/加载更多。新queryPlan和matchedRecords仅接口增量；UI01解释留B05，本轮没有JSX/CSS/Shell改动。来源当前授权和身份回退策略不变，[API](bilingual-search-api-2026-11-03.md)、[真实Chrome与前后截图](../testing/bilingual-search-b03-2026-11-03.md)。

## 2026-11-03 · S08原位真实任务闭环

`StudyTasks`只消费有界同源client和真实context；Form/Row/Context保留原两Panel/三主字段母版，轻量ListControls/actor-bound history恢复不接demo-store。编辑revision、选择sequence、身份epoch阻止迟到读取重挂载草稿；409由Conflict区展示当前版本/保留修改，明确确认才新key＋当前version提交。不同区域dirty互斥，轮询仅当前授权/来源不自动写入。标题窄屏占行，不缩字、不改Shell。[API实现](study-tasks-api-2026-11-03.md)、[技术交接](../testing/study-tasks-s08-2026-11-03.md)；AC10不代签。

## 2026-11-02 半宽与保存后续审

局部grid使用等宽首尾轨道＋中间确认按钮，桌面select约原宽50%，600px以下仍单列。`nextPendingAfterSave`基于保存后最新队列及当前kind/q/status选待审项；decided不暗换筛选。只有成功POST才向`load`传advanceFrom，失败/409/普通刷新不传；核对失败不跳篇。新标题承接焦点与“上一项＋对象名称”结果，submission守门阻止身份变更后的迟到反馈。同key选择仅focus/showDetail，不清工作簿scope引起无重读死锁。无API、数据库或后端变更。[规格](../product/source-review-workspace-spec-2026-11-02.md)。

## 2026-11-02 审核下拉与显式保存

`ReviewDecisionActions`本地choice区分未保存输入，当前统一status初始化原值、否则空占位；onChange不请求，单一确认复用原decide及disabled/相同范围禁用。父组件key绑定对象＋状态＋内容/决定/资产或工作簿行批次fingerprint，快照变化重建输入；已生效范围不使用choice替换。局部14/22 select/说明/按钮、窄屏堆叠，原长文入口和队列高度保持，无后端/API变更。[本轮验证](../testing/source-review-reading-2026-11-02.md#补充下拉选择与确认保存)。

## 2026-11-02 队列高度及审核说明补充

`HubSourceWorkbench`局部测量队列位置与父容器底边，以CSS变量设置桌面可用高度；scroll捕获/resize/ResizeObserver经rAF合并，卸载或失权清队列时完整清理。底部sticky受父容器挤压时用64px固定顶栏＋16px间隔约束顶部，避免反馈增高遮住标题；窄屏height:auto。`ReviewDecisionActions`保留原3个Button/decide/disabled/currentStatus，useId连接各自常驻说明，14/22；不添加提交或权限。仅来源局部CSS，G02总览/公共Shell不改。[补充实测](../testing/source-review-reading-2026-11-02.md#补充队列到底与首次操作说明)。

## 2026-11-02 PMC审核阅读增量

`PmcReviewPreview`按当前version/hash读取受控只读章节，Abort和身份事件清理，403清审核内容、409重核、503显式纯文本降级/手动重试。`PmcArticleReading`仅渲染白名单结构、科学MathML/上下标和版本化ID；章节/引用/图表定位先展开祖先details再焦点/滚动，参考文献与图表保留正文回链。`pmc-review-content.js`独立处理真实来源组件完整性/技术副本及筛选计数。`HubSourceWorkbench`切对象回标题、保留队列，底部sticky入口仅跳同一决定区/原下一项，不另写提交逻辑。CSS均局限来源子功能，Reading16/28、表格/操作14/22；G02总览、公共Shell及普通E02布局未改。[测试与截图](../testing/source-review-reading-2026-11-02.md)。

## 2026-11-02 G02来源审核工作区

`HubSourceWorkbench`统一获取真实审核队列；筛选/类型/搜索与用户选择分开，保存后保留当前对象，显式下一项。`PmcReviewPreview`和`ExternalReviewPreview`仅负责当前对象的内容核对，不再各自渲染独立审核表单；`WorkbookReviewDetails`处理当前来源批次与单行的真实范围/分页/历史。共用Button、原Token、14/22操作和16/28阅读；来源子功能局部CSS控制左右队列/详情、窄屏列表到详情，G02总览和全局Shell不改。原冗余施工说明只在此子功能隐藏，保留本机合成环境标签。

审核POST由单一当前作用域和指纹提交，busy单飞、当前账号/请求代次守门；未知保存不自动重试。`hubVisibleRequest`把原C01/C03/E01/E02/H06的数据读取接到需认证的member投影，401/403可回退原公开读取，不调整其布局。身份事件先清内容并abort/递增代次，迟到响应不得回填。完整技术与专业用户边界见[规格](../product/source-review-workspace-spec-2026-11-02.md)。

## 2026-11-02 接线布局恢复

RealAiWorkspace/PersonalOverview/RealEntryLayouts及既有真实来源组件消费原母版结构，不另造接线占位版式。RealStudyOverview/RegistryDetailLayout与论文详情专用Skeleton在授权核验/失败态保留结构。真实live/entry路由跳过旧pageRules演示跳转映射；原显式demo不变。Study导航只生成验证过的双scope链接，其他模块明确受限。AI同身份重核验保留组件和幂等状态、暂停提交与隐藏回答；身份或scope变化重新挂载。响应式修补限真实页面消费者，桌面Shell不改，G02同期批准改动保留。没有API/Schema或依赖变更。[技术记录与未测项](../testing/layout-restoration-2026-11-01.md)。

## 2026-10-31 S07指南人工引用面板

`ResearchDesignGuidanceCitations`复用共享Card/Button与`GuidanceClauseDetails`，独立同源GET/POST仅在精确引用路径开放。面板折叠、当前/固定历史选择、完整目标与来源核对、明确确认、解除；与正文/证据/建议dirty互斥。独立序列/单飞/卸载守门，3秒及focus/visibility重验；失效或身份变化先清正文，迟到响应不串入。未知提交（含无表单选择的解除）固定原payload/CAS/key并保护dirty，显式重试，不自动重发。纯原文Reading16/28、48rem，操作14/22/44px；原生SELECT computed normal例外实测留痕。局部CSS，不改Shell及旧AI输入。[交接](../testing/guidance-plan-citations-2026-10-31.md)。

## 2026-10-31 H06关键条款按需展开

`RealGuidanceDocuments`继续读取三条真实书目投影，卡片内 `GuidanceExcerptLoader` 用原生details按需调用 `guidance-documents/:documentId`，不在前端导入受控清单。关闭/切对象/unmount中止请求，忽略迟到响应；重试先清旧正文，父页focus/visibility刷新重新核对。`GuidanceClauseDetails`为G02预览与H06正文共用纯展示组件，区分物理/印刷页码与局部条款位置，长文16/28、48rem上限，操作14/22及44px触达；局部CSS使用原Token，Shell不变。新增重试复用共享Button，不加全文下载或假AI操作。[验证](../testing/guidance-clauses-2026-10-31.md)。

## 2026-10-31 C03结构化注册来源

真实C03读取当前API的 `structuredDetailsStatus/structuredDetails`，复用 `pages/shared/RegistryStructuredDetails.jsx` 呈现设计、分组干预、登记结局及原始位置；G02在具名审核预览中复用同组件，不从客户端解析MHTML或回退演示。局部样式 `pages/shared/registry-structured.css` 使用Reading16/28、来源操作14/22和44px原生summary；G02窄卡片内部单列，C03手机单列。正常折行避免pre-wrap行末空格挂出，公共Shell不变。重试/焦点重验先移除旧内容，待审或撤回不保留结构化值。[本机验证](../testing/clinical-registry-structured-2026-10-31.md)。

## 2026-10-31 五份当前获准来源的非空布局

H01在无论文且有外部来源时使用单行满宽来源卡，内部桌面两列/手机一列；论文空态另行标明，注册题名经不可变ID链接到C03。C01/C03/H06新增 `real-registry__content` 承担正文留白，main不再限制公共页头宽度。仅四个真实来源页在不大于900px时将主滚动区缩短72px，为现有底部平台导航保留独立区域，正文链接不滚至按钮背后；桌面与演示不变。G02陈旧“尚未接入公开页”提示已更新。真实非空、链接命中和文字Range、原生200%完整viewport验证见[本轮实测](../testing/initial-five-display-2026-10-31.md)。

## 2026-10-31 H06 指南与研究标准真实模式

`real-mode-route.js` 将 H06 真实模式标为 live；`workflow-main.jsx` 仅在真实配置且非显式 demo 时挂载 `RealGuidanceDocuments`，经同源 `guidance-documents` 接口读取当前公开书目，失败不回退演示。公共 Shell 的 H06 真实页头、手机导航和领域分类横向滚动延用 H01/C01/C03 规则；显式演示模式仍显示原样页。空态和搜索无匹配分开；原 PDF 与无 HTTPS 来源链接不展示。[实测](../testing/guidance-source-real-2026-10-31.md)。

## 2026-10-31 C01/C03 注册来源真实只读页

真实模式 C01/C03 由 `real-mode-route.js` 标为 live，`pages/c01/src/RealClinicalRegistries.jsx` 和 `pages/c03/src/RealClinicalRegistryDetail.jsx` 分别调用同源 `clinical-registries` 列表/详情接口，现有 `main.jsx` 的固定演示组件仅在显式 demo 模式保留。详情 `documentId` 严格校验，不为未审/404 填固定试验；链接仅对 HTTPS 来源开放。C01 的搜索只过滤当前可见返回项，不冒充全域筛选；地图/趋势不显示演示统计。公共 Shell 的真实页头和手机导航扩至这两页，页内九项领域标签可横向滚动；桌面与其他页母版不变。网络失败可重试、重试取消旧请求，初始加载/空态/无匹配/不可见分态。[实测](../testing/clinical-registry-real-2026-10-31.md)。

## 2026-10-31 H0 真实领域页移动端公共 Shell 消费者

`page-linking.js` 将真实模式 H05/H01 加入已有 `data-hub-source-real` 移动端消费者清单；`hub-source-responsive.css` 为 H01 页内分类导航加容器横向滚动与不收缩按钮，并只在这两页的真实手机模式将原侧栏改为受控抽出。`platform-frontend.js` 装配「平台导航」开关、遮罩、Esc 和焦点归还，侧栏关闭时 `inert`；抽屉打开时页头/正文 `inert`，Tab/Shift+Tab 在抽屉及关闭按钮内循环，切宽屏恢复背景交互；重复挂载时重新同步当前侧栏实例。宽度不大于 900px 时正文回流并保留品牌/账号；桌面 Frozen 尺寸、五导航目的地、其他真实/演示页面、API和权限不变。证据见[本机实测](../testing/h0-mobile-shell-2026-10-31.md)。

## 2026-10-30 AI01 Hub 来源会话入口

AI01 真实模式继续沿用 `RealWorkspaceEntry` 与公共 Shell，局部增加 `HubAgentPanel`。前端仅用现有认证资料选择当前获授权 Study 请求作用域；权限数组不在浏览器认证投影中，真正的 `AgentAccess`、租户和来源审核由后端再次核验。`src/knowledge-session.js` 白名单只增 `/sessions/hub-source`，发送沿原队列 `knowledge-messages` 且 `kbIds=[]`。UI 不展示旧 AI01 高保真演示答案；报价/预算失效时显示阻断说明且不呈现发送入口，来源失效后历史答案由服务端替换为受限提示。字号沿原工作区 20/28 标题、14/22 操作说明、16/28 回答；无 Shell/Token/一级导航改动。浏览器证据见[Hub Agent 本机记录](../testing/hub-agent-session-2026-10-30.md)。

## 2026-10-30 Hub 来源目录真实页

`src/real-mode-route.js` 把 E01、E02、G02 标为当前真实页；G02 由 `pages/shared/HubSourceWorkbench.jsx` 调用管理接口，E01/E02 分别由 `RealEvidence` 与 `RealEvidenceDetail` 调用公开投影，均不把静态样例当数据库记录。`src/hub-source-api.js` 只构造同源有界请求；旧样页在显式演示模式保留。公共 Shell 和局部 `hub-source-responsive.css` 为这三页提供真实标题、导航与手机/原生 200% 缩放布局，不改全站视觉 Token。服务失败、未审、撤回和无数据分别呈现错误、404 或真实空态；详情不补造方法、结果、评级和全文。浏览器实测证据见[首切片验证](../testing/hub-source-first-slice-2026-10-30.md)。

## 2026-10-29 S02 复用设计列表

`src/research-design-session.js`允许 S02 精确有界 `designWorkspace=1`＋Study 双作用域；`pages/shared/missing-main.jsx`仅在该路由挂载既有 `ResearchDesignWorkspace` 列表分支。`src/real-mode-route.js`复用设计路由分类，Shell 去演示页头；原 Q02/S07 保持。旧`missing-pages.css`最小1280宽仅对真实 S02 局部覆盖，显式演示不变。权限和本人列表仍由原 `/api/auth/me` 与草稿 API 判定，未新增 API/表/角色。[规格](../product/study-design-entry-real-2026-10-29.md) · [实测](../testing/study-design-entry-2026-10-29.md)。

## 2026-10-29 S01 有界真实概览

`src/study-overview-route.js`只允许 S01 精确 `studyGroupId`+`researchProjectId` 双作用域；`src/real-mode-route.js`只把该有界路由标为 live，未带作用域依旧守门。P01 真实项目列表一律可链至此只读页；`pages/shared/RealStudyOverview.jsx`复用`src/my-research-api.js`并仅接受服务端返回的同组项目成员关系。焦点/可见性/身份变化使旧内容先清空再重读；错误不回退演示。旧S01高保真样页仅显式演示模式保留。公共 Shell 针对有界真实页替换演示页头，手机局部覆盖旧样页的最小宽度；没有新增 API/表/权限。[规格](../product/study-overview-real-2026-10-29.md) · [实测](../testing/study-overview-2026-10-29.md)。

## 2026-10-28 真实入口与演示数据边界

`src/real-mode-route.js`按52条登记路由判定公共、认证、已接通、真实入口、具名作用域或未接通状态；未接通页由`src/page-linking.js`隐藏`#root`中的固定演示结果并显示诚实守门。Q02/A01/AI01默认真实入口复用`GET /api/auth/me`及原Study成员摘要，`src/real-entry-links.js`仅生成既有工作台链接，后续能力仍由原业务API鉴权；不产生模型请求。P003新登录安全回跳默认P01，原显式演示可独立选择。真实模式顶栏搜索/通知及页头不再读取`browserDemoStore`，K01承载真实知识服务时强制真实身份。手机真实入口隐藏固定侧栏并保证正文宽度，保留桌面Shell。此切片不是52页全接后端，35条无作用域或未接通页在真实模式下守门。详见[产品规格](../product/real-entry-demo-boundary-spec-2026-10-28.md)与[实测](../testing/real-entry-2026-10-28.md)。

## 2026-10-28 P01个人聚合接线

P01从`/api/my-research/overview`只读获取当前真实会话下的个人投影；客户端`src/my-research-api.js`校验固定响应结构，401/网络/无数据分态显示，`qiyan:user-change`使旧请求失效并清除旧私有内容。`src/research-design-session.js`保证P01不被本机演示模式覆盖。服务器本机适配`researchhub/scripts/my-research-overview.mjs`在当前授权事务中读取旧Auth/Member/Project/Artifact/StudyTask表，项目按双层有效成员关系过滤，产物仅本人拥有且具有原artifact.read，任务仅本人被分配且有原workbench菜单；不增加权限、Schema或模型调用。当前仅19501/19502本机合成服务启用，生产独立服务尚未部署此适配。详见[规格](../product/my-research-overview-spec-2026-10-28.md)与[实测](../testing/my-research-2026-10-28.md)。

## K08当前技术交接（2026-10-26，AC10待用户）

K06界面、K07联调及K08唯一独立代码总评审的技术工作已完成；专业AC10尚未签署，不称完整WP09/AI-15、一期或生产验收。独立原结论为With fixes（0 Critical、4 Important、无新增Minor），原文保留；主实施逐项RED→GREEN修补，不冒称独立二次复签。修补涉及明确倍数/分数表述的输入/资料/输出边界、空访视映射未声明、依据选择跨轮询保留及同基准自检提示；回归另修复在途轮询误取消历史目标读取。只改本用途，不改旧内核/权限/共享底座。

最新证据：browser-5ce391ba两账号26项（含真实在途轮询）；browser-auth-0d9780ee两账号12项；browser-visual-c05c9683两账号原生Chrome200%/键盘/字体；browser-review-97b2ea20两账号11项（本人新记录两次显式意见保存，不增AI）；前序本轮flow-dc2290c7的22项真实PG/CAS/幂等/意见链仍保留，不盲重跑。review-readback-92bc6049读取32记录126版本，0摘要受影响、0历史改写，三份原始真实模型输出通过新严格契约免费回放。free-gates-dba74990：404纯测试、1054旧内核测试、构建/保全/空白全部通过；691旧源码、115表41128前序行、三旧scope和八旧进程不变。PNG/WebM、失败与原评审均留痕。

本轮0新Provider/费用；累计仍10job/9实际HTTP/88笔known/¥1.899558，paid=false、任务额度已满，不因余额自动续跑。只用专用合成库，七个本机服务就绪，不接临床库、不动旧服务、不发布。用户可先阅读已有结果并体验意见闭环；正式AC10的新合成AI任务须另确认。后续仍保留11/04、11/06全一期复估和11月中旬交付目标，不借本片销掉其余业务/AI/正式治理。

完整证据与AC10验收卡见本片实测文档，原评审与作者复验见planning同日目录code-review.md；61项最终源码摘要见implementation-k08-checkpoint.json。Notion同步状态以最终回读收据为准。下方K06/K07“待总评审”和更早停止点均为历史，不恢复旧任务。


## K06/K07本机界面与全链技术验证（2026-10-26，K08待总评审）

用户已明确继续K06及既定后续。A02新资产核对族接通：本人源候选/目标固定版本→六组逐子项声明规则→已有真实AI定性解释及typed来源→免费规则或明确AI依据的人工意见→分批提交/固定历史。原资产/目标只读，不套用或新建研究；本轮派生参考目标不冒称新PICO确认。原Q01不支持固定历史URL，故目标通过既有versions接口在本页只读核对，源候选保留原固定历史回链。

真实Chrome：browser-d72086b8两账号26组（五视口、已有真实AI/来源/固定历史及错路由拒绝）；browser-flows-dc2290c7两账号22组（新建、真实PG保存/CAS/响应丢失原键重试、读完整性/网络故障恢复、真实U02/U03撤销、AI依据显式切换/同消息分批意见）；browser-auth-03bf0b6a两账号12组（非首项/固定历史精确探针、在途撤销/迟到200、实际Cookie换账号和退出）；browser-visual-b6fa3363两账号原生Chrome200%/键盘，Reading16/28、输入及重要限制14/22。相关PNG/WebM和初始失败永久保留。已观察并修正：无AI历史误禁目标读取、通用演示提示、错误A01新族继承旧动作、成功HTTP探针未传播U02/U03撤销。移动截图先等既有侧栏动画结束；测试自身字段集disabled判定及异步选项等待问题不记产品修补。

本轮0新Provider/费用，仍10job/9实际HTTP/88笔known/累计¥1.899558；paid=false且10job已满，不借余下HTTP次数启动新任务。六笔已批Token对账已收尾；不续额/充值、不改角色/旧源码/旧scope/前序行/旧服务。完整免费门禁free-gates-99436190为399纯测试＋1054旧内核、构建/保全/空白通过（其后仅本片路由窄修，最终门禁待收口）。仅本机合成技术证据；K08唯一独立代码总评审与用户专业AC10未完成，不称WP09整片/完整AI-15/一期或生产验收。下方旧K05停止点/无UI等为历史，不再作为当前指令。

## 2026-10-26实施检查点 · WP08方法资产本人工作台（本机技术验证通过，AC10待用户）

A01/A02新显式crfMethodAssets入口优先于旧族/演示；任一新族参数交严格解析，拒重复/混合/未知参数。新Workspace处理真实me/Study/列表和身份栅栏，Detail独立管理阅读/notes/history/派生。沿原Shell/Card/Button/安全Markdown，不改全局Token、五导航或旧SyntheticAssetWorkspace；原族按当前Study可只读往返。S06仅增封装按钮和首次精确methodReportId/version选择，显式history始终只读，不自动选head。

内容GET single-flight，独立探针绑定实际候选ID/当前或历史版本，不以列表A01代替A02历史或非首项根；目标切换失效旧探针，不重置手动分页。401/403或集中身份最终换人/匿名清私有区、释放busy/reading和失效代次，checking不误清同账号dirty。读失败health与mutation CAS错误分离：invalid优先，隐藏不可信报告/配方/来源；临时unverified明确上次读取，均禁写，成功重验清读错误而保dirty/CAS/key。不是新增服务端sourceStatus值。dirty轮询保notes与原CAS，成功回执才报保存；受控提交后丢响应原key重试不增版。真实导航保护不拦用户菜单等非导航，字符串/对象/混合选项显式显示。

仅新工作台复用wf-content窄屏导航和既有compact品牌规则，保留14/22操作、16/28/48rem阅读与单h1/逐级标题。V07为321/1054、两账号28组及五视口/原生200%通过；唯一原评审With fixes（3 Important/1 Minor）已返，作者三Important一次修补及最终回归已通过（324/1054、整链28组、读失败14组/细分授权10组）；原With fixes保留，无第二评审。M-1无A02时空历史控件提示登记延后；[本轮证据](../testing/crf-method-assets-2026-10-26.md)，不代专业AC10或生产。

## 2026-10-26当前 · WP07首切片技术收口，AC10专业验收待用户（未发布）

S06真实CRF方法页新增CrfMethodsReport独立子组件，复用Shell/Card/Button/Markdown/ep-reading，操作14/22、长文16/28；仅UI把报告内部标题映射到Card h2下h3/h4，存储正文/hash不变。report读单飞/序列和身份fence，401/403清私有数据；notes dirty保持原CAS，真实409保留输入，显式确认丢弃才刷新/读历史，beforeunload保护。dirty/busy只互斥写动作，不伪装实际方法computing。本人报告最多30份/每份30版，超限不静默裁切；无审批/导出入口。两账号真实Chrome、五视口/原生200%与迟到/慢网/失权技术检查完成，D08独立原评审及重要项作者复验完成；专业AC10待验，不改全局样式/权限。




D08唯一独立原结论With fixes（0严重/3重要/1轻微）；三重要项已由主实现一次RED→GREEN修补：第五意图英文/Unicode数量禁入禁出，慢读失权同步释放busy/reading，比较补真实输入修订与双方范围观察。新Chrome交叉失权恢复/迟到200/五视口通过；最终302组合＋1054原内核及构建/保全通过，原Node/chunk告警保留。未追加模型请求，原With fixes与作者关闭分开记录；一处旧“待接入”提示Minor延后。代码/本机启用/真实请求与用户专业AC10四层分列，技术交接不等于完整WP07、一期、生产或专业验收。后续新样例如需新增AI请求，先另确认次数/有效价格，不自动动用余额。下方旧阻断/旧PID/待批均为历史。

## 2026-10-25当前 · 存储修正已验证，模型输出未通过（未发布）

S06仍复用原Shell/Card/Button与操作14/22、长文16/28规则。后端pending从精确真实job投影，runVersion不随AI变化；本轮首笔输出被拒，页面显示缺正文引用/费用留痕/不自动重试，按钮停用，R01结果可读。两账号实际Chrome三视口14/22和无根横溢通过；没有合格长文/来源/报告，不把预期样式当实测。

本轮新增1笔known费用¥0.012051；累计76笔/¥1.476468/原¥5，余¥3.523532、预留0。原75笔与报价保持，原3次已用1次、余2次；要保持原三项目标至少仍需3次，额外1次计划待确认，不自动重试/续额/续价。详见[当前实测](../testing/synthetic-crf-methods-2026-10-25.md)；下方此前“0模型/待存储确认”均为历史记录。


## 2026-10-25 · 方法AI选择/来源UI在建并显示暂停

CrfMethodsInterpretation沿原Card/Button与14/22操作、16/28阅读，选择绑定run/resultHash，403/退出清理，409保留选择/请求基准；typed [M]方法源和[n]文献源各自读取。原Orchestrator/JSON/去数值契约只证明免费兼容，不证明真实AI结果。有效入队因终态run不可写失败，当前禁用付费按钮并显示implementationHold原因；无实际解释/报告，不显示假成功。真实暂停/方法保留及失败见[报告](../testing/synthetic-crf-methods-2026-10-25.md)。公共Shell/主题/导航不变。

## 2026-10-25 · S06本人真实CRF方法结果阶段接入

仅显式crfMethods路由接CrfMethodsWorkspace/Results及局部CSS；S05本包提供返回同包的入口，原Shell/全局导航/旧演示分支保持。解析拒绝未知/重复/跨包或混合任务参数，不回退demo。原同源scope客户端、真实身份、single-flight与identity fence复用，列表手动分页，不被详情轮询重置；完成详情同步同id列表状态，避免busy悬挂。restricted/401/403/退出清输入/列表/结果并拒绝迟到200。

表格操作14/22，长文16/28，五视口/原生200%下仅表内横滚且键盘可达。AI/报告标未启用，不提供假按钮。详见[实测](../testing/synthetic-crf-methods-2026-10-25.md)；这不是完整D05–D08/专业交付。

## 2026-10-23 · S11真实执行准备完整草稿链

Workspace/Form/Check/Opinions/History复用原Shell、同源Scope客户端和single-flight栅栏；仅本人原Study，无新全局导航/邀请路由变化。Opinions独立局部错误与dirty，成功追加根版本、保留原execution，真正配置修订才清当前结果/意见；History按identity/operation序列隔离迟到读取/复制，不误报新目标成功。历史JSON只手动复制，不自动写配置。

重绑理由空值曾被全局error effect抢焦点，已改局部关联错误，不加延迟补丁。配置/opinion/rebind共同未保存态拦显式放弃/离开，改回原值可恢复clean；restricted/401/403统一推进identity/fence并失效refresh gate/operation、清输入与反馈，历史失效后的迟到普通读/写响应也不恢复。修改试填答案即清父级preview，不误报当前答案已通过。两账号新材料UI、五视口、原生200%、真实在途撤审/慢读及复制反例见[实测报告](../testing/research-execution-preparation-2026-10-23.md)。操作14/22、长文16/28、局部样式及单h1保持。

## 历史：S11执行准备E01–E04

executionPreparation标记优先于WP02邀请/旧demo分支，readPreparationLocation拒绝无效/重复/混合范围；不增加全局导航或复制Shell。ResearchExecutionPreparation/Form/Check分离读取/编辑/临时试填，沿原同源Scope客户端和single-flight栅栏。dirty保留原CAS；401/403/restricted立即清除配置、预览和历史投影，退出前请求晚到不能恢复。

样式仅局部作用域，操作14/22、阅读16/28/48rem、说明13/20、元信息12/18。控件独立可访问名称、汇总＋行内错误和首错聚焦；Markdown新增显式headingOffset=2供嵌入方案使用，默认聊天不变。配置修订清空临时答案，同修订普通轮询不抹预览；规则链接可定位字段或空配置区域。E05 AI和E06意见/历史diff/重绑待完成，见[阶段报告](../testing/research-execution-preparation-2026-10-23.md)。

## 最新交接：WP05首切片本机技术验证与评审修补完成

T01–T09真实实施验证及T10唯一一次独立代码总评审已完成；3项Important、2项Minor均由主实现核对修补复测，无第二次独立签认。最终190/190相关测试、1054/1054既有编译内核、构建及25项综合门禁通过（gates-6d67fff7），含两角色新材料全链各9项、实际在途来源撤审、五视口/原生200%、慢轮询及复制晚到反例。完整证据与用户专业体验A09见[最终实测报告](../testing/research-design-workbench-2026-10-23.md)。

交接仅指本机合成技术能力，不是用户专业验收、完整WP05/一期或生产交付。累计52笔均known，保守¥0.984879/¥5，原33笔与旧源/旧服务/历史对象保持；无新权限、Schema、充值、自动续额或云/远端配置/发布。报价至2026-10-24 14:12:50北京时间，过期/费用未明停新调用。本次收尾不再调用模型。下一检查点为用户体验核对，不自动扩大业务范围；2026年11月中旬总体目标仍须逐片复估。

以下按阶段保留原记录；旧段落的“评审中/待批准/186项/22门禁”均为当时历史，当前结论以上段及最终报告为准。

### T10交互保护

同详情刷新采用single-flight并合并强制重读，不因3秒轮询使4秒响应永久过期；身份/对象变化仍立即使旧响应失效。历史复制以目标版本及操作序列绑定，切换版本/对比目标立即清状态，旧promise晚到不为新目标显示成功。真实受控慢读与剪贴板反例分别2项通过，不冒称发生了真实网络或系统剪贴板事故。

## 2026-10-23 · WP05本人设计真实分支（评审前记录）

ResearchDesignWorkspace拆本人Q02列表和S07详情；Evidence/Suggestions/History三个小组件只处理当前本人server view，经既有同源Cookie/Scope客户端和精确路由白名单。Q01/K01沿原入口往返，不增加正式Project/Study或全局导航。真实标记优先于演示、混合demo ID拒绝；旧Shell/five-nav/frozen tokens不变。

轮询有请求代次隔离；证据/建议异步同版本到达按resultMessageId重建表单。证据、建议和正文dirty分区互斥，轮询不推进可见CAS；失败/409保输入，退出/失权/来源受限立即卸载正文和历史，dirty不延迟清空。保存沿原版本/审计原子提交，同结果部分采纳以server head续接。History只作有界文本行差异和真实复制失败提示，不猜Protocol结构。

长段/原文16px/28px、最大48rem，表单14px/22px、元信息12px/18px；局部CSS不改全局token。两角色全新材料真实UI各9项、五视口/Chrome原生200%已记录；原SyntheticQualityPanel在方案换版清除旧run/report选择与query，旧结果只能显式只读核对。当前独立总评审中，专业待验，参见[实测](../testing/research-design-workbench-2026-10-23.md)。

## 2026-10-22 · 六阶段联调最小修正

research-plan-contract新候选limitations必须显式为“资料证据局限：”原资料范围；确认P/C/O的population/comparator/outcome框架服务端确定性引用，方法待定沿原outline单列。不做中文语义猜测/自动修复，不改旧版本或原服务。新候选正文明确意图≠证据≠方法批准；这不是完整专业语义校验。

syntheticRunUrl纯函数由SyntheticQualityPanel的choose/create/revise共用：保留当前Study/plan，仅更新run并删除旧syntheticReportVersion；资产固定版本回链不变。pages/k01/host.css仅追加同既有真实Q01/资产分支的1000px窄视口演示搜索隐藏，防200%品牌/身份遮挡；不改全局Shell尺寸/Token/其他消费者。真实阅读/操作字号不变。

两新账号链真实上传/解析/审核与Agent/DQ/原产物服务连续贯通，无SQL造方案/Mock成功。110单元、828既有编译内核、真实导航RED→GREEN、权限/失败恢复/实际Chrome200%/局部页头矩形回归及构建通过；实际产物和未测边界见 `../testing/research-flow-e2e-2026-10-22.md`。本机适配层仍非生产公共API，专业验收待用户。

## 2026-10-22 · Q01→A01/A02私有资产候选

SyntheticReportPanel增加封装操作与busy联动，SyntheticQualityPanel阻断提交中切换；missing-main仅a01/a02且assetDrafts/assetDraftId显式query挂载SyntheticAssetWorkspace。真实me/scope/本人授权，不信任query，不回退演示；列表/详情/历史/说明/派生全链路，dirty/CAS/错误焦点/请求序列共用。详情5秒轮询、列表仅显式刷新/分页，加载更多不被轮询重置；受限响应优先清空敏感内容。局部CSS阅读16/28/48rem、操作14/22、元信息12/18，原safeMarkdown禁图片，未扩大全站Token/Shell/导航。

synthetic-asset-route纯映射只调整真实候选页头，移除示例模板/分享下载、准确提示私有范围；默认A01仅本机配置有入口，其他演示分支不变。transport只新增nested report asset-drafts和research-asset-drafts本人列表/详情/版本/derivations，不开放通用产物或治理操作。

local-synthetic-assets复用withScope/inDraft/inRun/inReport已锁定事务里的原服务，绑定原report/source/软件snapshot与祖先版本；现存chunk撤审直接restricted，原生Source语义与封存数据比对。成功请求包括无改动都在AuditLog绑定摘要，异输入同键409；只增原产物版本，未新增表/DDL或修改旧服务。软件facts不重算、不调用模型。无正式Asset/跨研究应用，生产接入前仍需内部入口升级兼容性与正式治理设计。详见 `../product/synthetic-asset-slice-2026-10-22.md` 与 `../testing/synthetic-asset-2026-10-22.md`。

## 2026-10-22 · Q01可追溯报告限定接入

SyntheticQualityPanel内挂载SyntheticReportPanel，仅真实researchPlanId分支；沿用Shell/Card/Button/原安全Markdown。白名单仅增加当前本人plan/run下report-draft及versions，不开放通用产物、审批或导出。只读事实16/28/48rem、说明14/22、元信息12/18；失败保输入和焦点，成功失效化较早GET，显式放弃同步清理dirty，报告dirty/busy联动父数据生成保护。版本query仅用于选择，不是授权。

local-synthetic-reports.mjs在原withDraft/withCurrentKnowledgeRead/共同授权事务内验证原两账号、当前权限/feature/Skill、父方案/会话、真实本人run、来源/版本/终态和Manifest。原ResearchArtifactsService.createWithSourcesInTx原子写正文、Source、摘要和审计，createVersion追加说明并复制Source。type=data_quality_report/status=draft，知识多片段聚合为同一文档Source，方案使用data_snapshot既有类型，无DDL/旧源码修改。报告纯事实组装与哈希位于synthetic-report-contract.mjs，不调用模型或重算数值。

真实执行与内部入口/Source完整性后续限制见 `../testing/synthetic-report-2026-10-22.md`。仅本机受控适配层，非生产API或完整旧AppModule接入。

## 2026-10-22 · Q01合成质控限定接入

ResearchPlanFlow内增加SyntheticQualityPanel，沿用Shell/Card/Button与14-16-12字号。客户端白名单仅增加本人草稿下synthetic-trials创建/列表/详情/revisions；纯单元格验证在synthetic-quality-form.js。未保存输入、错误/首错聚焦、历史只读、URL选择恢复在同一组件处理；403同步父组件清空数据并显示原因。宽表自身滚动，不改全局Token/Shell或演示Q01。

local-synthetic-quality.mjs复用原ResearchMethodRun/共同授权锁、汇总/WorkerClient/执行数值策略/质量评价纯函数，只把本人快照转为安全manifest，不读全Study或写放行门禁。local-knowledge新增自有19505原Python子进程，固定内部URL、私有随机Token，不连接旧Worker。规格与实测：`../product/synthetic-quality-slice-2026-10-22.md`、`../testing/synthetic-quality-2026-10-22.md`。

## 2026-10-22 · 真实PICO与方案草稿分支

K01的KbAgentPanel只按真实scope/最小权限建立或列出本人候选；同源白名单transport新增research-plan-drafts读/创建/阶段任务/确认/版本，拒绝通用产物与review/export。Q01仅URL含researchPlanId时装配ResearchPlanFlow，原localStorage演示分支不变；真实会话再次匹配me中的group/project，不将URL当授权。

本机 `local-research-plans.mjs` 调用旧ResearchArtifactsService、候选框架和原共同授权锁；原队列创建Hook把server-owned阶段绑定及产物版本在同一事务提交，assistant最终提交仍在原claim/授权事务验证当前来源/PICO/版本。上下文seal沿旧canonicalArtifactJson避免JSONB键序误判。不存在新API表、DDL、旧源码改动或历史扫描。

纯契约拆到research-plan-contract.mjs；页面纯表单/dirty/CAS规则位于research-plan-form.js。dirty刷新不推进编辑基准；受限响应立即清空正文，失败保输入、显式放弃后加载新版本。编辑正文与服务端来源附注分离，附注终止标记保护追加修订。CSS仅真实分支：14/22操作、16/28阅读、12/18元信息、1100以下单栏，取消桌面固定最小宽度并在窄屏隐藏演示搜索框防200%重叠；不改全站Token/Shell结构。最大30条本人列表和30版元数据有界，本机按条重验来源，尚非大规模生产性能结论。

接口/能力边界及证据见 `docs/product/research-plan-ai-slice-2026-10-22.md`、`docs/testing/research-plan-ai-2026-10-22.md`；完整旧AppModule/OpenCode与云发布未因此启用。

## 2026-10-22 · K01知识资料受控复用

K01注册于既有manifest/Shell/导航映射；A01和G02只增叶子入口，不改一级导航、母版或S10职责。独立同源frame仅加载旧知识组件受控副本，无旧Shell/global CSS外泄；`src/knowledge-reuse/source-manifest.json`记录22份源文件/SHA（原20份加会话纯函数和Agent面板来源，后者为限定只读适配，不声称字节相同）。所有运行依赖在ResearchHub自己的package/lockfile内，Vite另登记frame.html，独立dist不引用外层app路径。Tailwind/PostCSS仅能力区使用，配置路径固定，不能因从仓库根运行测试而失效。

会话桥取真实 `/api/auth/me` 的组/研究项目授权；`src/knowledge-session.js`固定同源Cookie/API，去重键含实际scope，不将demo/URL身份当权限；后台沿用原guards和当前授权。无成员/只读/401/403/409/503有独立反馈。iframe与宿主只交换busy/现有角色展示/可见区域数值，并校验origin/source，不交换token；切换scope销毁旧实例，进行中的写操作不允许切换。

本机测试通过；后续用户批准常驻合成体验，现由 `scripts/local-knowledge.mjs` 装配独立回环前端/API/解析/向量服务（19501–19504），真实同源 API proxy 与租户 slug 仅在本机启动配置中提供，不更改生产反代。不是完整 AppModule，不调用历史导入恢复扫描；仅专用合成库与新夹具，具体见 `docs/technical/local-knowledge-runtime.md`。生产目标仍须另行批准装配。

AI追加授权后，KbAgentPanel调用原知识会话契约，复用原conversation纯函数/Markdown并用严格路由白名单的同源transport；不开放通用Sessions或后台接口。busy/dirty沿用iframe桥，迟到响应不跨scope；内存草稿按账号/研究/库隔离。操作14/22、回答摘录16/28、元信息12/18；真实200%缩放可展开来源。后端本机装配见 `scripts/local-knowledge-ai.mjs`，复用原Sessions/Queue/Orchestrator KB/KbTools/DeepSeekProvider；来源栅栏处于原授权/claim最终提交事务，未新增会话表或修改旧源码。费用账本为单机限定安全门禁，不充当生产计费平台。规格：`docs/product/knowledge-ai-slice-2026-10-22.md`。

## 工程模型

每个高保真页面保留独立入口 `pages/<page-id>/`，避免不同压缩包中的同名文件覆盖。公共能力位于 `src/`：

- `design-tokens.css`：Foundation 与 Layout Tokens。
- `platform-header.js/css`：L0 Global Topbar 和用户信息入口。
- `platform-user.js`：独立用户状态适配层。
- `platform-shell.js/css`：统一 Sidebar、Breadcrumb、Page Header、Context Navigation。
- `platform-navigation.js`：页面路由与一级导航映射。
- `page-linking.js`：跨压缩包页面链接、公共 Shell 挂载和交互装饰。

## 接入新页面

1. 使用 `scripts/Add-Page.ps1`，页面编号必须唯一。
2. 在 `platform-pages.json` 登记路由、母版和来源压缩包校验值。
3. 在 `platform-shell.js` 增加页面上下文映射，不得在业务页面复制 Shell。
4. 在 `page-linking.js` 增加页面内可点击关系。
5. 运行 `pnpm run build` 并按测试规范完成浏览器验收。

业务页的 `<main>` 必须带 `class="platform-main"`，并按 `docs/ui/page-layout-practice-v1.0.md` 处理顶栏偏移、24px 页边距和滚动。历史样式里的 `main { padding-top: 70px }` 对应已废弃的 70px 页头，不能继续生效。

## 扩展用户身份

认证系统通过 `setPlatformUser()` 或初始化 `window.__QIYAN_USER__` 对接。业务页面不得自行绘制另一套用户区域。

## 已知兼容策略

历史压缩包可能在 React 首次渲染时覆盖公共 Shell。`page-linking.js` 使用受控 MutationObserver 在首次渲染完成后重新挂载；不要删除该时序保护。

## 灵枢心域与工程基准

本仓库采用React18/Vite多页面工程，是唯一开发基准。P002开放门户无需工作区Shell，独立CSS不注入其他页面。P002的动态素材路径由既有Vite构建插件复制到dist/pages/p002/assets，源素材仅在pages/p002/assets维护。其他业务页面仍使用公共Shell。六份外部附件的原文归档在docs/reference/lingshu-v1；Vue建议不触发技术栈迁移。


## 本机演示适配层

2026-10-22：P003新增src/auth-session.js和pages/shared/LoginSession.jsx，复用旧后端同源login/me/logout及独立HttpOnly Cookie。公开构建配置VITE_AUTH_TENANT_SLUG只固定本部署租户slug，不能由query或localStorage覆盖；未配置明确不可登录，不回退演示成功。正式登录目前留在身份/授权摘要卡，不把未接线的本机研究列表当正式数据。测试通过受控本地Vite proxy接新建合成Auth测试壳，未改变生产CORS/路由或全局platform-user/header。生产反代和完整工作台接线仍待对应部署/业务验收。

`src/route-context.js`控制允许的跨页标识与站内返回；`src/demo-research-store.js`统一本机读写、版本和复用来源；`src/platform-frontend.js`消费公共搜索/通知/菜单事件。PublicPages独立门户布局，WorkflowPages复用公共Shell。既有详情在有自定义研究上下文时展示对应本机对象，没有对象上下文时保留历史示例。真实服务需要独立认证、授权与数据接口，不能把localStorage视为后端或安全边界。
## 2026-11-16 · AI01视频首片（本机合成技术交接）

原AgentMaterials文件入口按当前mediaEnabled分流视频到AgentMedia；PDF/CSV/XLSX保持原路径。useAgentMedia以client/账号/会话generation隔离，保留同身份续期中的选择；pending仅保存原requestKey/uploadId/阶段等元信息，完成未知先查原回执并继续原归档，不存字节或另建副本。播放器只在主动展开后挂载，沿同源Cookie/Range读取，style限该列表，字号14/22。后端复用原分片/签名/存储/媒体结果分类，单表FORCE RLS及当前父链/版本/流重验；实际六文件、恢复/撤权和原上传回归见[验证报告](../testing/ai-video-2026-11-16.md)。未更改Shell/导航/会话输入框；文件检查不能当作内容理解或被试入库。

## 2026-11-17 · 视频聊天来源

HubAgentPanel复用同一useAgentMedia对象，AgentMessages/VideoChatAnswer在原回答区渲染当前源校验后的内容及VideoSources。内部选择不进入用户meta；来源按钮先取真实evidence，再校验SHA/版本和时间，经playbackRef定位原播放器，closePlaybackRef收束失效。identity/session/epoch拒绝迟到响应；仅聊天引用滚动原player，旧video操作保持。来源/body均14/22，精确帧时间由后端微秒确定性格式化，ASR明确近似。真实两账号1440/390与五宽组件完成，不以构建替代浏览器。
