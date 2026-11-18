# 科研身份 → T01 → R01 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans，本轮主代理当前目录串行实施＋最后一次独立代码总评审，不派实现子代理。用户本轮要求直接执行，覆盖默认再次等待计划批准；不重复请求同一方案确认。

**Goal:** 在原页面布局上实现本人L0/L1档案、团队T01和研究者R01真实数据库闭环。

**Architecture:** 原Account兼容增加四个科研档案字段，原认证／租户／授权／审计不重建；公开目录仅使用三张必要有界扩展表，来源与审核当前重验，不改变私有成员或认证资格。身份先闭环，T01整页后才进入R01。

**Tech Stack:** 原React18／Vite6／NestJS／Prisma6运行Client／PostgreSQL，Node test和现有Playwright＋Chrome，无新依赖。

**Spec:** [业务规格](../../product/research-identity-team-researcher-spec-2026-11-03.md)、[表设计](../../technical/research-identity-directory-database-2026-11-03.md)、[API](../../technical/research-identity-directory-api-2026-11-03.md)。2026-11-03用户本轮提出直接执行，按已给方案和最小本机范围推进；未确认字段不猜填。

本轮边界与实际结果：用户最新要求只完成T01，Task4–6已技术闭环，R01本轮不自动切页。UI07窄屏差异经单独明确批准后实施；本轮唯一独立代码总评审已做并关闭阻断，236项串行测试／双构建／真实PG／HTTP／Chrome通过。[实际进度](implementation-progress.md)和[验证](../../testing/t01-directory-implementation-2026-11-03.md)为准。Task8原跨页全链及专业资料验收不能提前勾完；下方R01仍为后续计划，不当当前新指令。

## Global Constraints

- 仅wp01_test_full_baseline及既有合成租户；临床库／生产DDL／远端运行配置／云／旧服务停线／真实发布全部禁止。
- 原两个owner/admin本人新资料；最多1新具名L0账号、不增席位，最多3机构／2团队／4人物、40事实版本／20决定；前序对象只读。
- 公共目录真实内容与合成夹具分开；真实团队为研究所内灵枢心域具体项目团队，名字／成员／成果未提供不猜；公开批准不由初始化暗做。
- L2／L3只设计不建表／申请／审核；无付费AI／外发SMTP／抓取／新权限授予。原Study、KB、Agent、收费权限不变。
- 原Frozen Shell／T01／R01母版保持；仅规格已有UI01–06局部配套；有新增必要变化再确认。
- 当前目录codex分支串行、保留脏改动、不自动commit／push／切分支／清理证据。其他会话工作不恢复、不覆盖；装配共享文件只做定位增量。

## Review Focus

- 旧Account接口默认序列化不能漏新私人字段；没有Study也能保存／幂等，不能放宽审计RLS（I01/I02）。
- 原注册和直接登录继续P01，选填入口与合法邀请返回不能丢token或被外部returnTo劫持（I03）。
- 资料更新不能写role／认证，迟到响应和真实切账号必须清空本人资料（I02/I03）。
- 多任职／主项冲突不猜首项；coverage和相关性有受控来源，撤回即时影响排序／计数／地图（T02/T03/R01）。
- 未审候选／外部同名专家不是账户；T01／R01非空来源验收与合成技术验证分开（T03/R01/F01）。

## Task 1: I01 · 原表准入与兼容迁移

Files：新`scripts/research-identity-schema.mjs`、`server/research-identity/schema.sql`、`schema.test.mjs`；原`app/server/prisma/schema.prisma`仅四个可空映射；证据／台账。

Interfaces：`inspectResearchIdentitySchema(env)`读取准确四列状态与已有迁移指纹；`applyResearchIdentitySchema(env)`只在fixture目标、原13列和RLS匹配时受控应用／重入，不随启动执行DDL。

- [ ] RED：全缺列首次允许，四列完整匹配可重入，部分列／错类型／意外receipt拒绝，旧行不回填。
- [ ] Run `node --test server/research-identity/schema.test.mjs`，先看预期失败再补受控DDL／结构验证。
- [ ] 真实PG只读保全原两账号／成员／源列与费用hash；受控apply，重跑created=false；无其他旧列变化。
- [ ] GREEN：相同单元＋真实app-role可读新列、原Client旧账号行为／tenant隔离探针回滚；留证，不自动commit。

## Task 2: I02 · 本人科研档案服务与API

Files：新`server/research-identity/{policy,service,controller}.mjs`及对应tests。

Interfaces：`normalizeProfileChanges(changes,current)`严格白名单；`createResearchIdentityService({db,lockAuthorizationMutation})`提供read／save／establish／receipt／identity；`createResearchIdentityController({env,ids,load,require})`只消费原身份。

- [ ] RED：草稿L0、姓名＋方向明确建立L1、非法ORCID／字段／大小／日期拒绝；建立后最低字段不能清空。
- [ ] RED：本人scope、停用／authVersion、CAS并发、最近回执同键／异体／后续写冲突和事务失败；原updatedAt／authVersion／role／displayName不动。
- [ ] 实现当前授权共同锁／行锁、参数化四列更新和最小审计；48KiB本路由限制，不修改旧WP02的16KiB边界。
- [ ] GREEN：`node --test server/research-identity/*.test.mjs`与真实PG回滚／HTTP探针；不读取管理员他人private JSON。

