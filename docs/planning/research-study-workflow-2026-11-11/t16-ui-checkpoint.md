# T16 S06 正式描述统计页面 · UI交付检查点

2026-11-12。承接已授权19项任务中的T16；T15 S05已收口后实施，保留S06母版与Shell。该检查点只证明本机通用合成案例的页面包，独立审查、产品文档与Notion收口由主循环完成后销项。没有把本机证据当作临床或生产验收；主ONSITE/H5/CSV三人未被本页验收修改。

正式入口为S05当前有效快照的“运行描述统计”，到 `formalMethods=1&studyId`，可带固定planId+snapshotId或runId。沿用研究摘要、九页签、原三栏/下方结果与来源区域，未新增导航/页面/全局样式。桌面原三栏保留；窄屏只用本页限定的现有适配模式解除旧HTML最小宽度。普通用户不填写内部ID、摘要或请求键。

页面真实读取当前Methods能力、运行状态、固定AnalysisBasis与快照、固定字段标签、Worker outputs及逐项numericEvidence。数值只显示服务器存储值；0、false、缺失及未定义样本标准差保真。没有疗效/P值/安全性/AI结论/报告的区域明确空态。列表标明最近最多50条，投影元数据；失效来源和读取失败不保留旧统计。管理员审核，具有实际分析权的研究者运行和取消但不能审核；不从客户端role或S05能力推断方法权限。

创建与审核响应未知仅GET原回执，再核当前Run/capabilities/来源；404保留最小标记禁新写。取消没有原动作回执，未知只核原Run当前cancelled元数据，不称原取消回执、不重POST。标记仅actor/authVersion/Study/action/runId/snapshotId/requestKey七字段，意见与数值不存浏览器；意见十五分钟内存限时包含POST200但当前核对未完成的分支。当前用途/身份失效清敏感界面，普通409/503保留未过期意见。共享确认支持Esc/焦点恢复，离开取消与beforeunload保留。

## 真实证据

目录均在 `docs/testing/evidence/research-t16-2026-11-12/`，每项保存实际HTTP元数据、PNG、WebM；合成账号Cookie没有写进证据。

| 包 | 证据与结论 |
| --- | --- |
| 主流程 | `methods-ui-a31ee85c/result.json`：S05固定快照→有分析权研究者UI显式运行→真实Methods/Worker→独立generic-v1 oracle与numericEvidence；一次dispatch/response、llm=false；研究者无审核UI且真实review403；管理员审核/原GET回执/当前completed；显式新Run取消、owner403、实际解锁使旧统计清除。 |
| 原恢复回归 | `methods-recovery-39fc8627/result.json`：完整原九项通过，含实际all_missing/single_observation及null标准差、unknown create/review/cancel、15分钟、刷新原GET、404、503、审核竞争、身份和用途撤回。此为早期通过证据，后续外层异常补验见下行。 |
| 外层恢复修复后 | `methods-recovery-659e55ad/failure.json`：前九checks真实通过，含原review回执200后capabilities/list注入503清旧值并保留标记、详情503、取消后来源失效、单观测0、CAS409、身份切换。最后withdraw初始GET遇到runtime停机，保存ERR_CONNECTION_REFUSED/ERR_EMPTY_RESPONSE原失败，不把此文件称为整包通过。 |
| 只补未执行撤回 | `methods-withdraw-recovery-4a2cbc5c/result.json`：恢复环境后只读核同一owned single来源及当前表格200屏障，执行此前尚未执行的一次新用途撤回→focus清统计。0 Methods POST或旧动作重放。与659前九项合并覆盖增强后的十项。 |
| 已保存但待核对的TTL | `methods-ttl-4001dbd1/failure.json`真实RED：POST200、原回执GET注入503、15分钟后意见仍保留。`methods-ttl-45b69028/result.json` GREEN：仅删除POST返回时提前清timer，成功forget仍清；同固定快照显式新Run后，1 review POST、原标记保留、意见清除，无重放/clock刷新。 |
| 最终视觉与交互 | `methods-visual-d293c802/result.json`：全新独立来源；桌面1440、390、Chrome原生200% PNG/WebM/CDP，浏览器business POST为0。14/22，文档宽度分别1440/390/720，表格独立横滚；桌面原三栏378.406/340.594/420；原生inner720/outer1440、DPR2、scale1。数值末列未截断/四舍五入，布尔表、共享审核确认Esc/焦点、离开取消均实测；0 pageerror。三图已实际查看。 |

## 保留的失败与修复边界

- `methods-recovery-17b841d6/failure.json`：原review回执200、当前Run GET503时旧表仍显示；已在acknowledged先更新安全视图后报待核对，39fc相同反例通过。
- `methods-recovery-b27c00f7/failure.json`：独审指出的相邻list/capabilities在readView try外抛错，recover catch只报错，旧表仍1。统一recover非敏感失败清结果与verified、保留原marker及意见，659对应两项通过。
- `methods-visual-828c3c8c/failure.json`：390继承旧HTML min-width1280。仅S06页限定窄屏适配，最终d293宽度390，桌面原比例不变。
- `methods-recovery-afcaee77`/`2d3e4c14`为早期clock/故障屏障位置不当；保留并修harness，不当作产品通过。`15d1208e`在多余显式clock.resume轮次无进展后只终止已核command的自有harness进程；未触runtime，未重发原操作。
- `methods-recovery-2d05c2d3`刷新连接中断，主循环同期观察runtime变更；`659e55ad`及`methods-ttl-1420ca31`有明确connection refused，发生20750→42310→47879→50403环境更替期间。未将其归咎clock/Methods/业务；保持失败文件，恢复后只补未执行步骤。
- `methods-ttl-e165828a`为harness把fixture计划审核与运行审核一起计数，尚未到TTL断言；改为精确Run路径后才采纳4001/45b RED/GREEN。

runtime控制始终由主循环负责；本页脚本不含stop/start/reload。最终UI写窗口已关闭，主循环可推进T18主案例。最终源SHA、完整前端单元测试和独立tmp构建日志在 `ui-freeze/manifest.json`；不会覆盖共享dist。任何后审增量保留原freeze，再附postReview而不重写原通过证据。

建议下一项：主循环完成T16独审、living spec/手册/版本/专项文档与Notion同步后，承接已授权T17 S10报告整页，把当前已确认Run与真实报告、审核、发布、受控DOCX下载连通；本包不先做S10。

## PostReview：完整数字单行呈现

主循环查看d293真实390截图后要求：数值单元格保持完整原值且不因全局word-break折成两行。仅本页 `.fm-table-scroll td` 设nowrap/normal word-break与overflow-wrap；容器继续横滚，14/22与桌面三栏保持。不更动数据或舍入。复用d293已保存且当前有效的独立Run做三视口只读复核，不创建fixture/Run或提交审核；数值文本Range单行矩形、无文档横向溢出、共享确认取消及焦点一并核验。最终结果/源SHA/日志另存 `ui-freeze/post-review/manifest.json`；原manifest、图、证据及更改前CSS/检查点/visual harness原文保留。

PostReview结果：`methods-visual-9d4adbfa/result.json` passed，复用d293同一Run，0 business POST；桌面/390/原生200%全部数值Range为1个单行矩形，完整原串 `2.82842712474619` 保留，14/22与原三栏不变，文档无横向溢出，三张末列图已实际查看。前端469/469、独立tmp build5.87s均exit0；原freeze未改，post-review包含三项更改前源码归档与新SHA。
