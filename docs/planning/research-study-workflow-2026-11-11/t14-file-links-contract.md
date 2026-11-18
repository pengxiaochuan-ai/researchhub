# T14 文件与访视来源契约（实施中）

## 真实模型和边界

复用 M09 `IngestService` / 既有对象存储和任务发布，不新增平行上传或处理器。原始文件为 `ModalityFile`，其 `subjectVisitId` 可固定到访视；`ProcessingTask` 固定 `modalityFileId` 及 Study scope；`Feature` 可同时固定 `sourceModalityFileId` 和 `sourceProcessingTaskId`。`ScaleResult` 目前只有被试及可选版本，没有访视外键，不能按日期推定其访视。旧的 `ingestPreprocessed` 直接特征行尚未写文件或任务来源，历史数据应为来源未知；不得推断或回填。处理状态、文件存储状态、质量告警与特征是否存在分别展示，不将上传当成已处理或质控通过。不得调用退役音视频处理器。

## 当前须修的绕过

`refreshSystemVisitRequirements` 现按被试及时间窗选择文件和量表，`completeVisitInTransaction` 会使用其结果；同日多访视可能共用证据。正式访视文件仅由明确 `subjectVisitId`、同一被试和当前非删除文件满足；量表尚无固定访视来源时保持 missing。历史验收夹具维持原契约。获取候选后在当前事务锁文件并重读，完成也重新校验。已完成历史访视没有固定来源的状态应显式未知或需复核，不能伪造既有事实。处理和质控不能由文件存在推断。

## 最小接口

新增 `createFileLinksService({studies,core})`，由正式 Study 事务解析 scope；`list(user,studyId,visitId)` 验证当前 read 权限、真实访视/入组/方案/当前研究与数据用途同意，返回该访视显式绑定文件、该文件真实范围内任务及与两者一致的特征来源引用，保持分页有界。对任意文件进行详情查询时再次重验 tenant、被试、访视及任务父链；对缺少完整双重文件/任务来源的旧特征标 unknown，不能自动归属。无需暴露存储密钥、文件字节、特征值或受试者联系方式；上载及处理仍通过旧正式入口。

文件/任务/特征引用不是凭日期成立；跨 Study、另一访视、错误父链、删除文件、撤回同意都拒绝或显示受限。读取状态应在源锁后重读，不能以客户端提供的 ID/状态为可信来源；不对任务发起隐式二次派生。写入链由旧入口同一事务保存有效来源；预处理直传属于不同旧路径，需要单独保留与区分其来源，不能假称已有处理任务。若确需新持久结构，先审候选与回滚而不执行 DDL。

## 验证和交付范围

单元及受保护合成 PostgreSQL 覆盖同被试两访视同日不串证、文件→真实任务→特征、无源未知、跨 scope/删除/撤回、重复读取无写、并发锁后重读、旧入口兼容。实际处理文件及网页/HTTP 未验证前不宣称生成特征或四层验收完成。T14 当前实施中。

## 首批实现与未覆盖范围

正式文件必需项以同访视非删除、存储键非空且登记了 SHA-256 的文件为证据；完成时保留文件 ID 和登记摘要。已完成访视的摘要改变、文件被删除或改绑后标 `requires_review`；旧事实无摘要及未固定访视的量表为 `legacy_unversioned`。该摘要为登记的来源摘要，尚未通过对象存储重新读取验证内容。文件状态只反映文件登记状态，不表示处理或质量放行。

原同步 `ingestPreprocessed` 的特征行导入在原事务新增实际导入任务 `preprocessed-feature-import`，记录 `parseFeatureFile-v1`、输入 SHA-256 和缺失/告警数量；新 Feature 固定文件与该导入任务。该任务代表导入与已有字段解析，不代表运行科学算子。绑定正式访视时当前参与同意不可缺失，同源同元数据重复请求复用导入事实；无访视旧归档不依此限制。对象存储写入仍先于数据库去重；事务内明确业务拒绝或重复返回时会按本次唯一对象键尝试清理；事务提交结果未知时保留对象，避免删掉可能已提交的来源，清理失败或进程中断仍可能遗留孤儿，不能声称对象存储与数据库原子或完全幂等；受保护 PG 使用存储替身，只证明解析与持久链，不证明真实对象上传或处理。

正式只读接口 `list(user,studyId,visitId,{limit?,cursor?})` 在授权事务锁后查明确绑定的文件；每项的 `sourceRef` 为固定文件摘要（无来源则 null），真实任务附 ID 与 updatedAt，真实 Feature 附文件/任务及内容摘要；输出不含值、存储键、邮箱或答案。任务若是本次预处理导入，可见真实报告缺失/告警数，否则质量状态 unknown。`unassignedFeatureCount` 是该被试缺失文件或任务引用的历史特征数量，并非推断属于此访视。每页最多 100 文件、500 任务及 500 特征，超出明确阻断；分页游标绑定身份、Study 与访视。当前只实现列表读侧，不提供随意把旧文件改绑或新造上传入口。

