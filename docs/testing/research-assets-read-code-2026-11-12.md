# 科研资产A02最小只读依赖：本机技术验证

2026-11-12｜当前目录串行实施＋独立评审。范围来自用户“可以，你来进行串行实施”，沿[A02先行依赖规格](../product/research-assets-a02-read-slice-2026-11-12.md)；未进入A01开发，不将此阶段当完整页面交付。**当前结论见第5节；第1～4节保留批准具名夹具前的代码/零写入阶段记录，不再代表当前停线。**

## 1. 本轮实际改动

- 新Hub资产族`rh-research-asset:`，复用ResearchArtifact/research_report与追加版本，五类为protocol/dataset/instrument/analysis/publication。人工合成来源声明与草稿语义明确，不改旧枚举、表、角色或旧系统。
- 新纯契约与只读reader/Controller工厂，注入现有当前授权事务；校验真实owner/创建者/tenant/Study/父版本、正文与规范JSON摘要，历史元数据不取当前头标题。拒绝旧族/正式报告/删除/非draft/篡改/类型变更，不透传旧get整包。
- 只读投影提供固定正文和最多50条版本元信息；无任何编辑/共享/审批/发布/下载/导出接口。Controller工厂尚未注册到运行中的后端。
- A02新显式真实分支按原hero-detail-card、七Tab、预览/核心信息/摘要与右侧AI/推荐/复用位置实现；仅替换真实状态，不带演示结果。此为结构实现，非已完成有内容同视口视觉验收。
- 当前会话及账号切换清私有正文；同账号authVersion变化、/auth/me在途及detail在途旧响应不得恢复正文；probe成功发布新head或更新固定历史版的当前版本/历史列表，旧慢响应不覆盖新响应。
- P01同一where在数据库计数/分页前排除新族，动态继承相同集合，保留既有正式报告排除。未改P01页面或其布局。

## 2. 验证与证据

证据目录：[p1-admission](../planning/research-assets-product-2026-11-12/evidence/p1-admission/)。

| 层次/检查 | 本轮结果 | 证据/限制 |
| --- | --- | --- |
| TDD | 已通过 | r1/r2/r3及P01/red日志；先观察失败再实现，不用单纯绿灯替代回归有效性 |
| 前端全量 | 489/489，失败/跳过0 | [frontend-tests.log](../planning/research-assets-product-2026-11-12/evidence/p1-admission/frontend-tests.log)，`node --test --test-concurrency=1 tests/*.test.mjs` |
| 相关后端契约 | 34/34，失败/跳过0 | [read-slice-green.log](../planning/research-assets-product-2026-11-12/evidence/p1-admission/read-slice-green.log)，新reader/契约/P01及原候选/适用性/来源准入回归 |
| 构建 | 通过 | [build.log](../planning/research-assets-product-2026-11-12/evidence/p1-admission/build.log)，输出到`.tmp/research-assets-a02-20261112-dist`，不覆盖运行中dist；保留大于500KB包告警 |
| 专用PG READ ONLY | 已通过，0业务写入 | [readonly-pg.json](../planning/research-assets-product-2026-11-12/evidence/p1-admission/readonly-pg.json)，双连接目标守门＋当前事务只读；owner246/admin110旧过滤计数不变，新族0；五类JSONB往返、空字符串键不误排 |
| 独立代码评审 | 修复后通过 | 先发现身份版本、probe丢响应及/me在途窗口；独立实际Workspace内存Hook复验6项通过，指定5组28/28；无模型/PG写入。双SSR实例一次WebSocket端口占用告警保留，不称零告警 |
| 真实浏览器负向 | 已通过当前入口/重试 | 当前owner cookie，真实新路由返回未注册404；页面显示业务文案、保留真实身份、0私有正文/0演示，4个危险/不可用动作禁用；重试后相同真实状态，控制台本次采样无warn/error |
| 新对象正向/两角色/原布局同视口 | 未测 | 未创建本轮持久夹具、未启用Controller，不能以旧候选或SSR代替 |
| 正向录屏、原生200%与长文实际字号 | 未测 | 同上，后续正向范围内执行；不声称A02新功能验收完成 |

只读PG命令：

