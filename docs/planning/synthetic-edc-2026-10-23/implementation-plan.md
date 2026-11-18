# WP06合成采集与更正／AI质控解释小步实施计划

> 2026-10-25当前执行覆盖：C01–C09本机技术交接。唯一独立总评审0确认Critical/5Important/2Minor，主实施者补反例并修补复验关闭七项，未第二次独立复签；AC10由用户专业验收。公开核价及原累计5元已批，75笔known、保守¥1.464417/¥5，无充值续额/扩权。原32h＋8h、4～5工作日和11月中旬目标保持，不把自动化时长压缩成人日承诺。此前待批/评审中为历史；以[ledger](implementation-progress.md)、[当前实测](../../testing/synthetic-edc-c06-c09-2026-10-25.md)为准，不自动扩展新切片。

> 执行者：2026-10-25用户已批准规格、计划及M01–M03。使用superpowers:executing-plans在当前目录串行实施，唯一独立代码总评审留C09；不派并行实现、不创建worktree、不自动提交/推送。文档评审不是C09。下方批准前状态为历史，付费AI调用仍单独停线确认。

**Goal：** 把本人WP05配置变成真实保存、可更正、可质控及可解释的合成记录，并形成可追溯报告草稿。

**Architecture：** 独立`research_report/draft`演练包＋原ArtifactVersion/Source/AuditLog；父方案只读，复用旧表单纯校验和原KB科研Agent。DQ为真实动态CRF的确定性规则，不假造旧Python/run；新报告facts窄分支，不扩正式EDC或共享底座。

**Tech Stack：** 既有React/Vite/JS、NestJS/Prisma/PG、原会话Queue/Orchestrator/DeepSeekProvider；无新依赖、表、角色、Worker或Skill。

**Spec：**[规格V0.1](../../product/synthetic-edc-spec-2026-10-23.md)；[最小授权M01–M03及费用门槛](authorization-scope.md)。2026-10-25：C01–C05主体已实施并有阶段证据；C06付费/有效核价待确认，C06–C09未完成。实际命令与偏差见[实施ledger](implementation-progress.md)和[阶段报告](../../testing/synthetic-edc-2026-10-25.md)，下文初始检查项不能冒充最终业务签认。

## 全局约束与评审重点

- 仅专用合成库、原两个账号/当前Study/本人本轮包/报告；正式实体/放行表零写入；旧源/Schema/RLS/Client/角色/服务/历史保持，WP01 T03–T24暂停。
- 每包3～5编号、显式2访视、CRF1/字段1～12、text500；POST32KiB、包块256KiB、操作128、索引每页20、DQ最多130、单次AI选择/返回最多6；不偷偷放宽。
- 包根CAS、dataRevision、responseRevision分离；数据改回也不能复活旧DQ/AI；父方案只读，任何根改版使旧包stale而非重绑。
- 当前M项/费用均未批准；严格保留原累计5元，不核价/调用/续额/充值。UI沿原Shell/母版，操作14/22、阅读16/28/48rem、辅助13/20、元信息12/18。
- 每任务按RED→最小实现→GREEN→适用真实API/浏览器证据→文档检查点。一次失败不自动扩权/付费重试；所有初始失败留痕。

Review Focus（相应用例必须归入任务）：

1. 旧表单published/PI/计分前置不能被合成flag绕过；原正式表零写：C01/C08。
2. 保存越界原值与类型硬拒绝分开，not_applicable不豁免必填、0/false非缺失，不能悄悄丢值：C03/C05。
3. 根元数据版本不是数据版本，完成确认绑定真实问题hash，更正CAS与审计原子：C02/C04/C05。
4. AI在途改值/撤审/换父版本/失权不得交付，重复key及恢复不加费：C06/C08。
5. dirty、慢轮询、历史/复制迟到、失权清空及报告真实回链不串对象：C03/C04/C07/C08。

## 文件边界与内部接口

拟新增文件：

