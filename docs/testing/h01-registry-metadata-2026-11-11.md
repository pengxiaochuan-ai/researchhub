# H01临床注册元数据 · 本机验证与阻断记录

## 最终增量 · B方案本机闭环通过（2026-11-11）

用户批准B后，新加严格限定两条初始clinical/source1/extraction2/schema2的display_only路径。当前授权锁/对象锁/CAS保留，仅追加display+detail同hub-display引用；当前有效AI只允许完整当前统一public无写入返回，否则拒绝，不做历史AI桥接。读侧新prefix同ref检查，旧分字段路径禁止绕过。G02原select条件增加一个选项，其他页面无布局/CSS更改。

原admin已在G02明确选择“仅更新公开展示（AI不变）”并保存200293，真实状态为“公开展示；AI未获准”，计入已决定，保存按钮在未修改时禁用。202558本轮没有写审核，原批准及原AI片段逐字保持。公开两条及注册指标2已恢复，两日期/负责单位/未知研究进度准确，C03来源位置与首页一致。下方阻断记录为保留历史，不是当前失败状态。

| 最终验证 | 新结果 |
| --- | --- |
| 新路径TDD | 真实PG先失败（AI行发生变化/no-op未生效）→2/2；状态组件/队列先失败→聚焦11/11 |
| 全前端 | 329/329，串行tests/*.test.mjs；未跳过失败 |
| 相关后端/真PG/真HTTP | 28/28，含新仅展示、摘要、当前版本/哈希/撤销/过期/租户隔离、真实三身份及同篇C03；非全旧项目测试 |
| 构建 | pnpm run build成功，4.42s，原>500k chunk警告仍在；未运行不存在的lint/typecheck脚本 |
| 真实审核与保全 | api-verification.json及display-live-verification.log通过：B仅新增200293书目display与详情display各1条；本任务累计新提取2、书目决定7、详情决定4（含前序两次批准和保守撤回），AI行未再改变，全部旧行/源/v1/grants保留 |
| 队列 | 原实施前52条、B开始前60条逐行保全；B前新增8条不属于本轮操作；无活跃任务才重载owned服务46505→66711，不触碰旧服务 |
| 双角色浏览器 | admin/owner首页两条→同ID C03→总览均走通，原快照折叠/原位置展开；G02仅展示真实保存及重读，389px同一个select/保存按钮，Tab跳过已禁用保存到下一项，无困焦点 |
| 布局与字号 | 1421×1419原5 KPI/6卡/5列最大差0.000023px；实际1045×1194、389×1260 H01及389px C03/G02主内容无横向溢出，原正文14/22保持。320px/200%未验证 |
| 独立总评 | 新上下文registry_display_final_review无Critical/Important；Minor为更全面构造tenant有效AI、无AI行、schema1/extraction3/source2及过期AI组合测试，静态分支受控，不阻断；不将其冒称已独立跑过 |

B新增修改仅位于object-review、当前公开详情同ref、新prefix旧入口保护、错误映射及原G02用途/队列状态；没有修改AI检索算法、模型、角色或数据库Schema。独立评审set-aside裁定：既有统一public/tenant是明确范围操作，继续保留；有效AI但展示链未就绪拒绝符合本轮边界；既有initial-five/N+1不扩改；几何判断由上述实测而非静态审查回答。

浏览器最终控制台0 warn/error，科研人员H01、原视口已恢复。0模型调用/新增费用，未动历史任务/旧服务/远端配置/云或真实发布。此为本机技术交接；用户专业与视觉最终评审、正式部署另行确认。

### 最终证据补充

仍为下方同一证据目录；所有初始失败日志保留。

- display-only-red.log、display-only-pg.log、display-ui-red.log、display-ui.log、display-backend.log：新路径RED/GREEN。
- display-frontend-full.log、display-final-backend.log、display-build.log：最终329/28/构建。
- display-before-runtime.json、api-verification.json、display-live-verification.log：B前快照和双基线真实保全。
- g02-display-choice/saved.txt/png、g02-389-final.txt/png：原管理员仅展示决定、保存结果和窄屏。
- home-after-admin.png/layout、home-after-owner.png/layout、home-final-owner.png/txt、home-final-layout.json：最终双条与两账号。
- c03-200293/202558-admin/owner-final.txt/png、c03-389-final.txt/png：四条真实角色往返与窄屏来源。
- home-1045/389.json/png、layout-verification.json、browser-console-final.json：实际尺寸、无溢出/字号/几何和控制台。

建议下一项：C01列表仍把研究类型、干预方式、牵头机构写为未提供，后续可沿原列接入已审核详情；不自动展开本轮范围，不混用注册日期与“首次公示/更新时间”。

日期：2026-11-11。仅wp01_test_full_baseline；[获批规格及新停止点](../product/h01-registry-metadata-2026-11-11.md)。没有发布或调用模型。

## 已实现和配置

- 可选schema2追加registeredOn/leadInstitution/registrationStatus，v1解析及旧提取不变。两文件原位置113/538/119行，日期2023-07-12和2023-11-01，单位均中国中医科学院针灸研究所，注册号状态均预注册。不能据此推断研究进度。
- 具名脚本只追加提取2，经当前源/原件/旧payload/hash、既有RLS/策略/约束核对，幂等重跑0新增，无DDL。新增字段未审/撤销/过期/换版/坏哈希不交付，不回退旧批准。
- overview.clinicalRegistries白名单接入原H01五列表格；C03/G02只在既有“快照版本与定位说明”内补三字段。新增registration从AI搜索JSON和片段排除。C01列表不扩大。
- owned本机服务PID62019→46505，重载前0活跃任务、0入库任务；52个原queued任务保全，不认领/排空/取消。

## 实际运行发现与当前安全状态

实施前快照中，200293没有ai_retrieval审核，AI命中null；202558原有registry_details命中。G02统一public确认同时插入display、ai_retrieval及详情审核。主实施错误地把“原公开展示”当作“原已公开展示和AI”，没有在审核前逐用途比较基线；初次独立评审也未发现这一点。

真实G02两条确认后，HTTP两项通过，但保全脚本的AI不变断言失败：200293首次获得AI书目及既有设计/干预/结局，虽然新增registration未进入AI，也仍违反本轮用途不变约束。该断言失败是有效阻断，不应删掉、放宽或用全绿测试替代。

已原G02仅对200293追加暂不放行。数据库回读证明两条原AI结果恢复基线，所有原提取/审核/排队任务保留；当前200293公开及AI均不可见，202558正常公开并交付新元数据。原公开展示尚未恢复，故未完成。新增行：提取2、书目决定6、详情决定3；包含两次public确认和一次保守撤回，不删除历史。未绕过现有统一审核保护直接写批准。

独立追加评审认定阻断，推荐先确认B：两条临床来源的受控仅展示更新路径，原审核卡准确展示不同用途，保留AI决定与拒绝状态。A为明确新增200293 AI用途授权，工程更小但扩大用途。两者均未代用户决定。

## 测试和浏览器证据

| 验证 | 实际结果与边界 |
| --- | --- |
| 提取TDD | RED schema1!=2→5/5；严格日期/字段/来源，v1比较保持 |
| 组件TDD | RED→3/3；原五列、未知进度、未审/失败不泄漏、原来源折叠 |
| 新真实PG | 初次测试旧authVersion=0失败；仅本轮测试读取当前5，并保留旧版本拒绝，未改账号。2/2强制回滚通过 |
| 全前端 | 323/323，tests/*.test.mjs，串行 |
| 相关后端 | 24/24，含真实PG、指标/论文索引/来源合同/统一审核；不是全项目全部历史后端测试 |
| 构建 | pnpm run build成功，4.28s；原chunk体积警告保留，没有lint/typecheck脚本，不宣称已运行 |
| 真实未审接口 | 新提取2均pending_review，不公开新字段 |
| 撤回前实际HTTP | 2/2通过匿名/owner/admin值一致及同篇C03/C01门禁；后续用途保全失败，不作为最终验收 |
| 当前保全 | blocked-state.json：原AI恢复、原行/52queued保留；只剩202558获准摘要，注册数随真实公开状态变为1 |
| 浏览器G02 | 原管理员登录、两条新字段及原位置核对、各public提交，200293后续withheld真实保存留痕 |
| 当前H01 | 1421×1419下单条真实202558日期/单位/未报告；五KPI/六卡/五列保持原几何。双条最终布局与两账号完整路径未完成，窄屏/200%/320px未在本轮验证 |
| 独立评审 | 初评8/8纯测试无阻断；获知实际授权基线后追加评审确认阻断，推荐B，不宣称独立验收通过 |

浏览器只用CUA实际页面，不运行旧raw Playwright脚本，不改DOM伪造数据。全程0模型调用、0新增费用、无角色/远端配置/云/旧服务或发布变化。

## 证据索引

目录：`docs/testing/evidence/h01-registry-metadata-2026-11-11/`。

- `implementation-before-runtime.json`：实施前保全基线，不能覆盖。
- `import.json`、`import-idempotent.json`、`unreviewed-live.json`：两份具名追加和未审门禁。
- `red-*.log`、`pg.log`、`pg-current-auth.log`、`pg-complete.log`、`extraction.log`、`ui-component.log`、`frontend.log`、`backend.log`、`build.log`、`http.log`：失败和成功均保留。
- `g02-200293-before.txt`、`g02-202558-before.txt`及对应metadata截图：三字段逐来源核验。
- `g02-200293-withheld.txt/png`：保守撤回实际确认。
- `blocked-state.json`：撤回后AI/旧行/任务保全及当前公开摘要，未伪造最终api-verification.json。
- `implementation-before-layout.json`、`home-blocked-layout.json/png`：当前单条几何留痕，不冒称双条最终通过。

下一步等待用户确认最小用途方案；确认前不再提交审核、调整G02交互或扩展到其他页面。
