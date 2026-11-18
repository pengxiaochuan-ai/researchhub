# S07指南条款人工引用：本机技术交接

日期：2026-10-31。状态：核心实现、独立合成环境启用及真实页面请求已验证；唯一独立总评审完成，1项Important并发验收缺口仍待最小授权，不称全部技术验收通过；专业用户验收未代签，不是生产发布。

## 本轮交付与边界

按[已批准规格](../product/guidance-plan-citation-spec-2026-10-31.md)与[四步计划](../superpowers/plans/2026-10-31-guidance-plan-citations.md)，在S07新增“指南／标准人工引用”。本人选择已保存完整段落、当前获准条款与用途，核对原文/章节/PDF物理及印刷页码后明确保存；从数据库读取引用、固定历史、解除并留痕。每草稿最多12条，既有64条operation不裁剪。

复用原方案授权/父Study、ResearchArtifacts不可变版本/CAS/审计、来源双审核同快照及共享条款展示组件。引用独立封存在`guidanceCitations`，只存定位、hash、审核版本与建立人/时间，不把条款复制入方案Markdown或AI输入。新增或解除也增方案版本；下游沿原绑定规则保留旧基准，不自动重算/改绑。

仅`wp01_test_full_baseline`、原owner/admin及当前Study。新建两份具名本人合成夹具，前序来源/PICO/报告只读；不新增表、数据库/角色权限、来源决定、付费调用、云资源、远端配置或生产发布，未改旧服务代码。

## 体验入口

