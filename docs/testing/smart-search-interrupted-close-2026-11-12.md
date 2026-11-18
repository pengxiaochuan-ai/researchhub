# 智能搜索单笔中断任务收口 · 2026-11-12

用户已批准并完成：仅cmwcw7u280005luyi1na8t4wf失败收口，按真实2273Token结算并释放多余预留，不重跑、不改其他账本。目标仅本机专用合成库；北京时间2026-11-12 10:20正式提交。仅此操作完成，不代表智能搜索整体专业验收通过。

1. 锁定原任务、会话、owner及预留cmwcw7utc0008luyicjlle5f9，核对数据库时间下租约失效、assistant为空、已有1803输入/470输出的单次持久调用凭据与原Provider HTTP200一致。
2. 复用旧recoverExpiredClaim，仅具名知识问答任务失败收口；复用现有sealExecution与Hub租户管理员对账服务，不复制结算或改旧系统。
3. 先完整事务回滚验证，再执行单笔原子事务；验证重放幂等、UsageRecord仅新增1笔、原额度/角色/其他任务/消息/预留/账本不变。新增审计仅属于本笔恢复、封存及结算。
4. 真实Chrome只读检查owner原会话与admin用量详情/刷新，保留截图/WebM，不发新消息/模型、不重启服务。更新本轮文档及Notion。

该操作不发布未验收模型正文，不把失败收口当目录完整网页或来源专业验收通过；不恢复生产排空协议或其他旧任务。

## 已执行与验收证据

- 原任务failed，错误WP01_EXECUTION_INTERRUPTED，assistantMessageId仍空；payload/attempts保留。原Provider HTTP200：1803输入＋470输出＝2273，1次调用。
- 原预留12288改settled/actualTokens=2273；释放有效占用差额10015，不增加Token额度。新增唯一UsageRecord `cmwcx7ciq0005luahnl3oazmi`，runtime=hub-provider-reconciliation。原管理员通过现有Hub对账服务结算；同requestKey/fingerprint回执重放不重复扣账。整个one-shot --apply不应再次运行。
- RED→GREEN契约3项，相关免费回归14/14；完整真实PG事务先回滚且前后相等，正式事务内/提交后首读的非目标快照断言通过。独立只读评审无Critical/Important。
- 末次快照messages hash变化，原`applied.json`中otherObjectsUnchanged=false保留；原apply.log硬编码true不作为证据，脚本已改为输出实际比较值，未重跑apply。只读内存重建证明唯一差别是本任务关联用户指令`cmwcw7tc40002luyig0dg111d`被既有队列扫描器从dispatched/version2归一为failed/version3；仅还原这两个字段，7403条消息总hash精确恢复原hash。正文、其他消息与七类其他快照不变。见`message-snapshot-explanation.json`，未回写数据库。
- 真Chrome owner原会话与admin用量详情/刷新通过，无pageerror。owner真实API：目标failed、待执行items空、uncertain=false；输入框可编辑。admin真实API及弹窗：settled、2273、1803/470、1次、确认结算禁用。未点击发送/结算/恢复队列；未新增模型调用。截图owner.png/admin.png与WebM保留。
- 原任务唯一Provider trace仍1份，浏览器前后目标Job/预留/Usage完全一致。无新额度/权限、历史清理、旧服务重启、云或发布。

证据目录：`.tmp/smart-search-grounding-2026-11-12/close/`；`preflight.json`、`applied.json`、`regression.log`、`browser.json`、`owner-api.json`及上述快照解释。前阶段596免费/29Chrome/build是历史结果，非本轮重跑。

收尾复核：`regression-final.log`为本轮最后14/14；`browser-final.log`补充目标失败、无待执行指令、uncertain=false断言通过。操作脚本/浏览器脚本语法及限定文件diff-check通过。未修改产品前端/后端运行代码，未进行构建重载或生产动作。本页全文追加到既有Notion验收页，产品基线/变更/版本/九Skill/技术/计划的最新状态及使用说明已同步；保留其他并发文档，不重复建页：[本机验证与单笔收口](https://app.notion.com/p/41656479ab5881f19557fb342962fb64)。

独立最终复核：smart_grounding_review通过guarded readOnly重新查询7403条消息并独立复算，上述仅目标指令status/version变化解释成立；目标job/userMessage双向归属正确，DB失败/2273结算/Usage与artifact一致，无阻断项。准确结论为“无无关对象变化，仅目标用户消息命令状态按既有scanner同步”，不称所有消息字节不变。
