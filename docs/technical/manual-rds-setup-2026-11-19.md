# researchhub：RDS手动建库、账号与表结构迁移

## 2026-11-19 · 新增服务器执行入口

可使用[服务器执行器与命令](manual-rds-server-runner-2026-11-19.md)，安全读取旧配置、检查客户端并串行00–04；默认check不连接数据库，all强制TLS且不自动继承旧disable。已做本机隔离与失败恢复验证，未在生产运行。新版带脚本包与原SQL包分开保留，下方DMS步骤仍可用。

2026-11-19。用户改为自行在RDS创建数据库和账号，本轮仅准备SQL、说明及本机隔离验证；不执行远端RDS写入，不改SSL、容量、旧服务或应用入口。目标固定为 **researchhub**，与 **aisci** 是同实例的两个独立数据库。合库仍为MB-01，12月以后重新评估。

## 交付文件与当前停点

实际执行包在本机私有目录：

`/Users/mac/aisciencesys/researchhub/.tmp/manual-rds-researchhub-20261119/package-final/`

请使用该目录下的文件，**不要执行公开仓库里的未展开模板**。完整表结构含旧核心结构和具名合成约束，不上传公开Git/Notion；公开仓库只保存构建器、无密钥模板、测试及本说明。目录内有manifest.json和SHA256SUMS，可逐文件核验。

来源为已冻结的专用合成快照，182表，选定Hub租户共98,565行；schema.dump SHA256：`5508da1d4094fc398cdb118a622b500d101a645f26f8d42f774378ed2776053c`。SQL包**只有结构，没有行数据、PDF/附件、旧数据库口令或模型密钥**。数据恢复另外处理。

**本次请先手动执行00→04，成功后停下。05→07已准备，但必须等待演示数据恢复及内容核验，不启动后端或Worker。**

| 文件 | 当前连接库 | 作用 | 成功标准 |
| --- | --- | --- | --- |
| 00-check-postgres.sql | postgres | 只读核操作者和命名占用 | 没有异常，记录版本和角色能力 |
| 01-create-roles.sql | postgres | 原子创建4个专用角色，先NOLOGIN | 事务COMMIT，4个角色存在且不可登录 |
| 02-create-database.sql | postgres | 单条CREATE DATABASE | researchhub创建成功；必须单独自动提交 |
| 03-init-researchhub.sql | researchhub | 初始化新库ACL及vector 0.8.1.2 | COMMIT，marker为initialized |
| 04-pre-data.sql | researchhub | 完整表、类型、函数和序列 | COMMIT，182张业务/历史表，marker为pre-data-complete |
| 05-post-data.sql | researchhub | 恢复行数据之后，安装索引/FK/触发器/RLS/GRANT并校准7个自增序列 | COMMIT，marker为post-data-complete；行数不符则拒绝 |
| 06-verify.sql | researchhub | 只读核验库、版本、182表逐表行数、角色、RLS与索引 | 无异常，保存结果供复核 |
| 07-set-passwords.sql | researchhub | 本地填两份新口令，启用owner/app登录 | 来源SHA/owner/状态/逐表行数/口令检查全部通过 |

## 一、RDS与DMS准备

1. 在阿里云控制台确认选择的是已有RDS PostgreSQL实例。记录实例标识、版本、已分配/已使用容量及采集时间；不扩容、不重启、不修改SSL、不开放公网。旧aisci保持独立且不选择它执行本包。
2. 用已有高权限运维账号登录DMS。账号需要CREATEDB、CREATEROLE，以及RDS允许的新角色BYPASSRLS设置和vector安装能力。此前只读账号是aisci_control；是否获准执行以RDS实际结果为准，不因模板存在就认定权限通过。
3. 00/01/02选择维护库 **postgres**，03以后明确切换 **researchhub**，始终使用同一创建操作者。不要用旧aisci_app/aisci_owner或网页admin账号代替运维账号。
4. 一次执行一份文件。除02外，事务型文件必须整份在**同一连接**提交，不按不同会话拆开运行；DMS若不支持该模式或拦截DDL，停止并保留错误，不删BEGIN/guard求通过。02是独立单条，不能放进BEGIN或DMS强制事务中。
5. 确认DMS返回COMMIT后再进入下一份。若出现错误，当前连接执行 `ROLLBACK;` 后停止；不要只看最后一条“执行完成”，也不要继续下一文件。

