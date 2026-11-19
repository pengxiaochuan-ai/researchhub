# 独立演示库账号连接与Hub前后端接通

2026-11-19。当前用户指令：来源指纹为用户复制截断，不再复验；验证新数据库账号实际连接，接通独立后端与已部署前端。已批准原researchhub独立演示库和4角色，旧aisci/旧服务/官网不动，不启用历史Worker、不调用模型或邮件、不创建云资源。

## 账号与配置

原accounts命令只设置数据库密码，不保存后端配置。新增服务器助手隐藏输入两份**既设口令**，只读连接新researchhub（owner/app分别实连），核真实current_user、非super/非建库建角、app非bypass/owner既有bypass、库owner和当前marker。两个连接均通过才将百分号编码的独立DSN及新库真实marker SHA/结构指纹保存/srv/researchhub/ops/.env.prod，文件0600；沿用现有ops目录，不递归改目录权限。固定沿用旧运维配置中已批准的RDS主机/端口和VPC非TLS方式，不修改原.env或数据库密码，不输出凭据。用户追加要求配置统一至Hub原.env.prod：只合并已验证的数据库与绑定字段，保留其他参数，更新前留0600回退备份；采用同目录0600临时写入/校验后原子替换。验证或新写失败保留原配置，不另建活动database.env。旧系统.env.prod不改。

结构指纹来自新库真实catalog，并与runtime统一SET LOCAL search_path=pg_catalog，不照抄本机v33或用户截断的source manifest。已以public enum真实反例验证默认search_path会导致指纹不同，并修补复验。仅配置启动守门所需指纹，不重复已免除的源指纹复验。目标库唯一允许researchhub，不向aisci发SQL。密码只用于实际新账号验证及获准私有配置，不向聊天/Git/Notion/日志交付。若Hub的.env.prod已保存两份正确新role DSN，configure可复用并再次实连后合并，无需重新输入；没有保存时才隐藏输入既设密码。

## 串行实施

1. 原封存私有核心复用、Linux amd64构建；本机现有arm64镜像不能作为ECS交付。先只读核对服务器Hub目录/现有代理/架构/资源及存储配置是否具备，不读取旧业务行。
2. 明确S3现有桶与对象恢复情况，full装配的只读存储探活必须通过；不可跳过后宣称资料能力完整。配置单租户/独立Cookie/JWT、真实数据库角色/marker/结构；ENABLED_WORKER_KINDS空、CONTROL_PLANE false、OFFICIAL_JOB_KINDS空，模型/邮件关闭。不创建角色或代授权限。
3. 新后端独立loopback端口启动，先原生数据库连接、认证及目录只读请求，再只在Hub服务接同源/api。前端构建准确VITE_AUTH_TENANT_SLUG，保持既有布局/交互。优先Hub自身受限转发，不改旧服务/官网代理；实际路由不支持时列准确差异，不盲改共享Nginx。
4. 本机合成完整联通/故障与独立总评后，按当前授权发布Hub并真实浏览器验证登录→工作台→领域/知识/资产读取。保存真实结果，角色开关、密码认证、API能力和页面结果分开；对象缺失、资料解析/模型/邮件未启用明确列限制，不以health200代替完成。

只修本轮实际阻断，严禁因旧文档恢复共享库迁移/排空协议或启用旧消费者。若资产写入出现源schema与v33生产等价约束差额，仅定位新researchhub准确对象，不套旧五步增量或改指纹绕过。历史私有包与失败记录保留，新包新目录。

## 统一配置与前端隔离

用户明确要求后续数据库口令统一进入/srv/researchhub/ops/.env.prod，不再单独创建backend-private/database.env。该文件是Hub后端唯一活动配置；历史备份只用于回退。前端容器只应获得显式HTTP代理参数，不应因为同目录.env.prod加入数据库口令而获得数据库/JWT/存储秘密。调整Hub自身Compose的前端环境注入，保持同源路径和页面布局；旧ops/官网配置不变。

## 当前证据与剩余依赖

GitHub只读云助手运行44491795860确认Hub仍为2026-10-15静态镜像、未部署API；线上静态/health=200，/api/auth/me和业务状态接口404。独立只读分支运行44493323628确认ECS x86_64/Python3.6.8，约16GB内存、可用约13.6GB，磁盘余约25.9GB；Hub网络researchhub_default，现有release S3键名和传输器存在；未查询数据库或写服务器。键存在不等于桶可用。

数据库助手8项单元及真实13.23新具名PG两角色认证、错口令不写、编码字符、统一配置合并/备份/复连、enum指纹与已存口令复用均通过。前端代理/静态进程8项真实HTTP在Node22独立容器通过，额外原Origin守门测试通过；multipart/Range/Cookie/状态/流关闭和故障502不重试均保留。独立总评通过。

当前尚未取得服务器新账号实连与保存配置成功回执；后端amd64构建、存储探活/对象恢复、网络alias、前端真实VITE构建与目标浏览器验收仍待实施，不称已接通。已免除源manifest复验；不以本机通过替代目标执行。后端必须实际加入researchhub_default并提供researchhub-api DNS；Docker ARG必须实际传VITE_AUTH_TENANT_SLUG，空值不能宣称真实登录启用。

## 现场接通结果

API运行44508811755成功，full启动已实际核新数据库身份/marker/结构及现有存储桶只读探活；认证未登录401。前端运行44509082815成功，仅Hub静态服务替换，前端环境无DB/JWT/S3/SMTP秘密，同源/api/auth/me=401、/health=200；旧ops/official-site容器identity/image/status与新researchhub六类历史任务摘要不变。

Chrome真实目标https://hub.pengxc.com：owner/admin两账号均login201→P01、me200，P01/H01/E01/K01/A01十组页面各有真实业务接口200，0 pageerror、0非认证错误；未登录阶段me401为预期。保留12截图及2录屏。初次受本机系统代理影响ERR_CONNECTION_CLOSED，无登录提交；测试Chrome单进程--no-proxy-server后通过，未改系统代理或服务器网络。

A01真实正式目录目前为0：runtime只读family=business（rhab-）目录，不纳入旧具名测试资产。历史数据没有删除或自动转换，不以演示回退掩盖。论文领域统计部分仍待口径核验。AI/mail/workers仍关闭；解析、方法执行和对象完整恢复/原件读取尚未验收，不称这些功能已生产可用。会话签发有真实认证写入，无科研业务变更/模型调用/邮件。本轮能力仅为独立数据库、后端、线上前端的真实登录与目录读取闭环。

私有证据目录`.tmp/backend-deploy-20261119/`：api-receipt.json、front-receipt.json、browser/result.json、12张PNG及video下2份webm。配置/口令/会话材料不得进入公开Git或Notion；文档只同步非秘密结果。源码/包私有，公开main仅受审Hub自有代码与部署控制；工作区其他线程页面修改未混入。
