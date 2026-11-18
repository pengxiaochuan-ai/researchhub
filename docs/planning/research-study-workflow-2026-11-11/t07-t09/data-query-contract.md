# T08 正式答卷数据疑问事务契约

状态：实施中；本文件不表示 HTTP、目标环境页面或业务验收完成。沿用 `public.data_query`、`targetRecord`、`communication` 和 `closeRationale`，不另建 EDC 或自动执行 DDL。旧非正式 DataQuery 与其既有 communication 原样保留；新格式显式带版本标记。

## 引用、权限与锁

正式目标固定 `FormalResponseRef={responseId,assignmentId,revisionNo,contentHash}` 及可选 `fieldKey`，只接有不可变 revision 的已提交答卷。事务内根据真实 assignment/response/revision 查询同一租户、组、项目、被试、入组、访视、方案、FormVersion、政策与哈希，核对全部父链及字段存在于该版本 schema；不用当前答案投影代替历史 revision，也不静默改成当前版。旧执行方案只有在当前 enrollment 仍固定该已批准 executing/superseded 方案时可用。复用 `authorizeFormalResponse` 的 read、form.fill（创建/回复）与 study.review + project_manager（关闭），租户管理员按 ADR-0006；Hub owner 关系不授权限。当前参与/同意规则及正式表单 guard 同事务重验。返回最小摘要和固定引用，不暴露未授权答案。

同一授权事务内按 project → protocol → subject → enrollment → visit → query 锁定，锁后重新查源和状态；创建及回复/关闭不能接受客户端 tenant/scope/actor。状态及固定 revision 每次写入重验，退出、权限撤销、范围/方案变化在回执读取前阻断。T09 更正只是追加修订，不改变或自动关闭原疑问；关闭独立审核动作，理由必填。

## 追加事件、CAS 和幂等

`targetRecord={kind:'formal_response_revision',ref,fieldKey:null|string}`，引用及父链只由服务端核验后写入。新 `communication={schema:'formal-data-query.v1',version,events:[...]}` 递增整数版本，事件记录 action/create/reply/close、真实录入 actor、服务器时间、文本或关闭理由、requestKey 与 canonical requestHash、稳定结果摘要；每次在同一 query 行锁后追加，绝不覆盖旧事件。旧数组/任意 JSON 未被认作新结构，也不会隐式升级；legacy 查询保持旧路径。

每个写命令提供 8–160 位 requestKey、固定 ref（responseId/assignmentId/revisionNo/contentHash），回复/关闭另带 expectedVersion；create 消息必填，reply 消息必填，close 理由必填。按 tenant+group+project+actor+requestKey 获取事务 advisory 锁并在正式疑问事件中检查唯一键，同输入同 actor 同 scope 返原结果、不同目标/内容冲突。来源当前权限在查/返回执前重验；任何冲突、失败回滚疑问、事件和审计。通讯/审计只存必要用户输入与 ref，不复制答卷答案。列表按请求 limit 读取并以 id 继续分页，批量预锁避免跨被试锁倒序；详情返回版本及完整本疑问事件；无权不泄露记录存在。

旧 `createQuery/closeQuery` 必须由 formal agent 对显式标记的正式对象 dispatch 到此共同核心；对疑似 formal ref 但缺标记的输入需拒绝，不能借旧自由 JSON 或裸关闭绕过；旧普通 DataQuery 行为保留。该分发不由本文件直接修改 StudyOperationsService。

## 验证

单元及受保护合成 PG 验证合法创建/列表/详情/回复/带理由关闭、历史修订目标、错字段/错 hash/跨 assignment 或 scope/未发布版本/未授权/已撤销同意、双窗口 CAS 与同 key 重试/异输入冲突、审计和失败回滚；更正不关疑问，旧普通数据不变。真实 API、旧入口 dispatch、S05/S09 页面和业务用户验收由后续集成完成，不因核心测试通过而标 T08 完成。

### 当前证据与边界（2026-11-12）

