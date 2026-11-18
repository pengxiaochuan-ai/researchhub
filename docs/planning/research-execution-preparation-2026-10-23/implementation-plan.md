# WP05第二切片小步实施计划

> 执行者：用户已批准规格与八步计划；使用superpowers:executing-plans在当前目录串行实施，唯一独立代码总评审留E08，不派并行实现、不重复询问执行方式。下文命令是已批准执行落点，不是自动付费授权。

**Goal：**本人方案→可版本化的执行准备配置→确定性检查/真实AI说明→人工修订与核对，形成WP06输入候选，不写正式采集对象。

**Architecture：**原protocol_draft的可选executionPreparation块，复用原授权/版本/队列/来源/Provider及旧表单纯validator；薄适配不扩共享底座。规则与AI候选分开，head连续链区分方案basis与根CAS。

**Tech Stack：**现有React18/Vite/JS、NestJS/Prisma/PG、原KB/Agent/DeepSeekProvider；不新增依赖、Worker、公共表或角色。

**Spec：**[实施规格V0.1](../../product/research-execution-preparation-spec-2026-10-23.md)。版本2026-10-23；整体已批准，费用/有效报价/权限仍单独过门槛。

## 实施检查点（2026-10-23）

E01–E08代码、唯一代码总评审及主实现修补复测完成；AX09待用户，最终文档/Notion证据另见本片final-validation.json。217/217相关测试、1054/1054原内核、构建及28项免费检查通过；新材料两账号AI链、意见/修订失效、真实在途撤审及三项评审反例均留证，无二次独立复签。费用见[核价记录](pricing-revalidation-2026-10-23.md)，实测见[报告](../../testing/research-execution-preparation-2026-10-23.md)。

E02–E04早期免费集成采用本轮新具名本人草稿，继承本人原已成功PICO/方案的只读封存内容并标注来源；不伪造新AI、不新增用户复制API、不更改原历史方案。E05新核对及E07两账号全新材料链已另行实跑，历史免费夹具未冒充AI证据。下方未勾选的E08项仍须收口，E05–E07勾选由最终交接同步，不改变原工时预算。

## 全局约束

- 仅专用合成库、原两个账号/当前Study/本人本轮草稿；正式Protocol/VisitPlan/Form/Subject等表零写入，预览答案零持久化。
- 保留旧源码/Schema/RLS/Client/角色/服务及历史任务；WP01 T03–T24暂停，当前脏目录不清理/提交/推送/切分支。
- 来源6、结局8、访视4、CRF1/字段12/选择项12、映射24、规则发现24、AI说明6；字符与数值技术边界严格照规格4/6，不偷偷放宽。
- 原正文24000 UTF16、operations64；新准备保存128KiB，任务/预览/意见/重绑32KiB；Controller实际别名同覆盖，旧32/128/192KiB族不改变。
- 原字段类型number/integer/text/select/boolean，不运行scoreFormResponse或写正式采集；mappings还含人工unit，R06只比声明不做单位换算。
- 原模型/maxTokens<=1536/预算及来源完整集不变；本片付费前另过明确授权/有效核价，不自动调用、续额或续价。
- UI沿Frozen Shell/五导航/现有母版；操作14/22、阅读16/28且48rem、辅助13/20、元信息12/18。
- 各任务RED→最小实现→GREEN→本片集成/浏览器证据→文档检查点；下列已获批任务按依赖推进，实际付费另过门槛。

## Review Focus与落点

1. 配置保存/入队增加根版本，不能让basis自我失效；其他写后改回正文也不能复活：E02/E05/E06。
2. 原PICO/design/新准备任务必须互斥，免费key不得新扣费；迟到模型结果不能越过当前head：E05/E07。
3. 旧表单列表可能写模板，旧Protocol创建写正式对象；仅消费纯函数，真实表零写入：E01/E04/E07。
4. 缺失/false/0、非法范围/字段与中文科学值/真实技术ID分离；模型不能改配置：E01/E04/E05。
5. 慢刷新/dirty/撤审/切对象/复制晚到不得恢复失效内容或误报保存：E03/E06/E07。