- `scripts/synthetic-edc-contract.mjs`、`.test.mjs`：严格包/答案/绑定/DQ/AI/报告facts的JSDoc契约及纯函数；不引入新TS构建链。
- `scripts/local-synthetic-edc.mjs`：原授权事务、包/记录/DQ/队列钩子及精确Controller；`scripts/local-synthetic-edc-report.mjs`：报告创建/读取/说明版本，独立原子边界。
- `src/synthetic-edc-session.js`、`tests/synthetic-edc-session.test.mjs`：路由、客户端、dirty/CAS/请求代次。
- `pages/shared/SyntheticEdcWorkspace.jsx`、`SyntheticEdcRecord.jsx`、`SyntheticEdcQuality.jsx`、`synthetic-edc.css`：列表、记录/更正历史、DQ/AI/报告局部视图，不复制Shell。
- `scripts/synthetic-edc-api.mjs`、`-browser.mjs`、`-boundaries.mjs`、`-live.mjs`、`-gates.mjs`、`-preservation.mjs`：新的具名夹具/免费与付费显式分离/Chrome/冻结核对。证据建父仓库新目录，不能重用旧任务。

拟修改（限定必要分支）：`scripts/local-knowledge.mjs`装配新Controller/parser、`scripts/local-knowledge-ai.mjs`第四互斥任务分支/最终重验及原knowledge-state/knowledge-sources的新kind只读投影守门；`src/knowledge-session.js`精确同源白名单；`pages/shared/workflow-main.jsx`/`BusinessPages.jsx`按实际S03/S04/S05入口分发；`ResearchExecutionPreparation.jsx`加入口；`src/platform-frontend.js`真实分支提示；`vite.config.js`只在新增本机精确proxy确有需要时修改。原local-research-plans/旧Service默认只读复用，不重构大文件或移植整个后台。

以下接口在contract中以JSDoc定义，精确结构取规格4～7：

```ts
normalizeSyntheticCaptureInput(config: PreparationConfig, input: unknown): CaptureInput
classifySyntheticAnswers(config: PreparationConfig, answers: unknown, validate: Function): {answers: Answers; findings: RecordFinding[]}
syntheticCollectionDataHash(block: CollectionBlock): string
syntheticCrfQuality(block: CollectionBlock): QualityResult
assertSyntheticCollectionBinding(frozen: CollectionBinding, current: TrustedBinding): void
parseSyntheticQualityExplanation(text: string, trusted: ExplanationInput): ExplanationCandidate
buildSyntheticEdcReportFacts(collection: CollectionBlock, quality: QualitySnapshot, ai: AiProjection): EdcReportFacts
createLocalSyntheticEdc(options: ExistingLocalOptions): Promise<SyntheticEdcAdapter>
createLocalSyntheticEdcReport(options: ExistingLocalOptions & {withCollection: Function; inCollection: Function}): Promise<EdcReportAdapter>
projectSyntheticEdcMessage(user: JwtUser, message: AssistantMessage): Promise<AssistantMessage>
readSyntheticEdcMessageSource(user: JwtUser, message: AssistantMessage, index: number): Promise<SourceProjection>
```

`createLocalSyntheticEdc`的ExistingLocalOptions沿原`{root,ids,plans,prisma,storage,load,require,budget,own}`并增加经批准的`scope`；返回`{Controller,reportController,setQueue,onJobCreate,prepare,prompt,toolEvidence,accept,validateTurn,projectMessage,readMessageSource}`，后两项绑定上述投影函数，其余与本机旧design/preparation装配钩子同形。新增task字段researchSyntheticEdc与原三字段互斥，不能落回普通问答。`withCollection/inCollection`在原withDraft/inDraft内验证新scope/包及实时授权，报告复用同一事务，不嵌套独立提交。AssistantMessage/SourceProjection沿原message/source shape，新结果使用`provenance.researchSyntheticEdcResult`；受限仅安全占位、stale含historical:true，不在投影中改DB。

## 工时、依赖与每日检查点

