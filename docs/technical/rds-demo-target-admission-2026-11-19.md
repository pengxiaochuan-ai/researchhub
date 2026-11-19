# 独立RDS演示库：准确目标与下一步确认清单

2026-11-19。用户选择现有RDS实例新建独立数据库，保留获准Hub资料和合成样例；不是合并aisci。**用户已批准G0，数据库名改为researchhub；角色仍按本清单四个专用名称。尚未建库/建角色/恢复或切换入口。**

## 只读实证

[运行44445641142](https://github.com/pengxiaochuan-ai/researchhub/actions/runs/44445641142)仅连接现有RDS维护库postgres，readonly=on、写入0，不查询aisci业务表。当前运维身份aisci_control：非superuser，CREATEDB/CREATEROLE/BYPASSRLS=true。候选researchhub_demo库及researchhub_demo_owner/app角色名未占用；两个NOLOGIN候选名尚未核。执行前必须核库及全部四个候选角色名，被占用即停，不覆盖。

源PG16.14、vector0.8.2；RDS为PG18.3，可用vector最高0.8.1.2。当前运维连接ssl=false，只能证明本次未用TLS，不能推断RDS不支持TLS。只读角色能力不证明可授予BYPASSRLS或创建非trusted向量扩展；上述必须在新目标范围验证，不向旧库做试写，不升级旧扩展或实例。

## G0候选动作（仅独立库准备/恢复验证，不是前端正式切换）

| 对象 | 最小动作与权限 | 限制 |
| --- | --- | --- |
| researchhub | 在现有RDS新建独立库，所有权为专用owner，使用UTF8；库级CONNECT/TEMP/CREATE按准确恢复需求设置 | 不改aisci/旧库owner/ACL/参数，不创建或扩容RDS实例；先核已有可用容量 |
| researchhub_demo_owner | 新独立登录owner：NOSUPERUSER、NOCREATEDB、NOCREATEROLE；源elevated依赖BYPASSRLS，所需属性/可授能力单列验证 | 不继承aisci_control/aisci_owner/aisci_app，不将运维账号给应用；不能授该属性时停，不改旧角色或放松RLS |
| researchhub_demo_app | 新独立登录app：NOSUPERUSER、NOBYPASSRLS、NOCREATEDB、NOCREATEROLE | 仅新库中映射后的原应用对象/列/函数权限，不授全局GRANT ALL |
| researchhub_demo_analysis_reader | 如恢复源SECURITY DEFINER函数确需，新建NOLOGIN、NOBYPASSRLS的窄读角色，替代源rh_analysis_job_candidate_reader | 仅对应分析函数/表的必要权限，不为app提供SET ROLE/成员提权 |
| researchhub_demo_pmc_collector | 如对应已安装策略确需，新建NOLOGIN、NOBYPASSRLS角色，替代rh_pmc_collector_local | 不运行采集、不接付费来源或修改审核状态 |
| vector扩展 | 仅新库安装RDS支持的版本并验证源数据/类型/算子/索引兼容 | 0.8.2→0.8.1.2兼容未验，不视为可直接降级；失败停在新库，不改aisci扩展或实例 |
| 目标schema/数据 | 按源快照分pre-data→数据→约束/策略/权限恢复，使用新角色映射；182表/98565行的同租户来源 | 不导wp01_meta，不复活历史任务/挑战/邀请，不扩大原资料或AI用途；对象文件与一致性验证仍要补 |

源aisci_owner本机是superuser，不能复制该属性。源函数owner包含aisci_owner与rh_analysis_job_candidate_reader；源RLS角色含aisci_app、public、rh_analysis_job_candidate_reader及rh_pmc_collector_local。恢复必须重映射owner/TO/EXECUTE并验证，不能让新app继承旧角色求兼容。RDS角色是实例级对象，不因新库而天然隔离；必须核旧库PUBLIC授权不会让新角色读写旧业务，新角色登录/授予范围只面向Hub库。若需要改变旧库权限或全局RDS设置才能满足边界，停下提交新增确认。

创建任何新LOGIN角色前必须先只读核旧库现有PUBLIC表/列/函数/连接权限，尤其是可经PUBLIC调用的SECURITY DEFINER函数；若新角色能因此读写旧业务，先停，不通过修改旧ACL消除。

新口令/JWT/对象密钥只在私有配置中生成/交接，不沿用旧云/旧应用账号密码；不把源20账号的本机明文凭据公开。目标演示账号的凭证和会话失效处理在恢复验证时列单，源账号/角色/额度不改。

## 数据包与执行边界

本机已生成单租户一致性快照，182表98565行，源写入0、FK闭包通过，183文件hash/行数重验，私有文件合计213284030字节。它是schema.dump＋逐表JSONL/清单，不是已经演练通过的pg_restore全数据包；未包含上传/附件/PMC/索引对象文件，尚未恢复验证。不能直接将目录上传后宣称已部署。

历史queued/processing/running及未知预留不得在目标自动恢复，不能通过删行或改计费历史掩盖。先保留原快照，提交目标历史任务隔离和新任务启用的准确规则，经同租户恢复/回读验证再启用消费者。新目标默认不发邮件、不调模型；AI核心、解析、邮件、文件和实际业务分别完成配置和真实请求验收后才能作为演示功能交付，不用disabled或health200销项。

## 尚需确认/验证

G0若获准，只做新库/专用角色及该新库的恢复兼容验证，不切换当前Hub前端/API、不运行旧服务发布/停线，不新增Token或模型/邮件费用，不新购/扩容云资源。命名、容量、权限、TLS、扩展或数据状态有不一致即停，保留失败证据，不自动换库/提权/重试/清理旧数据。

完整对客发布还需：上传/对象与配置、amd64包和原功能装配、演示账号、历史任务隔离、真实浏览器与AI等实际能力、备份恢复、Hub路由差异和回退准确清单。生产入口切换另行确认，不将本次G0授权视为任意发布。后续共享库合并见MB-01，12月以后评估。

## 本轮独立复核

源选择规则4项、RDS探针2项、既有只读探针6项及语法检查通过；实际只读源导出与RDS元数据查询另有证据。独立评审无当前文档交付阻断，强调四角色占用和新LOGIN前PUBLIC权限前置已补。未把源快照、纯测或管理标志代替目标恢复／浏览器／客户验收。

## G0执行准入（用户已批准，2026-11-19）

仅将数据库名改为researchhub，四个角色名保持researchhub_demo_owner/app/analysis_reader/pmc_collector，避免把用户库名修正扩为额外命名决策。现有readonly探针更新为核新库名与四角色，并在aisci只读查询PUBLIC目录权限（表/列、可直接调用SECURITY DEFINER函数，不读取业务行）作为新增LOGIN前置；若有未知可读写入口先审查，未证明安全不创建角色。容量、TLS和vector兼容继续为前置，不扩容/改旧权限/切入口/调用模型或发邮件。

### 容量与TLS只读门禁实现

为执行已批准的容量前置，拟仅用现有RAM查询该RDS实例DescribeDBInstanceAttribute，不修改实例。使用DBInstanceStorage（GB）和DBInstanceDiskUsed（byte）计算；为约213MB源包/约330MB源库保守预留2GiB恢复/WAL余量，要求余量后仍留2GiB且使用率不超过80%，缺指标/权限/标识对应关系即阻断，不自动扩容。接口字段依据[阿里云官方API](https://help.aliyun.com/en/rds/developer-reference/api-rds-2014-08-15-describedbinstanceattribute)。

TLS只读连接试验使用Prisma6的sslmode=require及sslaccept=strict，仅作用于临时连接，不改旧服务.env或RDS配置；证书/握手不满足即不用于新库写入。[Prisma6官方说明](https://docs.prisma.io/docs/orm/v6/overview/databases/postgresql)。PUBLIC目录补充schema CREATE/USAGE及用户schema列表；实例标识仅在运维调用私有中间文件流转，公开日志只留host hash和容量摘要。