## 文件与接口分工（拟创建，不表示当前已实现）

| 文件 | 责任 |
| --- | --- |
| 新`scripts/research-execution-preparation-contract.mjs`与`.test.mjs` | 严格配置、basis/head、规则、AI解析、预览missing适配、字节/路由/绑定纯契约 |
| 新`scripts/local-research-execution-preparation.mjs` | 7类接口、原产物事务/审计/队列钩子，不暴露通用写库 |
| 改`scripts/local-research-plans.mjs`、`local-research-design.mjs` | 三类pending互斥和列表可选摘要；保留旧来源/权限/版本/幂等 |
| 改`scripts/local-knowledge-ai.mjs`、`local-knowledge.mjs` | 注册新Controller/parser、互斥payload及prepare/prompt/accept/final publication钩子 |
| 新`src/research-execution-preparation-session.js`与对应`tests/` | 路由、dirty、表单、单次刷新、head/检查绑定；现有knowledge-session仅加精确路径 |
| 新`pages/shared/ResearchExecutionPreparation.jsx`、`ResearchExecutionPreparationForm.jsx`、`ResearchExecutionPreparationCheck.jsx`及局部CSS | S11装配、访视/CRF/映射/预览、规则/AI/意见/历史，不复制Shell |
| 改`pages/shared/ResearchDesignWorkspace.jsx`、`workflow-main.jsx`、`src/platform-frontend.js` | Q02/S07入口/摘要、S11真实分支能力横幅；原S11/WP02邀请不变 |
| 新`scripts/research-execution-preparation-api.mjs`、`-browser.mjs`、`-boundaries.mjs`、`-gates.mjs` | 新具名夹具、真实请求/Chrome/反例/免费回归编排；付费脚本显式checkpoint |

接口统一前缀及typed字段以规格7为准；不修改原Session/Queue/Artifact表、旧Service或另建权限系统。check仅GET投影，准备块持久字段为pending/opinionHead，不做完成时元数据版本回写；精确hash、稳定路径/findingId及预览真值表以规格4–6为准。若需超出这些薄适配点，先报告影响而不是增代码。

## 共享内部接口

以下导出名为本计划约定，实施时在对应文件实现；不以“已有工具”掩盖缺失函数。

```ts
normalizePreparationConfig(input: unknown): PreparationConfig
preparationRules(config: PreparationConfig, basisState: 'current'|'stale'): RuleResult
preparationCurrent(block: PreparationBlock, currentRootVersionNo: number): boolean
preparationTaskBinding(payload: unknown): PreparationTask | null
assertPreparationBinding(task: PreparationTask, current: TrustedPreparationInput): void
parsePreparationCheck(text: string, trusted: TrustedPreparationInput): CheckCandidate
preparationPreview(config: PreparationConfig, answers: unknown, validate: Function): PreviewResult
createLocalResearchExecutionPreparation({root,ids,plans,prisma,storage,load,require,budget,own}): Promise<PreparationAdapter>
```

PreparationConfig/Block/Task/RuleResult等精确字段均来自规格4–6；在contract文件以JSDoc定义并由strict parse约束，不新建一套TS构建链。adapter沿现有setQueue/onJobCreate/prepare/prompt/toolEvidence/accept/validateTurn消费钩子；在原local-knowledge-ai.beforeAssistant组合新validateTurn，不新增平行validateBeforeAssistant写通道。actual hooks对齐local-research-design当前导出。

## 工时与日检查点

