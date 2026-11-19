# 同机三项目：生产只读核对

用户已批准只读核对生产部署、CPU架构与共享PG结构；补充确认Hub、旧系统及official-site同机。本次不发布、不运行deploy/rollback、不重启/停服务、不修改配置或DDL，不读临床业务行，不创建云资源或新增权限。

本机无云助手凭据；GitHub生产环境已有发布凭据。复用该现有通道，新增仅workflow_dispatch的只读核对任务，使用skip-ci提交，不触发既有前端发布。命令仅uname、docker ps/inspect、受限Nginx配置解析及旧server容器内独立Prisma进程的只读catalog事务；不启动Nest/Worker，不加载模型。凭据留在GitHub/ECS，不输出环境值。三个项目镜像/状态/端口仅做摘要。

本机app/.env.prod保留RDS aisci目标，但解析为私网地址、sslmode=disable；不是服务器实际配置证据，不由本机用它发口令。实际目标从运行中的唯一aisci-server进程环境只取连接位置摘要；DB仅查pg_catalog/扩展/owner/ACL/RLS/结构指纹，不查业务表。核对结果存GitHub运行日志的脱敏JSON，不上传原配置。

若凭据未授权给当前仓库、云助手拒绝或运行中server不唯一，明确阻断，不改RAM/安全组、不开放SSH、不切换旧服务。
