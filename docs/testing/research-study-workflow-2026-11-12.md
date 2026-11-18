## 2026-11-13 · 科研课题流程19项验收完成

用户已对更正后最终Word报告明确回复“核对通过”。T00–T18共19项的代码、目标本机配置、真实执行与通用合成业务验收全部完成；[业务验收原件](evidence/research-t18-2026-11-12/corrected-report-6277b638/business-acceptance.json)绑定同一报告和文件摘要。真实临床规则、专业签认与生产验收仍独立未验。以下技术阶段的“待用户反馈”属于验收前历史，当前状态以本段及机器台账为准。

## 2026-11-13 · T18 同一研究更正后报告技术闭环

T00–T17保持本机通用合成软件范围通过。T18在同一主Study完成现场、实际邮件H5与CSV采集，原固定分析/报告交付后，仅现场观察值0→1形成ref2；重新审阅锁定、访视重核及新快照完成，原批准计划不变。原H5的1.5/2/是、CSV的4/缺失/是及来源、时间、批次保持，旧当前结果/报告/文件受阻，旧历史和已下载原文件保留。更正后同一新Run实际计算一次并人工确认，新artifact/v1报告已审核、发布、真实Word下载并逐页检查。

T18代码、目标本机配置、真实执行与用户业务确认四层通过；T00–T18共19项本机通用合成验收完成。临床/生产仍未验。

- [更正与新依据](evidence/research-t18-2026-11-12/after-confirmed-review-3111dc32/result.json)：7项原journal动作包含一次被拒旧导出；根独立只读确认其operation为零及旧job/file各一项。
- [更正后原Run确认](evidence/research-t18-2026-11-12/corrected-method-d9292461/result.json)：cmwdq0636001jlud6scho3s1q，completed/confirmed；原创建键保留、实际Worker一次。
- [更正后报告](evidence/research-t18-2026-11-12/corrected-report-6277b638/result.json)：[Word](evidence/research-t18-2026-11-12/corrected-report-6277b638/corrected-report.docx)，根已核最终所有页面，原技术结果保持passed:false历史，新QA结果通过。
- [当前源码验证证据（含分阶段窗口）](evidence/research-t18-2026-11-12/read-isolation-final-proof/result.json)：549项前端测试、隔离构建、S10六项只读及[S06读取隔离](evidence/research-t18-2026-11-12/method-read-isolation-8f3f43b3/result.json)；真实列表耗时记录在该证据。

保留首30秒/续90秒UI失败、原get列表20秒abort及锁路径诊断；四路并发未实施。源码与runtime窗口均按实际producer保存，不由旧阶段拼成同一运行。角色边界见[最终矩阵](../planning/research-study-workflow-2026-11-11/t18-final-role-compatibility-matrix.md)。

# 科研课题同例贯通验收 · 2026-11-12

需求对应[13模块复用清单](../product/research-study-module-reuse-2026-11-11.md)与[19任务计划](../planning/research-study-workflow-2026-11-11/implementation-plan.md)。T00–T17已按本机通用合成软件范围关闭；T18更正前后分析与报告、更正失效及新交付的技术链均已完成，最终用户已明确核对通过，19项本机通用合成四层验收完成。临床规则/专业签认与生产启用独立未验。

## 统一对象和证据边界

同例从 `rh-workflow-benchmark-747c689d` 的通用新合成研究出发：Study `rh-study-72203d59-4db8-4e74-9444-edff3b088b6d`，同一执行项目、固定表单、BASELINE访视，三名分别来自现场录入、实际邮件H5和CSV导入的合成受试者。创建、方案提交/审批/启用与入组前缀使用真实API；采集/快照/Methods已有真实UI证据。不能把这个同例前缀描述为全部由页面点击创建。创建功能另有[独立真实UI回归](research-t02-t03-current-2026-11-12.md)。

真实邮件仅发送一次，指定用户在垃圾邮件中找到并提交原邀请。H5答卷实际填1.5、2、是；保留原值及来源，不能为符合最初建议输入而覆盖。原H5提交后自动刷新/重复感谢提示已修复，详见[T11/T12证据](research-t11-t12-2026-11-12.md)。垃圾邮件中找到不等于正式邮件主收件箱投递质量验收。

