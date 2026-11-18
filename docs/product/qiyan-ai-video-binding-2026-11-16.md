# 岐研AI视频 · 原始数据登记与处理回执

2026-11-16。用户已确认“两者都要，先旧流程再接内容理解”，并已批准本规格、六步计划及MVB01–MVB03。**VB01–VB06已完成本机合成技术交接；用户业务签收与正式部署另列。** 两份既有合成原件已分别登记到本人被试，一例不关联访视，一例关联既有访视；两账号真实Chrome、并发防重、未知结果恢复、SHA/Range/播放/刷新及17项边界验证通过。756纯测、47后端/PG、52浏览器及5.38秒构建通过；独评2项P2已复现修补。没有新增媒体原件、旧处理任务或模型调用，尚未实现语音转写和画面理解。[四层证据与保护边界](../testing/ai-video-binding-2026-11-16.md)。

## 1. 目标与顺序

先完成：上传 → 自动显示真实文件检查结果 → 一次确认研究/被试及必要访视 → 原件登记到被试数据 → 显示可恢复、可追溯的处理回执。内容理解在此之后接入真实执行器，另核定模型/算子、数据流、费用及权限，不在本片调用。

首片仅关联**既有被试和可选既有访视**；不从原始文件名猜身份，不隐式建被试、入组或建访视。没有合适被试时保留会话归档，提示先按现有建档流程准备；没有必要访视时允许明确的“未关联访视”，不编造采集日期或自动完成访视。

## 2. 已核实的复用与限制

| 对象 | 复用方式 | 不直接照搬的原因 |
| --- | --- | --- |
| 已归档视频 | 使用服务端当前本人mediaId解析真实storageKey、SHA、大小及检查结果；登记引用同一私有原件 | 客户端不得传storageKey/原路径；不再上传或复制原件 |
| 旧IngestService.ingestStoredRaw | 复用原件登记字段、假名命名、媒体分类和ModalityFile；处理结果引用Hub已真实执行的媒体检查 | 方法内部独立事务、可能隐式建被试、kick通用队列，不能直接包一层冒充Hub原子提交 |
| P05表格导入 | 复用源会话/目标Study分离、准备快照、一次确认、当前授权锁、父链验证、事务/GUC恢复及未知结果查询模式 | 旧许可仅profile.create/visit.import/result.read，不能当作视频登记许可，表格/CRF接口不改 |
| 旧文件检查 | 复用inspectMediaFile的容器/时长/音视频流分类；读取已真实执行的当前检查结果 | 不启动旧后台扫描，不伪造ClaimRef；needs_review不是人工批准、内容理解或特征生成 |

代码依据：`app/server/src/ingest/ingest.service.ts`的ingestStoredRaw/withUploadPublication，`ingest/raw-processing.service.ts`的processMediaTriage，`ingest/ingest-authorization.ts`；Hub `scripts/ai-research-data-import-native.mjs`及`server/ai-agent/research-data-import-access.mjs`。

准入只读核对时，目标Study `rh-study-b3fa8c8d-b861-454e-8733-5ccbcce8f090`，执行项目`cmwcc7ft60002lua6zkvh0mxj`，有3项访视计划；owner是有效成员但没有data菜单/data.upload，admin具备原生租户管理员身份。**没有为登记修改整个研究组角色或开放旧上传接口。** 用户随后批准MVB01–03，已仅给owner发行本片独立对象许可，admin沿用原权限；原MV02禁止的data.upload/subject.bind仍未授予。原始准入记录在私有`.tmp/ai-video-binding-2026-11-16/read-only-preflight.json`，该准入步骤本身没有数据库写入；后续获批新增详见验证报告。

## 3. 用户已批准的路径与局部UI差异

沿用AI01当前布局、上传入口和“本会话视频”区域，不改Shell、历史列表、对话区或右栏，不新增准备弹窗、固定开发说明或独立向导。

