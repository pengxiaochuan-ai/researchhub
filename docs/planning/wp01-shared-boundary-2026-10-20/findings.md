# WP01源码与约束核对

2026-10-20实施后说明：下文是实施前源码事实/红测依据，不作为修改后认证代码的现状声明。Task 1已补DeploymentScope/认证/控制面（含评审发现的跨租户主题漏口），证据见[首批记录](../../testing/wp01-shared-boundary/report.md)；四类Worker等未实施事实仍保留，不据此自动开工包外模块。

## 已确认

共享实例/库/公共表、租户隔离、共用租户管理、ResearchHub独立部署、旧历史不迁；公开注册默认新租户，私有Study另授权。必要旧后台隔离修补允许先验证后实施。

## 本轮初步证据

- ResearchHub仍为前端演示，没有可直接宣称已启用的独立认证/后端。
- 旧AuthService按tenantSlug和(tenantId,username)查Account；JwtAuthGuard会重查active租户/账号与authVersion，但当前读取范围内没有部署允许租户边界。
- PrismaService同时持有app受限连接和elevated连接；forTenant及withTenantTransaction使用事务本地set_config。RLS无法自动限制elevated扫描，需分层验证。
- 四类Worker证据由只读并行调查核验；实际运行库/catalog与应用配置本轮未读取，不包含患者行或凭据。

## 四类后台的具体落点

| 入口 | 本轮只读事实 |
| --- | --- |
| [知识导入](../../../../app/server/src/knowledge/knowledge-import.service.ts#L241) | elevated恢复queued/processing，无部署租户条件；process主要依靠进程内active集合，缺DB原子claim/持有者保护；允许官方null任务，需显式例外 |
| [知识问答](../../../../app/server/src/sessions/knowledge-chat-queue.service.ts#L387) | 全局恢复/候选；claim已有session advisory lock及queued CAS，但心跳/终态无claim代次；当前用户复验不等于租户active和部署scope验证 |
| [原始处理](../../../../app/server/src/ingest/raw-processing.service.ts#L92) | bootstrap检查disabled，kick/tick未检查；恢复/候选elevated全局，领取虽经forTenant queued CAS，终态缺持有者fencing |
| [上传直接kick](../../../../app/server/src/ingest/ingest.service.ts#L631) | 上传及已有文件入口可直接唤醒，证明只依靠bootstrap开关不充分；这是源码反例，未执行生产请求 |
| [科研运行/attempt](../../../../app/server/src/sessions/research-agent-runs.service.ts#L1177) | 全局恢复/扫描；主run恢复UPDATE遗漏陈旧时间重核；session锁/CAS存在；stage attempt提交较强但仍无部署scope/claim代次 |
| [Account模型](../../../../app/server/prisma/schema.prisma#L171) | 当前账号单tenantId，复合唯一(tenantId,username)；跨系统全局身份不是既有能力，D01已随V0.1批准为单租户账号/独立登录 |
| [Prisma事务](../../../../app/server/src/prisma/prisma.service.ts#L18) | app与elevated两客户端；不能从forTenant实现推导所有elevated后台都受RLS限制 |

根仓库HEAD为9b2bf43，ResearchHub为190f509，存在未提交差异；不是目标环境版本证明。没有读取真实连接串或租户记录，没有执行新测试。

官方技术核对：[PostgreSQL16 RLS](https://www.postgresql.org/docs/16/ddl-rowsecurity.html)及[advisory locks](https://www.postgresql.org/docs/16/explicit-locking.html#ADVISORY-LOCKS)。本轮据此区分RLS/会话锁与应用scope/持有者契约，不引用第三方建议替代实际代码。

本文件只记录事实/来源及待核查项，不赋予任何环境或修改权限。
