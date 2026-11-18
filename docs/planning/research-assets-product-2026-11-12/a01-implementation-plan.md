# A01整页串行实施计划

> 执行方式：superpowers:executing-plans，主线程串行实施＋最后一次独立总评；不创建并行实施者，不切S10/G02/知识库剩余包。用户已回复“确认，”批准新增范围，开始C01。下列勾选仅由实际证据更新，不以批准冒称实现。

**目标：** 原A01的六统计、五Tab、九列、四预览和登记/治理/用途任务链完整接真实后端，不留演示或以只读半页销项。

**架构：** 复用旧ResearchArtifact/Version/Source/File/Review/Audit与授权锁，在Hub加rh_asset业务扩展；不修改旧源码/数据库定义。新治理族与A02 V1、旧两候选族分离。技术栈沿原Node/Nest/Prisma事务、React/Vite及共享组件，不新引依赖。

**规格：** [A01整页规格](../../product/research-assets-a01-spec-2026-11-12.md)；[授权清单](a01-authorizations.md)。

## 全局约束与预检

- 当前目录codex/ui-ue-validation；不提交/切分支/新worktree/清理用户改动。文档先行，普通实现仍须TDD、最小原子增量。
- 仅专用合成库、原两个账号/当前Study；待批F01最多10新资产×8版，F02最多4文件，总用途操作≤240；F03指定旧合成共享KB内最多2个原创新文档×3版，不改旧文档/KB属性/分配。
- D01/A-W/I/F批准前不运行DDL/GRANT、开写接口或写夹具；无费用/模型/远端配置/云/旧服务变化。
- 所有变更可追溯AS-11～26及A01登记/治理动作；其他页面只补已明确I04最小阅读/返回依赖，不切换开发主线。
- 不调用旧removeDraft；不靠更改旧状态机、旧成员角色或启动恢复授权实现本页。

接口依赖预检：C01模型/范围→C02目录与预览→C03登记→C04审核发布→C05共享引用→C06辅助Tab→C07整页验收。C04须保留已发布v1和待审v2；C05固定版许可不能因新工作版继承；C06所有计数/图谱必须用C02相同可见谓词。I04的新v2只读投影与V1不得混路由/放宽历史权限。

## 任务与验收落点

每任务先写下列失败测试并亲眼观察RED，再最小实现、GREEN、定向回归；未满足验证不打勾。以下文件是拟新增/最小修改，不存在的测试命令不能当本轮已执行。

### C01：仅本轮新对象的状态/用途契约与隔离增量（4～6h）

**文件：** 新scripts/research-assets-catalog-contract.mjs及.test.mjs；新server/research-assets/schema.sql、scripts/research-assets-catalog-schema.mjs及.test.mjs。不改旧schema。

**接口：** assertAssetCatalogInput(query)；assertAssetAction(current,input,actor)；schema迁移仅显式--apply且具名目标守门，无导入副作用。

- [x] 契约12项覆盖查询拒绝、发布/工作版、当前管理员/父Study、固定版许可、回收保留、具名额度；迁移守门2项通过。测试命名按实际行为命名，不伪造计划示例函数。
- [x] 新模块缺失RED→GREEN；真实PG读前守门暴露Prisma void反序列化，显式失败回归后改executeRaw解决；不是数据库授权问题。
- [x] 专用库23项真实回滚演练通过后实际创建D01四表/最小GRANT，应用角色四表RLS强制/禁DELETE、只追加和幂等重读通过；原public定义/角色/10份20版hash不变。回滚中普通人伪造审核/第三人决定两项RED→GREEN修补。49相关、494前端、隔离构建通过，C07独审与整页仍未完成。[证据](evidence/a01-c01/pg-verified.json)。

### C02：真实目录→预览→同版详情→返回（4～5h）

**文件：** 新scripts/local-research-assets-catalog-read.mjs及.test.mjs；新src/research-assets-catalog-session.js及tests同名；新pages/shared/ResearchAssetCatalogWorkspace.jsx、ResearchAssetCatalog.jsx。接线改动另限missing-main/平台页头及旧reader兼容，不重构其他页。

**接口：** createAssetCatalogReader({withAccess})提供catalog/preview及GET /catalog/:id[/versions/:version]的detail.v2；共享单一visiblePredicate和scope/identityRevision。新增makeCatalogAssetUrl/assertCatalogAssetDetail按I04 assetCatalog=1和assetReturnTo严格安全返回；原makeResearchAssetUrl/V1守门不变。