建库到权限初始化之间不导入任何数据。03会移除新库PUBLIC连接及public schema默认访问，只开放本包所需的新角色和当前操作者。不会修改旧库PUBLIC权限或旧角色属性。

## 二、先建角色，再单独建库

依次全选执行00、01。00/01拒绝目标库或任一角色名已存在，避免误接他人库或覆盖账号。01只创建以下4个角色，不复制旧密码、旧SUPERUSER或旧角色成员关系。

| 新数据库角色 | 职责 | 初始状态 |
| --- | --- | --- |
| researchhub_demo_owner | 新库owner、迁移和现有受控后台路径；保留所需BYPASSRLS | NOLOGIN、非超级用户，不可建库/建角色 |
| researchhub_demo_app | 普通Hub应用，原RLS继续生效 | NOLOGIN、NOBYPASSRLS |
| researchhub_demo_analysis_reader | 特定分析发现函数的definer owner | NOLOGIN、NOBYPASSRLS |
| researchhub_demo_pmc_collector | 采集策略身份；本轮不启动采集器 | NOLOGIN、NOBYPASSRLS |

01使用PG16+的createrole_self_grant=set，让创建操作者能够SET到自己新建的角色。它不授app成员关系、不让新角色继承旧aisci权限。BYPASSRLS只授新owner；RDS拒绝时停下，不授SUPERUSER/rds_superuser或改旧账号绕过。

然后**单独执行02**，核心语句是：

```sql
CREATE DATABASE researchhub
  OWNER researchhub_demo_owner
  ENCODING 'UTF8'
  TEMPLATE template0
  CONNECTION LIMIT 20;
```

已创建成功后不要重跑02。实例级角色名保留此前批准的_demo后缀，库名按用户要求为researchhub。它们是数据库身份，与网站owner@example.org/admin@example.org不是同一类账号。

## 三、切到新库，初始化并建表

在DMS重新选择 **researchhub**：

1. 执行03。它检查库名、owner、空库、4角色的安全属性，安装此前RDS只读清单提供的vector **0.8.1.2**，并做3维向量类型探针。若版本不存在、BYPASSRLS/扩展权限不支持或目标不为空，停止核实；不要安装别的版本或复用aisci扩展来蒙混通过。
2. 执行04完整文件。约0.5MB，182表，并包含对应schema、类型、函数、序列及部分原始ACL；其余索引/FK/触发器/RLS在05。运行期间角色仍不可登录，不允许应用连接半成品。
3. 完成后用下面只读SQL核对并保存结果：

```sql
SELECT current_database(), current_user;
SELECT shobj_description(oid,'pg_database') AS delivery_state
FROM pg_database WHERE datname=current_database();
SELECT count(*) AS tables
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE c.relkind IN ('r','p')
  AND (n.nspname='public' OR n.nspname LIKE 'rh_%');
SELECT extname,extversion FROM pg_extension WHERE extname='vector';
```

预期：researchhub、marker的state=pre-data-complete、tables=182、vector=0.8.1.2。**此处停止，把执行结果或首条报错发给开发者即可，不发密码。**数据库建好不等于客户环境已经可用。

04/05为保留分析函数的原definer owner，在事务内仅暂时授新owner对新analysis_reader的成员关系，函数改owner时短暂授新reader对rh_analysis的CREATE；提交前撤销临时成员/CREATE。app不获得上述关系；永久函数执行权限仍按源ACL映射。

## 四、数据恢复及05→07的后续操作

这部分在00→04成功后继续，不在SQL窗口直接粘贴约213MB的JSONL。