独立Python基准固定为[generic-v2](fixtures/research-study/generic-v2/oracle.json)，SHA256 `f0dafb552f6ffc43340a61c11c2fe7abc661cc15059a9b7a43b26d5fb8737f3b`，在主Methods执行前冻结；首版基准不删除。工程跨持久层数值对照容差为事先声明的1e-12，报告显示及DOCX严格复制实际已保存Run的数值字符串，不由LLM计算或补齐。

| 渠道 | 观察值 | 选填观察值 | 已完成 | 原固定修订 |
| --- | --- | --- | --- | --- |
| 现场 | 0 | 0 | 否 | ref1 |
| 实际邮件H5 | 1.5 | 2 | 是 | 原邀请答卷ref1 |
| CSV | 4 | 缺失 | 是 | 原批次ref1 |

CSV的导入通道由不可变批次回执、行来源和文件摘要举证；正式修订本身的source可为researcher，不能将此误报为没有导入。0/false保持观测，缺失不补零。

## 已实际通过的主链

| 阶段 | 实际结果 | 证据 |
| --- | --- | --- |
| 同研究采集 | 原三人正式答卷审阅/锁定，访视completed/current；原H5及CSV来源保留 | [main-capture-ca263fff](evidence/research-t18-2026-11-12/main-capture-ca263fff/result.json) |
| 固定分析依据 | 同三人/三字段的原计划已批准；放行快照 `t15-snapshot-abbde046-27b9-4113-b7ce-9a1ece74ca90` | [main-basis-41f5ebd1](evidence/research-t18-2026-11-12/main-basis-41f5ebd1/result.json) |
| 实际统计与人工确认 | Run `cmwdd8a1g0031luw3dlzct2dg` completed/confirmed；实际descriptive-v1/t19-1 Worker一次dispatch/200，映射v1/v2/v3到固定原字段后符合Python基准 | [main-method-d7213f7b](evidence/research-t18-2026-11-12/main-method-d7213f7b/result.json)、[分阶段说明](evidence/research-t18-2026-11-12/main-method-d7213f7b/phases.json) |

原Methods首阶段实际create/review及Worker已成功，末尾harness误把正常`/auth/renew`当业务异常失败；失败记录保留。后续仅GET核对原运行和原键，零业务POST，通过新证据。不能把首阶段失败删掉、重复创建或宣称后阶段重新执行了Worker。

## 验收核对项与剩余业务确认

- [x] S10独立整页：固定正文、审核、发布、真实Word ready/受控下载、只读reader与受限账号、未知原GET/TTL/来源变化、三视口/独审/文档与Notion。
- [x] 原主Run基线固定报告实际审核、发布、真实DOCX受控下载和逐页可读性核对；证明包含四动作原身份与原键，不以queued回执代ready。
- [x] 仅现场value 0→1，ref2审阅锁定/访视重新核对；H5/CSV原答案、修订、时间和批次均不变。
- [x] 原快照/Run/报告/导出/文件/操作回执当前新用均由精确来源错误阻断；原历史与已下载本地文件保留，拒绝导出零新增job/file/operation。
- [x] 同一原批准计划新快照、新Run及人工确认，对照既定`correction.expected`；新artifact/v1报告审核/发布/真实Word交付，不覆盖旧artifact或旧正文。
- [x] 实际角色、跨范围/撤权与兼容矩阵证据汇总；明确未挂载旧generic控制器和G01/A01/A02未开发页面的边界，不用404冒称其源码守门实际执行。
- [x] 本地living spec/版本/手册/技术/测试和Notion同步回读。
- [x] 用户已于2026-11-13对最终Word报告明确回复“核对通过”；T18.businessAcceptance已据此设true。