- [x] 可见集合统计/过滤/稳定排序、无权预览、迟到响应和安全固定版返回均RED→GREEN；V1/v2分族及静态路由守门保持。
- [x] 目录/预览/详情相关测试及空库真实0通过；失败不得显示0的契约验证通过。实际读取503注入和全页故障矩阵仍按C07最终验证，不以本行代替其真实浏览器证据。
- [x] 获批新族10份真实HTTP与两角色浏览器验证；同1910六卡/九列/固定版/精确筛选返回、实际两页各5条无重复通过。不称A01整页完成、不切下一页。

### C03：原上传入口登记→修订→历史（4～5h）

**文件：** 新scripts/local-research-assets-registration.mjs及.test.mjs；新pages/shared/ResearchAssetRegistrationDialog.jsx；本页工作台最小集成。新增client写allowlist在同功能提交。

**接口：** register(user,input)、revise(user,id,input)、upload(user,file,input)，请求/结果按整页规格§6；所有原键由系统生成和保存，不让用户填技术字段。

- [x] 五类固定内容/policy、非读权即沉淀权、缺依据提交阻断契约、幂等、CAS、文件/暂存当前身份/24h/一次绑定/原键恢复等RED→GREEN；F03恰两份原创新资料、真实旧服务撤审阻断在回滚事务验证。
- [x] 当前全量前端563/563、后端资产70/70、隔离构建5.25秒通过（原大包告警保留）。
- [x] 10对象/13版/13成功事件/4绑定文件实际保存及当前HTTP全量重读通过；owner/admin真实登记/修订/旧版/取消/Esc/站内离开/账号清理、受控提交后503及实际重登录原键核对通过。旧10/20、旧定义及角色保持。受控503不是意外TCP断连；五宽、原生200%与完整故障矩阵仍在C07，不冒称已验。

### C04：固定版提交→管理员审核→限定发布/撤回（4～5h）

2026-11-13当前：C04指纹阻断已解除，严格--verify在数学重现原hash及精确核验独立获批新增函数后通过，不重置旧基线。C04及C05已完成本机增量技术验证，以下历史失败留在执行台账；C06/C07继续按顺序，不称整页完成。

**文件：** 新scripts/local-research-assets-governance.mjs及.test.mjs；新pages/shared/ResearchAssetGovernanceDialog.jsx；注册/预览最小集成。

**接口：** submit/review/release/withdraw；current authorization与registry revision/Version/Policy绑定，事件/Review/Audit同一事务。

- [x] 真实当前管理员/科研人员权限、自审、CAS、旧固定源及撤回、来源失效缩减等契约与真实PG回滚验证已留证；实际测试命名见相应测试，不把本计划早期示例函数名冒充已存在。
- [x] 治理服务与UI契约RED→GREEN；后续公共指纹问题以有界精确证明收口，不改原基线。
- [x] 原两角色真实退回修订、自审、工作v4独立于历史v3撤回、具名受控503和重登录原键恢复均通过；不修改G02/旧权限。完整跨宽/故障矩阵留C07。

### C05：申请/指定共享→原位处理→引用与撤销（4～5h）

**文件：** 新scripts/local-research-assets-access.mjs及.test.mjs；新pages/shared/ResearchAssetAccessDialog.jsx；共享Tab/引用动作原位接线。

**接口：** requestAccess/decideAccess/revokeAccess/cite/getOperation；purpose∈read_body,cite，recipient仅原另一账号，TTL≤7天。

- [x] 用途闭合/本人及重复/版与封印/CAS/原键/当前身份、复制失败与晚响应等RED→GREEN；不新增角色/成员权限。
- [x] 当前97项资产后端＋7项用途UI=104定向通过；已落v2约束下18项真实aisci_app全回滚验证通过，含失权/封印/审计失败/伪造grant。期限采用局部注入时钟与真实PG，未调全局时钟、未伪称等候7天浏览器验收。
- [x] 真实浏览器双角色申请→拒绝→重申请→授予→实际正文/引用→阅读期间撤销→打开正文清除/复制拒绝；另指定cite-only→引用可用/正文受限→原页面撤销。首次申请真实提交后受控503原键核对一次，旧探针不重arm；最终3条历史/2引用，10资产/15版/33事件/4文件，模型0。原页面1910×1075母版几何及14/22复核；C07五宽/200%及总评尚待。

### C06：五主Tab其余区域与推荐/趋势（4～6h）

**文件：** 新scripts/research-assets-catalog-views.mjs及.test.mjs；本页ResearchAssetCatalog.jsx/样式限定作用域；fixture/e2e文件独立。

