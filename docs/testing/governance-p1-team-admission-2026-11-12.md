# P1团队页：只读准入与DG06确认口径

后续状态（覆盖下文准入时的“待额度确认”）：用户已批准各1个新合成团队/机构/负责人及4/4/5额度，已实施新对象保存/联审/关窗/恢复与T01/T02实际验证；旧资料只读快照不变。R01真实依赖未接通，P1整体仍未完成。[最新报告](governance-p1-team-2026-11-12.md)。下文未创建/待确认及只读证据均为前序阶段历史，不作为当前阻断点。

2026-11-12。来源页已完成本机技术交接后进入DG06–10；**团队页尚未完整交付，P1未完成，P2未启动**。当前没有团队前后端运行代码改动，没有对原团队/机构/人员持久写入；未改变布局/权限或新增费用。

## 已实际核对

- `node scripts/governance-p1-team-admission.mjs`：真实admin登录→团队深链接→审核弹窗→读取原草稿；本地修改名称、同身份focus保留输入；站内放弃弹窗取消保留，再明确放弃回列表；实际切owner后清管理员内容，owner403/匿名401。0浏览器目录写请求、0 pageerror，原团队完整快照前后相同。
- 成功证据：[1794477420183/result.json](evidence/governance-p1-team-admission-2026-11-12/1794477420183/result.json)，PNG/WebM同目录。人工查看桌面列表和原弹窗；不声称已验证本页五宽/200%或真实审核写入。
- 首次只读尝试遇目录读取不可用，弹窗未出现，保留根目录`result.json/failure.png`；加入网络采集后同路径200且成功，独立无参/`?page=1`/`?q=&page=1`请求均200，未重复复现、未凭猜测改产品代码，也不把第一次失败抹去。
- `team-contract.test.mjs`、`team-draft-schema.test.mjs`、`team-edit-revision.test.mjs`、`team-optional-note.test.mjs`：**14/14**，`contracts.log`。其中后两者含真实PG回滚，非全为纯单元。
- `team-admin-review.test.mjs`、`team-institution-edit-pg.test.mjs`、`team-workspace.test.mjs`：**13/13**，`rollback-pg.log`。测试使用现有guard/withRollback，仅事务新合成来源/目录对象；验证联审/机构原位编辑/新人员/旧历史/范围收窄/并发409/原回执及失败原子性，不是本机HTTP新团队审核验收，不是生产启用。

## DG06产品差异及确认结果

获批DG06写“团队列表、查找、机构/省市筛选”，但当前确认母版/运行实现为：

- 治理审核列表：团队名称搜索、查找团队、新建团队、原五列列表及审核弹窗。浏览器API列表字段仅id/name/savedAt/version/hasDraft/hasPublished/reviewed；服务仅q/page，未接机构/省市过滤。
- 编辑弹窗：机构选择及省市字典，用于填写本团队资料，不是列表筛选。
- T01团队浏览页另有原研究方向/地区/机构类型/团队类型筛选，不应把其能力或表单字段冒称治理列表功能。

用户2026-11-12已确认“审核列表保持简洁”：G02治理审核保持名称搜索＋列表＋编辑审核弹窗，不新增机构/省市两组列表筛选；DG06按此明确，T01原有浏览筛选不变。该差异已解决，不再是阻断项。

来源页不受此项影响，仍可在本机体验已交付的恢复功能。继续本轮新具名合成团队HTTP/浏览器保存→联审→关窗/回流→T01/T02/R01，未做前不标团队闭环。

## 当前新确认点：新合成对象额度（未调整）

只读HTTP核对：`directory-admin/entities?kind=team|organization|researcher`分别返回3、3、4个；`server/directory/controller.mjs`的`localDirectoryBudget`恰为team=3、organization=3、researcher=4。`commands.mjs`在创建实体前按租户计数，达到上限返回`DIRECTORY_FIXTURE_BUDGET`，不是账号业务权限，也不是已移除的每团队操作次数上限。未为证明拒绝而实际发创建请求，未改配置/扩额，未创建新对象。

为避免复用原人员时写入其团队关系，建议仅为本轮联审新增1团队＋1机构＋1负责人，均显式标为合成。建议额度team 3→4、organization 3→4、researcher 4→5；不删除历史、不恢复次数上限、不改角色/GRANT/来源/审计或其他保护。此建议**待用户确认，尚未实施**。获批后锁定同一具名对象及清单，不因失败自动再建；用当前管理员走真实保存、一次联审、原回执恢复、关窗和T01/T02/R01展示。现有真实/历史团队、机构及人员只读。

## 本轮新增只读界面验证

`scripts/governance-p1-team-readonly-visual.mjs`对全部非认证API写请求拦截拒绝；真实名称查找、打开现有原弹窗、14px输入、Tab/Esc及焦点回列表、完整workspace前后相等。覆盖1920/1440/1366/390/320及Chrome原生200%（dpr=2，visualViewport.scale=1），无页面/弹窗横向溢出，PNG/WebM保留。只读界面通过不代替新团队实际保存、联审、回执或前台展示闭环；P1未完成、P2未启动。

- 最新完整名称查找/五宽/200%成功证据：[1794479785276/result.json](evidence/governance-p1-team-visual-2026-11-12/1794479785276/result.json)，0 pageerror、0业务写；对应PNG及WebM同目录，人工检查1440/320/原生200%截图。前两轮几何检查成功也保留，不覆盖。
- 本轮7个相关契约/PG文件串行重跑 **27/27**，命令`node --test --test-concurrency=1 server/directory/team-contract.test.mjs server/directory/team-draft-schema.test.mjs server/directory/team-edit-revision.test.mjs server/directory/team-optional-note.test.mjs server/directory/team-admin-review.test.mjs server/directory/team-institution-edit-pg.test.mjs server/directory/team-workspace.test.mjs`；[完整日志](evidence/governance-p1-team-visual-2026-11-12/1794479386743/team-regression-serial.log)。所有写测试均整体回滚。
- 失败记录未抹除：默认跨文件并行跑上述PG测试时25/27通过，`team-workspace.test.mjs`的“name-only team draft persists privately with CAS and immutable receipts”“incomplete evidence remains private draft…”在`lockAuthorizationMutation`报PG57014 statement timeout，见同目录`team-regression.log`；同期浏览器只读初始化两轮503，见`1794479448797/result.json`及`1794479573848/result.json`。相同生产代码改为串行27/27，待PG结束后单独浏览器完整通过；证据支持共享授权锁测试争用，不据此改产品授权、超时或自动重试。
- 本轮只改确认文档与只读验收脚本，无前后端运行代码/API/数据库/配置变化；未新构建/重启/发布，不借用此前构建声称本轮新交付。使用说明无新操作；整页独立总评留到实际写链路完成后执行，未提前标通过。