| 任务 | 可验证小交付 | 小时 | 依赖/门槛 |
| --- | --- | ---: | --- |
| C01 | 复用/授权/保全核对＋包/答案契约golden | 4 | 规格/计划批准；实际写库前M01 |
| C02 | 创建/读取本人包与S11→S03入口 | 4 | C01、M01 |
| C03 | 单张合成草稿保存/刷新恢复 | 4 | C02 |
| C04 | 完成/更正/差异与历史闭环 | 4 | C03 |
| C05 | 实际录入→确定性DQ快照与定位 | 4 | C03/C04 |
| C06 | 原Agent真实问题解释与在途守门 | 4 | C05、M02、费用/有效核价 |
| C07 | 当前DQ→报告草稿与回链 | 3 | C05及M03；无AI时明确未解释 |
| C08 | 两账号全链/风险/旧链真实回归 | 3 | C02–C07；AI未验不能销AC05 |
| C09 | 一次代码总评审、修补复测/文档 | 2 | C08 |
| 缓冲 | 仅上述缺陷/评审返工，不添加新功能 | 8 | 按需；不足先复估 |
| 合计 | 32小时＋8小时缓冲 | **40** | **4～5工作日** |

第1日C01/C02（8h）；第2日C03/C04（8h）；第3日C05/C06（8h）；第4日C07/C08/C09（8h）；第5日最多8h缓冲。C01前半日先排除复用/授权根本障碍，C01后半日可先做免费纯契约；M01未批不写PG。第2/4日检查实际剩余量；权限/费用/专业等待单列，超过40h或涉及新增范围先确认。若10月26日获批且无等待，10月29日目标技术交接，最迟10月30日使用缓冲后再判断，不把它写成全项目保证。

### C01：范围守门与纯契约（4h）

文件：新增contract/test与preservation脚本，复用旧policy及原Artifact/准备契约。先记录当前原ids摘要、专用DB标记、旧源/正式表/角色/旧进程/冻结包及原账本前缀；不得执行会改历史夹具的全量脚本。

- [ ] 只读核对scope批准M01–M03及内部旧Service可加载、不会初始化模板/计分/写正式对象；需新Role/Schema/旧源即停，不切正式EDC路线。
- [ ] 写`capture_capacity_and_binding`、`answers_zero_false_and_explicit_missing`、`invalid_type_is_not_soft_range`测试：3/5编号允许、2/6拒绝；两访视必须来自保存版且不同；12字段允许/13拒绝；0/false保留，value:null/空白/错选项拒绝。
- [ ] `node --test scripts/synthetic-edc-contract.test.mjs`先RED，再最小实现normalizeSyntheticCaptureInput/classifySyntheticAnswers，GREEN；纯契约不连接DB或模型。
- [ ] C01检查点：记录选定旧入口/实际权限与保全基准，AC02/AC08；测试/新文件此时才创建。

### C02：本人持久包与入口（4h）

文件：local adapter、contract、同源白名单及S11/S03入口，≤5个主实现文件；消费C01，产出建包/list/detail/单版及withCollection/inCollection。

- [ ] 写`collection_create_is_atomic_and_owner_scoped`、`child_writes_do_not_move_parent_head`、`create_idempotency_race`：同键竞争只一个包，编号不重复；相同键异输入409；跨账号/无成员拒绝；GET无写入。
- [ ] `node scripts/synthetic-edc-api.mjs --case collection`留真实合成PG RED→最小原事务实现→GREEN，正式表计数/摘要不变；原源/source/authVersion重验。
- [ ] 真实浏览器case `entry`：两账号S11→建包→S03→S04，当前配置与合成标识清晰，刷新/登录恢复、未知ID不回demo；构建`pnpm run build`。AC01/AC03/AC08。

### C03：保存单记录（4h）

文件：contract/adapter/Record/session/test；消费包view，产出record draft写入与明确反馈。

