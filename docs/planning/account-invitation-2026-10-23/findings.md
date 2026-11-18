# WP02 只读发现

2026-10-23代码事实：AuthController只有login/logout/me。AccountsService.create会给researcher分配默认课题组；直接公开使用会违反“注册零私有Study授权”。其resetPassword是管理员路径，不能公开。旧问卷Invitation服务属于受试者H5，不是研究成员邀请。

PI控制器要求group_admin菜单、member.manage；成员写操作有共同授权锁及最后负责人保护。专用合成库守门readOnly查询确认原owner/admin都没有前述菜单/按钮，当前原研究也都不是project_manager。没有新增任何grant。

官网mailer有可复用nodemailer/TLS/超时/禁外部文件安全配置，contact正文固定公司收件人，不适合账户事务邮件。本地限定项目扫描仅找到env模板，当前进程完整SMTP键不存在；没有扫描项目根外或访问ECS/远端。若采用本机捕获只能证明本机SMTP/兑换，不能冒充真实邮箱投递。

统一platform-user已有setPlatformUser事件和统一Header，但当前默认王教授/演示资料；本任务需要真实me作为可信展示源。当前认证数据模型没有已验证邮箱绑定或注册/reset凭证。草案提出Account可空增量和两个独立凭证/邀请实体，不建平行账户/成员表，不执行DDL。

检索错误：猜测的research-projects.service路径不存在；含researchhub/.env*的zsh查询在执行前因无匹配终止。随后收敛到已存在源码及限定rg文件清单，未读/写其他目录，未输出任何密钥。

后续批准轮核对：官网package固定nodemailer 9.0.5；共享迁移真实目录为`app/server/prisma/migrations/`（根README中的app/db路径不是当前运行迁移入口）。现有本机scope adapter固定原group/project，新Study不能通过放宽通配来复用；计划限定新模块精确scope适配，不扩大原KB/草稿授权。旧保全脚本会写冻结目录且Account row_to_json会受新增null列影响，故新建本轮证据器并固定旧列投影，不运行旧写入脚本。

批准后配置文件静态检查通过：capture、固定回环/baseURL、私有0600、Git忽略、无VITE_键、SMTP秘密为空。没有实现加载器/SMTP服务或读取用户随后填写的秘密。另一次路径检索命中不存在的app/db/migrations、researchhub/ops，已改以真实Prisma路径为准，未扩展扫描。
