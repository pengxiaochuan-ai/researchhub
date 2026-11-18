# WP08首切片阶段实测：真实方法报告资产候选与复用准备

2026-10-26，**V01–V08本机技术交接，唯一原评审With fixes三Important已由作者修补复验；18份文档/章节Notion已回读，AC10待用户**。仅本机专用合成库/原两账号/当前Study/本人新候选及A04具名新夹具。不是完整WP08、一期、生产或专业效果验收。

关联：[规格](../product/crf-method-assets-spec-2026-10-26.md)、[批准的授权](../planning/crf-method-assets-2026-10-26/authorization-scope.md)、[计划/接口裁决](../planning/crf-method-assets-2026-10-26/implementation-plan.md)、[实时台账](../planning/crf-method-assets-2026-10-26/implementation-progress.md)。

## 本轮证据根与命令

证据根`/Users/mac/aisciencesys/docs/test/evidence/2026-10-26-researchhub-wp08-crf-method-assets/`。使用实际原服务/PG、既有本机Worker和真实同源HTTP；本片真实Chrome截图/录屏，不拿前序截图补本轮。

| 检查 | 真实结果/证据目录 |
| --- | --- |
| V01真实报告/Version/Sources/hash与新snapshot兼容 | readiness-00e6781c，两账号，0模型 |
| V01全门禁 | free-gates-8d2adb4d：307纯测试/1054原内核、构建/保全/空白通过 |
| 同tx桥/错父/跨人/拒绝回滚/隔离R01/R03及条件R02 | bridge-c20633d9，12项原服务/真实PG；不附AI仍可读 |
| 新purpose配置与首次审计 | activate-fb261866：仅两原根登记，0600/0700，13项；无补权 |
| V02全门禁 | free-gates-7d7388cf：312/1054、构建/保全通过 |
| 原子创建/独立连接双键同根/合法重试与冲突 | atomic-create-1ffa0e43；含Artifact/Version/Sources/Audit/回执故障及未命中也强制回滚 |
| 实际同源HTTP创建/详情/历史/列表/越权/输入及原始32KiB | create-read-list-bfb254a6：12原PG＋两账号HTTP组＋跨人组，共15项，不是15个HTTP请求 |
| 来源换版/候选提交的真实并发顺序 | source-head-a55cf330；源先改拒旧，候选先锁源写等待、随后stale；只改A04新报告说明 |
| V03全门禁 | free-gates-79eddbf1：315/1054、构建/保全通过 |
| notes CAS/422/幂等/历史/原子回滚/8层血缘及祖先源校验 | notes-lineage-c8e29138，6组真实PG |
| 跨根/跨run同账号计数、跨动作同键及30版 | capacity-cross-keys-35773cc0，5组真实PG；见下方边界 |
| POST未知query拒绝 | post-query-b858ea97：12原PG＋2账号HTTP组，原201!=400失败已保留 |
| HTTP说明/历史/派生/重试/POSTquery/32KiB含encoded ID | notes-derive-c6fc5724：12原PG＋2账号HTTP组，共14项 |
| V04全门禁 | free-gates-35d34ec2：318/1054、构建/保全通过 |
| V05入口/真实身份/真实分页 | browser-df277c2f，两账号各2组；42份经真实派生接口保存的本人新候选（非元数据占位） |
| V05全门禁 | free-gates-556228eb：320/1054、构建/保全通过 |
| V06说明/历史/派生/键盘/字体/错误恢复 | browser-882cb859，两账号各5组；reading16/28、input14/22，真实409/原CAS、实际提交后受控丢响应同键重试、真实新scope撤销＋迟到200不复活＋精确恢复不busy |
| V06全门禁 | free-gates-50164e8e：321/1054、构建/保全通过 |
| 新数据更正/源失效/失败无回执/终态不写 | sources-f89f187e，7组实际PG/HTTP；原R02/R03仅隔离副本，真实新purpose另证 |
| 同Cookie切账号＋界面刷新会话/迟到200 | browser-f16286c7，两账号4组；原7d88a221旧内容未清RED已修复 |
| V07最终完整浏览器 | browser-2b8a5703，两账号28组；五视口/原生200%、源失效/固定旧版回链、前序只读往返、分页不重置、PNG/WebM/字号/实际API状态与console |
| V07最终全门禁 | free-gates-8862fbbd：321/1054、构建/保全通过 |
| V08 I1读校验失败/临时断网/列表失败及恢复 | browser-d003c435 RED→browser-cfae8d99两账号14组GREEN；保notes/CAS/key、不假称current；初次脚本返回定位失败保留 |
| V08 I2 A02单独撤销/非首项来源根慢200与恢复 | browser-e2d977eb RED→browser-698bf931及最终browser-0ef5e466各两账号10组GREEN，不拿整个scope撤销替代 |
| V08 I3字符串/对象/混合选项 | 纯formatter契约缺实现RED→GREEN；实际页面仍原对象配置，不冒称三个数据库样例 |
| V08修补后完整浏览器 | browser-99fa9503两账号28组，实际轨迹/字号/五视口/原生200%/固定回链/dirty/丢响应/身份回归 |
| V08作者全回归 | free-gates-6e7fd45b：324纯测试/1054原内核、构建/保全/空白通过 |