- [ ] 写`out_of_range_value_is_preserved_and_flagged`、`unknown_field_rolls_back`、`draft_root_and_response_cas`及`dirty_refresh_keeps_edit_base`；有限越界原值仍在，错误类型拒绝，旧CAS冲突不丢输入，源revision绑定不由轮询推进。
- [ ] 纯测试＋真实API case `draft` RED→最小实现→GREEN；原normalizeAndValidateAnswers仅在新外层区分类型/范围，原正式validator不修改；包版/审计原子。
- [ ] Chrome case `draft`保存→刷新→切记录→失败/409恢复，computed字号/焦点/退出迟到反例留PNG/WebM；原WP05 preview依然不持久化。AC01/AC02/AC08。

### C04：完成、更正与历史（4h）

文件：adapter/contract/Record及session/test；消费当前记录/问题hash，产出recorded转换及版本diff。

- [ ] 写`completion_ack_is_bound_to_saved_findings`、`recorded_rejects_draft_write`、`correction_requires_reason_and_revisions`、`correction_version_and_audit_rollback`；明确ack hash可允许合成缺失/范围问题但不称放行，原因7拒绝/8接受，旧responseRevision409。
- [ ] 纯/API case `correction` RED→GREEN；更正前后state/value/原因/人/时间同版，两个独立请求竞争一个成功、另409，故障注入全部回滚；no-op不推进数据revision。
- [ ] Chrome case `history`实际完成→更正diff→历史→准确返回；dirty/取消/改回原值/慢复制目标/受限隐藏，不为完成增临床审批按钮。AC03/AC06/AC08。

### C05：实际记录质控（4h）

文件：contract/adapter/Quality/局部CSS；消费已保存包，而非客户端临时值/旧固定生成器；产出QualitySnapshot。

- [ ] 写`quality_uses_saved_crf_records`、`missing_range_unrecorded_golden`、`quality_metadata_does_not_invalidate_data`、`change_back_never_revives_old_quality`；故意缺失/越界/未完成均准确定位；最大130完整呈现，不生成临床指标。
- [ ] 纯/API case `quality` RED→GREEN；按rulesVersion/hash独立复算，保存快照/审计同事务；故意让客户端未保存正确值，服务器仍检出旧已保存错误，证明非前端假DQ。
- [ ] Chrome case `quality`问题→跳单元格→更正→重检，旧结果标过期/保留，未完成表覆盖显示；没有Python/run调用时明确标本片确定性规则。AC04/AC08。

### C06：AI解释真实执行（4h，计费门槛独立）

文件：contract/adapter/local-knowledge-ai/Quality及live脚本；消费当前DQ，产出原队列任务与不可变assistant投影。

- [ ] 写`edc_payload_exclusive_with_three_existing_kinds`、`selected_finding_ids_and_citations_strict`、`no_raw_numeric_answers_in_prompt`、`inflight_edit_or_source_change_blocks_assistant`、`same_key_no_new_fee`；真实合法引用与技术ID通过、伪ID/数字推断/补丁拒绝；入队原子回滚/assistant完成事务不得半交付。另写`completed_edc_session_reads_follow_current_binding`、`revoked_edc_scope_hides_session_and_source`：解释完成后更正/换父版，两条旧读取路由不能标current；撤销本片scope后正文/关联来源不可读，关联队列结果不泄露；损坏provenance不落普通问答，旧三kind行为不变。
- [ ] 纯/免费API case `explanation-boundaries`先RED→最小装配→GREEN；新任务落到原Agent分支而非普通问答，原assertAnswer/claim/来源门槛不放宽。原state/source分支遇新provenance调用projectMessage/readMessageSource，检查新scope/父包/数据/DQ/来源，current/stale/restricted规则严格照规格6；投影无写入副作用。
- [ ] **停线核对M02＋本片计费授权＋有效公开核价＋原账本**，未齐不运行live；齐备后`node scripts/synthetic-edc-live.mjs`先checkpoint原job，再真实KB/Provider；恢复只查询，不自动重放。两账号新样例、真实在途更正/撤审的付费反例逐次记录预留/失败费用，不预承诺调用笔数。
- [ ] Chrome case `ai`看真实解释/资料及规则定位、未解释项；0问题不调用。保存query、原文指纹/URL或文档ID、时间、usage/最终结果；不拿Mock销AC05/AC06。

