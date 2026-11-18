# B03中英检索真实后端接线 · 2026-11-03

## 当前结论

用户本轮明确要求B03接通B02，而非继续停在纯编译阶段。现有E01输入中文并“应用筛选”已能通过真实后端命中获准英文PMC，原预览→E02详情路径、管理员和科研人员入口保持。旧科研Agent的Hub检索同样使用这套计划。**这不是单篇文章AI回答交付**，不运行Provider、不改E02/AI01页面或旧内核。

产品living spec/基线/变更/版本/使用说明、API/前端架构、测试与倒排台账及Notion已同步：[Notion交接](https://app.notion.com/p/40d56479ab58812e86e1c4e3dcb0950c)、[API契约](https://app.notion.com/p/40d56479ab588142ba3fdbf82ccfc7d7)。同步为追加本轮精确状态，保留其他会话的科研身份/团队目录资料。

仅`wp01_test_full_baseline`和原两个体验账号，前序资料/决定只读；无新权限/表/数据夹具/云/远端配置/发布，当前目录串行保留既有改动。owned本机服务在任务在途0时受控重启，不重启旧服务。B02单纯“未接页面”作为当时结果保留，由本记录覆盖当前B03状态。

## 四层证据

| 层 | 已验证事实 |
| --- | --- |
| 代码 | 共用47词快照/QueryPlan，工作簿SQL前置AND/OR、当前授权字段、PMC固定20候选投影、外部初始五份检索及当前来源重验；混合结果原文优先/签名rank游标/真实计数 |
| 本机配置 | 原SourceReadController复用既有secret、现有进程装配加载新代码，无新配置/依赖/权限；无默认关闭旁路 |
| 实际执行 | 真实PG/app角色、两账号/匿名HTTP、Chrome E01应用→英文命中→预览→详情，AI只读meta同计划；真实2条/页全部命中一次、跨查询/身份/篡改cursor400；四屏与原生200%证据 |
| 用户效果 | 中文现在可找到获准英文资料；研究相关性、后续单篇解读支持度和最终专业验收不代签，范围不是开放语义搜索或全网检索 |

## 观察到的结果

当前13篇公开获准PMC；改动前原E01“针灸”实际0篇，接线后“针灸”13篇，“针灸 抑郁”同样13篇，实际每个概念均在当前获准文字中匹配，**相同条数不代表把AND改为OR**。真实PG控制样例已证明仅含单个概念和词内electroacupuncture不满足两个组，跨字段针灸/抑郁可相交。全文出现一个词不等于该篇研究专门评价该主题，不添加RCT/疗效等级或相关性承诺。

PMCID精确查询返回对应1条；“针灸 2099 未知约束”literal且0条，不丢掉年份/未知约束。旧Agent只读检索默认最多6来源，当前英文/中文探针各6；不是页面只有6篇，也不是新模型回答。返回queryPlan可查实际中英词形，页面展开解释UI01仍留B05，本轮不改变已确认布局。

## RED/GREEN与失败处理

1. 原B03真实测试三处失败：中文无英文命中、PMC绕过limit、响应无queryPlan。随后先接共用投影，再修正混合分页；不改测试预期掩盖失败。
2. 计划要求的原`approved-source-chain-pg`两正例失败，因为测试硬编码authVersion0，而S08后实际5。只将测试设置改为同事务读取当前有效账号版本；过期/跨租户负例仍拒绝，未改角色或生产授权。
3. 原文优先排序先用恒定rank反证，真实PG按原文字段优先断言失败；实现rank/cursor后通过。曾将字面rank0直接置于ORDER BY，PG按第0列解释报42P10；改为明确`searchRank`别名并重跑原/新检索，通过。不是数据库策略放宽。
4. 内部rank不得扩散成新公开DTO字段，实际接口断言先失败，再在交付边界剔除；排序游标仍签名保存rank。
5. 503由浏览器对本次只读请求定向注入，明确**UI-only**；点击原重试后返回真实后端命中，不把注入当真实服务故障。其余正向请求均实际后端，不拦造英文结果，不创建任务/会话或新增审核决定。

## 验证命令与范围

```sh
node --test --test-concurrency=1 server/hub-sources/search-query-plan.test.mjs server/hub-sources/bilingual-search-pg.test.mjs server/hub-sources/approved-source-chain-pg.test.mjs server/hub-sources/article-preflight.test.mjs
node scripts/bilingual-search-browser.mjs before
node scripts/bilingual-search-browser.mjs after
node scripts/approved-source-chain-browser.mjs --mode local-synthetic
node scripts/study-tasks-final-gates.mjs --mode local-synthetic
node scripts/study-tasks-preservation.mjs --mode local-synthetic
```

QueryPlan8＋B03真实PG5＋原资料链3＋原复用3＝19项通过；其中原复用探针新Session/Message/failed-job均回滚，不是实际问答或新检索接线证明。全Hub最新纯测试239、旧StudyOperations138、旧事务核心12及前后构建/空白检查通过；不是旧系统全部测试或所有历史PG夹具重跑。原chunk/WebSocket告警保留。

全目录第一次在235项通过；共享目录随后新增科研身份测试时，`research-identity-session.js`尚未存在，236项中1失败（`free-gates-f853bc93-*`）。本片未修改那一模块，待对应文件随后出现，其4测试及完整239项重跑通过，不删除/跳过该失败，也不把其他会话的修补记成本片产出。

前后截图原三栏/字段/应用与清空/预览/详情不变，1440/390/320及Chrome原生200%保留；PNG/WebM与实际查询/URL/时间/响应元数据归档。屏宽测试不代替原生200%，用户效果不由构建替代。初始只读资料链6组回归保持queueChanged=false、当前13篇决定不变；原件352/版本1083/来源2710、旧2任务/共享角色/AI账本保全，无第9个S08任务/Provider调用。

证据根`docs/testing/evidence/`：

- `bilingual-search-browser-before-fe0bee17-f7a2-418e-9796-cd98f35881c7/`改动前真实中文0篇及母版；后补1280与14px输入/按钮DOM测量见最终浏览器记录，不从旧三屏截图推定。
- `bilingual-search-gates-645d1789-b05d-4d59-8936-c963de65a0b3/result.json`、tests.log：最终运行代码SHA及19项通过。
- `bilingual-search-browser-after-f525f126-e966-4bb3-abc7-4cf1f589e3c9/result.json`：两账号共7组实际检查/恢复、四视口14px输入/按钮及原三栏DOM、原生Chrome200%、PNG/WebM，0新任务/模型。已查看桌面/1280/390/320及原生200%截图；截图等待resize后的两次绘制帧，避免在重排途中取证。
- `approved-source-chain-44130006/result.json`：原链6组、13篇、当前审核队列hash不变、0模型/来源写入。
- `study-tasks-s08-2026-11-02/free-gates-de29c690-9c91-4c32-a7fc-4260d3a926d2/result.json`：最新239/138/12和两端构建/空白检查通过。
- `study-tasks-s08-2026-11-02/rh-s08-1c6165b1/preservation-cd4365ad-73d6-4297-b0fc-6241027c993b.json`：原件/旧任务/共享角色/费用账本保全，8/8任务未增。

## 边界与下一项

- 保留PMC首批20候选来源边界，不采新文章；工作簿15697原始行不是全部获准搜索内容。
- 新增的`counts.matchedRecords`为获准来源记录命中数，不当研究去重计数。原审批总数不被搜索命中数量替换。
- 当前获准工作簿样本不足以宣称已走过大型工作簿实库负载验收；SQL前置条件和分页用真实PG只读合成值验证，不新批准或改动原始行来制造正例。
- 未变更权限，不能为证明隔离而撤回旧13篇；旧当前决定/hash/失效身份反例及匿名/未审隔离已验证。新撤回夹具属于获准M02后续免费整链范围。
- 完整切片唯一独立总评审仍留B08，本轮作者自查SQL参数化、当前字段投影、精确标识、原文优先及游标边界，不冒称独立签认。B04单篇context/证据包与旧Agent提交链尚未实现；B05解释UI/AI按钮未借此提前改版。
- 1280px既有列表工具条“排序/列表/图表”仍有窄列换行，手机需向下滚至结果；本轮没有据此擅自修改已确认页面，不宣称全站/所有屏宽视觉完美。截图库记录实际状态，后续UI调整须单独说明和确认。

相关[API/实现约束](../technical/bilingual-search-api-2026-11-03.md)、[实际台账](../planning/bilingual-article-ai-2026-11-02/implementation-progress.md)。建议下一项为B04，先把“当前一篇文章/固定版本”的证据包和后端隔离做实，再接既有AI入口。
