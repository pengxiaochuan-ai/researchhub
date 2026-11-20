## 2026-11-19 · EEGLAB原件上传与访视归档

原访视“到岐研AI上传”及原“上传文件”支持EEGLAB SET内嵌与SET+FDT配套；一次选组、自动带入研究/受试者/访视、一次确认登记，再回原访视或受试者详情下载完整原件和查看登记记录。MAT v5–7.2/7.3、原成员名/字节/引用、逐成员SHA与整包SHA保留；缺件/引用或尺寸错误阻断登记，eeg/raw/needs_review不自动运行预处理或算法。SET≤100MiB、完整包≤500MiB，上传前应在EEGLAB去除身份信息并重新保存；同名同尺寸FDT仍由采集人核对同次导出。 沿既有session-media/source/ingest/content链，只扩原2CHECK、原guard及ready receipt。当前[接口与本机启用](eeglab-ingestion-2026-11-19.md)及[验收](../testing/eeglab-ingestion-2026-11-19.md)为准；旧视频/舌图/语音记录保留。

## 2026-11-19 · 语音接口增量

原session-media链已扩WAV/MP3/M4A，复用原键/双端当前授权/归属/Range读取；本机原2约束/guard精确升级，无新表/角色/ACL。旧图片/视频兼容，当前技术依据见[语音契约](audio-ingestion-2026-11-19.md)，以下保留前两批接入记录。

## 2026-11-19 · 舌图接口增量

原session-media链已扩PNG/JPG/JPEG，与原生权限/原键/来源/研究侧读取复用；本机原2约束及guard精确升级，无新表/角色/ACL，原视频兼容。当前技术依据见[舌图契约](tongue-image-ingestion-2026-11-19.md)，以下保留前一批四页接入记录。

# 研究数据与岐研AI联动 · 接口及本机装配

2026-11-19。范围、入口和字段来源以[产品衔接表](../product/study-data-linkage-2026-11-19.md)为准；[验收](../testing/study-data-linkage-2026-11-19.md)。只涉及既有Study/被试/访视与AI链，不新增一级页面或平行数据模型。

## 读取与能力

新增`GET /api/research-studies/:id/subjects/:subjectId/data`，query白名单`section=files|tasks|features,fileId,taskId,limit,cursor`；返回`schema=hub-subject-data.v1`、真实Study/Subject、`capabilities.canReadClinicalData`、`clinical`与`data`。分页游标签名绑定当前身份/authVersion、研究、被试、section/父文件任务及limit；逐次核对作用域与来源，不能用上一页能力代替当前权限。

复用`subjectPermissionsInTx/createSubjectReadAccess`：普通subjects可读或原精确导入/媒体对象范围，仅证明对象可见。只有当前原生data权限/真实租户管理员才返回Subject/SubjectProfile白名单；无此权返回200且`clinical.status=data.status=restricted`、临床内容null及空数据页，不当作“没有数据”。完整原件/任务结果、存储键和其他人的私有会话不透传。

无visit原件单独列出；按显式file/task父链读取处理状态及特征元数据，不输出无visit数值。多人档案Excel原件可能挂carrier，当前档案取实际SubjectProfile，不能由carrier推断其他人的原件归属；完整历史确认批次仍从本人原AI回执查看，本轮未新建跨会话索引。原件页的任务/特征计数使用2次批量读取，避免20行最多40次串行count。

原S09 `/visits/:visitId/files[/.../tasks/.../features]`增加显式`canReadFeatureValues`。当前data权、原访视读取/同意锁、文件SHA与存储核验、显式file→task→feature父链且task完整完成时才投影`value/unit/sourcePipeline/extractionVersion`；无权保原来源-only。0保留，null表示缺失，非有限值标`valueStatus=invalid`，不补0。前端还同时核对最新fileAccess能力，后台重读撤权/未知不增revision也立即清值，并让在途分页失效。

## 导航与AI

