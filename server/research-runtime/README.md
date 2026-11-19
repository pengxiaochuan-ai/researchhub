# ResearchHub独立后端运行入口

本轮配置受限的独立合成部署演练已通过，交付可执行构建器/私有包及严格基线迁移候选，**不等于完整AI启用或生产可用性验收**。边界及证据见[交付说明](../../docs/testing/backend-delivery-rehearsal-2026-11-19.md)、[实施规格](../../docs/technical/backend-deployment-implementation-2026-11-18.md)与[演练进度](../../docs/testing/backend-deployment-progress-2026-11-18.md)。不要用容器启动成功替代业务验收。

## 构建与启动边界

`deploy/core-bundle.mjs`读取明确指定的旧服务源码/依赖，生成私有封存副本；不复制旧.env、业务数据或Mac原生模块。`deploy/backend-package.mjs`接收该副本及其准确manifest SHA256，生成Hub代码、必要静态资源、Linux原生Prisma生成配置和Docker构建上下文。

```sh
node deploy/core-bundle.mjs build /explicit/core/source /private/core-snapshot
node deploy/backend-package.mjs /private/core-snapshot SOURCE_MANIFEST_SHA256 /private/backend-context
docker build --build-arg CORE_MANIFEST_SHA256=PACKAGED_CORE_DIGEST -t researchhub-backend:reviewed /private/backend-context
```

`SOURCE_MANIFEST_SHA256`与`PACKAGED_CORE_DIGEST`分别取自源封存清单与构建结果release.json，不能混用。私有副本、镜像、真实配置不提交公开仓库。包必须经`verifyBackendPackage`及目标Linux原生依赖验证。当前本机已构建的linux/arm64镜像不能冒称linux/amd64镜像；发布前按目标架构另验。

正式进程以`node server/research-runtime/start.mjs`启动，要求`NODE_ENV=production`、`HUB_RUNTIME_PROFILE=full`和显式私有core路径/hash；不会回退到相邻工作区。full进程独占自己的process.env，不在旧服务进程中嵌入。没有旧AppModule、自动迁移或自动创建租户/角色/Agent/额度；初始化合成夹具是独立具名命令，不随启动执行。

`minimal`仅供无数据库HTTP单元测试，不是生产降级替代。full已装配认证/准入、课题/Study、原生知识导入、Hub来源、目录/字典、身份治理及资产登记/目录/固定版/治理/用途/评论/附件/复制/方案应用。新库实际方法—报告—资产闭环与固定版复用/文件/讨论已有技术证据；材料AI用途与个人许可独立，免费检索依据通过，不等于模型回答。

Hub普通来源会话以专用Sessions/Queue适配原生Orchestrator和计费；入队与assistant提交均有当前授权事务fence。该切片只允许knowledge-import/raw-processing/knowledge-chat消费者，不能凭付费开关放行未适配分支。管理员聊天成员兼容已[获批并通过本机原生回滚及HTTP验证](../../docs/technical/backend-hub-chat-admin-admission-2026-11-19.md)，只读工具硬上限为knowledge.search，不持久授权限。当前无聊天Agent/配置/Access/Token，管理员明确503 HUB_CHAT_NOT_CONFIGURED，科研只读账号仍403；未进行LLM验收。其他上下文明确不可用，不视为已实现/已启用的完整AI能力；主干提交及复核结果以Git与交付报告为准，生产执行另确认。

省市参考数据通过`deploy/reference-data.mjs`显式生成初始化事务，3213行完整一致才接受；不随启动写入，不覆盖部分/漂移字典。运营者先核目标身份/marker，生产执行另批。PMC附件使用显式S3桶内`<tenant>/hub-pmc/objects/<sha256>`；已有获准对象须独立同步和核hash，不从旧.tmp读取，不随包带数据。当前新库无获准PMC内容，未称正向交付通过。

### 独立确定性方法Worker

显式指定已审核的旧Worker源码，先核源摘要，再构建私有上下文；不改旧源码，不带.env或业务数据。仅复制Python标准库服务、三个算子及schema。此包是独立组件，不随API启动创建Agent、装备Skill或授额。

