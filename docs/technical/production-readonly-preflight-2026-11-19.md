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
