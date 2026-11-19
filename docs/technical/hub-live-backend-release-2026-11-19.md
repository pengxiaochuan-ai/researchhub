# Hub独立后端与现有前端实际接通

> 最新现场结论：独立researchhub→API→线上前端已实际接通；2角色×5页读取与2次登录共12检查通过，独立总评通过。44509764134再次verify成功且不重启。资产仅空态、知识资料仅目录读取；正文/附件/解析/方法与AI/邮件不在本轮完成范围。

2026-11-19。用户已回传new-database-accounts-connected：owner/app实连与configSaved均true，目标researchhub，配置唯一/srv/researchhub/ops/.env.prod，databaseWrites=0、Worker未启动。按当前明确指令继续实际接通，不再重复申请此前已批准的部署范围或源manifest复验。

## 有界发布路径

1. 复用经验证的封存私有core（85a0f5c5e7b5155b1593e04baaebd534322d8cb2b41d2847e394e54a5ad75135）及精确Git快照；不混入其他线程未提交页面/代码，不改旧源码。原core依赖/锁与native Prisma契约不变，仅在linux/amd64重建。源包和镜像私有交接，公开Git仅工具/清单，不能放core或运行配置。
2. 复用现有OSS发布前缀及GitHub/云助手。源码对象显式private ACL，任务只新建具名发布对象，不创建bucket/IAM/实例。构建器原生验证amd64，镜像不含.env或业务数据，SHA校验后分发，不沿用arm64成品。CLI账号jerryshichina不变。
3. 服务器只读提取旧运行容器已存在的S3四项以复用同一存储能力；既有Hub S3参数优先，不输出秘密。完整runtime只读探桶必须成功；不能以键名存在代替。补齐Hub独立JWT/Cookie/源core摘要与固定HTTPS源，其余原参数保留、备份及原子合并。所有配置继续唯一.env.prod，不建额外活动配置、不改aisci.env。
4. 新Compose project researchhub-backend在researchhub_default提供researchhub-api别名，API只发布127.0.0.1:19612，限内存/CPU，原三个项目不重建。ENABLED_WORKER_KINDS空、CONTROL_PLANE false、OFFICIAL空、付费AI/邮件关闭。真实DB身份/marker/结构895dadbcc49134d4fde59ddaacedf242由启动门禁重验，无迁移/GRANT。
5. 后端先验证启动、401认证路由和真实登录/只读业务；再以同一受审快照构建前端，实际传VITE_AUTH_TENANT_SLUG=rh-kb-local-b0e2af9d-tenant。沿Hub自身/api代理，不改共享Nginx/旧web。前端只获白名单HTTP参数，不能注入.env.prod中的DB/JWT/S3秘密。
6. 真浏览器验证原owner/admin登录到工作台，读取领域/论文/知识/资产，保留原布局及权限；旧服务/官网前后容器identity/image/status和只读HTTP对照。未启用的AI/邮件/解析/方法执行及缺失原件明确列明，不扩称全功能验收。异常只回退本次Hub组件，保留DB/新配置和既有记录，不启动历史任务。

## 只读目标证据

云助手44499683630确认Hub.env.prod存在且私有：researchhub、marker cb387f97078c6af304807b132a00d2400d7f10e6d2c39e050616e455542de523、结构895dadbcc49134d4fde59ddaacedf242、默认合成租户/admin和真实构建slug齐备。约16GB内存/可用13.5GB、磁盘余约25.9GB，不需扩容。源截图/旧schema事实不代替此回执；本轮不查旧临床行。

本机旧生产S3配置仅在进程内使用，签名URL不打印/不进argv；SDK因本机Python SSL环境失败，改用系统curl进行同等签名HEAD，实际404（具名不存在探针），无写入。此步只证明可达/凭据路径，不能代替上传成功或服务器桶探活。禁止把签名URL放GitHub公开日志/输入；CI用既有Secrets认证，不上传密钥。

用户本次授权是Hub独立接通，不能扩大为共享aisci迁移、旧服务重启、新云资源、付费模型或邮件发送；若现有权限确实不够则停止新增权限并报告具体阻断。实施中测试/回执按四层记录，生产结果待执行后追加。