| 任务 | 小交付 | 小时 | 依赖 |
| --- | --- | ---: | --- |
| E01 | 复用/授权零扩张核对＋严格配置及规则golden契约 | 2 | 用户批准 |
| E02 | 本人准备草稿保存/读取/历史及原子版本链 | 4 | E01 |
| E03 | 原设计入口→S11真实配置/保存恢复 | 4 | E02 |
| E04 | 访视/CRF映射预览＋确定性缺项定位 | 4 | E01–E03 |
| E05 | 真实AI核对任务、互斥与最终提交重验 | 4 | E02/E04及费用门槛 |
| E06 | 核对意见/历史diff/显式重绑与dirty | 4 | E03/E05 |
| E07 | 两角色整链、风险/权限/旧链回归与浏览器 | 3 | E04–E06 |
| E08 | 一次独立代码总评审、修补复测与文档交接 | 3 | E07 |
| 缓冲 | 上述缺陷/评审返工，不添新功能 | 4 | 按需 |
| 合计 | 28小时实施验证＋4小时缓冲 | **32** | **4工作日** |

第1日E01/E02及E03前2小时；第2日E03后2小时/E04/E05前2小时；第3日E05后2小时/E06/E07前2小时；第4日E07后1小时/E08及4小时缓冲。划分为有效工作预算，不意味着每个任务一天完成或忽略AI等待。E01确认后仍只能编程，无有效费用授权不得跑E05实际模型。费用/专业反馈等待单列；预计超过32小时或缓冲耗尽即复估，不默默延长。

### E01（2小时）：可复用、可验证的配置契约

文件：新contract/test；只读旧study-forms-policy、StudyOperations/FormsService及原产物授权。消费原PLAN_MARKER/author/source/operations契约；产出normalizePreparationConfig、preparationRules、preparationPreview及JSDoc。

- [x] 写`config_capacity_and_unknown_fields`、`legacy_types_missing_false_zero`、`units_are_declared_not_converted`测试：12字段接受/13拒绝，4访视接受/5拒绝，重复/悬空/score拒绝，0与false不视为missing，单位不同只报冲突。
- [x] 跑`node --test scripts/research-execution-preparation-contract.test.mjs`，先证实新函数/行为缺失而失败，再实现严格外层校验＋调用现有纯validator，跑同命令通过。
- [x] 只读确认原两账号本人artifact及Agent接口授权路径、旧模块加载无副作用；不调用listTemplates/createProtocolVersion。记录所有正式表零写入路径和原Client可用性，需新权限/DDL/旧源即停线确认。
- [x] 记录本片文件/hash和RED/GREEN；AX02/AX08；不提交Git。

### E02（4小时）：本人草稿版本纵向切片

文件：新local adapter，改local-knowledge装配及客户端精确白名单；contract补head测试。消费plans.withDraft/inDraft/formatContent与原ArtifactsService.createVersion；产出GET、POST versions、GET单版本及可信basis/head。

- [x] 写`own_configuration_roundtrip`、`basis_and_head_are_distinct`、`free_key_cannot_create_paid_job`：初存v→v+1/head跟进，配置r递增而basis固定；其他根版本写后stale、改回也stale；同键同输入不增版本/审计，异输入409。`128k_raw_alias_limit`覆盖实际Controller路径别名。
- [x] 跑纯测试及未来`node scripts/research-execution-preparation-api.mjs --case persistence`留真实RED；最小实现原共同授权事务/严格seal/原子append/审计/只读历史，不建表、不启动新Worker。
- [x] 同命令GREEN，覆盖跨账号/只读/未邀请拒绝与异常回滚；旧无块读取及原PICO保存/来源行为不变。GET不创建模板/版本。
- [x] 同步状态文档与证据检查点；AX01/AX05/AX08。

### E03（4小时）：真实入口、配置和保存恢复

文件：新session/test/Form/Workspace/CSS，改Q02/S07与S11 dispatch及横幅。消费E02 view和精确路径，产出独立真实分支/基准卡/访视字段编辑/保存反馈。

