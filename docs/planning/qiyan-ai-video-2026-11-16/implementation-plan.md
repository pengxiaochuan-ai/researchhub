# 岐研AI视频首片实施计划

> Agent执行约束：沿当前目录串行实施＋一次独立代码总评审；用户已明确批准本规格及MV01–MV03。只实施本片，不恢复其他计划或退役检测。新表及目标19501六文件本机技术验收已完成；[证据与限制](../../testing/ai-video-2026-11-16.md)。用户专业签收、内容理解与正式发布另行进行。

目标：沿原AI01上传入口，使本人视频可私有归档、播放、检查及刷新恢复。

架构：复用旧ChatChunkUploadStore、流式签名/SHA检查、StorageService和媒体结果解析；仅新增Hub媒体关联实体及受控适配，不装配旧AppModule或历史扫描Worker。

技术栈：现有React/Vite、Nest装配、共享PG合成副本、现有私有对象存储、已安装ffprobe。无新云服务或Provider。

规格：[qiyan-ai-video-ingestion-2026-11-16.md](../../product/qiyan-ai-video-ingestion-2026-11-16.md)。

## 全局边界与状态

- 单文件500MiB、分片1MiB/最多3并发；每次最多20份选择仍受账号暂存配额，文件串行。首次只MP4/MOV/WebM，不因raw入口支持MKV便自动扩会话格式。
- 仅当前专用合成库/原两账号/MV03新对象；旧源码、旧数据/账本不改。原上传失败修补和其他会话的工作保持。
- 保持Shell/导航/会话布局；文件列表中按需播放。常规上传不新增用户确认，正式被试关联尚不开放。
- 内容理解没有可用执行链证据，不发模型；不恢复VA/星辰检测。能力状态以四层证据为准。
- 所有新增DDL/GRANT严格显式执行，不在启动自动迁移；MV01–MV03已获批准，迁移仅在专用合成库执行。

## 重点反例

1. 同身份文件框focus触发重核时保留选择；真换会话/账号不续传/不交付旧视频（V03）。
2. 归档完成、检查失败和浏览器编码不可播相互独立，不显示虚假“解析完成”（V02/V04）。
3. 对象PUT成功但PG/响应丢失，首次PUT前完整SHA已CAS冻结；重写分片不能换源。初始化uploadId提交未知不能取消已绑定清单，原key查回、不新建文件、不删除未知原件/清单（V02）。
4. 原分片完成缓存不能绕当前授权；读取前/打开流后版本重验（V02/V04）。
5. ffprobe读取上传容器必须只用允许的本地协议；不让媒体解析变成隐式网络访问（V01/V02）。

## V00 复用核查与授权材料

- [x] 核对当前上传/检查/播放源码及退役策略，区分历史检测和当前可用链。
- [x] 新合成有效/损坏MP4调用真实原签名检查＋ffprobe；12相关原测试通过，0网络/PG/模型。
- [x] 写完整规格、1表字段/约束、接口、MV01–MV03与验收；不执行DDL。
- [x] 一次只读规格独评0 Critical/2 Important；已明确首次PUT前冻结完整SHA、初始化绑定未知先查回不取消，补V02测试落点。仅合同修订，不冒称运行时验证。
- [x] 用户明确批准MV01–MV03；不为同一表/权限/六文件重复提问。内容理解未找到不阻塞本片归档路径。

## V01 数据实体与当前授权（约0.5天）

文件：新server/ai-agent/session-media-schema.sql、session-media-schema-pg.test.mjs、session-media.mjs、scripts/ai-session-media-schema.mjs；复用scripts/local-session-materials.mjs当前授权上下文，媒体动作单独白名单，不复制IAM。

接口：createSessionMediaAccess(...).transaction(user,sessionId,operation)重取当前主体/Agent/file.read；schema只MV01对象。输出可信scope，禁止由前端提供tenant/storageKey。

- [x] 先写RED：RLS/真实会话父链、不可变归档、CAS、错账号与状态拒绝。
- [x] 实现精确SQL及守门；先合成库事务内验证完整回滚，再执行一次批准迁移并存schema hash/receipt，未知漂移即停。
- [x] 检查新表app权限、本片不修改public/既有rh_ai表/角色；真实验收前后既有业务/账号/账本摘要保持。

