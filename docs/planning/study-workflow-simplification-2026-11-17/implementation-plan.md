# 课题流程剩余优化串行实施计划

**Goal:** 将用户当前审查出的全部剩余优化逐项实现并验收。
**Spec:** `docs/product/study-workflow-simplification-2026-11-17.md`。
**Architecture:** React原页合并意图、原生API逐步授权/CAS/回执；仅持续计算增加必要持久作业边界，实施前独立ADR。

## 裁定

- 用户已批准原建议实施且拒绝反复确认；所列页内按钮/衔接即本轮UI边界，沿原布局，不新增全站设计。
- 当前非main共享分支codex/ui-ue-validation含大量未跟踪真实运行代码；不stash/reset/switch/删除他人增量，不用缺文件的干净HEAD替代运行基准。每项先存before/hash/patch，只改具名文件，不混合提交他人工作。
- 至多实施一个功能；子Agent只实现本项，根负责目标I/O和集成。真实临床资料未知不编造。
- 成功步骤不重播，unknown先只读核定；旧19任务/资产/视频仅保护与共享入口协调。

## 串行任务

| 编号 | 目标 | 依赖 | 状态 |
|---|---|---|---|
| WF01 | 保存并准备研究 | 无 | 已完成（本机合成） |
| WF02 | 已审核原生模板带入及差异核对 | WF01 | 已完成（本机合成；form_score明确阻断） |
| WF03 | 自动核对提交与批准并启用 | WF02 | 已完成（本机合成） |
| WF04 | 入组核对 | WF03 | 本机合成核心四层与390只读补证已有证据；已完成（本机合成；文档同步记录见最终清单） |
| WF05 | 今日待访视直达 | WF04 | 已完成（本机合成）；代码/准入/真实业务/全仓/保护/读切片补证根验；Notion同步记录见finalmanifest |
| WF06 | 集中审阅关注项优先 | WF05 | 已完成（本机合成）；14文档/11页Notion同步，证据见final-manifest |
| WF07 | 确认数据并开始分析 | WF06 | 已完成（本机合成）；四层、9份最终产品/技术文档及10页Notion，见wf07/final-manifest.json |
| WF08 | 持久后台计算/离页与重启恢复 | WF07 | 已完成（本机合成；7Job、两真实重启、停止/失权/撤准、双身份多宽及保护；既有概览布局留WF12） |
| WF09 | 统计直达报告预览 | WF08 | 已完成（本机合成；58项、真实两报告/恢复、13文档与11页Notion；见final-manifest） |
| WF10 | 准备并下载Word单动作 | WF09 | 已完成（本机合成；63相关、两真实文件、六宽/200%、中断/旧回执及旧行保护；文档/Notion见final-manifest） |
| WF11 | 更正影响及重新交付引导 | WF10 | 已完成（本机合成；49相关/PG回滚、双身份六宽/200%、旧报告文件阻断/现有交付往返、恢复与旧行保护；文档Notion见final-manifest） |
| WF12 | 四阶段任务入口与整体贯通 | WF11 | 已完成（本机合成；69相关/3PG回滚、两完整旅程、六宽/200%整卡/逐入口、恢复/身份、两原Word复用和最终保护；文档/Notion见final-manifest） |

## 每项完成合同

1. 读取本项brief和当前代码，先存before/最小UI差异与三侧影响。
2. 行为测试真实RED→最小实现GREEN；权限、来源、部分成功、unknown、迟到与输入保护反例齐备。
3. 相关单元/原生集成/构建通过，日志定向证据目录。
4. 协调19501窗口，记录实际加载源，以新合成对象真实请求/native审计/回执验证，保护旧事实。
5. 科研/管理员完整页面、恢复、五宽/200%/键盘及PNG/WebM；按既定标准代理核定。
6. 独立审查、必改问题修复、文档/Notion同步；全部通过再记完成，直接推进下一项。

WF08先拆持久作业合同、调度/恢复、客户端/离页真实验证三个依赖子步骤，不以默认关闭旁路销项。后续brief在轮到本项时按实际前置输出补齐，不提前开发多个功能。

## Review Focus

跨账号/authVersion/Study迟到；部分成功重复写；批准后来源/政策变化；纯GET误离开保护；持久作业租约到期重复派发或恢复无关历史；模板失权及临床固定版本；导出未知与下载时身份变化；四阶段不新增临床门禁。

