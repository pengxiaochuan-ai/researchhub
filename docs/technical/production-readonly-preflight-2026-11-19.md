# 同机三项目：生产只读核对

用户已批准只读核对生产部署、CPU架构与共享PG结构；补充确认Hub、旧系统及official-site同机。本次不发布、不运行deploy/rollback、不重启/停服务、不修改配置或DDL，不读临床业务行，不创建云资源或新增权限。

本机无云助手凭据；GitHub生产环境已有发布凭据。复用该现有通道，新增仅workflow_dispatch的只读核对任务，使用skip-ci提交，不触发既有前端发布。命令仅uname、docker ps/inspect、受限Nginx配置解析及旧server容器内独立Prisma进程的只读catalog事务；不启动Nest/Worker，不加载模型。凭据留在GitHub/ECS，不输出环境值。三个项目镜像/状态/端口仅做摘要。

本机app/.env.prod保留RDS aisci目标，但解析为私网地址、sslmode=disable；不是服务器实际配置证据，不由本机用它发口令。实际目标从运行中的唯一aisci-server进程环境只取连接位置摘要；DB仅查pg_catalog/扩展/owner/ACL/RLS/结构指纹，不查业务表。核对结果存GitHub运行日志的脱敏JSON，不上传原配置。

若凭据未授权给当前仓库、云助手拒绝或运行中server不唯一，明确阻断，不改RAM/安全组、不开放SSH、不切换旧服务。

## 本轮结果：GitHub启动权限阻断（2026-11-19）

新增5文件经独立只读评审，无P1/P2阻断；3项本机契约测试及Shell语法校验通过。脚本只证明实现与错误脱敏契约，尚无目标环境执行证据。容器库存仅running；Nginx摘要仅前40份conf.d匹配，未观察到代理不等于不存在代理。

已推送main提交`7d665e9ad5b9403508cc63d1f00d4f1429fa2d9f`，含`[skip ci]`；核查该提交Actions运行列表为空，未触发既有前端部署。手动执行`gh workflow run production-readonly.yml --ref main`返回HTTP403：`Must have admin rights to Repository`。云助手RunCommand尚未发出，无远程运行结果，生产CPU、连接目标、结构指纹、Hub代理及资源共存仍待核实。不能把本机配置或旧文档当作当前服务器事实。

