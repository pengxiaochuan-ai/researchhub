# WP06 首切片代码核对

## 已知事实与待核定

- WP05第二切片技术交接不等于专业AX09验收；正式Study/Protocol/EDC未因此启用。
- 旧StudyFormsService.assign要求published/locked；submit链有计分，提交后拒绝再次保存；acceptanceFixture入口还绑定onboarding及PI，不是一般合成旁路。
- 当前合成质控以固定8条软件夹具生成数据，不能充当WP05任意CRF录入后的持久采集路径。
- 首选复用现有表单纯校验、原产物/版本/审计、原确定性质量运行及科研Agent；具体持久化载体需核对代码后在规格冻结，不能留下互斥分支供实施者猜测。
- 当前只核对本地代码与无密钥文档，不读取实际.env、不查远端配置、不连接PG或模型。

## 本轮依据

- `docs/product/research-execution-preparation-spec-2026-10-23.md`
- `docs/testing/research-execution-preparation-2026-10-23.md`
- `docs/planning/phase1-review-2026-10-19/reverse-schedule.md`
- `../app/server/src/study-operations/study-forms.service.ts`
- `scripts/synthetic-quality-contract.mjs`

本文件是核对记录，不是恢复旧任务的执行指令。

## 2026-10-23 · 已核定的推荐实现决定（待用户批准）

- 旧FormResponse是一分配一答卷，无revision字段/历史关系；不能声称复用它即可完成更正历史。assign要求published/locked，submitAcceptanceFixture还要求onboarding/指定PI，writeAnswers会score并拒绝已提交再写。
- 推荐单独的`ResearchArtifact(typeKey=research_report,status=draft)`保存具名合成演练记录包，`contentBlocks`使用新严格marker，版本、来源、CAS与AuditLog仍沿旧Service。它不是新的正式EDC表，也不是正式EDC已交付；不得改变父方案root/head来保存答卷，否则会自我失效。
- 当前旧产物类型白名单没有dataset/CRF类型，因此不能凭空写dataset_manifest。research_report是既有类型，扩展仅限本地受控marker/本人范围，须用户明确同意最小业务动作，不能放开通用research_report写接口。
- 现有合成Python链只支持固定8条结构；动态CRF的本片DQ用原表单纯validator＋确定性缺失/范围/录入状态检查，结果保存在演练包不可覆盖版本。不伪造ResearchMethodRun、seed、Python执行或t19-1算子来源，不新建Worker/Skill授权。
- 报告复用原ResearchArtifact/Version/Source及事实/人工说明分离模式，但新快照必须有独立facts schema和纯渲染分支；不能给旧buildReportFacts塞假run/dataset。旧报告/资产链本片只回归，不宣称新资产派生已支持。
- 旧normalizeAndValidateAnswers可拒绝范围错误。为保留可质控的合成越界原值，新外层先严格类型校验，再把范围作为明确的软质控发现；不是放宽旧正式表单。完成合成录入不等于数据有效或放行，必须明确承认当前问题hash。
- 原费用交接63笔known、保守¥1.246815/¥5；报价有效至2026-10-24T10:03:30Z（北京时间18:03:30），不是本片调用授权；本轮新增调用/费用0。

## 读取异常

- 一次猜测`research-artifacts.policy.ts`/common目录通配符未命中；已从service实际import定位`research-artifacts/research-artifact-policy.ts`，不创建缺失文件。
- 第一次摘要脚本输出文件清单和全文过大，JSON被工具截断；改为仅输出1276份受限源码总摘要及5份待追加文档hash，已成功保存会话基准。没有写运行文件。

## 独立文档评审核实

唯一评审0C/1I/0M；I01已由主编核实local-knowledge-ai的state/source读取只核知识来源。新EDC结果必须在这两路额外只读核scope/父包/数据/DQ绑定，撤销隐藏、版本失效标历史，不能只接最终提交。已补规格6/AC06、授权及计划C06/C08；无业务代码修补、无二次独立复签。