1. 上传后，原视频区域显示实际检查结果：原件已归档；容器是否可读；是否有画面/声音；实际时长；损坏/超时/不支持的明确分类。无音轨是事实，不单独认定为坏视频；登记为video必须有已核实视频流。损坏/超时/解析失败/流未知不进入登记，沿原检查恢复；文件检查不表示医学质量达标。
2. 尚未登记的有效视频，在该区域展开一个内联确认区。真实研究只有一个且有权时预填，名称保持可见；多个候选且无可靠上下文才选择一次。被试只列当前Study有权对象，访视仅列该被试实际可用项；有可信既有上下文时预填，否则不猜。真实采集时间可选，不以上传时间代填。
3. 唯一提交主动作“确认关联并登记”。该动作即明确决定，不再弹同义二次确认。切Study/被试使旧访视及确认计划失效并重新准备，安全输入尽量保留。
4. 成功后原位收起确认区，显示研究、被试编号、可选访视、登记成功、检查结果和下一步；任务ID/版本/hash只在按需详情中出现。被试详情现有“相关文档”卡展示本次有权视频原件/回执（无访视也可查看）；已有访视读取权限者仍从原访视文件区查看同一记录；管理员同源读取，不另建治理总览模块。
5. 失败保留输入，显示具体问题及恢复动作；断网/超时结果未知时先核对原操作，不重新登记。不允许把排队、needs_review、未关联、未转写伪装成全部处理完成。

### 3.1 无访视与有访视的读取闭环（独评R1）

已核实：`server/research-execution/subjects.mjs`当前detail没有原件列表；`research-capture/file-links.mjs`必须有有效visitId。不能声称登记后自然出现在既有详情。本片明确补以下定向读取，纳入MVB02及UI批准范围：

- 被试详情`ResearchSubjects.jsx`仅替换原“相关文档”卡的空态内容，显示本次committed视频条目、可选访视、检查结果，以及“查看回执/播放”操作；无数据仍保留原空态。卡名、位置、宽度、其他正文及操作不改。AI回执提供进入该被试详情的安全站内链接。
- 新只读投影按tenant/当前actor/Study/Subject及登记许可过滤本片关联表，核对真实ModalityFile未删除、原件SHA/父链、源本人会话及当前result.read。不以P05仍有效代替本次许可；必要的被试详情读取由独立limited-media-read回调只开放该被试最小身份与已许可访视，不开放其他被试、CRF答卷或临床字段，不改P05原回调语义。
- 有访视且原本有访视页读取权时，在`CaptureFiles.jsx`原文件条目附同源检查投影，不造任务；无访视页读取权者仍可从被试“相关文档”查看获准原件，不因登记文件而扩大通用访视/CRF页面权限。
- 播放/Range及回执使用新的对象级读取桥，交付前重新验证源/目标两端授权和版本；复用原流读取/关闭规则，不返回storageKey或302跳转到绕过目标校验的内容URL。权限撤回、软删、切身份及迟到响应清除原件/回执显示；仅有旧Cookie不继续交付。

## 4. 最小数据与接口

不改public schema及旧系统代码。本机专用合成库已在rh_ai新增以下2表；未迁移临床或生产库：

| 表 | 必需内容 |
| --- | --- |
| session_media_ingest_access | 本次视频登记的细粒度许可：tenant/account、源session/group/project、目标Study/group/executionProject、明确media/subject/visit集合、capabilities（media.register/result.read）、scopeKey、version、active/revoked、expiresAt、具名授予者和审计ID；不允许空集代表全部 |
| session_media_ingests | 操作及回执：本人源会话/mediaId、准备时媒体版本/SHA/大小/检查指纹；目标Study真实父链、subject、可选enrollment/visit/protocol及真实collectedAt；requestKey、确认hash、状态/version、许可ref、快照、回执、审计及时间 |

操作状态`planned → committed`；明确取消/失效另记，未知网络结果不是失败状态。回执仅在committed存在，关联新增ModalityFileId及源媒体检查版本/尝试ID；不复制第二套任务进度，不为显示“处理过”制造一个新旧任务。源媒体身份及操作目标不可篡改；同key异内容409；首片同一媒体仅一个有效正式绑定，不允许换Study套旧回执。两表FORCE RLS及数据库父链/状态守门，隔离tenant/account、来源和目标双scope；旧public对象不加危险的级联外键。