## Task 3: I03 · 注册选填与P006本人资料闭环

Files：新`src/research-identity-session.js`、`pages/shared/ResearchIdentityProfile.jsx`及tests；改AccountProfile／AccountAccess及合法returnTo解析，局部CSS；本机装配文件定位增量。

Interfaces：同源client读／保存／建立／最近回执，独立epoch／Abort；P006内新增资料区，原displayName表单不重写。

- [ ] RED：客户端严格body／响应、独立CAS／原key恢复、切账号／迟到body；安全P006 section返回且恶意回跳拒绝。
- [ ] 补本人表单、可选字段／草稿与明确建立、无研究权限说明；不匿名持久化，不收附件。
- [ ] GREEN：原前端完整`node --test tests/*.test.mjs`、`pnpm run build`；原两个账号真实Chrome填写／刷新／修改／建立／故障／退出、注册页跳过与完善入口、1440／390／320及原生200%截图录屏。
- [ ] 身份完整门禁通过才进入Task4；现有资料保全，更新living spec／版本／使用说明及Notion。

## Task 4: T01支撑 · 三表目录与当前来源契约

Files：`server/directory/{schema.sql,contract.mjs,sources.mjs}`及tests；`scripts/directory-schema.mjs`。

Interfaces：固定entity三kind、assertion六kind、decision追加式；`resolveDirectorySource(tx,scope,ref)`只读原来源精确版本／hash／用途，不抓网页。

- [x] RED：跨tenant／Hub／类型父链、部分DDL、不可覆盖历史、伪source／hash／撤回拒绝。
- [x] 受控schema迁移／app权限／FORCE RLS；仅在必要触发器存在后提交，重入验证目录指纹；最多三表。
- [x] GREEN：真实PG隔离／事务回滚、原表及来源hash保全；前序真实内容不改决定。

## Task 5: T02 · 目录候选／审核治理与受控投影

Files：`server/directory/{commands,repository,controller}.mjs`及tests；G02原子叶子与候选预览组件。

Interfaces：createEntity／appendAssertion／decideAssertion在共同授权锁与来源锁下同事务；readModel给出可见profile／关系／coverage／relevance与目的绑定回执。

- [x] RED：实体创建丢回执可重入、异体409；新版本不沿用旧批；普通用户403／在途撤权／来源失效拒绝。
- [x] RED：coverage已核验0与未知分开、新增／撤回使指纹失效；多主任职／主要团队批准互斥，不猜第一项；相关性无审为未核验。
- [x] GREEN：单元＋真实PG/API；G02叶子实测候选→预览→批准→撤回且原来源治理不改。

## Task 6: T03 · T01整页真实接口与浏览器闭环

Files：teams读取／facets／map路由、`src/directory-session.js`、T01原main增量及真实详情配套T02。

Interfaces：teams列表／facets／map／详情按当前投影、10条／页、有界页码；同一resolver和dataRevision，不先分页后过滤。

- [x] RED：搜索／四筛选／排序／标签清除／分页跳页；地图不是当前一页，空结果不回全部；无坐标单列、源撤回所有投影一致。
- [x] 接原T01结构及必要T02只读Tab／回链；保留原按钮位置，关注未实现不假成功。
- [x] GREEN：完整前端／目录测试与构建，真实Chrome管理者／科研人员／匿名走搜索→地图→详情→返回及错误恢复，五视口／200%／母版对比／截图录屏。
- [x] T01全约定功能技术闭环后才进入Task7；真实团队缺正式名称／人物时明确专业验收待补，不以演示补数。

## Task 7: R01 · 研究者整页与必要详情／团队联动

Files：researchers读取与facets、R01原main／R02配套、directory客户端及tests。

- [ ] RED：姓名／方向／地区／当前机构／角色／职称、论文／试验／团队排序、清除、分页、同名不同人、非法ID无演示回退。
- [ ] 完成真DTO／当前任职／主要团队／指标与来源、R02只读Tab及T02往返；不创建外部专家账号／认领／认证。
- [ ] GREEN：前后端完整门禁、真实PG/HTTP、Chrome两角色及匿名、失败／迟到／视口／200%、源撤回和两页回归；更新产品／使用文档。

## Task 8: F01 · 全链、保全与唯一独立代码总评审

- [ ] 单元／真实PG／HTTP／原账号注册找回邀请回归＋两账号完整任务链，所有失败保留；无模型／SMTP外发／旧服务变化。
- [ ] 旧后端完整测试运行前核对实际测试目标，仅专用合成；前端完整测试／build、Schema／角色／历史／AI账本保全。
- [ ] 一次新上下文独立只读代码总评审；Important／Critical作者一轮RED→GREEN修补，Minor登记；不把作者复验冒称二次复签。
- [ ] 四层交付分别报告；真实团队／人物资料与用户专业验收未齐不宣称全项完成；同轮同步产品／API／迁移／测试和Notion。

工时沿规格44h＋8h缓冲，不因本轮直接执行而新增云／费用或放宽范围。执行遇新权限、破坏性数据操作、真实来源公开依据不足等须具体说明，不能借故重复询问已经确认的设计。
