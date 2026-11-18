# T15 S05 分析数据准备 · 前端验收记录

2026-11-12，范围见 `t15-ui-contract.md`。正式互斥 `formalAnalysis=1` 路由沿 S05 既有九页签、六指标、三图、主列表与右栏；主区域完成选择、计划、审批、预览、放行与固定快照，未另造页面或调整冻结 Shell。S01研究准备卡、既有S05常用操作新增研究内入口；无权威总量/图表来源仍准确空态，不把本次3人当全研究统计。仅追加header范围适配和安全登录回跳。

当前显式合成研究范围选择固定执行方案、BASELINE及固定版本字段，分页搜索3名假名受试者并核其真实入组/访视；提交定义不含客户端答案。SAP/map使用已定 `synthetic-sap-v1` / `synthetic-map-v1`，不推断临床方案内容。固定schema单位未声明则未知，0/false/null/not_recorded/blank分别保真。变量表只呈现实际投影，逐值链接精确S09原修订；ID/hash/key不要求用户输入，摘要仅追溯详情。不可变快照打开时重新核当前来源、审批、用途和质量。

动作只消费服务端canSubmitPlan/canReviewPlan/canReleaseSnapshot，再结合最新approved review、真实preview.evaluation和manifestHash；权限位不冒充放行。审批弹窗固定打开时expectedSequence，quiet更新不偷偷改变CAS。原值/理由仅内存，15分钟未知内存过期清正文；storage仅actor/authVersion/Study/action/planId/原键。刷新仅原GET回执后读当前，404仍禁写，无POST重试。原submit/review回执是历史动作，不替代当前审批；release回执仍须当前快照守门。

quiet focus/10秒核身份及已打开来源，无spinner或输入重置；来源hash变化清旧投影并要求人工重读，不静默换成新值。普通409保理由、废止旧预览；当前用途/身份敏感变化清数据/待发。预览503清不可核验值但保理由，不作注销；当前读取期间写确认给出保留输入的明确反馈，不静默丢操作。放行原回执200后必须另读到有效当前snapshot才完成确认；随后GET503或失效时仍保留原核对标记，明确已保存与当前不可核对，不宣称已经可用。业务确认、Esc/焦点、跨页离开与beforeunload保护保留。

## 真实证据

基目录 `docs/testing/evidence/research-t15-2026-11-12/`。新独立3人均实际提交/审阅/锁定的正式答案，未使用或改写主ONSITE/H5/CSV三例。视觉只读既有独立HTTP样例，不消费主三例。

| 证据 | 实际执行及结果 |
| --- | --- |
| `analysis-ui-8f43e324/result.json` | 管理员真实浏览器选择3名假名、固定字段→提交→审批→原值0/false/null预览→理由放行→固定快照与S09原修订回链。明确data.analyze研究者读取/预览，三项写控均无、直接review403；旧采集研究者仍403，角色未提升；无关owner无投影。真实正式疑问使结构阻断1项、按钮disabled，直接release409且零新快照，显式关闭后恢复。实际解锁来源使quiet清旧值、旧snapshot409。前版主链 `a6539a3e` 保留。PNG/WebM齐。 |
| `analysis-recovery-e8a82761/result.json` | 实际submit/release落库后仅截断响应，十五分钟清内存、刷新原GET回执再当前计划/快照，各只有1次POST，无重放。实际双HTTP审批CAS，即使弹窗期间quiet已见新批准，旧expectedSequence仍409且理由保留；明确预览503清值保理由，实际恢复。真实release回执200后注入当前snapshot GET503，仍保留核对标记且无虚假当前成功，再次原GET恢复。实际plan和snapshot游标（仅limit=1请求覆盖，响应未改）；真实Cookie切换owner清数据/未发理由、真实404跨刷新禁新写、真实用途撤回清原快照。早版 `6e05ed93`、`9684453c` 保留。PNG/WebM齐。 |
| `analysis-visual-8248cab2/result.json` | 桌面1440、390、Chrome原生200%（outer1440/inner720、DPR2、scale1），正文/操作14/22，页面无横向溢出，宽变量表独立滚动；共享放行弹窗Esc/焦点，离开保留修改弹窗取消并返回来源链接焦点。零业务POST，PNG/WebM齐，原生以 `*-cdp.png` 为准；已实看三视口。 |
| `ui-freeze/` | 全前端459/459，无跳过；独立Vite构建7.05秒，输出 `/tmp/researchhub-t15-ui-freeze-build`，未写共享业务dist。源、测试、脚本/合同SHA与日志留存；既有大chunk提示保留。 |

## 失败、验证边界与当前状态

失败原样保存：`analysis-ui-de6bd563` harness以多个h3做strict定位；`73b276a3`先错误假设旧t06采集研究者具备data.analyze，实际403正确，最终使用既有独立narrow方法研究者，不改旧角色；`analysis-recovery-3af54dac`在quiet读取尚在执行时确认，客户端写锁拒绝但旧反馈不清，已补明确“当前权限核对、输入保留、稍后再确认”，harness改实际GET完成屏障证明真正双HTTP CAS；`6176efa9`分页点击后未等实际DOM追加就断言数量，改为真实第二条出现屏障。上述失败不算通过。

自审追加 `analysis-recovery-f3446968` 是真实产品RED：原release回执200后当前snapshot GET503被readView转只读sourceError，旧ack分支却清标记并错误显示当前已核对。最小修要求真实当前snapshot验证存在才结束确认；上表 `e8a82761` 全恢复链GREEN证明原标记保留、已保存/当前不可核对分开，后续只原GET恢复，未新增release或数值。成功当前读取同步清过期sourceError，避免恢复后残留停止展示提示。

503、响应截断、浏览器时钟为明确注入；当前权限/真实Cookie、固定源修订、审批CAS、结构疑问阻断、对象状态、实际PostgreSQL回执与用途撤回均真实请求。验收主链最后故意解锁一个来源，恢复链最后故意撤回一个用途，这些独立旧快照应保持不可用，后续T16不要把它们当当前有效来源。S06需新当前来源或既有T16独立HTTP案例。未执行数值统计、不作真实临床或生产验收声明。390/200%顶栏账号与搜索重叠属冻结Shell既有限制，本包正文操作可用，未改全局布局。

等待主循环窄审、living/baseline/changes/manual/version/API/test/Notion同步后标记T15本机合成包闭环。T16继续沿原S06母版；审核/取消权限须独立真实Methods能力，不从本页admin/当前用户role推断。

## 主循环最终核对

根已读最终ack分支、相关契约及真实证据，实看desktop-preview、mobile390-preview、native200-confirm-cdp；独审结论无已证实P1/P2，最终16源/459前端与build7.05保留。living/manual/version/API/test本地同步，Notion以journal后续readback回执为准；T15本机合成闭环，临床/生产未验。下一页S06按原19项授权实施，不复用本包故意失效的独立快照作为新分析来源。