## 台账与证据

`progress.md`逐项四层，`findings.md`记录裁定/失败；证据根`docs/testing/evidence/study-workflow-simplification-2026-11-17/`。首项详`briefs/wf01.md`。每项完成更新对应living spec/手册/版本及Notion。当前WF01–WF12全部完成本机合成范围，原逐项真实执行与最后整体回看分别有证；不把旧访视验收替代全部任务。

## 历史实施记录（保留当时状态，当前以顶部串行表及最终清单为准）

## WF04当前收口（2026-11-17）

V2十四源/native七源冻结，native37、实现/独评84、根105、全前端1082通过/1跳过/0失败，隔离构建5.15秒；六PG整事务回滚外0残留，v1筛选机制409与P2三RED/全部attempt保留。根目标84835→30580，原生UI恰3create/7record/2enroll，rawDB12proofs/24业务审计；A、B两类200丢响应严格GET恢复、B原tab刷新保原key/hash/未发eventHash/固定期限，明确继续及入组，D仅失败筛选有证。2anchor/4planned访视/16missing要求/2open fallback任务，零分配/启动/答案，旧13人及WF01–03/科学/Word/155job保护。

原390末项过渡/hover遮挡失败PNG不覆盖；新鲜390页面三点命中、drawer right=0与14/22只读补证通过，产品/Shell未变。根最终独立代码与真实证据复核通过；文档同步记录见最终清单，后续按序WF05；WF05–12仍分别实施和验收。[本项报告](../../testing/study-workflow-wf04-2026-11-17.md)。

## WF05已完成（本机合成，2026-11-17）

V3十源冻结，native4及组件/CSS/S01相对V2不变；相关/独评99、JSX3、build5.61秒。真实只读PG12、六HTTP GET与phase2两角色22条/1more/旧3新1导航逐项有据；首5+17的一次展开加进入为2动作，不把总点击写1。五宽/native200正确2.600s录屏帧/14-22/三点hit、500重读/clean reload、最终591全job/旧行/科学/Word保护通过本模块标准，0业务写/分配/启动/答案。

原QA155误作591、日期P2、V2四次more、phase1因精确新AI01外部audit严格拒绝及native200 PW裁片均保留；新阶段5/5 validator先行、实际新before完整含新事件且原before不覆盖/0旧行减少，不能称全球0增量。

原全前端V3 attempt的1084pass/4fail/1skip历史保留；新共享准入装配后根在74871核四源hash/两表/QA身份approved metadata，9GET及双角色首5→1more22、native全scope href一致通过，fresh strict全旧行/591/科学/Word及准入本窗口metadata另保护通过，0采集/业务写；跨期42audit不当F01业务或本次写，原baseline不改。最新构建4.71秒；当前全前端含两个真实rollback PG完整1176总/1175pass/1skip/0fail、fixture14/14，末次全旧行/591/科学/Word/角色及准入两表完整rowhash另保护通过，原after仅RAM续用、不改旧文件。两fixture配置中止attempt/真实504保留，不填完整计数，产品未因此改变。源矩阵和末审原pending=true保留，后续精确还原快照wholeSHA命中目标、仅list-body差异且读切片同hash，已关闭来源待项；policy仅owner声明/current hash，不称独立历史比对，不背书F01独立list。WF05已完成（本机合成），Notion同步记录见finalmanifest。目标已释放给F01，WF06–12未开始；WF06仅可另作设计预备，代码仍待本项正式封板后再按序推进。[报告](../../testing/study-workflow-wf05-2026-11-17.md)。

## WF06本机合成已验（V6）

WF06本机合成已验；Notion同步及最终完成状态见本项final-manifest。 当前六源冻结V6，关注原因先于原题、两个filter primary与aria同步；原source/资格/20上限/CAS/批次恢复保持。相关/独评101、集成18、build4.80秒；全前端1197pass/1skip/0fail、93.828秒。根同源两角色/五宽/native200、原值/单位/S05/确认取消及三次fresh0写/591job/科学Word核定；保原失败，literal N/A/uncertain0/0和双方eligible2如实。所有目标已释放，WF07未开始，按最终清单后再推进。用户本人新签收与代理本机验收分开。见[报告](../../testing/study-workflow-wf06-2026-11-17.md)。