- [x] 写`real_route_wins_over_demo`、`single_flight_refresh_keeps_dirty`、`restricted_clears_all_data`客户端RED；模板无日期默认值，无保存前临床完整假象。
- [x] 跑`node --test tests/research-execution-preparation-session.test.mjs` RED→最小实现→GREEN；不改原邀请/演示分支或Shell。
- [x] 新具名Chrome case `workspace`实际登录两账号：找到入口→空态→保存→刷新恢复→返回S07/Q02；失败保输入、首次不报错、首错聚焦、退出迟到响应不可回填。
- [x] `pnpm run build`及对应截图录屏，记录14/22与16/28；AX01/AX07，不称全流程AI已完成。

### E04（4小时）：能定位的规则与无持久采集预览

文件：contract、adapter previews、Form及Check组件；消费旧纯normalizeAndValidateAnswers，不调用scoreFormResponse。产出R01–R07规则面板和预览字段错误。

- [x] 写`golden_unmapped_outcome_and_visit`、`declared_unit_mismatch`、`null_time_is_not_zero`、`preview_unknown_field_and_missing_state`、`preview_required_not_applicable_and_empty_value`、`preview_all_field_errors_and_zero_fields`，按规格真值表断言：缺字段/显式missing分别处理，required+not_applicable仍REQUIRED_MISSING，value:null/空白均EMPTY_VALUE，0/false有效，两个错误同时返回，零字段FORM_EMPTY。另验重排不改变稳定key路径/findingId，先RED再最小实现。
- [x] `node scripts/research-execution-preparation-api.mjs --case rules-preview` RED→GREEN，预览不追加版本/审计答案，不写正式Form/Subject/Visit/ScaleResult，0/false保留；结构非法400、字段业务错误200+errors。
- [x] Chrome case `rules-preview`实际定位问题→只改对应配置→保存后规则变化→预览缺失/越界/有效答案；换revision清内存答案并说明，无“已采集”文案。
- [x] 记录规则版本/hash和golden比较；AX02/AX03/AX07。

### E05（4小时）：真实AI与当前执行上下文

文件：adapter/contract/原local AI三处pending装配，Check候选展示。消费E04规则快照、原Queue/KB/Provider、原key/预算守门；产出consistency payload、不可变check与真实工具/usage证据。

- [x] 写`three_pending_families_exclude_each_other`、`queued_version_is_execution_version`、`source_or_head_changed_blocks_assistant`、`scientific_numbers_and_foreign_ids_rejected`、`old_free_key_conflicts_before_fee`、`real_citation_survives_numeric_guard_but_foreign_ref_fails`；真实[1]通过、只有6来源时[7]拒绝、[1]外20例/三十拒绝、findingId不替代引用。三生产者/全部写路径初查和最终提交均列反例，不只测新POST。
- [x] 跑相关纯测试RED→最小装配→GREEN；jobs/parser32KiB，JSON输出和1536上限，失败/缺job不伪装空闲，实际Provider输入不含预览答案和配置数值原值。`queue_append_rolls_back_with_job`和`assistant_and_completed_commit_atomically`明确两事务边界；GET完成结果不追加版本，check从不可变assistant投影。原assertAnswer先执行、新strict parse/数字guard随后，最终原beforeAssistant重验，不为新输出放宽旧引用门槛。
- [x] 检查明确本片费用授权/有效核价/原账本；不足停在实跑前报告，不自动续价。通过后仅一个新具名合成任务，checkpoint先记job，恢复只查原job，不重复付费；真实KB核验完整固定集后实际模型说明，留query/source/hash/time/usage/result与失败。
- [x] `node scripts/research-execution-preparation-api.mjs --case ai-live`及Chrome case `ai-check`验证真实内容/覆盖范围；技术轨迹不能替代AX09专业评判。AX04/AX06。

### E06（4小时）：意见、版本差异与重绑

文件：adapter decisions/rebindings/history及Check/Workspace/session。消费原不可变结果/head，产出部分意见、终结防重、旧/新配置diff和显式新basis。