S03/S04/S09仅用允许的`#study-data/#subject-data/#capture-files`定位，不把hash作为业务授权。AI query增加严格层级`uploadStudyId → uploadSubjectId → uploadVisitId`；拒绝重复键、跨文档模式和任意returnTo。Study真实响应是`{item}`，被试响应为`{subject,visits}`；二者验真后才显示归属。登录、会话续接、创建会话和重开同会话保留；主动切其他历史会话清除采集默认值。

视频再由`GET /sessions/:sid/media/:mid/ingest-targets?studyId=...`核原生合法目标并预填；query只允许单一studyId。已知研究仅核该目标，原装配PG候选622ms（此前全目录约10秒），不冒称浏览器整体耗时。已有current/pending操作优先，新的URL线索不能改写原意图；单视频会自动展开登记区，验收不可假定还需点击“关联研究”。

CSV从研究入口上传时保留已核Study intent；独立CSV和资料上传保原行为。批量被试/访视仍按文件与确认预览，不用导航线索覆盖各行。AI内部返回、其他站内导航受共享确认保护未发送问题/未确认选择，取消保输入与焦点；确认离开不重复beforeunload，refresh/close仍保浏览器级保护。未知结果沿原key只读核对，不自动重放。

## 视频原生权限适配与数据库保护函数

`createSessionMediaIngests`可注入动态目标及来源resolver，缺省仍旧固定契约。`local-session-media-ingests.mjs`显式启用当前本人Hub来源/真实Study/原生ingest权限；源父链取当前合法actor，旧登记按已保存源group/project重核并恢复目标GUC。无native权继续旧boundary、精确grant及本人被试限制；native实际有权才允许合法同Study非creator被试。保原同意、入组、方案、访视状态/排期和回执，不新增临床时窗规则。

既有DB函数`rh_ai.check_session_media_ingest()`原先始终限制creator。候选`server/ai-agent/session-media-native-target-guard.sql`仅在DB内核对active账号/租户、active目标组/项目、当前角色/成员与JSON数组data/data.upload、精确id/authVersion后，允许native非creator；grant仍creator。缺kind/NULL/unknown/缺version、伪native、错源/跨账号与停用组均拒绝。保原不可变字段、原件SHA、父链、状态、回执和GUC恢复。

升级helper：`scripts/ai-session-media-native-target-guard.mjs`，导入无DDL副作用；导出`upgradeNativeMediaTargetGuard(tx,env,{direction:'up'|'down'})`和`assertNativeMediaTargetGuardReady(tx)`。只准守门本机`wp01_test_full_baseline`，核旧catalog/baseSQL、事务/咨询锁、精确候选body及ACL；仅CREATE OR REPLACE函数+原schema comment回执，不增表、角色或grant，不改原业务行。down须匹配已应用候选，恢复原函数/comment。生产/云/其他库没有应用。

本轮精确候选摘要（helper的materialDigest口径）：`d2c3e45756b1b0f53764b3a08969e7e44f140edf5c1e3ee665ea19afe05c68bd`，revision=`native-authorized-targets.v1`。已在本机应用并核就绪，实际catalog见`native-guard-applied.json`。独立源/迁移正反例先全ROLLBACK，再由根应用；目标装配强制核新guard，不能降级跳过后宣称采集可用。

## 运行与限制

19501仍唯一前端端口，原owned运行受控重载；重载前核0活跃分析、0模型有效租约/现consumer任务；175历史队列和8已类型化暂停保留，不恢复旧任务。重载182表原行摘要一致。新的通用合成验收仅增加一来源会话、一视频上传、一原件、一登记及原审计，无模型/科学处理/访视完成写入；[逐表保护证据](../testing/evidence/study-data-linkage-2026-11-19/preservation-final.json)。

当前共享入口支持CSV/XLSX研究表格、MP4/MOV/WebM视频；独立舌图、音频、EEG/fNIRS原始文件不在共享上传范围，本轮不扩算法。原始文件登记不等于指标生成或质量放行。当前visit-QA研究的既有分析计划接口仍返回409，本轮只加同Study数据回链；普通/整课题原分析分支契约保持，不以回链验收替代统计计划配置。1024实测整页仍宽1280，新数据区自身不溢出，未改全局Shell。
