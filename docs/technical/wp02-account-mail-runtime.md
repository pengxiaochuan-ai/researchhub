# WP02 本机账号与邮件运行说明

## 2026-10-28 本机新Study续验

原`wp02-invite-3a7f7604`历史夹具保留不变。用户另批准本轮`real-invite-b55d67c7`具名合成Study，只占原合成租户剩余1个Study配额；私有夹具清单在`.tmp/researchhub-real-entry/invitation-fixture.json`（0600）。`scripts/real-invitation-fixture.mjs`先`check`再单次`initialize`，后续只用`verify`，不重授被撤销权限。`local-accounts.mjs`只在本机装配两套已存在夹具，以`invitation-router.mjs`按请求Study或服务端租户内token摘要选原邀请服务，后者仍执行原全部授权/邮箱/成员/审计校验。浏览器脚本重跑前只读核对该Study的邀请列表，唯一且已捕获才复用；未知结果不得再次发送，结果快照追加保存。当前旧WP02夹具接口200、本轮新Study接口200、原合成Study接口403；不影响旧系统运行，未修改旧Schema或历史夹具。真实邀请与成员审计见[新实测](../testing/real-entry-2026-10-28.md)。

2026-10-23；仅专用合成环境。用户已批准八步串行实施＋独立总评审，最终结果以对应测试报告为准。本文不构成生产迁移或外部邮件启用批准。

## 运行与配置

`node researchhub/scripts/local-knowledge.mjs status|start|stop`只管理有PID、启动时间、命令匹配的自有环境。19501前端、19502 API、19503解析、19504向量、19505确定性质控、19506 SMTP捕获、19507私有收件箱全部仅绑定127.0.0.1。停止后保留账号、随机会话密钥、合成资料及邮件；不自动恢复被撤销的授权。重启会轮换收件箱会话和一次性启动口令。

专用配置为`researchhub/.env.smtp.local`，已生成、0600且Git忽略；模板`.env.example`无秘密。配置必须是当前用户拥有的普通文件，不接受符号链接、重复参数或非capture模式；不source、不加载旧项目.env、不传给Vite。用户已有填写内容不覆盖、不打印、不传Notion。

| 参数 | 当前允许值/作用 |
| --- | --- |
| WP02_MAIL_MODE | capture；其他模式拒绝启动 |
| WP02_PUBLIC_BASE_URL | `http://127.0.0.1:19501`；只生成已知门户确认链接 |
| WP02_CAPTURE_SMTP_HOST / PORT | 127.0.0.1 / 19506 |
| WP02_CAPTURE_INBOX_HOST / PORT | 127.0.0.1 / 19507 |
| WP02_CAPTURE_FROM | researchhub@example.test；合成发件人 |
| SMTP_HOST / PORT / USER / PASS / FROM | 供将来填写，当前不启用、不连接、不verify、不外发 |

将来外部SMTP通常465隐式TLS或587 STARTTLS；SMTP_PASS应使用服务商授权码，不是邮箱登录密码。启用前还需单独批准真实邮件、收件人范围、远端配置访问及费用；当前不能仅通过改.env切换为外部发送，也不自动回退外部SMTP。不得设置VITE_密钥。

## 私有收件箱

地址为`http://127.0.0.1:19507/`。启动口令只在本机私有文件`.tmp/researchhub-wp02/mail/inbox-credentials.json`中，由操作者自行打开；不要贴进聊天。解锁采用HttpOnly/SameSiteStrict Cookie，启动口令只能兑换一次；无宽松CORS，严格Host/Origin，no-store/no-referrer/CSP。

列表只有合成收件人/目的/时间/摘要；打开正文才出现确认链接。正文含一次性秘密，不截图、录屏、上传或复制进文档。GET打开邮件不完成操作，链接页面须明确POST确认。注册/找回15分钟、邀请72小时；过期正文HTTP410，元数据仍可追踪。文件目录0700/消息0600，当前最多1000封；不自动删除，容量满须停下决定清理范围，不自行外发或扩大容量。

捕获器只接受example.test/example.org收件人、单条单收件人、64KiB/10秒连接，邮件投递必须有SMTP成功及匹配本机消息ID/收件人/有效期的摘要凭据，才可标captured。SMTP接受不等于外部送达。failed/unknown/pending不允许消费，不自动重试；人工核对后显式申请/重发。

## 共享数据库兼容

只在`wp01_test_full_baseline`及既有guard marker上执行。配置引用原`.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json`；每次事务仍经过fixture guard，不连接临床库。固定合成租户模拟灵枢心域，不改生产租户映射。

唯一迁移为`app/server/prisma/migrations/20261023000000_wp02_account_invitation/migration.sql`，摘要`54f91cdcb7e6b3b166abdfcf0a5c27e21236e078256a61128489db57bae17a9e`。只增Account可空验证邮箱字段/唯一索引和挑战、邀请、持久速率表；新表强制租户RLS，原app角色仅SELECT/INSERT/UPDATE，不给DELETE/BYPASSRLS。旧邮箱不回填，旧行不改，原Prisma Client不生成/替换；ResearchHub参数化SQL访问新增字段。

注册复用原共同租户授权锁、原`aisci-account-create:<tenant>`席位锁、bcrypt及审计，**不调用会自动加组的旧AccountsService.create**。重置原子更新密码/authVersion并消费凭证，旧Cookie由原JWT守门拒绝。成员继续复用原StudyGroupMembership/ResearchProjectMembership/PermissionRole，不另造一套成员权限。

新具名夹具`wp02-invite-3a7f7604`只初始化一次；原admin仅在该新组/Study有独立邀请角色，目标reader菜单/按钮为空、项目researcher。运行时只核对夹具身份，不重跑seed或修复撤权。旧Study仍403，原owner/admin旧权限不变。

## 验证与维护

本轮命令：`node researchhub/scripts/wp02-gates.mjs`，包括单元、专用PG、既有编译内核、构建、52页面身份、表单及真实200%；不应用迁移、不初始化夹具、不发送邮件、不调用AI。首次真实闭环证据单列，门禁只核对其记录，不以重复使用账号冒称全新注册。

测试与脱敏证据均在新`docs/test/evidence/2026-10-23-researchhub-wp02/`。原23表14635行固定列摘要、691源文件（Schema仅逆向剥离本轮添加后比对原字节）、旧8进程、1250冻结条目和AI账本需保持。不得运行会覆写旧证据的历史脚本或旧native all。

邮件实现依据[Nodemailer SMTP](https://nodemailer.com/smtp)、[Node net](https://nodejs.org/api/net.html#netcreateserveroptions-connectionlistener)、[Node parseEnv](https://nodejs.org/api/util.html#utilparseenvcontent)及官网既有版本；未引入外部邮箱平台或通用队列。