```sh
node tests/fixtures/research-assets-read-pg.mjs /Users/mac/aisciencesys/.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json /Users/mac/aisciencesys/.tmp/researchhub-knowledge-local/runtime.json
```

配置只通过旧fixture guard读取并核对本机专用合成库，输出不含连接口令。测试脚本不初始化业务记录/权限、不调用模型、不连接临床库。

### 实测发现与修正

1. 首次内联PG诊断的相对导入路径错误，未建立连接；改为可复跑独立只读脚本。
2. 初版P01为假设可空请求键加入null兼容，纯测试替身未发现；真实Prisma拒绝，静态核对共享schema确认该字段是非空String。最小改为直接not.startsWith，先RED后GREEN并重跑真实PG。保留失败日志，不改旧schema。
3. 初版SSR测试未加载项目React自动JSX转换，引起旧Markdown的React未定义；测试夹具补相同转换，未修改旧Markdown或生产配置。
4. 真实浏览器发现原框架404正文暴露接口路径且错误时丢失已核对身份；新分支统一业务错误文案、清正文但不将普通服务错误当注销。修正后真实重试复测。
5. 独立评审复现probe不发布及authVersion窗口，修补后各回归及实际Hook生命周期复验通过；内存Hook不是持久PG或真实浏览器正向验收。

## 3. UI/UE本轮记录

工作区A02；复用Shell/Card/Button/Tabs/AIPanel/安全Markdown。声明沿原A02母版结构，未改Frozen Shell。正文显式Reading16/28，其他由原Token继承；有内容computed字号仍待真实样例验证，不凭CSS宣称通过。

本次负向浏览器实际视口1910×1075、DPR1.34，根无横向溢出、错误alert聚焦、可重试/返回，返回后不串入固定演示。截图：[失败恢复](../planning/research-assets-product-2026-11-12/evidence/p1-admission/a02-new-route-error.png)，[AX](../planning/research-assets-product-2026-11-12/evidence/p1-admission/a02-new-route-error.txt)。非1440×900母版对比，也不是200%验收。

## 4. 四层结论与当前停点

1. 代码已实现：新最小依赖契约/reader/Controller工厂/真实页面分支及隔离回归已具备，完整60项仍未交付。
2. 目标环境启用：前端分支可达，运行中后端尚未注册新Controller；未重启现有本机服务。
3. 真实请求执行：只读PG语义/JSONB及浏览器负向GET已执行；本轮新持久资产正文正向读取未执行。
4. 业务结果达到用户标准：待新夹具两角色/原母版/历史和失败恢复验证及用户评审。

下一实际动作是确认A-R01～03具名持久夹具：原两账号、当前Study、最多10份×最多2版，复用已有权限，0模型，不改角色/旧记录。已通过非阻塞问题呈交用户；确认前不写入夹具/用途审计或启用后端。旧用途审计不是新RBAC要求，不再以此暂停普通代码实施。最小依赖实际通过后才集中A01。

## 5. 用户批准夹具后的最终技术结果

用户已确认A-R01～03并要求继续。通过旧ResearchArtifactsService与现有当前授权事务建立10份具名合成草稿、20个追加式版本，来源仅人工合成，未调用模型；每账号五类各一份。未改角色/旧表/枚举/旧系统，未开放共享、审核、发布、锁库或导出。新对象有原创建/版本审计及本轮具名用途审计。