先经[真实登录](http://127.0.0.1:19501/pages/p003/)使用对应账号。可从“我的科研→当前Study→研究设计→本人草稿→完善研究设计”进入；列表名称含“指南人工引用本轮合成夹具”。

- 科研人员`owner@example.org`：[本人新夹具S07](http://127.0.0.1:19501/pages/s07/?designWorkspace=1&studyGroupId=rh-kb-local-b0e2af9d-group&researchProjectId=rh-kb-local-b0e2af9d-project&researchPlanId=cmvwinz0y0001luzuacvojv6q)，只读基于本人原方案`cmvowdv07000flucmsiqa9uns` v3的已确认PICO及合成资料。
- 管理员`admin@example.org`：[本人新夹具S07](http://127.0.0.1:19501/pages/s07/?designWorkspace=1&studyGroupId=rh-kb-local-b0e2af9d-group&researchProjectId=rh-kb-local-b0e2af9d-project&researchPlanId=cmvwinz460006luzuxgnqlddo)，只读基于本人原方案`cmvowdvuq000ylucm7rgz0b06` v1。

展开“核对并管理方案条款引用”，两账号均留有一条针对真实设计正文的人工核对引用。测试建立/解除的历史仍保留；不把标题关联、测试通过或引用本身当成科学适用性证明。原账号密码仅在私有本机体验配置，不在本文件记录。管理员无权查看另一账号私有草稿。

## 验证与证据

证据根：`/Users/mac/aisciencesys/docs/test/evidence/2026-10-31-guidance-plan-citations/`。各目录含result、网络状态、computed、PNG及WebM；丢回执额外保留实际已提交响应，不记录Cookie/密码。

| 验证 | 结果与位置 |
| --- | --- |
| 引用纯契约 | 6项，含精确UTF-16/CRLF/重复段落、完整段落/hash、未知字段、JSON数组冒充clause字符串、重复与12条上限 |
| 最终纯测试 | `node --test tests/*.test.mjs scripts/guidance-plan-citation-contract.test.mjs scripts/research-plan-contract.test.mjs scripts/research-design-contract.test.mjs`，181/181 |
| 来源及真实PG | guidance-clause contract/schema/service、external-visible/review及新local-guidance-plan-citations六个测试文件，22/22，其中新服务8项；事务回滚、不留历史夹具或审核变更 |
| 独立连接锁竞态补测 | 新服务最终8/8；真实两个backend分别验证审核先持源锁与引用先持源锁，`pg_locks`精确文档key及`pg_blocking_pids`证明另一方等待；全部回滚，不冒称已提交撤回竞态 |
| 双账号全流程 | `flow-fb697ca4`，10项；真实201/版本、刷新后回读、精确历史、解除、跨账号403及非法治理字段400 |
| 两账号四视口阅读 | `visual-86d795b3`，8组；1440、390、320及Chrome原生200%，键盘来源定位、两页码、Reading与Range无裁切 |
| 两账号四视口真实写入 | `viewport-flow-ca85bc05`，8组；每组新增→固定历史→回当前→解除；仅本轮两夹具追加版本，不覆盖旧数据 |
| 最终可体验关系 | `experience-4ed03a4b`，2组；完整设计正文关联，不是标题；保留当前人工引用供体验 |
| 新增/解除丢回执 | `unknown-312785c9`及`unknown-remove-3cb5cecf`；先由真实后端完成提交，再丢弃浏览器回执，原key/CAS显式重试replayed且不重复增版 |
| 读取失败恢复 | `read-fail-6029716c`；UI-only503不展示旧摘录，显式重试真实后端；不能冒称真实数据库故障演练 |
| 真身份切换 | `auth-02d8e7a9`；真实Cookie切为另一账号后旧方案403，条款及表单立即清空；预期403 console单列expectedFaults |
| H06/G02只读回归 | `/Users/mac/aisciencesys/docs/test/evidence/2026-10-31-guidance-clauses/verify-e291ccb7/`，27组，0新审核决定，0warnings |
| 构建/保全 | build4.16s通过，既有500kB chunk提示保留；`--verify`核对1053前序版本、角色和完整AI账本指纹未变；`git diff --check`通过 |

测试日志：`.superpowers/sdd/2026-10-31-guidance-plan-citations/final-pure-tests.log`、`final-source-pg-tests.log`、`final-build.log`。本机服务状态检查7端口就绪；未执行旧服务停线或真实发布。

真实PG额外证明：原方案资料restricted不交付段落/引用/选源、stale只读，其他owner与authVersion漂移拒绝；当前任务在途不能写；撤回/到期、错误提取/hash/条款、半段定位均拒绝。模拟在实际版本及审计写入后到期，整个授权事务回滚，既不留版本也不留审计。相同提取撤回再批准仍不复活旧关系，须本人明确解除并重新添加。换源/提取头和跨租户拒绝另由既有真实来源服务测试覆盖；不把两组证据混称同一浏览器演练。

## 浏览器发现及修补

- 真实提交但回执丢失，最初缺少独立重试；新增仅显式重发原操作/key/CAS的入口。解除没有新增表单选择，曾被轮询推进CAS而丢失重试；补齐不确定提交dirty保护，分别RED→GREEN。保留真实已提交版本，不删除失败历史。
- 原生Chrome SELECT即使声明22px行高，computed可能为normal；实测14px文字、22px标签及至少44px高度。保留原生控件，作为明确记录的原生例外，不把normal改写成实测22px。
- visual首跑取到了第二条未展开引用内的隐藏summary，限定到已展开项后通过，不据测试定位错误改Shell。auth首跑将预期403记作unexpected，修正日志分类后复测，拒绝响应没有被忽略。
- viewport-flow一次开始时19501短暂ECONNREFUSED，无写入；重新核对本机具名服务和7端口就绪后串行重跑通过。失败目录保留，不隐去异常。

人工检查了桌面、320手机和原生200%的实际截图：局部Reading16/28、最大48rem、操作14/22、正常折行和44px触达；移动长文允许纵向滚动，不缩字压内容。全局Shell未改；“工作区导航”沿用既有控件，来源定位与最终保存/解除均实点通过。

## 独立评审与四层验收

唯一全新只读总评审`guidance_citation_final_review`结论：未发现可确认的代码缺陷；Critical 0，Important 1（验证缺口），无阻断性Minor。其独立执行纯测试9/9；拒绝代判专业适用性、临床效能、生产和真实AI。

Important原意见：当前“写后到期”通过同事务代理，撤回/再批准按顺序测试，未实证两个独立连接的审核撤回已提交与引用提交交错。主实施已补两连接双顺序锁测试，真实`pg_locks`精确源key及阻塞backend证明等待；回滚后旧决定与版本未变。但“审核撤回先持久提交→另一连接提交引用拒绝”仍未验，不能用锁等待、同事务或Mock替代。因已批准边界明定不新增来源决定，未擅自提交撤回；已单独请求仅原本机源T/CAAM0010追加最多2条具名admin撤回/恢复展示决定的最小授权。确认前此项保持未关闭，不安排第二次独立复签。

1. 代码实现：本片纯契约、受控引用服务、S07面板及严格同源路径已实现；独立评审未报告确认代码缺陷。
2. 目标环境启用：仅本机独立7服务合成装配，非生产。
3. 真实请求执行：两账号真实数据库版本、HTTP、截图/录屏与失败恢复已取证；两连接锁等待有证据，持久撤回竞态未取得授权和实证，此技术验收项未关闭；本片没有AI调用。
4. 专业用户结果：仍待用户核对“这些条款是否适用于我的方案段落”及阅读操作体验；测试不会代签方法学适用性、真实研究合规、正式Protocol或生产验收。

后续建议不等于授权：先由用户在上述两份新夹具验收人工引用的适用性和可读性，再讨论是否确有必要将获准来源加入AI一致性核对；本片不自动开放AI用途。

## 文档同步

已同步Notion既有规格、四步计划、产品基线/变更、版本记录、使用说明、API、前端架构及UI验收；不覆盖其他并行专项。新增交接位于testing原目录：[S07指南条款人工引用·本机交接与待验项](https://app.notion.com/p/40a56479ab58815990f3d3386033d5a7)，唯一新增页，已回读。规格/计划标题已由“待确认”改为“已批准实施”，Important未关闭状态同步保留，未冒称全部验收。