来源读取适配器由 root 注入 `createFileLinksService({studies,core:{readVisit:readFormalVisitInTransaction,lockBinding:lockCaptureBinding},cursorSecret})`；`list(user,studyId,visitId,{limit?,cursor?})`。来源引用目前供读取和比较；未实现将任意客户端引用作为新写命令的通用验证入口。任务和特征摘要版本标记 `t14-source-v1`，发生变更时需重新读取，不能靠客户端 hash 获得授权。

## 正式访视预处理数据提交（下一增量）

提供独立受后台身份和同源写保护的正式 Study 控制器，绑定 `studyId` + 明确 `visitId`，只接收用户已预处理 CSV/JSON 特征行，严格大小上限与文件扩展名、内容类型；不启动任何音视频检测或额外算子。用户无须填写被试编号、存储键、摘要或内部 ID：后端以当前授权的访视真实父链解析，并重验真实 Study binding、账号、data.upload 权限、当前参与同意和方案。涉及字节的对象存储 I/O 与数据库事务不可原子，上传前检查、事务内锁后复查及明确业务拒绝后孤儿清理同时保留；存储失败不得伪造成功。

新动作采用 `requestKey`，原子操作回执与文件/导入任务/Feature 同事务；回执绑定 actor、Study、visit、动作及输入摘要，相同 key 不同内容冲突，失权优先于回执；响应丢失允许只读回执恢复（404 表示未知），不可隐式再次上传。重复相同数据的不同 key 复用既有文件/任务/特征，但每次操作都有自己的合法回执。回执与授权在发布事务中重验，不输出文件内容、存储键或值。

对象来源状态分为登记摘要与读回校验：上传后在对象存储流式读取并重新计算 SHA-256，只有匹配才报告已验证；不存在、不可访问、大小超限或不匹配必须明确失败/未知，不能当成完整文件证据。不能仅依赖存储元数据或客户端摘要。ScaleResult 暂无精确 visit 关联结构，本次通用文件验收不适用；该限制不等同完整 ScaleResult 支持。

写后对象读回校验实际匹配时，在当前 Study/参与同意授权和文件行锁下保存 `storageVerifiedSha256`、`storageVerifiedAt` 并写审计；正式文件必需项和完成状态同时核对登记摘要与该验证事实，未验证保持 missing。`GET` 回执仅再次流式检查当前字节并报告，不修改验证事实；若之前存储不可读，用户可在核对回执后使用同一 key 明确重试，以重新执行读回验证。该标记证明某时刻读回匹配，并非保证对象此后绝不会在存储侧变化；后续实际读取仍应重新核验。对象读回限定 128 KiB、5 秒，超时或失联为 unknown，不伪报通过。

## 独审发现与正式入口修复合同（2026-11-12）

独审在全新、整体回滚的保护库 fixture 实际复现：旧 parseFeatureFile 会把 JSON 空字符串/布尔/数组转成 0/1/0，把 CSV 非零下溢和不安全整数改为 0/舍入值；正式入口必须单独严格解析，旧未带 formal 的 API 本次保持兼容。新增正式解析器支持 CSV 引号/转义/列数和明确已支持 header，JSON 数组或 features 包、既有 snake/camel 字段别名。错误须整批拒绝并返回不含用户内容的行/字段位置；不丢行、不猜字段、不把非法值归为合法 missing。JSON value 仅数值或 null（可缺 value 表示未记录），不允许字符串/布尔/数组数值化；CSV 空值和 JSON null 为显式缺失并沿既有 processing_status 报警，0 保留。数字原始 lexeme 与 Number 的最短十进制表示不等价、不安全整数、非有限或非零下溢均拒绝。JSON 必须在 JSON.parse 前检查字符串外的数值 lexeme，避免精度已经损失后才验证。单位/算法/医学阈值仍不由系统猜测。

第二反例：完成文件摘要 A→改 B→显式重核 B→恢复历史 A 时，旧实现接受任一历史 ref 而误报 current。完成完整性应以最新一次明确重核的该文件要求/模态引用为依据；历史 refs 继续保留，不能通过匹配旧 ref 自动恢复 current。当前最新 B 不变时为 current；随后 A 或另一摘要须 requires_review 并重新显式核对。没有固定摘要或存储验证事实仍保持未知/需复核。独立反例证据为 `.tmp/t14-independent-probes.test.mjs` / `.tap`；其 2/2 是确认反例存在，不是修复验收。主循环已授权独审者在该窄范围转为实现者，修复后须由主循环或原作者另行审查，不自称独立审查通过。