| 接口（sessions/:sid前缀） | 行为 |
| --- | --- |
| GET media/:mid/ingest-targets | 当前有权Study及对象候选，服务端过滤；无权限不泄露私有题名/编号 |
| POST media/:mid/ingests | requestKey、studyId、subjectId、可选subjectVisitId/collectedAt；仅准备快照，不写被试数据 |
| GET media/:mid/ingests/:id | 当前授权下的确认区或原提交回执 |
| POST media/:mid/ingests/:id/confirm | expectedVersion、confirmationHash；一次确认并原子登记 |
| GET media/:mid/ingest-receipts/:requestKey | 按原key核对未知结果，不能据超时新建另一份 |

被试侧新增只读桥（`research-studies/:studyId/subjects/:subjectId/session-media-ingests`前缀）：GET列表（可选visitId和原分页契约）、GET `:ingestId`回执、GET `:ingestId/content`私有Range流。只投影本次许可的committed记录，不改旧通用数据/访视原件接口的授权或返回其他材料。

除现有本机媒体同源契约外，不接受任意URL、客户端storageKey、路径、原始姓名文件名、任意Task/Subject对象指针。前端不展示配置、接口/数据库状态或本轮开发授权信息。

## 5. 登记和执行原子性

- 首先在事务外核对实际私有对象元数据及已执行检查与不可变SHA，不下载真实视频到Codex，不持DB锁执行ffprobe/外部模型。检查未完成时沿当前媒体检查/恢复机制处理，不伪造成功。
- 准备/确认使用同一个授权事务模型：取租户授权锁，验证当前账号、源本人会话和媒体；切目标scope，验证Study binding→execution project→Subject；有访视则全验SubjectVisit→Enrollment/Subject/VisitPlan/Protocol、同意及当前采集条件。无访视不隐式创建入组。切scope后必须finally恢复GUC。
- 确认锁许可、操作及真实目标父链；重验源版本/SHA/检查指纹、许可版本/有效期、目标状态和确认hash；只允许已明确授权的源媒体与目标对象。失效即不写，不借旧Cookie、邮箱或已有计划绕过。
- 同一原件先取登记事务锁，再判断当前回执及目标可写性；原操作重放只返回原回执，其他已准备计划明确提示“已有登记”，不以唯一冲突冒充网络结果未知。合法管理员撤销许可在核验不可变范围、版本及审计后即可终止，不因来源或目标已不可用而阻止撤销。
- 同一PG事务只写新增ModalityFile、AuditLog和Hub committed回执；ModalityFile.meta保存已执行检查的来源引用及最小结果，不生成第二套处理任务或Subject级状态。原件仅引用，不重传；审计不保存原文件名/本机路径/视频字节。
- 本片**不创建任何public.ProcessingTask/ProcessingStatus、不调用旧kick、不启用通用Worker**。Hub媒体检查本身已有真实持久状态，回执直接引用该检查；新增ModalityFile标记needs_review并保留triage_only和来源检查引用。登记时间与检查时间/尝试分开，不声称登记又执行了一次检查，不生成科学Feature。只有后续真正运行内容理解时才使用对应执行任务。若既有读取链强制依赖原生Task，先提出最小读取适配差异，不伪造完成Task或启动旧扫描器。
- 提交结果未知沿原key只读核对；current事务/唯一约束保证双击、刷新、并发确认至多一个新增原件登记。旧ModalityFile若已软删不悄悄复活。登记后重新检查但同SHA只产生新检查版本，不隐式改目标或重建登记。

## 6. 最小授权（用户已批准，2026-11-16）