更正脚本、新Methods和主报告脚本的准备合同分别见[t18-correction-acceptance](../planning/research-study-workflow-2026-11-11/t18-correction-acceptance.md)、[t18-corrected-method-acceptance](../planning/research-study-workflow-2026-11-11/t18-corrected-method-acceptance.md)、[t18-main-report-acceptance](../planning/research-study-workflow-2026-11-11/t18-main-report-acceptance.md)。准备时的marker及各次失败记录保留；根评审后按实际阶段执行、更正与原键只读恢复，最终通过证据见本文件开头。未重建已创建Run、重发邮件或覆盖原报告。

## 角色与兼容性口径

跨租户补证准备：仅复用已存在的旧创建合成Study `rh-study-6ef2d1f7-abc0-43ce-9dc2-554d1c980891`（创建证据`rh-create-39ca8c05`），先受保护READ ONLY确认其tenant与当前主Study不同，再用当前已认证管理员只读访问其Study/configuration/analysis/reports及正式S01/S05/S06/S09/S10；预期404安全受限并核同账号主Study正例200。该补证不创建租户/账号/Study、不改权限和来源、不重载、不发业务POST；真实结果另附，不把准备文字当执行证明。

实测已完成：[cross-tenant-ro-d0ae9ac2](evidence/research-t18-2026-11-12/cross-tenant-ro-d0ae9ac2/result.json)。受保护READ ONLY证明另一租户Study实际存在；本机当前租户管理员对主Study/配置/Run均200，对该外租户Study/配置/计划/运行/报告/既有job及file路径9项均404 `RESEARCH_NOT_FOUND`。真实Chrome五页安全受限、0业务POST/无页面异常。首S01图为Shell身份核验中间态，保留并补[身份完成后S01](evidence/research-t18-2026-11-12/cross-tenant-s01-stable-5204256c/result.json)；[根五图审阅](evidence/research-t18-2026-11-12/cross-tenant-ro-d0ae9ac2/root-visual-review.json)对应各实际文件。该证据是跨租户读取拒绝，不扩大为所有写路径或所有临床中心的实际验收。

主报告写入前另有[只读来源预检](evidence/research-t18-2026-11-12/root-baseline-preflight-e8c64854/result.json)：三原ref/答卷/访视与已确认Run完整回读一致，当前四报告权限及DOCX服务可用。整个Study有其他独立Run报告，主Run尚无报告；前次harness错误要求整Study列表为空已留错因，改成逐详情按精确Run区分，0业务POST、未改产品或数据。

当前普通Methods研究者以实际Agent/Skill/Study授权执行，管理员实际核对；报告reader的合法artifact.read与Methods执行授权分开。现有owner角色的报告list可200但detail因缺data.analyze而403，不能把list200当正文授权或为了验收改旧角色。未入研究账号404；当前权限和来源须贯穿回执/文件读取。

T17已有实际旧消费者只读证据显示正式报告排除P01/A01/A02候选，明确资产/方案域读取拒绝；旧generic Artifact/Export/File控制器在当前目标未挂载，其正式与普通ID均404，不能声称已实际运行源码中的409保护。G01和generic assetId页面在当前真实模式仍为明确未接入状态；本任务不将其整体开发并入范围。S10提供本研究报告的真实审核、发布和受控交付，不等于公开发布或自动资产沉淀。

最终状态以[机器台账](../planning/research-study-workflow-2026-11-11/continuous-status.json)和[连续记录](../planning/research-study-workflow-2026-11-11/continuous-execution.md)为准。本工作稿仅记录已观察事实及必要缺口，不把测试通过代替用户业务核对。


## 主S10基线报告实际交付

[main-report-217cd513](evidence/research-t18-2026-11-12/main-report-217cd513/result.json)已沿真实S06→S10生成、审核、发布并受控下载固定报告；原同一admin/authVersion5的四动作各一次200，原回执与当前来源确认。artifact `rh-formal-report-54284b85-c8de-4983-b485-3577dbd40775`、job `cmwdivydv000llul1ceeucubw`真实ready，DOCX12552字节，SHA256 `96e4dde7396871bcba5d04e32a72ead4b4f3895fffeb9905d977e95567815799`。原三人、实际H5、CSV批次、快照与confirmed Run均逐阶段保持；没有邮件或来源写入。