1. 从已冻结的单租户快照恢复182表逐表数据，验证原文件SHA、行数和内容，保留批准的来源、审核、AI用途及合成标识；不读取生产aisci临床行，不整库复制全部历史测试租户。
2. 数据恢复时保留显式identity值（原生INSERT需要OVERRIDING SYSTEM VALUE或等效COPY恢复）。仅把rh_source.pmc_collector_binding.role_name中的旧策略身份映射为新collector角色；准确映射在role-map.json，不全局替换正文/Study/tenant/对象ID。
3. 确认字段类型、父对象闭包、对象文件/加密配置可用和历史任务范围。05逐表计数门禁不能代替内容SHA或文件可用性；本包不自动更改历史任务状态，也不发送邮件或恢复模型任务。
4. 执行05：先核182表逐表精确行数，再安装索引、FK、触发器、RLS和原用途ACL，并按导入最大值校准7个新库identity序列。空序列保留首次取1；setval只影响新库且非事务回滚项，若后续失败需记录状态，重试仍由导入最大值校准。不启动消费者。
5. 执行06保存只读结果。期望182表/98,565行、179表启用且强制RLS、209策略、无invalid index；源已有3个NOT VALID CHECK被原样保留，不擅自VALIDATE或假称全部历史行合规。它们是study_task_blocked_reason_check、study_task_priority_check、subject_visit_anchor_schedule_check，不是迁移漏建FK。
6. 内容/文件与目标配置复核通过后，在本机07私有副本填写owner/app两份**不同、至少32字符**的全新口令（建议密码管理器生成字母数字，避免手工SQL引号转义）。不把实际口令上传Git/Notion或发聊天。07会在核库owner、来源SHA、marker和逐表行数后启用这两个新角色，另外两个仍NOLOGIN。填写后07不再与原SHA相同，保留原文件供追溯。
7. 07成功也不自动切换应用。连接串、后端目标marker/指纹、对象文件、加密配置、外部服务、历史队列及同机端口/代理的准确配置和真实页面验收另行进行；不得把空库/建表成功、health200或旧本机AI记录当作客户环境的功能通过。

## 错误与恢复

| 情况 | 处理 |
| --- | --- |
| 00/01报DATABASE/ROLE_ALREADY_EXISTS | 停下核实归属；不DROP、不改名绕过，不给已有角色重设密码 |
| 01成功、02失败 | 保留新角色NOLOGIN；排查02原因后只恢复该步，不重跑01，不清理旧角色 |
| CREATE DATABASE cannot run inside a transaction block | 取消DMS对02的事务封装，单条自动提交；其他步骤仍保留原事务 |
| WRONG_DATABASE / WRONG_DATABASE_OWNER | ROLLBACK，检查DMS当前库与本包目标；不改guard |
| vector/BYPASS/SET ROLE/GRANT权限报错 | ROLLBACK并停止，记录RDS原始错误；不扩大旧账号/实例权限 |
| 03/04/05超时或会话中断 | 不继续；重连只读检查marker和对象状态。事务是否提交不明确时先核实，不盲重跑 |
| 04重复执行 | 正常拒绝，不能DROP后重来；pre-data-complete则转数据恢复 |
| 05数据计数不符 | 停在pre-data-complete，核对导入范围、完整性和数据映射；不删行/补造数据求通过 |
| 07未填口令、错源/错owner | 正常拒绝，不启用账号；修正私有副本/目标事实后再核 |

不提供自动DROP DATABASE/DROP ROLE的回滚按钮。错误时保留新库用于核对；任何删除清理都须另核准确目标和备份，旧aisci/官网不在处理范围。

## 本机验证记录与限制

隔离容器无网络、无宿主端口；没有连接或写入RDS，源数据库写入0。构建器不连接数据库，只从冻结schema.dump提取结构。生成SQL已移除psql反斜线指令、避免无限锁等待，使用2秒lock timeout、5分钟单语句上限和事务内SET；不是在共享aisci运行增量包。

本机为PG16.14/vector0.8.2；仅在测试内把03的目标扩展版本替换为0.8.2，并用本机超级用户模拟RDS扩展安装权限。04/05及数据导入由非超级用户迁移操作者SET到新owner执行。此证据**不能替代RDS PG18.3/vector0.8.1.2、RDS角色授权和DMS执行模式的实际核验**。

已观察：182表/98,565行全量选定数据恢复及05/06通过；错库、04重跑、05未导数据、07占位口令/错源SHA/错owner拒绝。独立评审指出07来源绑定需补齐，已按最小差异修正。最终脚本的序列及登录启用回滚复验结果见[验证记录](../testing/manual-rds-sql-2026-11-19.md)。本轮没有前端变更，不将数据库脚本编译称为浏览器或专业验收。

生成器：deploy/manual-rds-package.mjs；冻结快照位置仅保留本机。不要把完整私有schema、数据和密钥作为公开仓库附件。

技术依据：[PostgreSQL CREATE DATABASE](https://www.postgresql.org/docs/18/sql-createdatabase.html)、[角色属性与创建者成员关系](https://www.postgresql.org/docs/18/role-attributes.html)、[序列setval](https://www.postgresql.org/docs/18/functions-sequence.html)。