可复跑的只读/纯命令：`node --test scripts/crf-method-assets-contract.test.mjs scripts/crf-method-assets-scope.test.mjs scripts/crf-method-assets-session.test.mjs`、`node scripts/crf-method-assets-preservation.mjs verify`。完整免费门禁为`node scripts/crf-method-assets-free-gates.mjs --mode local-synthetic`；不恢复旧付费harness或修改前序样例。状态型atomic/source/notes/cap探针消费新夹具的版本/容量，不能盲目重放；重放先看本片台账/夹具manifest。

## 范围与证据诚实边界

- A04只新4个具名包（每账号2、各3编号×2访视）、4次原本机确定性Worker及8无AI报告，原报告/数据始终只读。Scope根追加经真实原inReport校验并单独审计，不给整Study放行。
- 100容量测试只在强制回滚事务内创建无报告/AI内容的元数据占位，验证实际PG计数/锁；不是100份可用资产或正式复用。两个不同根/run的99→100探针都回滚，100拒新/满容量合法重试均无占位残留。30版则为本轮本人新候选实际追加并保留，不清理/篡改历史。
- 损坏hash注入仅改读取返回，未改存储Source；原R项撤销在隔离scope副本验证，不能冒称真实Role已撤销。未来浏览器必须用真实新WP08 scope撤销/恢复另留证。
- 691旧源、32表18212前序行、旧8进程、原角色/Schema/旧scope及79笔known账本整文件持续保全。当前0新增模型/费用；未核价/续额、云、远端运行配置或发布。
- 自有19501–19507在无在途任务后加载新Controller，多次最小修正后当前PID89505；不修改或停旧服务，不恢复历史任务。

## 保留的失败与告警

新builder/notes/state/lineage/白名单/scope缺实现RED均先观察；手核golden缺文件RED后补独立完整JSON。保全初错为missing与显式undefined键差异，基线没改，最小修正后全门禁GREEN（free-gates-de12f894原失败保留）。

HTTP首次404为旧进程未加载；之后历史只读标志、GET未知query错误码、POST未知query201分别用真实反例修正。祖先hash损坏后后代仍可读的RED已补逐级Source校验，并完整notes/派生复验。一次探针将完整合成正文打印到断言输出，已改为只显示路径/状态，未含凭证/患者数据；不继续灌全量响应。

既有Node `--localstorage-file`及Vite chunk告警保留，不声称零告警。测试短暂重叠已在台账登记；实际scope撤销/故障注入测试均串行。V01–V07已验证，V08代码总评审进行中、专业AC10未签，不借技术绿灯冒称用户效果。

320溢出RED见browser-d6c02fd2，390时正文仅155px；仅新工作台接现有wf-content窄屏导航及compact品牌规则，390正文375px、320正文305px，16/28阅读和14/22操作不缩小。A01旧页头追加死动作RED与demo concept继承分别有浏览器/纯反例，已仅新族排除。侧栏收起动画中截图不能冒称静止结果，最终等待侧栏完成收起后留图。

同浏览器切账号反例先发现忙碌离开保护误拦用户菜单，缩为真实导航确认；再实际证明集中身份改变后旧区未清。仅新Workspace监听最终身份事件、失效代次并清私有区，同账号checking不抹dirty；最后迟到200不串身份通过。不改原身份服务/角色，受控丢响应不是声称真实生产网络事故。

## 四层验收与专业待验

| 层 | 状态/边界 |
| --- | --- |
| 代码已实现 | 本片快照/闭合配方/原子候选/notes历史派生/精确回链/真实身份UI均实现；唯一独立原评审3 Important/1 Minor，作者三重要项一次RED→GREEN关闭，原With fixes保留 |
| 本机目标已配置 | 专用wp01_test_full_baseline、原两账号/Study、0600新purpose与独立审计、19501–19507已启用；旧scope/角色不改，不代表生产配置 |
| 真实请求已执行 | 原服务/PG/既有确定性Worker4次/实际HTTP/Chrome完整链及上述负例，有结果/PNG/WebM/状态轨迹；业务封装0新模型，非新AI推理或联网验收 |
| 业务结果达用户标准 | AC10待用户以未预运行合成说明区分历史事实/可参考配置/必须重确认条件；不可代用户评专业或临床适用 |

AC01–AC09本机技术证据齐，文档/Notion18份/章节回读及30本地链接验证，最终hash/门禁见交接收据；AC10未签。完整WP08治理/跨Study/发布/导出、其余一期AI和目标生产环境仍不在本片关闭范围。已知M-1：A01可读但A02无权时历史选择器可能为空仍启用，服务端仍拒绝，延后提示优化。