**接口：** graph/contributions/collaborations/trash/recommendations/usage，使用C02相同当前可见集合；trash/restore走同一操作原子提交接口。

- [x] 实际命名见views/lifecycle/contract测试：同可见谓词、游标换批、上海30天独立类型、历史回收阻断及恢复无许可；真实PG/双角色HTTP与浏览器均已留证，不把示例函数名冒充实现。
- [x] `node --test scripts/research-assets-catalog-views.test.mjs tests/research-assets-catalog-ui.test.mjs`RED→GREEN。
- [x] 五Tab/四预览全真实数据或合法空态，推荐可换批、趋势可回算，回收软删恢复均真实成功；无演示折线或只改样式的Tab。页内事件通知不冒充全局通知接通。

### C07：整页、兼容与一次独立总评（4～6h）

**文件：** 新tests/fixtures/research-assets-catalog-http.mjs、scripts/research-assets-catalog-browser.mjs；本页测试报告、产品living/版本/使用说明/Notion。脚本先审其scope、禁止自动restore旧授权/新AI。

- [x] 真实PG/HTTP四层：当前管理员、普通作者、受限用途/匿名/跨tenant/错Study负例；原10/20和前序已知ID/hash、P01数量/动态及原候选/方案/报告读取不变。
- [x] `node --test --test-concurrency=1 tests/*.test.mjs`；定向新旧资产/授权/来源测试；`pnpm exec vite build --outDir .tmp/research-assets-a01-20261112-dist`，不覆盖运行dist。
- [x] 浏览器整链五类、真实双账号、筛选组合/分页/非首项/固定历史/返回、服务失败/409/提交丢响应/撤权、复制拒绝/键盘/站内Dialog。五宽/原生200%和同1910母版比较及截图/录屏；工具不足列关键阻断，不勾完成。
- [x] 一名新上下文只读独评按下列重点，Critical/Important一次RED→GREEN修补后全回归；Minor留账。用户业务评审单列，不代签、不称正式发布。

实际录屏/鼠标脚本为`scripts/research-assets-a01-closure-browser.mjs --verify`，原任务标题中的浏览器文件名属拟议名，不以不存在文件冒称执行。

当前收口（2026-11-13用户已明确要求末项）：C07本机技术完成。单次独评三Important已修；本轮Minor错误提示RED→GREEN，trusted mouse click detail1原恢复打开/原key核对和双角色实时录屏补齐，623/112、5.39秒构建及真实PG/HTTP通过。旧缺项历史保留不再作为当前阻断；原始VP8/H264、质量元数据和当前边界见a01-closure-2026-11-13.md及docs/testing/research-assets-a01-close-2026-11-13.md。用户业务/专业签收及真实生产仍未完成，不自动切下一页。

## 工时与关闭门槛

各任务相加28～38有效小时＋4h缓冲；包含原P2分摊与P3，不新增一整套共享底座工期。每任务可能拆成≤5文件小步实现/验证，不一次写完整模块；需要用户确认的是上方业务增量而非每一个任务。保持现有11月中旬目标的风险提示，不擅改交期或把完整60项压成几天。

新增范围已批准，按C01～C07连续推进；遇费用/云/权限/旧服务/远端配置/真实发布等原停点才停止。当前C04公共指纹阻断已解除，严格门禁已通过；C05与C06已完成本机增量技术验证；当前进入C07整页总评，最新10资产/15版/39事件/4文件，不重复夹具/探针。不以纯契约或C04结果替代C05功能交付，不切A02其余开发，不恢复旧共享底座任务。整页跨宽/原生200%/故障与独立总评仍留C07。

## Review Focus

2026-11-13执行补记：共享窗口已解除；当前PID24917、原位登记/修订与受控恢复已实际执行。当前10/13/13/4新对象及文件保持在获批上限内，详见报告与台账。禁止依据旧“等待冻结/0资产”描述重复初始化、重arm已消费探针或新增第五份文件。

1. 内容容器draft与Hub真实资产状态是否明确分层，旧接口/扫描是否能绕过新policy；本轮不能证明生产兼容。
2. 摘要可发现但正文受限时，列表/预览/图谱/推荐/统计/引用/原回执是否泄漏私有字段。
3. 多个工作版及旧发布版并存时，许可/审核/引用/深链是否绑定同一固定版。
4. 当前管理员权限不能来自共享Role补全、邮箱或旧Token；在途当前授权失败是否阻止提交及晚响应复活。
5. 回收/上传/未知回执/Clipboard等异常是否真实可恢复，是否静默物理删除或用假成功替代整页闭环。