### C07：报告草稿衔接（3h）

文件：新local report adapter、contract、Quality报告局部视图及API case；消费当前包/DQ/AiProjection，产出新schema的真实data_quality_report/draft。

- [ ] 写`edc_report_uses_real_snapshot_not_fake_run`、`report_facts_immutable_notes_versioned`、`old_report_schema_and_assets_unchanged`、`report_duplicate_or_stale_source_rejected`；原源关联准确包版本/qualityId，报告输入不假造seed/operatorVersion。
- [ ] 纯/API case `report` RED→最小原Service实现→GREEN；报告创建＋包操作＋审计同事务，失败回滚；说明只追加报告版，不更改机器facts或包dataRevision；无AI明确未解释。
- [ ] Chrome case `report`打开→来源回正确包/记录/历史→说明/冲突保输入；生成后更正再读旧报告必须标历史过期，不重新绑新DQ。AC07/AC08。

### C08：两账号联调与风险回归（3h）

文件：新api/browser/boundaries/gates/preservation；消费前述真实端点，不复用旧研究/任务做写测试。

- [ ] 两原账号各新具名样例：本人WP05配置→建包→保存/完成→更正→DQ→实际AI→报告；真正新AI任务和保守费用对账。记录跨账号、未知ID、混合demo、CAS/重复/来源失效、在途改值、重启中断与禁止自动重放。另在真实解释完成后分别更正、换父版、禁用本片scope，从包页及原会话state/source两路实际请求；前两项历史过期，后一项隐藏正文/来源，不新增调用或修改旧角色来完成该已完成结果反例。
- [ ] `node --test tests/*.test.mjs scripts/*contract.test.mjs server/wp02/*.test.mjs`、`node scripts/wp02-kernel.mjs`、`pnpm run build`及未来`node scripts/synthetic-edc-gates.mjs --free`；免费门禁只核验已获准真实AI证据，不顺带调用。原账号/邀请/知识/WP05/固定Python质控/旧报告资产作无费用回归；若旧内核命令会写历史夹具，改只读核对并另列未测，不冒险重跑。
- [ ] 真Chrome两角色五视口/原生200%、键盘/失败/dirty/慢读/复制和PNG/WebM；冻结旧源/Schema/角色/正式表/旧进程/历史清单/原预算前缀对照。AC01–AC08均分实际通过/失败/未测，AI缺授权保持未验。

### C09：一次独立代码总评审与交接（2h＋按需缓冲）

文件：本片spec/计划/授权/测试报告、基线/版本/使用说明/本机技术说明及Notion。

- [ ] 一次fresh-context只读总评审覆盖本片代码与真实证据，不派第二实现/重复评审；Critical/Important主实现核实，加失败反例→最小修补→实际复测；超范围停线确认，原评审不可改成虚假二次通过。
- [ ] 汇总命令/PG事务/浏览器/真实工具/费用/保全和文档回读；有用户操作变化才同步使用说明，旧产品本轮无变化不虚构新发布。实际实施完成时同步根版本记录和相关living spec；本轮仅文档不写“功能完成”。
- [ ] AC10交用户用未预运行样例评阅，代码/配置/真实执行/业务效果四层分开。说明仍未交付的正式EDC/其他AI/发布及11/04、11/06复估；不自动删一期范围。

## 批准前自检

规格1–10→M01–M03→AC01–AC10→C01–C09逐项对应；合计32＋8=40h、无默认周末。当前只做文档静态校验/一次独立文档评审，不跑上述尚未创建的脚本/PG/模型/浏览器。待用户确认后才执行已批步骤，新增权限、费用、云、远端配置或真实发布仍先停下讨论。