[真实下载Word](evidence/research-t18-2026-11-12/main-report-217cd513/main-report.docx)、[逐值/字段/来源验证](evidence/research-t18-2026-11-12/main-report-217cd513/word-verified.json)、[根五页核验](evidence/research-t18-2026-11-12/main-report-217cd513/root-visual-review.json)与OOXML通过；本机PDF/PNG只是审阅衍生物。全部五页已实看，完整数值采用持久Run原字符串，不在报告补精度。只有完成技术和根逐页QA才新写passed proof，原technical-result保留passed=false时点。

此为更正前基线，用户最终业务核对仍待更正后新报告完整交付；当前未将T18整体销项。后续仅ONSITE观察值0→1，旧报告当前新用预期被阻断，历史本地文件仍保留。


更正首次执行被已验源码guard在任何journal/浏览器或业务POST之前阻断：共享real-mode-route新增A02入口。主三人和基线报告未变，未把这次保护性停止算成产品更正失败或重放；[停止记录](evidence/research-t18-2026-11-12/main-correction-root-execution-20261112/source-guard-stop-before-write.json)保留原/现SHA。用户已明确授权仅协调共享入口，已向另一用户会话发送范围有限的协同请求；新入口按单次当前源复验后再明确更新proof，不自动追新SHA继续写。


当前共享入口已获另一会话确认暂缓修改/重载。当前PID31042、源窗口的494项前端测试与独立构建已通过；只读补验发现旧owner会话401，按现有12小时会话策略重新登录原合成账号，不改变角色/密码/authVersion；待补完原有角色与同Study返回验证后，根逐项核源并显式更新proof。此前的失败及旧proof不删除，不将认证过期冒称业务权限拒绝。


## 当前共享窗口与只读补证（22:27）

原四合成账号仅经登录刷新，admin仍为原accountId/authVersion5，未修改权限或密码；[刷新证据](evidence/research-t18-2026-11-12/session-refresh-2026-11-12T13-53-49-784Z-23703855/result.json)。官方实例随后由其他会话在21:59:39重载至49880；根再次在任何主更正写入前停线。

[root-current-entry-3491f3e6](evidence/research-t17-2026-11-12/root-current-entry-3491f3e6/result.json)为一次实际31源/PID49880前后一致窗口：502前端、隔离构建和真实只读六项均通过、0业务POST。原聚合器不识别Node当前ℹ日志标记，留下原错误后仅元数据生成result，无子命令重跑或业务重放。此后platform-shell/real-mode-route/资产catalog/设计session四共享文件又有变化，故该manifest只证明已记录窗口，不能批准当前源码或更新私密执行proof。

已从只读会话上下文定位另一「researchhub」会话正在修改共享入口，另「researchhub-data」共用运行实例；向这两条新会话发送窄范围协调需要工具要求的明确授权，已向用户发出可审阅范围的问题，不越过此前只覆盖「researchhub- research」的授权。

[main-before-coordination-readonly](evidence/research-t18-2026-11-12/main-before-coordination-readonly/result.json)实际再次核对：三主答卷/访视完整DTO与原证据相等，原Run仍completed/confirmed，原报告正文摘要及ready文件未变，原本地Word摘要不变。0业务POST；主ONSITE仍ref1/value0。更正、新Methods和新报告均未执行，无未知业务journal。


主更正首次真实执行已确认解锁（原key73a01ef4-7fb0-457d-a038-574dadd14435、ref1/version4、pendingnull），随后harness对blocked Run metadata的白名单遗漏present()正常空默认字段而停，未执行correct。实际DTO无旧数值泄露。后续使用独立已确认解锁续阶段合同和脚本，只核原回执后从correct开始；不整体重跑、不再unlock、不改产品以迎合harness。metadata守门仍拒绝非空默认数组、额外键和任何旧来源字段，追加纯反例测试；原失败/网络/录屏保留。


2026-11-13收尾：对应产品基线、变更、手册、版本、设计、计划、进度、技术和测试的Notion九页已同步并9/9回读，见 `corrected-report-6277b638/notion-readback.json`。共享入口/19501协调已解除。用户最终业务核对已提出，T18.businessAcceptance保持false，收到明确反馈后再更新；临床与生产仍未验。
