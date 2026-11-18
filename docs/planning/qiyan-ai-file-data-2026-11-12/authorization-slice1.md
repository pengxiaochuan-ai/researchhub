# 首切片最小结构与工具配置差异 · 按确认范围继续串行实施

2026-11-12，仅“文献上传→本人私有库→本人固定材料分析”。新增表已按先前明确批准执行；针对剩余第2/3项最小接线的具体询问，用户要求按顺序串行继续，除必须新增确认外不再反复停线。本轮按已说明边界落实第2项限定表访问与第3项原两合成账号file.read，不扩大为数据写权、其他账号/Study/工具或付费试跑。实际结果与待验项另留证据，不以配置存在当作功能接通。

## 为什么不能完全不扩结构

KnowledgeSourceFile有文件hash/库/原件，KnowledgeImportTask有导入结果，但均无session、account请求幂等及可编辑材料集合版本。Message.meta没有对应唯一约束和独立查询索引；StructuredInteraction强制问答消息/交互语义，伪造消息用来存文件会污染历史和审核。不能为了免确认把上传记录塞入不受约束的JSON或自动审核发布。

## 本轮已确认执行的最小范围

1. **只在wp01_test_full_baseline新增`rh_ai.session_materials`一张关联表及必要索引/约束/作用域检查函数或trigger**，不建第二套文档、原件、向量、账户、被试表，不ALTER旧表或旧RLS；schema不存在则只增rh_ai。正文/原件/索引仍复用现有知识表和对象存储。
2. 现有合成应用身份只增加rh_ai的USAGE和该表SELECT/INSERT/UPDATE；不授DELETE、TRUNCATE、DDL/owner/BYPASSRLS或其他schema权限。辅助函数不对PUBLIC开放；不新增数据库账号。迁移身份仅执行本次显式脚本，不将其凭据暴露给运行请求。
3. 当前合成科研Agent配置在原`knowledge.search`基础上**仅增加`file.read`**，按旧版本/CAS与审计创建新配置，不改旧版本。仅原owner/admin、现有AgentAccess、当前合成scope和本人本会话材料可以实际使用；不改角色、成员/Skill、额度、租户默认权限或旧TOOL_CATALOG。

不含数据写权限：暂不补`data.upload`、`subject.bind`、数据菜单或其他Study权限，不处理新账号/其他租户；后续数据切片到达时按真实缺口再列清。不含付费试跑、额外模型服务、云/远端配置、旧服务重启或真实发布。

## 表与授权必须满足的约束

- UUID/稳定ID、tenant/group/executionProject/account/session真实父链；purpose区分knowledge/research_data但本首片只启用knowledge；必要的状态与version/CAS，不让模型直接改。
- `UNIQUE(tenant,account,session,requestKey)`＋固定请求指纹；一条关联对应一个原件/导入任务。源hash、库、doc/version和原件关系在当前事务重验，不能只验证传入ID存在。
- kb/source/import/doc为空仅限实际尚未完成阶段；ready必须关联当前本人private库、真实source/import/doc且hash可核。状态转换不允许用“ready”绕过解析/安全检查。
- RLS启用且FORCE：tenant/group/project使用当前事务scope；account使用服务端可信登录身份在同一事务设置的`app.account_id`，缺失即拒绝。后台从持久关联重建身份并逐次当前验权，不接受浏览器任意GUC/account值。范围不可变，修改scope/session/owner拒绝。
- 关联记录软删除使用明确deleted_at/等价删除事实；ready读取必须显式null，并同时读取文档trashedAt；漏选字段不得按未删除处理，不默认删除历史记录。
- 原表仅引用不改：实测RESTRICT FK会阻止旧K01清理及会话生命周期；最终用历史逻辑引用＋新绑定事务/trigger真实父链共享锁，不向旧表加约束/索引/trigger。source/import分别唯一且重验真实一对一；缺失旧对象只保留不可用历史快照，读取不能只信ready。[理由与代价](../../technical/ai-session-material-schema-2026-11-12.md)。
- 安全显示名使用旧假名化/正文标题规则，原始敏感文件名不进入持久标题、日志、模型或Notion；存储随机key仍由旧服务签发。
- 只向当前拥有者查询/交付；管理员角色不绕本人私有材料边界。K01已有库可见/审核规则不改变。
- 迁移先检查精确库/合成标记与旧结构指纹，已存在但不兼容则拒绝，不DROP/清理历史；执行前后旧表/角色/其他配置和数据保全，失败回滚，不开启旧扫描器。

## 接口冻结（P02接线中，P03命令材料尚未接入）

- 首片从普通Hub会话原上传按钮进入；旧单篇固定证据分支不混入新附件。
- `POST /sessions/:id/materials`：同源multipart，`requestKey`及file；复用旧流式文件校验/知识导入策略，文件全量hash由后端计算。同key不同源指纹409，提交结果未知只查原key。
- `GET /sessions/:id/materials?cursor&limit`：limit默认20/最多50，稳定分页，安全名称/真实阶段/可用版本/来源状态，不泄露storageKey/内部凭据。
- `GET /sessions/:id/materials/receipts/:requestKey`：当前拥有者原操作回执，不自动补写或重传。
- 如实际单文件超直接入口上限，复用旧分块策略，不能以25MiB结构检查兜底假称支持100MiB所有格式；实际每格式上限在入口显示。分块路径在P02冻结后不新增权限。
- 原commands提交与等待编辑增加可选`materialRefs:[{materialId,version}]`，最多20项；其余旧消费者缺省为空。后加附件不进旧指令；同key异材料冲突；读写时服务端固定并重验全部父链。
- 新私有工具只读取任务快照中的ready/allow材料，明确“本人上传材料”，不调用普通Hub检索绕审核。尚未ready不发付费问题；warning继续原安全决定流程，不当作allow。

第1项先前已执行；第2/3项按本轮继续指令现已完成，见[当前接线与权限](../../technical/ai-session-material-upload-2026-11-12.md)。原Agent旧配置保留，新v2只增file.read；应用仅该表DML，不修改角色/额度。P02真实入口尚待修补装配/复验，P03真实模型费用仍执行前另核；不放开数据Agent写库或自动付费。
