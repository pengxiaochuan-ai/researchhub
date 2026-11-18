# WP07 D08 唯一独立代码总评审包

2026-10-26；当前目录串行实施＋一次fresh只读总评审。不是上线/合并授权；AC10专业验收待用户。请按完整文件审查，不仅git diff：新增文件尚未跟踪。Base=Head=`190f509d127b833a9380dfdf52916f20038b6f9c`，分支codex/ui-ue-validation；不得改工作树/index/HEAD/分支，不建立worktree，不派代理，不访问秘密/远端配置，不跑付费或写库harness。

## 需求与权威

- [规格](../../product/synthetic-crf-methods-spec-2026-10-25.md)、[八步计划](implementation-plan.md)、[授权](authorization-scope.md)、[执行台账及Ruling](implementation-progress.md)。历史阻断保留，当前D05–D07技术结果以台账首节为准。
- 本人真实合成CRF→冻结版本→原Python t19-1确定性缺失/人工范围窄投影→真实科研Agent第五意图只解释→新本人可追溯方法报告draft/说明历史。LLM不接科学数字/原答卷、不计算；不改旧Worker/源码/Schema/角色/旧任务。不开放正式采集/审批/锁库/共享/导出/发布。
- 仅专用合成库、原两账号/当前Study/本人新对象。终态run包括artifactRefs/updatedAt全只读；选择/请求hash/版本在原KnowledgeChatJob，原Message和Audit绑定。原授权锁→精确本人run行锁→重验父/当前数据/DQ/result。报告复用原Artifact/Version/Sources/Audit，notes不改facts。
- 最新299组合＋1054原内核/构建/保全五门；真实PG、Chrome、Worker、Provider分列下方，不用Mock宣称业务验收。原四次付费请求全部用完（含前失败1次）；79笔known/¥1.518966/¥5，无再调用许可。

## 精确文件与源码hash

同目录`d08-source-manifest.json`为本次读取清单及SHA256。核心：scripts/local-crf-methods{,-ai,-reports}.mjs、synthetic-crf-methods-{contract,ai-contract,ai-approval,report-contract}.mjs；pages/shared/CrfMethods{Workspace,Results,Interpretation,Report}.jsx和crf-methods.css；src/crf-methods-session.js；对应synthetic-crf-methods-*.test.mjs及fixtures。

窄集成上下文只查本片分支：local-knowledge-ai.mjs第五kind装配/原消息来源；local-knowledge.mjs原队列事务hook/精确路由/体积守门；local-synthetic-edc.mjs冻结版只读暴露；knowledge-session.js白名单；research-design-session.js身份；platform-shell.js页头；platform-frontend.js显式真实路由；missing-main.jsx分流；SyntheticEdcWorkspace.jsx S05叶子入口。其他旧底座缺陷不得扩成这次改造。

## Review Focus（计划原文）

1. 看似合法的CRF值：0/false、未适用/未测、选填缺失、不同访视分母、手工范围缺省，不得变成默认年龄或独立样本假设——D01/D02/D03。
2. Worker“成功”但语义不适用：固定20%/50%、range.n=1、未覆盖零值/全Study矩阵，必须隔离并显示coverage，不能进入AI/报告——D01/D03/D05/D06。
3. 数据或权限在途中变化：创建/认领/Worker前/结果或assistant提交/历史读取同一可信链，CAS/失权/真父冲突拒绝交付——D02/D03/D05/D07。
4. 慢轮询/分页/历史/dirty/迟到200：共享single-flight、身份fence、保存保留原CAS，不使busy卡死或历史复活——D04/D06/D07。
5. 失败测试本身意外提交或计费：注入未命中必须事务内abort、免费与付费门禁隔离、同键不重放、原记录保全——D03/D05/D07。

## 真实证据（只读）

父仓库`docs/test/evidence/2026-10-25-researchhub-wp07-crf-methods/`：

- wp07-ai-3b8f41c2：两账号实际工具/Agent/Provider/不可变解释；第三个在途数据变更不交付。成功正文实际仅[M1]/[M2]，不宣称新[1]引用；原KB工具实际执行。
- crf-report-6c0788b1、report-pg-ca25d630：原服务实际提交/独立连接/回滚/来源hash/CAS/只读run和包。
- report-browser-fa23a39e、report-risks-25fcd759：两账号/五视口/说明冲突/历史/6秒单飞/真scope失权/实际退出迟到200/原生200%。预期401/409不等于零console信息。
- d07-e2e-6e69a3ef：整链、仅原本轮inflight包更正/重检/旧新比较、不再模型调用。
- reading-ff68479b：最终UI-only标题h3/h4/16px28px，两账号只读。
- free-gates-58d0c4cf：最终299/1054/构建保全空白；已知localstorage和chunk警告保留。历史失败目录不删。
- 原WP06证据目录legacy-75bb5f3a仅原链只读回归，不能当新CRF计算。

## 评审输出

独立按正确性/清晰度/架构/安全/性能逐文件判定，测试先读，必要只运行本片纯`.test.mjs`（不调用模型、不写库、不跑上述harness）。不要只复述已通过测试。给Strengths；Critical/Important/Minor（精确file:line、复现、用户影响、建议）；逐项Review Focus结论；未覆盖限制。规格不穷举全部输入，按合理用户实际影响评级，不能因规格沉默降级。

必须列“Declined to judge”：每项考虑后搁置的行为及原因，空则明确空。最后明确本机技术交接Ready/With fixes/No，不能代用户AC10、不能建议自动发布。主实现会统一重新定级并对确认重要项做一次RED→GREEN修补，不进行第二独立复签。
