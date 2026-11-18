# 科研身份／T01／R01串行实施进度

2026-11-03用户要求按已有设计直接执行，不再重复确认；主代理当前目录串行＋最后一次独立代码总评审，具体范围沿本目录implementation-plan及三稿。本记录不覆盖其他会话S08／B02等状态。

Task 1: complete — 4项Schema／真实PG测试、原后端build和176项前端完整测试通过；仅给原Account增四个NULL列，原两账号旧值及租户RLS保持，不回填、不generate。迁移重入不再写DDL。
Task 2: complete — 身份专项16项（含真实PG／租户RLS／审计失败回滚）及5组真实HTTP校验通过。本人API已在本机19502装配；当前授权／CAS／最近回执、48KiB局部解析及旧DTO不漏私有字段已核对，无旧权限变化。
Task 3: complete — P004选填入口及P006私有科研资料已实现，180项前端测试／构建、11组真实Chrome（五视口／原生200%／真实在途切账号／丢回执恢复）通过。额外1个具名L0账号经本机SMTP完整注册、不填资料登录P01、零私有Study／原席位配额不变，实际P006仍L0；身份阶段技术门禁通过，用户专业验收／唯一全链总评审尚未发生。
Task 4: complete — 有界来源锁已按明确授权受控启用，三类app调用／PUBLIC禁用／原42501权限／双事务及来源适配通过；三表V1及锁函数独立指纹匹配，旧来源UPDATE／DELETE不授予。
Task 5: complete — 候选／事实／审核／回执／当前授权／CAS／原子审计、coverage／多机构、G02目录叶子已装配；真实PG／HTTP／管理员Chrome创建、修订、批准、拒绝、撤回、恢复及历史通过。
Task 6: technically_complete — T01及必要T02全约定技术链已完成，UI07窄屏差异先获批准再实施；真实五视口、原生200%、地图锚点实际滚动、身份迟到200、未知提交两类恢复均通过。236项按共享合成夹具串行运行通过，双build与同一独立总评审无剩余代码阻断。真实资料／用户专业验收未代签。
Task 7: pending — R01／R02不在本轮继续实施，R01文件hash与母版一致。
Task 8: T01阶段的保全／真实请求／唯一独立代码总评审及文档收口已完成；原跨T01／R01全链仍随R01后续，不冒称整个计划完成。

本轮只增具名来源2行，无canonical论文；2机构／2团队／1人物、16事实版本／14决定，在原额度内。合成团队获准展示，真实机构及名称待确认的项目团队未批准。原两账号非秘密旧列hash与身份阶段一致，R01未动，[最终状态](../../testing/evidence/research-identity-directory-implementation-2026-11-03/final-state/result.json)。0模型／外发／新云／远端运行配置／生产发布。

本轮[验证与失败勘误](../../testing/t01-directory-implementation-2026-11-03.md)、[唯一独立评审](t01-code-review.md)。早期并行组合235项中5项因共享夹具prepare先更新账号再取租户锁，与其他测试形成40P01／55P03，未改业务锁或放宽超时；采用本轮串行约束`--test-concurrency=1`全236通过，原失败日志保留。

2026-11-03阶段证据：[身份API](../../testing/evidence/research-identity-directory-implementation-2026-11-03/identity-api/result.json)、[Chrome](../../testing/evidence/research-identity-directory-implementation-2026-11-03/identity-browser-68cbc929-1b33-46fb-959a-bb5b29dd0115/result.json)。原共享本机runtime在本租户无活动knowledge任务后正常重启加载本轮控制器；未启动或停止旧服务，没有认领其他租户4个历史queued任务。0模型／外发邮件／云／发布。

Ruling: 用户本轮明确要求直接执行，覆盖技能默认再次等待计划确认；保留完整计划供查阅，不再暂停重复问批准。成本：如实现发现超规格变化，仍须单独说明而非自动扩大。
Ruling: 当前目录和已有codex分支继续，不自动commit／worktree，不清理脏内容；按文件与证据指纹界定本轮。成本：唯一最终评审不能用整个历史git diff冒充本轮增量。

Ruling: 当前请求明确继续完成T01，先闭环Task4–6，R01页面本轮不切换；原后续计划保留，不将R01预定步骤当作本轮新主线。

文档收尾：product／technical／本目录计划与进度／testing及原身份阶段交叉状态已同步本地和原Notion页面；本轮验证Page `40d56479ab5881f88722e1135875afbb`、独立评审Page `40d56479ab5881d9b0dfeffefbbbd43a`。所有create/update返回对应ID、无warnings；保留其他会话章节与子页，不发送私有凭证／原始材料。后续建议是用真实团队资料由管理员完成T01专业核对，不是自动切页或新授权。