- [具名对象](../planning/research-assets-product-2026-11-12/evidence/p1-admission/named-fixtures.json)、[只读复验](../planning/research-assets-product-2026-11-12/evidence/p1-admission/named-fixtures-verified.json)：10/20，逐个当前/历史正文、标题、跨owner、未知版及失效身份/错父Study/跨租户拒绝通过。
- [新夹具后真实PG](../planning/research-assets-product-2026-11-12/evidence/p1-admission/readonly-pg-after-fixtures.json)：owner原产物251→P01过滤246，admin115→110；两人各5份新族均排除，原P01数量保持。JSONB五类往返仍通过，复验事务READ ONLY，复验无业务写入。
- [真实HTTP](../planning/research-assets-product-2026-11-12/evidence/p1-admission/http-verification.json)：双账号五类head/v1共20次200，Cache-Control:no-store；跨owner10次404、非法/未知读取8次拒绝、错Study403、注销后401、匿名401，P01草稿和动态不混入新族。
- [运行前守门](../planning/research-assets-product-2026-11-12/evidence/p1-admission/runtime-preflight-final.json)：真实活动租约/近期待执行/可派发指令/可恢复指令任务合计0。旧155条pending是历史夹具状态，不作为排空对象，未取消/恢复/清理；不把所有旧queued当本次在途。仅通过具名进程守门重启本机Hub，旧服务不动；最后七服务ready，原账号/口令与资料保留。
- [真实浏览器20次](../planning/research-assets-product-2026-11-12/evidence/p1-admission/browser-positive.json)：两账号×五类×当前v2/历史v1，正文和标题均匹配固定版，历史明确只读；当前两角色及跨owner拒绝有PNG。没有把下拉选择动作当实际正文已返回。
- [原母版](../planning/research-assets-product-2026-11-12/evidence/p1-admission/a02-reference-mother.png)、[新页](../planning/research-assets-product-2026-11-12/evidence/p1-admission/owner-publication-v1.png)：同1910×1075、DPR1.34，[原网格](../planning/research-assets-product-2026-11-12/evidence/p1-admission/a02-reference-mother.json)与[新网格](../planning/research-assets-product-2026-11-12/evidence/p1-admission/a02-real-layout.json)的hero/body/preview三组列宽完全一致，七Tab及七卡片槽位顺序相同；六元数据槽保留，缺机构不补造，创建时间和所选版本时间分开。连续正文computed16/28，无根横溢；只读禁用动作透明度.55。查看详细分析/编辑标签/更多等也保留原位并真实禁用。
- 固定版本通过链接Enter键可切换；原生下拉Space能展开，但自动化ArrowUp未改变选项，未冒称其键盘选择已通过；selectOption已真实选择v1并回读。其他Tab在原位置明确暂无/受限，不当作对应完整功能已交付。
- 真实登出清正文；[安全重登录](../planning/research-assets-product-2026-11-12/evidence/p1-admission/fixed-version-relogin.png)保留同asset/Study/version2，[重新登录实际回读](../planning/research-assets-product-2026-11-12/evidence/p1-admission/fixed-version-relogin-restored.png)成功。已恢复owner会话；未重放写动作。

### 5.1 后续发现修正与最终回归

独立复核发现夹具前缀计数不足以守10份上限；新增test-only具名集合校验，在preflight及实际创建同一授权锁事务内核对十个确切key、owner/creator/父Study/状态/版本，陌生同前缀记录先拒绝，RED→GREEN。真实复验仍10/20，未额外创建。

浏览器发现重登录原安全返回名单不认识新对象，新增新A02严格白名单，拒绝重复/混族/外链/hash。独评再发现通用assetVersion会劫持旧assetDraftId历史入口，最小修正新族识别以保留旧族；旧当前/历史/安全返回及混族拒绝RED→GREEN，未改旧组件或后端。最终独立指定范围Critical/Important/Minor均0；既有身份六项复验、guard、返回规则与旧路由复验分别留结论，不将Mock/Hook当真实PG/浏览器。

最终回归：前端491/491、相关契约与fixture guard35/35，隔离构建通过；日志仍同目录。保留包大小、双SSR端口及Node localstorage路径告警，未新增依赖或云操作。

### 5.2 四层结论及未覆盖

代码、目标本机启用、持久PG/真实HTTP/真实浏览器读取三层已有证据；本轮合成阅读任务可实际完成，但专业用户可用性仍待用户评审，不能代用户签业务验收。原母版比较仅1910视口；1440/1366、原生200%、手机、网络503/乱序的真实浏览器故障注入与连续录屏未测。工具本轮未提供视口/网络仿真或录屏能力，原生缩放快捷键试探未改变CSS视口，不能拿它算200%验收；只有截图与DOM测量，不能说已录屏或全分辨率通过。

此阶段仅A02固定版阅读最小依赖，不是完整A02/60项功能或正式资产治理交付。A01尚未实施新目录/登记/图谱/协作/回收/推荐；后续集中A01，不以KB全工具或底座扩建为前置。临床库、云、正式部署和真实发布均未执行。
