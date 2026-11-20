## 2026-11-19 · RDS数据与账号现场成功回执

用户回传status=database-accounts-enabled：目标researchhub、182表/98,565行、contentMatch=true、179强制RLS表、209策略、0无效索引、accountsEnabled=true、workersStarted=false。原3个NOT VALID约束与冻结基线一致，不是本次新增失败。按用户回执记录数据库恢复/05–07及角色启用通过，不冒称Codex直连核验或后端上线。

聊天中的sourceManifestSha256只有48位，未用它替代冻结64位指纹；请在原目录仅运行python3 restore-demo.py verify-enabled补全只读复验。正确冻结值为9a9e34001e762b8a2790b29c69e2a45f8306e12a3380178fec911b7e4239cafb。实际新口令目标连接、对象原件/后端配置与页面业务仍待验；不重新run/accounts，不启动历史Worker。首次口令检查失败记录保留，后续成功回执单独追加，不推测原输入。

# 独立researchhub演示数据恢复及05–07

2026-11-19。用户现场已完成00–04，182表、pre-data-complete、accountsEnabled=false。当前目标为尽快完成已批准的独立演示数据库部署，不恢复共享库改造或加密专项。本轮本机串行实施＋独立复核，生产仍由用户手动执行。

## 固定范围与复用

只恢复此前冻结的Hub单租户快照：182表/98,565行，sourceSchemaSha256=5508da1d4094fc398cdb118a622b500d101a645f26f8d42f774378ed2776053c，原manifest SHA256=9a9e34001e762b8a2790b29c69e2a45f8306e12a3380178fec911b7e4239cafb。保留原始来源、审核、用途、合成标识、固定版本和历史事件；不重跑任务、不发邮件、不调用模型，不复制生产aisci临床业务行。模型profile行数0，两个Agent配置env无字面凭据键；配置/密钥仍独立私有交接，不扩大资料用途。

复用已交付run-server.py的配置解析、主机/端口/账号、PG变量隔离和临时PGPASS机制；仅连researchhub，源aisci只作为旧配置中的来源库名，不对其发数据SQL。连接方式沿用户明确批准的既有配置；不再请求SSL批准，不改旧配置或服务。新包和数据仅本机私有目录，不上传Git/Notion。

## 执行顺序

- 默认check：只校验恢复包/冻结manifest/逐表文件SHA及行数，不连接DB。
- run：核新库owner/marker/角色NOLOGIN、精确182表和空表；事务内一次恢复源数据，identity保留原值，唯一数据映射为pmc_collector_binding.role_name的旧角色→新角色；提交后逐表规范化行摘要核验。随后原05安装索引/FK/触发器/RLS/ACL与7序列，再核内容/原06与179强制RLS表、209策略、0无效索引及原3个NOT VALID CHECK。所有验收保持失败即停。
- 原始JSON数字不通过float转换，SQL按原始JSON文本生成；内容比较使用Decimal类型保留任意精度，逐行摘要排序形成表级多重集摘要。比较是完整性核对，不计算或重写科研数值。
- 中断恢复根据数据库事务marker和真实行数/摘要判断：空表才导入；已原子导入且来源标记匹配则只验证并继续；unknown/partial/不符均不覆盖、不删除、不自动重试。新库事务安装锁与本地锁避免并发操作。
- 数据/权限核验通过后执行07等效账号启用：仅新owner/app两角色，输入两个不同且至少32字符的新密码；借用已安装libpq原生SCRAM接口生成verifier，实际SQL不含明文密码，仍执行原07的库/来源/状态/行数/角色守门。不是额外部署加密改造，不新增服务或库权限；密码不输出或写日志，口令由用户私有保存。其他两角色仍NOLOGIN。
- 不启动Hub/旧Worker，不自动重放复制的queued/running任务。文件/对象、API配置与客户页面验收独立推进；数据库完成不冒称全站已发布。

## 前置与保护

导入前操作者核实RDS磁盘可用容量。用户已明确确认RDS总容量3GB、已使用1GB、剩余2GB，并要求继续。该容量确认作为本次恢复前置记录；仍先完成本机完整恢复并记录实际占用，再交服务器执行。不能用ECS磁盘代替RDS空间，不扩容/创建云资源。

source-manifest和原JSONL逐表SHA在源包生成时与服务器检查时均核验。先写目标guard/数字精度/原子失败/恢复测试，后实现导入器；在新本机合成PG用真实13.23跑完整98,565行、内容核对、05/06与07登录验证，反例不得使用临床库。正文和运行数据不进工具输出，只记数量/hash/状态。

