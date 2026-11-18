# 九项默认 Skill · T04 默认装备验证

日期：2026-11-07。依据用户“所有账户装备九项 Skill，成为岐研 AI Agent 默认技能”的明确指令，完成 [T04 范围修订](../planning/qiyan-default-skills-2026-11-07.md)。这里只交接默认装备及读取合同，不宣称自动触发或九项执行已完成。

## 当前结果

本机专用合成库 `wp01_test_full_baseline`，Hub 租户 `rh-kb-local-b0e2af9d-tenant` 的专属 Agent 下新增九项租户自定义固定版本及九条 `scopeKey='*',accountId=null` 装备。沿用旧 `Skill`、`SkillAssignment`、当前授权锁和有效装备解析器，无迁移/新表、无逐账号复制，无平台全局技能或跨项目开通。

同一次真实应用角色并发安装结果为第一笔 `created:9,equipped:9`、第二笔 `0,0`。18 条具名发布/装备审计在同事务追加，授权依据记录用户本次明确决定。九项均标识 `pending-runtime`，当前 AgentConfig 的工具与 skillsEnabled 保持原值，不进入旧固定 SkillInvoker 的未知分支。装备是控制面配置，不是模型已执行。

安装前后对账号、角色、Agent、AgentConfig、AgentAccess、Study/项目成员关系、Token grant、旧 Skill 和旧装备做数据库哈希对比，全部一致。此对比在专用合成库内，未连接临床库。未加额度、充值、真实模型调用或费用；旧系统代码/服务和正式部署未修改。为装配只读接口，在无 queued/processing 合成问答任务时仅重启本机 Hub 独立环境；七项服务恢复健康，当前 PID 40357。

本次不扫描其他租户安装。模块接受明确的 Hub 租户/Agent，以后 Hub 部署须在其受控初始化中调用；正式域名尚未部署本次规则。所有未来注册账号由租户默认行自然继承，不增加 Study、角色或 AgentAccess。

## 测试与修补

新增默认装备/证据 11 项测试（5 纯策略、2 Controller、3 真实 PG、1 证据保留）。连同前一准备层，`node --test server/ai-agent/*.test.mjs integrations/pubmed-mcp/egress.test.mjs scripts/qiyan-default-skills-evidence.test.mjs` 为 **32/32**、0 跳过。覆盖未来零 Study 账号继承、默认及个人禁用优先、重跑幂等、未发布/版本漂移拒绝、跨租户/停用/旧 authVersion 拒绝、事务中第五笔失败全回滚、真实 app 角色 RLS 租户级审计及读取不覆盖安装证据。

两项 RED→GREEN 修补：

1. 实际安装首次审计写入违反 RLS，事务回滚，未留下半套装备。定位为缺少空 Study 上下文且 Prisma `create` 的 RETURNING 受项目级 SELECT 策略限制。改为显式空 Study 设置及 `createMany` 追加审计；不改变 RLS，不使用 elevated 绕过。补真实 app 角色用例先失败再通过。
2. 独立评审发现服务安装授权可被 `researcher + isTenantAdmin=true` 遗留标志绕过。改为当前数据库 `role==='tenant_admin'`，降权脏标志测试先失败再通过。CLI 本已单独检查当前 role，故已执行的安装不受该入口缺口影响。修补后全套 31 项通过；未发起重复评审循环。

收尾另发现读取脚本会复用 `installation.json`，首次安装的 JSON 被目录读取覆盖。首次 9/9 并发结果及保留断言的成功日志仍在 `defaults-install.log`，但不能把后续 JSON 冒称首次哈希原件。已补 RED→GREEN 用例并改为 UUID+wx 追加证据；重新验证幂等 0/0 安装与保留哈希，保存 `installation-55f82991-72c8-4ccd-9649-e89e3cc01c09.json`。最终全套 **32/32**。没有回写或伪造首次原件。

旧编译 OpencodeClient、selected-skill-policy、effective-skills-policy 三组回归 **22/22**，不是旧系统全量测试。`pnpm build` 通过（保留既有 bundle 大小警告），脚本语法及 `git diff --check` 通过。其他既有脏改动未提交、覆盖或归为本轮变更。

## 真实 HTTP / 浏览器

新增 `GET /api/qiyan-ai/skills`，仅返回当前登录账号在当前 Hub Agent 的有效九项默认装备，`Cache-Control:no-store`；不接受账号/租户/Study 查询参数，不泄露分配元数据。继承全局真实登录守卫，不要求私有 Study。当前 `equipped:true` 与 `executionReady:false` 分开，不用目录存在假装执行已生效。

真实 HTTP 结果：owner、admin、viewer、uninvited 及原 WP02 注册账号均 200/九项；uninvited 当前 Study 数为零。匿名 401，伪造 accountId 查询 400。原 WP02 注册夹具后来已有一项 Study，未再把它错误当作零成员账号；没有为测试新加成员或改旧记录。另在具名 PG 事务内真实新增未来账号，零成员继承验证后整笔回滚，不留下测试账号。

真实浏览器使用原 owner 登录 AI01：本人历史恢复、原发送按钮可用，未点击发送；管理员登录 G02：总览及现有布局不变。两身份分别实际导航新接口取得九项，未装备自助操作。检查的页面与目录控制台无 error。无前端源码/布局改动，截图只是回归和目录证据，不是九项真实执行或专业验收。

![owner 原会话回归](qiyan-default-skills-2026-11-07/owner-ai01.png)

![管理员原总览回归](qiyan-default-skills-2026-11-07/admin-g02.png)

![管理员真实目录：九项已装备，执行仍待适配](qiyan-default-skills-2026-11-07/admin-catalog.png)

## 可复跑命令及证据

在 ResearchHub 根目录：

```sh
node --test server/ai-agent/*.test.mjs integrations/pubmed-mcp/egress.test.mjs scripts/qiyan-default-skills-evidence.test.mjs
node scripts/qiyan-default-skills.mjs
node scripts/qiyan-default-skills.mjs --apply
node scripts/qiyan-default-skills-http.mjs
pnpm build
```

`--apply` 是明确的具名合成租户发布/装备操作，仅操作者批准后执行，重跑不重写发布版本或恢复禁用。无该参数只读取目录。真实 HTTP 脚本仅使用既有合成账号正常登录，凭据/Cookie 不输出。

本轮私有日志：`.superpowers/sdd/qiyan-ai-nine-skills-2026-11-06/` 下 `defaults-full-tests.log`、`defaults-legacy-tests.log`、`defaults-build.log`、`defaults-http.log`、`defaults-role-red.log`、`defaults-rls-red.log`、`defaults-evidence-red.log`、`defaults-install.log`、`defaults-preservation-recheck.log`，及 `defaults-2026-11-07/installation-<UUID>.json`、`catalog-<UUID>.json`、`http.json`。新的安装记录包含保留哈希，未存明文密钥或密码。

## 后续边界

T04 本切片的默认版本/装备、授权与目录合同已验证；原 T04 的“执行失败态不调用模型”及依赖就绪联合守门仍须随 T05 执行链验证，不以本轮目录请求替代。T05–T15 的自动触发、正常账本、九项执行适配、长文、订阅与专业验收继续未完成；原包商业发行权利仍未核验。当前只验证单一合成 Hub，不代表多租户正式部署已经完成。