由有权限的仓库管理员打开[只读工作流](https://github.com/pengxiaochuan-ai/researchhub/actions/workflows/production-readonly.yml)，选择Run workflow、分支main。准确名称为“ResearchHub production readonly preflight”；不要运行deploy/rollback。若有environment审批，按现有流程处理，不绕过。完成后提供运行链接即可，不提供密钥或.env内容；日志仅有脱敏元数据。流程失败保持阻断，不自动修权限或服务。

后续依据真实结果形成共享库增量差额及Hub独立进程/端口/代理/回退清单；生产DDL、GRANT、配置修改和真正发布继续单独确认。本轮未改产品页面、权限、旧项目或官网；无新增模型费用。

## 既有GitHub授权复核（用户要求复用旧系统授权）

当前CLI及GitHub连接器均为`kechebayan-collab`；Hub仓库实际权限pull=true、push/admin/maintain=false。该身份查询旧aisciencesys私有仓库返回404，不具备复用旧工作流的可见权限。Git SSH认证则为`jerryshichina`，解释了为何同机可以推送main，但不能据此让CLI获得Actions API权限；SSH密钥不转换为API令牌。本机Git HTTPS凭据助手未找到该SSH身份的已有HTTPS授权；浏览器状态读取超时，未能确认浏览器登录。

没有改变机构、仓库或云权限，没有改用push触发绕过403，也没有触发旧系统发布。下一步只需用户将本机gh登录为已有目标仓库写权限的账号，或由该账号在GitHub手动运行指定只读流程；无需在聊天提供令牌、SSH私钥或云密钥。取得可用身份后，仅续行已批准的只读工作流，真实发布仍待确认。

## 2026-11-19续行：身份已统一，首次远端核对失败

CLI已使用keyring中的jerryshichina；Git协议SSH，Hub实际admin/push=true，未改仓库或机构角色。已成功手动启动运行44437894517，UTC 01:34（北京时间09:34）。Cloud Assistant返回PRODUCTION_READONLY_PROBE_FAILED，流程非零失败；尚不能据此认定生产结构或部署状态。仅补充只读脚本阶段、Python/CPU版本、白名单异常类别与数值退出码，不回显命令、stdout/stderr、异常文本或凭证；测试与独立复核后再跑同一范围，不扩大权限或运维动作。

第二次只读运行44438223230定位：container_inventory阶段TypeError，目标x86_64、Python3.6.8。源码subprocess.run(capture_output=True,text=True)参数为Python3.7新增，尚未读取docker库存或PG。最小兼容仅将参数改为stdout/stderr=PIPE、universal_newlines=True；不升级服务器Python，不改变远端命令或数据库查询范围。增加Python3.6签名模拟及真实本机子进程回归，独立复核后重跑。

## 当前结论：身份统一且生产只读核对通过（2026-11-19）

[成功运行44438491892](https://github.com/pengxiaochuan-ai/researchhub/actions/runs/44438491892)，执行提交3247965。CLI与现有SSH推送身份均为jerryshichina；CLI凭据保存在keyring，Hub admin/push权限已实际核验，未改机构/仓库角色。旧kechebayan-collab登录记录保留为非活动，不删除其他项目凭据；Codex连接器为独立登录，不冒称其身份也已切换。

Python3.6兼容修补后6项本机测试、Python3.6语法解析、Shell语法及独立评审通过，已取得目标环境实际只读执行证据。首次与第二次失败保留；本次只有服务器清单和catalog查询，不读取临床行、不执行部署/DDL/GRANT/配置写入/重启。

| 项目 | 生产实测结果 |
| --- | --- |
| CPU架构/Python | x86_64；Python3.6.8 |
| 正在运行的容器 | 7个；只统计运行中，不代表停机容器库存 |
| Hub前端 | researchhub项目；镜像标签190f509d-20261015-142143；宿主8083→容器3000 |
| 官网 | official-site项目；宿主8082→容器3000 |
| 旧科研系统 | ops项目；web宿主80；server容器3001；方法Worker8210、解析8200、向量8199均为容器端口，未显示宿主发布 |
| PG连接目标 | 运行中旧server的DATABASE_URL所指aisci库，PG18.3；连接位置只存SHA256 |
| 当前DB身份 | aisci_app；rolsuper=false、rolbypassrls=false；本次事务readonly=on |
| 扩展 | plpgsql1.0、vector0.8.1.2 |
| 业务schema观察 | 本次public/rh_*检查范围仅返回public；501条relation目录记录（含索引等，不能当表数）；110条relation启用并强制RLS；未观察到rh_* |
| 结构指纹 | c3926157b522a67b902cc579eb738025 |
| TLS | 当前旧server DSN sslmode=disable；本轮未更改，不据此代表Hub未来配置 |
| 旧server部署范围配置 | DEPLOYMENT_PRODUCT未设；DEPLOYMENT_ID/ALLOWED_TENANT_IDS/DEFAULT_TENANT_ID均未设；不能据本机WP01结果宣称生产隔离启用 |
| Hub代理 | 宿主/etc/nginx/conf.d前40份配置未匹配，不能证明无代理；尚未核对旧web容器或其他宿主配置位置 |

### 迁移与发布门禁

正式架构仍按用户已确认的共享实例、共享库、共享表及租户隔离；本机独立合成库不合并到生产，也不复制合成业务数据或账号。当前只实测了旧server的数据库连接，尚未部署Hub后端，不能称Hub已连接共享库。

现有researchhub-production-equivalence-v1五步包要求前置指纹1636304ae3b092949aed8dc978f8373a，且含对已存在rh_*对象的增量修补；生产指纹不符且rh_*不存在。因此该包是候选基线增量，不是当前生产首次安装包。原有指纹守门必须保留；不能用改写期望hash、忽略漂移或直接db push让其通过。生产DDL/GRANT仍未执行。

### 后端发布检查清单（准备顺序，不是执行授权）

1. **锁定真实结构差额**：在同一已批准只读范围，提取所需schema/table/column/index/FK/RLS/ACL及迁移元数据，生成与生产实测基线对应的首次Hub安装＋增量顺序；不读取业务行，不把旧临床库复制到本机。必须核对新表引用旧共享表的真实类型/约束。
2. **形成准确迁移交付**：为生产基线生成单独manifest，列出只增DDL、必要GRANT、事务/锁超时、失败回滚及不兼容停线项；以catalog构建无业务行的等价合成库后演练。现有5步不可直接执行。
3. **验证共享表消费者隔离**：生产旧server缺少部署范围配置；需核对当前旧server及Worker实际版本和租户认领规则。未证明不会扫描Hub任务前不创建生产Hub任务；所需旧服务配置/停线仍提交单独确认。
4. **单独部署Hub后端**：复用已交付私有包，按实测amd64构建验证，Hub独立Compose项目/进程、配置、存储前缀、网络及回退产物；端口须先确认空闲，不覆盖8082/8083/80或ops服务。生产运行账号、租户及必要权限精确列单，禁止照搬合成账号/Token或整体旧.env。
5. **核实Hub专用路由**：先只读定位hub.pengxc.com实际代理，随后提交仅Hub域名/API与前端后端配置的准确差异；不假设现有宿主conf.d是入口，不重建旧系统或官网。证书、SMTP/解析/向量/模型依赖另行核实，未实际执行不宣称可用。
6. **发布审批与验收**：迁移DDL/GRANT、生产配置、影响/锁窗口、备份可恢复证据、Hub专属回退和最小业务冒烟列为一份可评审清单，取得真实发布确认后执行。变更前后核对另外两项目状态；浏览器走注册/登录、知识与科研核心路径并区分配置、实际调用和业务验收。

本轮交付仅身份统一、只读脚本兼容修复及生产现状核验；没有触发前端自动构建或任何项目的真实发布。后续首次安装迁移实现与生产执行分别评审，不因本次只读成功自动推进生产。

## 后续任务边界更新

用户已确认开发期Hub使用独立复制库，要求编制首次安装方案并保护原数据。已形成[首次安装方案](hub-first-install-production-plan-2026-11-19.md)及源对象工作库存；仍是方案，不表示生产结构已同步或DDL获批。当前结论取该方案，保留上方只读事实与失败记录。