## 小步实施

1. 冻结源与规范化摘要/原始JSON SQL生成、纯测试。
2. 安全流式恢复与只读内容核验、事务/marker恢复规则。
3. 原05/06与07原生密码/登录续接，不改业务权限。
4. 新本机完整演练、独立总评、准确私有恢复包及服务器命令。
5. 记录用户04成功与后续现场结果，更新手册/版本/Notion；不改已交付旧包或历史失败记录。

本机39项自动与全量恢复/账号实际连接已通过，独立总评通过；目标RDS数据/05–07待现场执行，不以模拟或源码路径代替目标RDS执行与客户验收。

## 服务器执行（接续已经成功的04）

只解压本次新的私有数据恢复包到新目录。保留之前的04目录和.server-run日志；不重跑all、00–04，不覆盖旧配置。以现有运维操作者执行：

```sh
cd /srv/researchhub/researchhub-rds-demo-data
sha256sum -c SHA256SUMS
python3 restore-demo.py check
python3 restore-demo.py run
```

check只读取本包，核对冻结清单与182份数据文件，不连接数据库；run沿用/srv/aisci/ops/.env.prod的DIRECT_URL，固定改连researchhub，只使用其中现有运维身份，不读取aisci业务表。执行data→逐表内容比对→05→再次内容比对→06与结构验收。约需数分钟，期间不关闭终端，不同时运行其他恢复命令。不安装新客户端，不改旧服务。执行器与数据核验分别设从客户端启动起30分钟总时限，含流式读写；超限终止客户端并要求重核事务/marker，不自动重试。

预期最后一行status=data-05-06-complete-ready-for-accounts，tables=182、rows=98565、contentMatch=true、accountsEnabled=false。失败时仅回传status/code及本次日志路径，勿发送.env、数据正文或密码。保留.restore-run私有回执。中断需先确认旧进程已退出，人工再次运行同一run命令会读取真实状态：空库导入；dataLoaded来源匹配且内容一致时只续05；post-data-complete且内容一致时只复验；不符即停，不删数据或覆盖未知状态。

成功后设置两份**新数据库账号密码**（与网站admin/owner体验账号密码无关），每份至少32字符且彼此不同，提前私有保存，不贴聊天：

```sh
python3 restore-demo.py accounts
python3 restore-demo.py verify-enabled
```

accounts先再次验数据和结构，终端隐藏输入两份口令及确认。复用服务器已有libpq原生SCRAM能力，不把明文放进SQL/参数/日志、不写密码文件；只向目标RDS提交verifier并执行原07守门。verify-enabled只读复验，预期status=database-accounts-enabled、accountsEnabled=true。两个特殊reader/collector仍NOLOGIN。角色标志启用与实际应用连接分别验收，本机已做真实新owner/app口令连接测试；目标RDS账户/应用连接仍由现场后续确认。禁止将已启用账号后的run/accounts当成自动重试，需复验时使用verify-enabled。

所有运行日志只含状态/错误标识，不落数据/SQL/口令/verifier。临时连接文件0600、运行目录0700，结束清除；原配置只读。包中历史任务不改变状态且不启动任何Worker。数据库完成后仍需独立交接对象原件和后端连接/环境配置；不得据此启动任务、发邮件或宣称客户全站可用。

## 容量与边界

用户本轮确认RDS总3GB、已使用1GB、剩余2GB并授权继续；冻结原始数据文件合计211,947,933字节（约202MiB），完整源快照连结构约213MB。实际关系、索引和WAL占用以本机演练记录和RDS监控为准；不假定JSON文件大小等于存储需求。本次不扩容、不新增实例，不连接旧aisci业务数据。数据包含合成账号、历史会话与科研记录，必须私有传输/保存，不放Git、公开对象或Notion。

## 本机验证结果与文档同步

真实13.23客户端完成98,565行逐表完整内容核对、原05/06/07、两新密码实际连接和7序列核验；异常回滚/错误目标/篡改拦截/已启用后拒绝重导入通过。新库约194MiB，全新本机实例WAL目录约192MiB，不能等同RDS精确增量。当前脚本13个新测试与26项原回归通过，独立总评两项超时问题均已关闭。详见[本机测试记录](../testing/manual-rds-demo-restore-2026-11-19.md)（私有交付包内为数据恢复验证.md）。本说明、验证、产品/版本/操作记录已同步Notion，仅同步说明，不含行数据或秘密。