## V02 分片、归档回执及检查（约0.5天）

文件：新server/ai-agent/session-media.mjs、session-media.test.mjs、session-media-pg.test.mjs、scripts/local-session-media.mjs；装配scripts/local-knowledge.mjs的独立控制器，status在scripts/local-knowledge-ai.mjs反映实际可用能力。

接口：规格§5七组动作；createSessionMedia({access,storage,chunks,inspect}).initialize/chunk/complete/receipt/list/recheck/content，HTTP适配只认已定义body。

- [x] 先写RED：相同key/异输入、分片字节/配额、空/伪扩展、500MiB边界、当前撤权、未知完成回执及存储故障；必须含首次SHA提交未知时PUT=0、PUT成功后重写同大小分片被拒绝且旧对象不变、uploadId已提交但响应丢失时cancel=0。
- [x] 包装原ChatChunkUploadStore/inspectChatUploadFile/StorageService；不调带旧Guard假设的Controller，不改旧库。
- [x] 本机限定执行适配复用原parseFfprobeOutput/classifyFfprobeFailure，固定媒体本地协议/格式、30秒超时、1MiB输出上限；无任意shell/URL参数。检查状态CAS提交，不持PG锁运行ffprobe。
- [x] 真实PG回滚/存储故障与并发完成集成；只认领本次explicit对象，旧历史不扫描。

## V03 AI01同一上传入口与状态恢复（约0.5天）

文件：新src/session-media-session.js、pages/shared/AgentMedia.jsx及对应tests/session-media-session.test.mjs、tests/agent-media-browser.test.mjs；改pages/shared/AgentMaterials.jsx、HubAgentPanel.jsx的格式分流和当前能力传递，必要样式限原文件列表作用域。

接口：useAgentMedia({client,identity,sessionId,paused,enabled,getSession})；视频不混入privateMaterials文献快照/CSV预检；pending只保存原key/uploadId等元信息，不存视频字节。上传能力以当前status为准。

- [x] RED覆盖chooser/focus、会话懒创建、暂停核验、真换身份/会话、撤权、丢回包/刷新恢复、不重传与清晰错误。
- [x] 原按钮分流mp4/mov/webm；进度取真实字节，保留原PDF/CSV/XLSX流程；不扩知识解析器格式或伪造KnowledgeDoc。
- [x] 固定当前媒体来源/版本交付，内容请求未解析明确说明，不静默忽略视频；原材料/表格上传和纯问答/输入组件回归，无新增付费AI问答。

## V04 受控播放与真实双账号联调（约0.5天）

文件：pages/shared/AgentMedia.jsx播放器；scripts/ai-video-live.mjs、tests/agent-media-browser.test.mjs；证据独立.tmp/ai-video-2026-11-16/目录。

- [x] Cookie原生媒体请求不带自定义scope头仍正确授权；原Range解析器复用，合法Range和失权时未交付流关闭/迟到不串用有实际或PG回滚证据。
- [x] 在已批准MV03范围真实MP4/WebM播放/拖动；损坏原件保留/不可播提示、全新页面刷新列表、原key无副本，记录真实HTTP/PG和截图/WebM。
- [x] 1440/1366/1920及原生200%字体/焦点/滚动检查；现有响应式约束如实记录，不顺带全站改版。

## V05 一次独立总评审与交接（1天缓冲内）

- [x] 限本片一次只读独立评审，主实施集中RED→GREEN修补，保留原结论；不因评审扩共享底座或恢复退役链。
- [x] 单元/合成PG/真实API与Chrome、原文件/表格回归及独立构建；比较既有业务/账号/账本，本片未编辑旧源码。误跑旧测试精确撤回及旁路摘要不变有独立记录。
- [x] 更新product living spec、baseline、changes、06版本、使用说明、专项技术/测试及Notion；四层证据分别标记，不以测试绿代专业验收。

约2工作日实施＋1工作日缓冲；等待授权/共享入口空窗的时间单列。内容理解只保持需求与核查记录，不在V05声称已交付，也不自动扩新服务/费用。
