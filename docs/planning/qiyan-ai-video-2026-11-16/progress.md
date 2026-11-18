# 岐研AI视频首片 · 当前进度

## 当前任务：上传恢复按钮无反馈（2026-11-16）

仅修原AI01上传恢复区。核对无反馈、早拒绝静默、核对busy残留及completing回退四项均有RED→GREEN；36浏览器回归、738纯测、明确回滚后端28及最终构建通过。一次独立总评审0C/1I，实施者补阶段读失效后验证，不冒称独立复签。共享窗口主动释放后，在PID99373的19501用owner/admin真实回执恢复通过，选择框实际打开，零新媒体/视频字节/Provider；原六媒体行及原两会话零Job保持。无权限/结构/旧代码改动，不读取用户原视频。[本轮验证](../../testing/ai-video-recovery-2026-11-16.md)与Notion均已同步，当前可交接；不把当前修补说成用户原文件已恢复。

2026-11-16。前片交接范围：原AI01上传入口接视频归档、播放、检查和恢复。MV01–MV03已实施，本机六文件技术验收通过，用户主观签收与生产发布另行进行。内容理解只核查/保留需求，不恢复退役VA、不调用Provider。[完整技术交接与事故记录](../../testing/ai-video-2026-11-16.md)。

- V00：当前/历史复用核查、原12测试及新合成ffprobe通过；一次规格独评0C/2I已补协议。
- V01：1表＋1守门函数/trigger＋RLS/索引，既有app仅本表SELECT/INSERT/UPDATE，已在wp01_test_full_baseline显式创建。SQL hash `fe9a4fe7fa476eeb5d1401c5b71068b6d1433ebe9a71bcda6a07a9f7c54456e3`；原表/角色未改。批准的6份新媒体已持久归档；schema真实回滚10项通过。
- V02：复用原Chunk/签名/SHA/存储/Range及原媒体结果分类；Hub有界ffprobe固定本地协议/格式、30s/1MiB。首次PUT前SHA CAS；PG/PUT未知、初始化未知、损坏、读取失效流、过期临时清单后原件恢复均有真实app-role PG回滚。
- V03：AgentMedia hook/view与原AgentMaterials入口、client raw XHR、HubAgentPanel/status/独立Controller接线已写。最终组件10项（含pending回执、刷新继续归档、原文件选择跨同身份续期）和旧材料/Excel18项通过。两次早期旧回归因独立Vite缺VITE_AUTH_TENANT_SLUG而中止，未配置的提示为正确保护；用19614已配置fixture后18全绿，不归因为产品故障。
- 问答：所有明确视频内容问题（含无动词疑问）当前阻断，设置账号GUC；submit、stage/编辑、旧send及实际worker同一规则，显式Hub/PDF问答保留。真实PG/单元与两个账号共4次目标HTTP409负例通过，零新Job/Provider。
- 独立代码总评审已完成一次：0C/4I；账号GUC、入口覆盖、无动词问题、pending恢复四项均已由实施者修补并补测试，不再开展第二轮总评。原结论在会话工具记录；最终测试报告保存四项证据，不冒充复签。
- 最终离线门禁：backend-final.log 36通过（含旧队列套件，见下方误跑）；pure-final.log 153文件/738通过；browser-final.log 28通过；隔离构建6.63s通过。真实浏览器组件证据已保存，不能代替目标六文件验收。
- 测试隔离事故：本轮三次误用旧conversation-commands.test.mjs，持久化39会话、663条user消息、24个未认领的测试Job、111条command审计。备份后已精确撤回；事务重验全量行、10条FK和零模型/Token关联，其他会话/消息/Job/审计/用量/预留摘要完全相同，不动历史测试任务。随后仅本片回滚/纯测试28通过（backend-scoped-final.log）。旧套件不是回滚测试，此处纠正早期误判并停止使用。


## 目标环境完成情况

1. 精确撤回自身误跑夹具及最终本片回滚测试28通过；证据保存，其他数据/账本摘要不变。
2. 共享会话重载PID78880后主动释放窗口，实际status均启用media；本会话无需再次重载。没有给其他用户会话发消息；用户再次选择等待对方主动解除，持续遵守。
3. UTC06:39:31，原owner/admin各一新会话、各MP4/WebM/损坏MP4，共6媒体全部归档；4有效可播/拖动、2损坏正确提示。6初始化/12分片/6完成，无第七份。完整SHA/Range、刷新、私有隔离、4次视频内容409及零新Job/Provider通过。旧Subject/Feature/Form、两账号状态/角色/authVersion和用量/Token预留前后相同。
4. 1440/1366/1920、14/22、原生Chrome200%（1440→720CSS、DPR2→4）/键盘播放通过；Mac下surface截图半幅问题不作为产品失败，补原生browser-view截图，记录方法，不伪称CSS模拟为真实缩放。
5. living spec、baseline/changes/06版本/手册/架构/专项测试/计划与Notion均已同步真实状态，新增Notion验证页`41a56479-ab58-81d3-ad75-f5d5e2a9e26d`。用户专业体验签收、500MiB完整压力、通用内容理解和生产不在完成声明中。

本会话新Provider=0、费用=0、临床/旧服务修改=0、本会话19501重载=0。独立Vite19613/PID48610和19614/PID51993已核对命令/cwd/端口后仅停止这两个自有进程；共享19501–19507保持。没有给其他用户会话发消息；接收协调消息不等于可发回。

Notion本片页面：产品 `41a56479ab5881cdb088c21bcecdf689`，计划 `41a56479ab5881cb87e5c194eeff25af`，复用技术 `41a56479ab58816b8dadf29a30035387`，ADR `41a56479ab58810e8e75d8f859f461cd`；验证报告在testing章节另建/链接，不复制私有备份或配置，保留共享页面其他会话内容。