```sh
node deploy/method-worker-package.mjs digest /explicit/reviewed-worker-source
node deploy/method-worker-package.mjs prepare /explicit/reviewed-worker-source REVIEWED_SOURCE_DIGEST /private/method-worker-context
node deploy/method-worker-package.mjs verify /private/method-worker-context TRUSTED_MANIFEST_DIGEST
docker build --build-arg PYTHON_IMAGE=REVIEWED_PYTHON_IMAGE_DIGEST -t researchhub-method-worker:reviewed /private/method-worker-context
```

源摘要须经审查，清单摘要取自可信构建输出并另行保管，不在验收时从待验证目录重新算成expected。验证覆盖清单字节、完整文件集和文件hash，不是数字签名；源码hash也不等于基础镜像可复现。发布证据另留基础RepoDigest、实际image ID、Python版本和架构。健康检查为`/ready`（缺令牌503），实际算子请求必须携带独立令牌；不公开Worker端口。本轮仅显式设置合成Study ID、Worker URL/token后启用既有合成分析适配器，不将真实Study归类为合成。

## 必需配置

无凭据字段模板见[researchhub.env.example](../../deploy/researchhub.env.example)。密钥使用私有配置文件/密钥管理，文件权限0600；不要把URL里的密码打印进日志。

| 配置组 | 约束 |
| --- | --- |
| core | HUB_CORE_DIR、HUB_CORE_MANIFEST_SHA256匹配包内封存，不使用旧运行目录 |
| scope | DEPLOYMENT_PRODUCT=researchhub；显式DEPLOYMENT_ID、单个允许租户及默认租户；禁用控制面和official jobs |
| 数据库 | DATABASE_URL为非super/non-bypass app角色，DIRECT_URL为批准的owner角色；同目标数据库；HUB_DATABASE_NAME/角色/marker SHA与实际连接一致 |
| 结构 | HUB_MANAGED_SCHEMAS与HUB_SCHEMA_FINGERPRINT准确绑定本次已审核结构；启动先核真实列/约束/函数/ACL/RLS，不自动迁移 |
| HTTP | HUB_APP_ORIGIN是准确HTTPS站点或具名loopback；HUB_API_AUTHORITY是代理实际Host；不信任转发头；Cookie独立、HTTPS时Secure |
| 存储 | 显式S3端点/桶/凭据；运营者先建桶，应用只读探活，启动不自动建桶 |
| 模型/向量 | HUB_PAID_AI_ENABLED显式true/false；本轮为false。HUB_EMBEDDING_MODE显式keyword-only或service；service必须KB_EMBED_URL，不读默认外部服务 |
| 消费者 | ENABLED_WORKER_KINDS显式列出；启动生命周期前检查实际消费者。当前演练只启用knowledge-import，已实际完成1份Markdown导入；其他格式/外部解析及完整产品流程仍须逐项验收 |
| 邮件 | capture只允许独立本机SMTP/私有收件箱；disabled明确拒绝邮件操作，不创建challenge或邀请。当前尚无正式SMTP执行/验收，不借用旧配置 |

禁用模型时不生成假回答，不授Token；服务调用返回明确未就绪。keyword-only是已有关键词检索契约，不表示向量已启用。解析、方法Worker与外部服务需各自显式配置及实际请求证据，不能把configured=true当作已执行。

API在独立监听端口，前端由独立静态服务在同源代理`/api`，不开放跨域Cookie。JSON上限256KiB；multipart只允许明确的知识导入/资产上传路径。业务权限、当前身份、来源和版本检查保持；未装配路径不代表已交付。Cookie沿用12小时活动会话规则。`bootResearchRuntime`返回`{app,address,close}`，close幂等，失败时仍尝试清理其他资源；停止门在Worker生命周期前绑定。

## 数据库与验收

迁移必须独立执行`plan/check/apply/verify`，绑定目标身份、marker、基线结构、源SQL哈希和逐步账本。已应用SQL与hash不改写，修正追加新步骤。当前候选基线来自旧专用合成库的结构，只能证明与该基线等价；生产真实结构、DDL/GRANT及停线/发布另行确认。绝不恢复合成账号、业务行或历史任务到生产。

仅运行已预读、不会直连旧库的相关纯测试。`deploy/migration-rehearsal.test.mjs`及其他PG脚本必须显式绑定具名新环境，不能因测试名称含local或不含pg就假定安全。真实Chrome、角色/失权/幂等、重启与故障回滚证据单列；模型费用和外部SMTP本轮为0，不声称AI执行通过。
