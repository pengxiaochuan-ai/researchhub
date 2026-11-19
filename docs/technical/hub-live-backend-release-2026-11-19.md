# Hub独立后端与现有前端实际接通

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