| 编号 | 已批准的精确范围 | 保留边界 |
| --- | --- | --- |
| MVB01 | 仅专用合成库新增上述2表及必要索引、RLS/守门；既有aisci_app只获新表SELECT/INSERT/UPDATE，无DELETE/TRUNCATE | 不改public表结构、现有角色、旧系统或临床库 |
| MVB02 | 原owner/admin、上述当前Study、本轮具名本人媒体及本人既有合成被试/可选访视的视频登记、回执及新增原件定向读取（含无访视）权。来源仍须chat.use/file.read；目标先复用现有原生登记授权，admin无需补权；仅owner不足部分新增media.register/result.read对象级许可，具名、可撤销、7天内到期；不授旧data.upload/subject.bind或其他工具 | 不扩展研究组角色、旧Agent工具列表、旧通用上传/数据接口、其他Study或历史材料；P05许可不代用 |
| MVB03 | 复用上一片owner/admin各1份已归档具名合成视频；每人仅1个本人既有合成被试及必要既有访视，下挂最多1份新ModalityFile；原生ProcessingTask/ProcessingStatus新增0条；许可/计划/审计按清单记录。跨租户/撤销/竞态等只用具名回滚夹具 | 原媒体字节、SHA及归档记录只读；原被试/入组/访视/CRF字段及历史状态不改，不新建被试或访视、不完成访视、不处理旧任务/账本 |

原生数据登记授权与新增对象级许可都只允许当前确认的动作；后者不能用于旧IngestController或旧Agent工具。MVB02的许可机制遵循P05已存在的“最小对象授权＋当前父链校验”模式，但新增独立视频许可表而不改P05枚举。正式业务不得按owner/admin邮箱兜底；本机测试清单只约束夹具，不变成页面中的临时业务收费/次数限制。批准MVB01–03也不等于授予任何模型调用、远端配置访问或真实材料上传许可。

## 7. 验收标准

1. 两账号分别完成原入口上传状态读取→查看真实检查→一次确认本研究/本人被试→真实被试“相关文档”读取新增原件/回执→刷新恢复；至少一例不关联访视，另一例在当前条件允许时关联既有访视并核对原有访视入口；不为跑通用例新增通用访视权限。原SHA/对象不复制，源会话/Study真实父链可追溯。
2. admin可看获批范围，owner只登记本人指定对象；跨账号/租户/Study、假访视/他人被试、权限撤销、旧计划/版本、损坏文件、双击/并发、断网未知和迟到结果均不串写、不复活、不重复。不新建或唤醒旧处理任务；旧对象字段/历史任务/CRF/账本保持。
3. 页面保持原布局，内联一次确认；14/22操作字号、长名/错误可读、键盘可达。单元、真实PG回滚、真实HTTP和双角色Chrome截图/录屏、构建及独立总评均有证，用户专业签收与生产上线另列。
4. 新登记配置/新表守门校验不通过时，仅登记装配不可用；原上传、文件检查和播放继续工作，原视频区域明确“视频仍可播放，登记暂不可用。”。服务端只记录安全错误码，不向页面输出配置路径或凭证；正常目标环境必须确认登记已启用，不能用该降级冒称交付。

## 8. 随后的视频内容理解

2026-11-16用户已要求开展免费核查和时间来源规则设计。[执行器核查](../technical/ai-media-executor-audit-2026-11-16.md)发现现有本机ASR可离线初始化，6个视觉模型候选但当时未加载；[转写/画面与时间来源契约](qiyan-ai-media-content-contract-2026-11-16.md)已形成建议稿。只有核查/设计完成，没有ASR或视觉推理，没有新增内容工具、表/权限、页面或部署；不改变本片登记交付边界。

第二片必须找到并接通真正的ASR/视觉执行器，输出可定位原视频版本与时间段的转写/画面摘要；无声、听不清和未处理画面如实显示。原文事实、AI推论与不确定性区分；科学数值/时长/抽帧时间仍由确定性程序提供。不恢复退役检测，不把原视频或内容送给Codex/Anthropic。实际新服务、费用、外送、云资源/远端配置、权限和解析结果入知识库范围在该片开始前核定。会话视频内容理解与被试登记是不同用途：不把所有视频（如学术讲座）强制归入被试；仅原始被试材料入库前须明确真实Study/被试关联。

本片建议2天实施＋1天缓冲。逐步计划见[六步实施](../planning/qiyan-ai-video-binding-2026-11-16/implementation-plan.md)。不承诺在尚未确定内容理解执行器时用同一工期完成全部视频理解。