独立编译 `app/server/.tmp/t08-query` 和两项目标解析/事件版本单元测试通过。受保护数据库回滚测试 `researchhub/.tmp/t08-data-query-pg.tap` 验证真实正式修订创建疑问后更正仍保持开放与原引用、固定访视表单要求缺失、错字段/hash/跨租户、撤回/权限撤销后拒绝、顺序 CAS、回执及失败回滚。双连接受限应用角色的独立全新合成 scope 通过 `pg_blocking_pids` 验证实际等待、同版本不同 key 只一次成功且回复未丢、同 key 同内容只追加一次并返回原结果、不同内容冲突不写；结果 `docs/testing/evidence/research-t08-2026-11-12/data-query-concurrency-pg.json`，仅保留该次合成 fixture。未将这些证据扩大解释为所有负例、旧入口或 HTTP/页面验收。当前实现额外要求 assignment 的 FormVersion 出现在其真实 VisitPlan 的固定表单要求中。列表 raw `afterId` 是内部接口，Hub 须以 actor、authVersion 与 Study 绑定的安全游标封装。

### 列表多项读取修正

列表按 query ID 取 `limit+1` 候选，先在 scope 内读取每条实际 assignment 与 enrollment 的固定绑定，锁 project 后统一按 ID 排序共享锁所有涉及 protocol，再按 subject ID 排序锁全部被试。锁后逐条复验同意、assignment、enrollment、visit、revision 和 query，且与锁前绑定一致；最终按原 query ID 顺序返回最多 `limit` 条及精确下一游标。任何源变化或权限/同意失效均失败，不能跳过不一致项；lookahead 不读取其详情。测试需包含两个 query ID 与 subject ID 逆序的真实重叠读取与数据库锁等待。

修正后独立编译、两项单元、原 PG 回滚与双连接测试通过，结果见 `data-query-concurrency-pg.json`（`rh-create-0a3f4506`）；此前 limit 被忽略的 RED 在 `data-query-concurrency-pg-failure.json`。逆序用例直接调整本次自有合成 fixture 中两条 query ID 来构造排序，其旧 audit/receipt ID 因此仅为测试布置，不作为回执证据；并发等待和分页读取使用真实数据库事务。

Hub 接入补充：列表可选 assignmentId，按 scope 与 targetRecord.ref.assignmentId 同时过滤，仍遵循 limit/游标与全部锁后复验。只读回执输入 requestKey、action、assignmentId 及可选 queryId；先按当前动作重新授权，再查本人 scope 唯一事件，核对动作与目标并锁后重验父链/同意，返回原结果；未找到或目标不匹配返回 404，无法从回执恢复原文或触发写入。Hub 须在带 assignment 过滤时先验证当前正式答卷，并对游标绑定身份、Study、assignment 和过滤条件。

Hub DataQuery 适配器与 history 使用同一 Study 授权事务：列表可按 assignment 过滤，签名 cursor 绑定 tenant/actor/authVersion/Study/assignment 和顺序；回执按 requestKey+动作+assignment+可选 query ID 只读恢复。动作能力调用同一 `authorizeFormalResponse`，仅明确 `RESEARCH_FORBIDDEN` 403 转为 false，其他授权/事务错误继续抛出；不从 owner 推断。默认进程随机签名密钥重启失效；多进程需组装层传同一稳定密钥。浏览器只传服务端返回的固定 ref/CAS，正文不含手工编辑 hash 的操作。

### 实际 HTTP 与页面来源投影

`rh-t08-http-4f43a62d/result.json` 已验证当前19501真实历史分页、旧0/false/未计分、固定引用读取与错误hash拒绝，疑问创建同键/异内容、本人回执、研究者关闭403、双HTTP回复CAS、更正保留原目标与开放状态、显式理由关闭。该证据不是页面或生产验收。

为S05/S09直接定位来源，list每项及detail.query追加同授权事务的 `source={subjectId,subjectCode,visitId,visitName,assignmentId,formTitle,fieldLabel}`，仅在共同核心当前授权及全部父链锁后按同scope查询；不含答案、人口学或联系方式。事件追加 `actorDisplayName`，按本租户账号批量读取显示名，历史账号无显示名时明确“历史账号”；不展示email。来源缺失或字段不属于固定表单时失败，不用请求参数或旧摘要补全。该投影增量目前仅单元通过，待受控重载后真实GET与页面验证。

来源和责任人投影已在19501真实GET验证，证据`source-display-http.json`，包含固定schema字段标签一致及list/detail一致。history同时追加安全actorDisplayName，H5显示“问卷自填”。疑问成功命令与只读回执另统一返回 `receipt={requestKey,action:'data_query.'+action,targetId:result.id,assignmentId}`，浏览器须先匹配原scope、请求键、动作、assignment及已有query目标，再回读当前状态；不能只凭任意同Study的query ID清除未知标记。该回执元数据增量待下一重载验证。