- [x] 写`partial_decisions_follow_same_head`、`other_plan_write_never_revives`、`explicit_rebinding_preserves_old_basis`、`old_copy_promise_cannot_label_new_target` RED；第一批意见后executionVersionNo不变而根version/head推进；同resultMessageId+basisHash+configHash+rulesHash+revisionNo且currentRoot=head=opinionHead.lastRootVersionNo时第二批可保存，换任一项409，已终结item不可重用。正文改回/任意外部写仍stale，新revision使旧结果/意见失效而非删除。
- [x] 实现32KiB两写接口与当前CAS/幂等/真实父对象；无pending才重绑，保留旧basis/config历史；意见不清规则、不写配置、不改审批状态。跑纯/API case `decisions-history` GREEN。
- [x] Chrome case `history-dirty`：手改保存/冲突保输入、修改回原值不dirty、原生离开保护、慢复制切目标、来源受限时即使dirty也隐藏历史。陈旧配置只经显式重绑继续，不自动换来源。
- [x] 核对上游方案及原合成run/report/asset保守版本失效说明，不能在UI把旧下游继续标当前；AX05/AX07。

### E07（3小时）：实际整链与风险回归

文件：新api/browser/boundaries/gates；消费E01–E06；产出新具名证据，不读写历史夹具。

- [x] 两原账号各用一份本人可用方案→新准备→映射/预览→规则→实际AI→意见→修订/旧版失效；模型阶段逐次checkpoint和结算，禁止以旧WP05任务伪装新片AI。
- [x] 真实在途撤审仅本片新具名来源，最终job失败/assistant未发布；并发/CAS/跨账号/只读/免费key拒绝。角色撤权若需额外授权则先确认并单列未测，不挪用旧角色。
- [x] 跑`node --test tests/*.test.mjs scripts/*contract.test.mjs server/wp02/*.test.mjs`、`node scripts/wp02-kernel.mjs`、`pnpm run build`及新gates免费模式；门禁只验证既有实际付费证据，不重放模型。真实Chrome五视口/原生200%与慢读/dirty/复制/键盘，保存PNG/WebM。
- [x] 只读保全旧源码/Schema/角色/旧进程/旧行/原冻结manifest和原累计账本前缀；正式表本片零新增/修改。AX01–AX08；未测项真实登记。

### E08（3小时＋按需缓冲）：一次代码总评审与交接

文件：本片living spec、基线/变更/使用/技术/测试/版本记录与Notion；消费E07证据；产出技术交接包和待用户专业验收清单。

- [x] 唯一fresh-context只读代码总评审，限定本片及实际证据，不写文件/库、不调用付费模型/读取凭据/派代理；当前文档评审不是这次代码评审。
- [x] 主实现核对意见，范围内最小修补加失败反例再GREEN；新权限/费用/旧源/云/远端配置/发布停线确认，不为评审扩范围；无二次独立复签则如实标注。
- [x] 相关单元/真实PG/浏览器反例及免费门禁复测，截图/录屏/工具轨迹/版本血缘/费用/保全完整；同步living spec与用户入口说明、最终validation/manifest和Notion回读，不覆盖原WP05交接包。
- [x] AX09专业体验交用户：未预运行合成材料能定位依据、理解缺项和修改影响；技术四层分列。不把首片或本片等同完整WP05/一期/正式采集；提交剩余量与11/04、11/06复估。

## 计划自检及执行门槛

X01–X05→AX01–AX09→E01–E08逐项覆盖；所有生产者共享三类pending、root CAS/head/basis/revision彼此区分、原严格字段与mappings.unit一致。拟文件/命令不表示已存在，执行时先RED留痕；本片文档阶段不运行构建/业务测试冒充功能通过。

工期是32小时有效工作估计，不是全一期承诺。先请用户批准规格/计划，再实施；沿已选串行＋总评审，不再询问是否建worktree/换模式。专业模板/实际研究启动另门槛，费用到期或授权不覆盖时即停付费分支，其余安全无费用工作可继续但不销AX04。
