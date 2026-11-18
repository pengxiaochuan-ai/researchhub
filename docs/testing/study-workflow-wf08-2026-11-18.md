# WF08 后台分析、恢复与停止验收

2026-11-18。本机19501合成环境；本机合成四层核定完成，不代表生产或临床验收。WF01–WF07保留原最终记录，WF09–WF12尚未开始。

## 已实际执行

| 场景 | 实际结果 | 原始证据（均在 evidence/study-workflow-simplification-2026-11-17/wf08/） |
|---|---|---|
| 普通分析、202丢响应 | 原键GET找回原Job；不重新放行、创建 | root/job1-read-2026-11-17T20-22-14-739Z-b2219b81/ |
| 普通未完成切点重启 | SIGKILL29388→49440，原120秒租约后同Run/inputHash，generation2/attempt1，派发/发布各1 | root/d-watch-restart-2026-11-17T20-48-06-355Z-ordinary-bound/；root/job6-known-ui-read-closure-v1.json |
| 整课题部分完成重启 | SIGKILL49440→56634；原租约到期仅接续未发布；39适用项完成、15不适用不计算；切点已发布行/审计、40快照与group行保持 | root/job2-read-2026-11-17T21-12-23-859Z-3736413d/；root/job2-cause-v1.json；root/job2-protection-v1.json |
| 原停止失败 | Job3取消POST为0；轮询误关确认框，Worker按时恢复后39项完成，仍待独立审核。失败不改绿 | root/job3-failed-case-summary-v1.json；root/job3-failed-case-global-protection-v1.json |
| 停止修复复验 | Job7实际UI创建/取消各1，非清理代签；已发布1保持，3个在途HTTP200均晚于真实取消成功响应、零迟到发布，原pending claim结清 | root/job7-execute-2026-11-18T01-40-58-772Z-4665a180/ |
| 科研身份仅计算与失权 | 科研authVersion0从已放行快照开始；仅撤本轮新project关系，Job blocked、实际迟到200/零发布；原样恢复该关系后仍不自动重算 | root/job4-execute-2026-11-18T01-55-29-038Z-6550d905/ |
| 新计划批准撤销 | 仅新计划1/审批2/快照1；撤销该新批准后Job blocked、实际迟到200/零发布，旧计划未变 | root/job5-execute-2026-11-18T01-57-25-243Z-129bf578/ |

停止复验Worker暂停有独立子进程CONT watchdog，3500ms ACK后才STOP，保原8秒HTTP超时；Job7实际暂停约1.9秒。未更改DB租约、时间或旧任务状态；不声称未发布重试的物理计算恰好一次。

## 页面修复与回归

1. 接纳收尾原effect随轮询/父回调再次关闭停止确认框。真实React RED→GREEN后，仅新createKey接纳成功时消费一次，仅关闭开始确认；停止确认、未知核对、Esc/取消及焦点保留。证据：`d-stop-modal-hotfix/stop-modal-freeze-v1.json`，实际GREEN目录`browser-2026-11-17T21-28-00-062Z-4bfdf3d2`。
2. 科研身份辅助编号请求403曾经清空计划并卸载确认框。编号读取改为独立、可取消的只读client，403只影响编号提示，401触发现有登录核对；分析本身权限/来源/写入守卫未变。原403证据`root/researcher-subject-label-denial-v1.json`；上述Job4真实UI通过；单元回归覆盖授权计划不受辅助显示拒绝影响。
3. Methods已有runId的只读结果页误调用不存在的preview方法。自动预检仅在新计划且adapter提供preview时执行，已有runId不自动预检。原浏览器异常、两项RED及GREEN分别留于`root/methods-preview-regression-*.log`；实际正常结果图见`root/readonly-ui-admin-2026-11-18T02-11-29-881Z-b0e56cc7/native-result-diagnostic.png`，该诊断目录不充整套矩阵通过。

管理员新鲜矩阵已通过：`root/readonly-ui-admin-2026-11-18T02-12-30-786Z-7ebb5178/`。五宽360/768/1024/1440/1920及真实Chrome原生200%，确认取消/焦点、原结果与后台任务往返；PNG/WebM、精确身份/HTTP/状态/14-22和逐行链接命中有据，零业务写。科研身份新鲜矩阵亦通过：`root/readonly-ui-researcher-2026-11-18T02-15-16-791Z-9fa73234/`。两矩阵均零业务写。

旧QA用多行链接总包围框的行间空白作命中点，已改为实际每行client rect；失败原件保留。S05既有概览在1024有文档级横向溢出，新增Job控件自身与提示完整；该旧区域问题交WF12收敛，不能据本报告称整页无问题。科研编号的精确403/code作为预期拒绝单列，其他HTTP/JS错误继续失败。

## 数值、保留性与范围

独立Python标准库从每份固定快照的原单元格重算描述统计，未导入应用投影、评分器或Worker；容差1e-12。普通2、整课题39、原失败停止任务39、成功停止前已发布1，共81个已发布结果通过。输入/结果位于`root/*-statistics-{input,result}-v*.json`；未发布/受阻不补零、不制造结果。

本轮有界预算：7Job、3full group、86NativeRun、42snapshot、1plan/2review、新Session至多1、7条新授权关系。使用原campaign-before与精确causal IDs投影，不替换旧基线；已完成新增行另按逐行MD5冻结，防新增白名单掩盖后续修改。原81表、7补表、591个KnowledgeJob与科学Word（22581字节、SHA e961a2b57679f1ae9bd40a37bd49c16b268323826b58cc68fef98be208b21bb7）保护。最终矩阵后原始基线和新鲜前后窗口均保护通过：`root/final-original-preservation-v1.json`、`root/matrix-zero-write-proof-v1.json`。

历史前端维护契约1294通过/1跳过、15个真实统计PG回滚通过均早于最后页面修复；不冒称最新全仓测试。旧Excel自动上传浏览器断言与现行归属研究交互不符，原独立复现保留，未改其产品。最终相关测试与构建见终态清单。

## 四层结论

代码、目标启用、真实请求与本机合成业务结果四层均核定；专业可用性按用户不反复签收的授权代理核对。最新相关140/140与最终构建通过，文档/Notion记录及完整绑定见本项最终清单。不涉及真实患者、生产部署、真实邮件或模型/云付费能力；真实临床与生产仍另行验收。