### 修复实现与冻结边界

正式严格解析器为 `parseFormalFeatureFile-v1`，解析器版本进入 formal 导入去重键和命令请求 hash；旧未带 formal 的导入保留原解析器及原去重键，不把旧宽松解析结果冒充本次严格解析。相同字节、相同正式 parser 的不同 key 仍复用一次导入事实；不同 parser 的旧事实保持历史并形成新的明确来源。JSON 数组或 features 包每条必须有非空 feature_key/featureKey，value 缺失/null 显式登记 missing；支持现有元数据别名，未知键、重复键/别名或不合法元数据拒绝；可选文字元数据为字符串/null，confidence 为有限且精度可保真的数值/null，空 CSV 元数据表示未知，不自行推断单位。每批最多 1000 特征行、128 KiB。

新文件完成 refs 显式记录 modality；重核还固定 visitRequirementId。完整性按追加顺序选该 requirement/modality 最新依据，核其当前精确父链与存储验证摘要；旧无 modality 的固定 ref 只从保留的真实文件行判别模态，缺行拒绝。不匹配最新依据时保持 requires_review，最新 ref 无固定摘要为 legacy_unversioned；历史 refs 原样保留。

实现者完成 19 单元、6 保护库 PG（其中真实 MinIO 读回）、补正后的严格上传 PG 和全 server noEmit；全部新业务 fixture 最终回滚，对象清理，未改主三人基准、未做 DDL/重载/SMTP。保护库仅证明服务与来源，不是 19501 HTTP/页面或业务四层完成。具体修复与证据见 `t14-file-links-review.md`；源码冻结及日志在 `docs/testing/evidence/research-t14-2026-11-12/fix-freeze.json`，须由主循环/原作者独立复核后再集成。
# 页面安全能力投影补充（2026-11-12）

原回执增加显式`POST .../visits/:visitId/files/receipts/:requestKey/verify`，body为空对象。只使用同actor既有回执的精确file/task/sourceSHA，在当前权限和用途下读保存对象，登记核验与审计；不调用Ingest，不重建文件/任务/特征。未知404不写。`storageIntegrity.recorded`区别当前读回成功与服务端已登记的核验事实；仅verified且recorded可完全确认。刷新只保留最小原键即可恢复，用户不必重传文件。GET仍不登记核验标记。

GET files 在同一真实授权/参与条件事务内调用现 authorizeIngest，返回 capabilities.canUploadPreprocessed；装配状态另以 preprocessedUploadStatus=available/unavailable 明示。无导入权限仅影响上传入口，仍按现readVisit授权查看文件，不把查看权当上传权。任一非权限型错误继续失败，不伪装可用。实际写入端仍完整独立重验，投影不能作为上传授权凭证。

处理任务和特征只在精确文件展开区域回链至本页固定父链锚点，不误用S08研究任务ID。当前不提供不存在的独立详情路由，不恢复退役检测算子。


### 文件来源有界分页增量（2026-11-12）

合法单文件可含 1000 条预处理特征。文件列表不得因全页来源数超过 500 而整体失败：每文件、任务各返回准确 `taskCount` / `featureCount`，默认最多嵌入 20 个任务及各任务最多 20 个特征，分别给 `tasksNextCursor` / `featuresNextCursor`，保留既有来源引用算法与不暴露值/存储键约束。新增 `listTasks(user,studyId,visitId,fileId,{limit,cursor})` 与 `listFeatures(user,studyId,visitId,fileId,taskId,{limit,cursor})`，1–100、默认 20，按 ID 升序、精确总数和 `nextCursor`；HMAC cursor 绑定租户、actor、authVersion、Study、visit、file 和（特征时）task。每次实际 Study 授权、固定访视及当前同意重验、文件共享锁和精确父链后才查询；非法跨父游标拒绝。不是创建处理事实或修改已有 1000 行上限，列表不会回传特征数值或存储位置。分页是当前读取而非跨请求快照，来源并发更改时须重新核对；后续正式 consumer 仍依现有来源 ref/hash 守门。

续页 DTO 补充：`listTasks` 和 `listFeatures` 均返回锁后当前 `fileSourceRef`；`listFeatures` 另返回当前 `taskSourceRef`，与文件列表中各自嵌入来源引用完全同算法。客户端比较已加载的父引用与总数，变化时丢弃已加载分页并重新读取。引用不替代每次当前授权、同意、scope 和父链校验；不可核验的文件引用仍为 null。
