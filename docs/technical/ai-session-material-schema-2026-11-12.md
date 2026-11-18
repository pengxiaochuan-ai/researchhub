# 岐研AI会话材料关联表 · 本机合成DDL

2026-11-12。用户本轮只批准“新增表”；已在`wp01_test_full_baseline`建立`rh_ai.session_materials`。仅schema/一表/必要索引、约束、trigger和三项RLS策略，没有应用GRANT、Agent配置、上传API、模型请求或发布。

## 结构和使用边界

| 字段组 | 事实与约束 |
| --- | --- |
| id、tenant_id、study_group_id、research_project_id、account_id、session_id | 服务端稳定ID与当前真实父链；插入时加共享锁核对，身份/会话/作用域不可修改 |
| purpose | 目前仅knowledge，research_data明确拒绝，不因新表开放被试写入 |
| request_key、request_fingerprint、source_sha256 | 当前账号/会话请求键唯一；请求指纹与原件SHA256不可更换 |
| kb_id、source_file_id、import_task_id | 本人private库，原件/导入任务必须真实同库、同创建人和当前scope；source/import分别唯一且成对存在 |
| state、version | staged→importing→ready/blocked/failed；blocked可回importing；ready可失效；每次更新version必须精确+1，调用服务仍须WHERE期望版本做CAS |
| doc_id、doc_version、content_sha256 | 固定解析文档、版本与UTF-8 Markdown SHA256；ready必须原件/任务同文档，任务complete、文档未回收、安全allow；不要求published/reviewed，不修改原审核事实 |
| deleted_at、created_at、updated_at | 明确软移除事实；已移除关联不复活，时间由trigger维护。就绪读取必须同时显式核对本字段及原文trashedAt |

新表不保存正文、原始敏感文件名、storageKey或模型凭据。列表索引覆盖tenant/group/project/account/session和稳定时间/ID排序。没有物理DELETE策略或后台扫描器。

## 兼容旧生命周期的决定

独立评审发现RESTRICT外键会阻止旧K01空库/回收站清理，也会钉住旧会话删除。最终采用**历史逻辑引用＋写入时真实父链共享锁**，不向旧表增加FK、索引或trigger。原库/文档/会话照旧允许其既有生命周期；关联快照保留，不冒充仍可读取。代价是可能保留无法解析的历史ID，未来列表、工具、历史交付必须实时重验原对象，缺失即不可用，不能只凭本表ready放行。

原文正常编辑/version++或回收后，允许在原scope/owner/session仍有效时，只把固定关联标failed或软移除；不可在该操作中换库、原件、任务、doc/version/hash。缺失/过期原文不能阻止减权，也不能成为更新快照绕验证的通道。旧服务、删除权限和数据保留策略不改。

## 迁移守门与运行方式

源文件：`server/ai-agent/session-material-schema.sql`；入口：`scripts/ai-session-material-schema.mjs`。

只允许显式`--mode local-synthetic --approved-material-table`。使用现有本地安全配置加载器，不读环境DATABASE_URL兜底、不输出DSN。每个实际执行事务重新核库名、直接身份、syntheticOnly/runId标记，设置锁/语句超时和专用事务锁。DDL前验证9张依赖旧表必要列/类型/可空性、主键、原件/任务唯一键及原级联关系指纹；不扫描业务正文或修复旧表。

首次只增；表已存在时必须SQL hash、完整rh_ai目录指纹和依赖结构指纹匹配表COMMENT回执，否则拒绝，不DROP或自动修理。COMMENT只存版本/hash与合成标记，不存凭据。应用启动不会自动执行本迁移。

## 权限与验收状态

新表已ENABLE/FORCE RLS，SELECT/INSERT/UPDATE均要求当前事务tenant/group/project和服务端设置的`app.account_id`完全匹配；没有管理员绕owner分支。函数SECURITY INVOKER、固定search_path、PUBLIC不可执行。首次DDL阶段无应用新权；本轮继续指令后已按app-material-rw.v1限定授USAGE/SELECT/INSERT/UPDATE，COMMENT目录回执同步，其他权限仍拒绝。[当前授权与上传](ai-session-material-upload-2026-11-12.md)。

直接迁移身份是superuser，**其成功操作不能证明应用RLS正向隔离**。首次无权阶段42501留证；现已用真实SET LOCAL ROLE aisci_app验证本人写、缺账号/跨tenant/group/project及admin≠owner零行，未删原负例或放宽RLS。上传与真实AI仍须分别实际证明。

真实执行回执：`.tmp/ai-file-data-2026-11-12/schema-applied.json`。持久表0行；新具名会话/库/原件/任务/草稿测试全部回滚，无历史清理。旧相关列、public索引/RLS/ACL、角色、原两账号和当前租户AgentConfig的限定审计前后hash相同；不是对并行其他任务全库静止的声明。

首次DDL事务已提交；随后应用权限检查按名称解析表得到预期42501，不能据该检查错误重建表。已用pg_catalog OID只读核对无新权限，并实测再次迁移返回created=false；原错误保留在执行记录，不假称首次整段命令全绿。

测试与独评见[DDL验收记录](../testing/ai-session-material-schema-2026-11-12.md)。完整文件/AI功能、P01、P02未销项；使用说明不新增未交付操作。