## 实际构建与启动控制

原生amd64构建44502950789成功，tag `hub-runtime-1e0d7087-44502950789`，镜像manifest SHA256 `56b37e68bdb8c04ae343596dea24f1881f7a00d3661819cf4c1ba73e0a2adb9b`。构建未切换生产服务。私有core不进入GitHub构建缓存/构建记录；分发对象显式private。

新增手动workflow `hub-runtime-activate.yml`：先activate API、再activate-front，verify不重启现有API。控制文件绑定上述镜像manifest，以内容摘要独立存放 `/srv/researchhub/ops/runtime-releases/`，不进入前端发布后会清理的旧releases目录。前端镜像回退沿用已剥离env_file的HTTP-only Compose，不能把canonical .env.prod中的后端秘密重新注入静态站点。

API验收前保存六类历史任务行摘要，仅用于确保启动没有执行历史任务，不是重验用户已豁免的源数据manifest。启动失败或可捕获中断，在finally仅清理本次新API；云助手子进程超时先TERM并留45秒清理，仍不确定则报告state unknown，不声称已停。临时诊断容器具名/标签并精确清理。前端操作前后核对旧ops/official-site容器identity/image/status及历史任务，检查同源/api/auth/me=401、/health=200及前端环境无DB/JWT/S3/SMTP字段。浏览器登录/业务读取仍需在真实切换后验收。

## 镜像身份口径修正

首次控制文件上传44507634919因遗漏手册辅助脚本停在CI，未执行服务器启动，随后补齐。44507915917归档校验和加载成功，但在up前因Image ID口径差异停止。只读44508332094确认：构建端ID `sha256:f35109efb857ca68f06da00f5f1607a0d0dd6d62e18939ff4efc297cf34e190e`；服务器ID `sha256:384a79218444c61e1b0adbd1eeb507fd32f091643644948969ba3aa56ae76771`，后者精确等于受审归档中唯一RepoTag对应Config的字节SHA。不是归档漂移；该轮没有API容器启动。

兼容规则：先验证完整归档SHA，再由唯一manifest.json/精确RepoTag定位Config，拒绝路径逃逸、链接、重复成员与多条目，重算Config SHA且匹配路径声明，要求linux/amd64。保留原buildId作审计；后续load/live/stop/verify统一以从受审归档推导的config ID判定，不信任现场ID兜底。前端同规则，且归档与Compose SHA、loaded config ID在任何up前校验。verify和前端操作复用同tag已下载归档但重新校验SHA，不改镜像或重建依赖。

## 现场接通结果

API运行44508811755成功，full启动已实际核新数据库身份/marker/结构及现有存储桶只读探活；认证未登录401。前端运行44509082815成功，仅Hub静态服务替换，前端环境无DB/JWT/S3/SMTP秘密，同源/api/auth/me=401、/health=200；旧ops/official-site容器identity/image/status与新researchhub六类历史任务摘要不变。

Chrome真实目标https://hub.pengxc.com：owner/admin两账号均login201→P01、me200，P01/H01/E01/K01/A01十组页面各有真实业务接口200，0 pageerror、0非认证错误；未登录阶段me401为预期。保留12截图及2录屏。初次受本机系统代理影响ERR_CONNECTION_CLOSED，无登录提交；测试Chrome单进程--no-proxy-server后通过，未改系统代理或服务器网络。

A01真实正式目录目前为0：runtime只读family=business（rhab-）目录，不纳入旧具名测试资产。历史数据没有删除或自动转换，不以演示回退掩盖。论文领域统计部分仍待口径核验。AI/mail/workers仍关闭；解析、方法执行和对象完整恢复/原件读取尚未验收，不称这些功能已生产可用。会话签发有真实认证写入，无科研业务变更/模型调用/邮件。本轮能力仅为独立数据库、后端、线上前端的真实登录与目录读取闭环。

私有证据目录`.tmp/backend-deploy-20261119/`：api-receipt.json、front-receipt.json、browser/result.json、12张PNG及video下2份webm。配置/口令/会话材料不得进入公开Git或Notion；文档只同步非秘密结果。源码/包私有，公开main仅受审Hub自有代码与部署控制；工作区其他线程页面修改未混入。
