## 2026-11-19 · RDS数据与账号现场成功回执

用户回传status=database-accounts-enabled：目标researchhub、182表/98,565行、contentMatch=true、179强制RLS表、209策略、0无效索引、accountsEnabled=true、workersStarted=false。原3个NOT VALID约束与冻结基线一致，不是本次新增失败。按用户回执记录数据库恢复/05–07及角色启用通过，不冒称Codex直连核验或后端上线。

聊天中的sourceManifestSha256只有48位，未用它替代冻结64位指纹；请在原目录仅运行python3 restore-demo.py verify-enabled补全只读复验。正确冻结值为9a9e34001e762b8a2790b29c69e2a45f8306e12a3380178fec911b7e4239cafb。实际新口令目标连接、对象原件/后端配置与页面业务仍待验；不重新run/accounts，不启动历史Worker。首次口令检查失败记录保留，后续成功回执单独追加，不推测原输入。

# 独立researchhub演示数据恢复验证 · 2026-11-19

对应[执行说明](../technical/manual-rds-demo-restore-2026-11-19.md)。本轮只在新具名本机合成环境完成，不访问生产或旧系统业务数据，不启动Worker，不调用模型或邮件。用户现场00–04成功回执已确认182表/pre-data-complete/账号关闭；生产数据与05–07仍待手动执行回执。

## 固定源与客户端

冻结manifest SHA256=9a9e34001e762b8a2790b29c69e2a45f8306e12a3380178fec911b7e4239cafb；sourceSchema SHA256=5508da1d4094fc398cdb118a622b500d101a645f26f8d42f774378ed2776053c。182表98,565行，逐文件SHA、字节数与行数均核对。唯一字段映射为rh_source.pmc_collector_binding.role_name；原始数字SQL不经float重写，Decimal逐行多重集摘要保留精度/类型/重复行。

实际客户端为从官方源码构建的psql13.23及同版libpq。服务器为全新本机PG16.14；模拟RDS vector0.8.1.2具名目录元数据，底层扩展二进制是OSS0.8.2，不冒称RDS PG18/厂商向量二进制验证。目标RDS04成功属于用户实际回执，与此本机演练分层记录。

## 自动回归

13个新Python单元：高精度数字、JSON重复键/非有限数拒绝、类型/数组/重复行、精确字段映射、路径/符号链接、库/来源/角色/成员/完整列清单、原子marker、密码长度/区别、事务锁；两个挂起客户端验证总deadline覆盖不读stdin和不结束stdout。Python3.6语法检查三份生产脚本通过。

原00–04服务端5项、CLI9项、SQL生成及快照范围12项通过；合计39项自动测试。独立总评发现流式总超时和额外wait30秒问题，均最小修正：从Popen起唯一30分钟总限，超限kill/wait，状态需人工复核；不自动重试。

## 真实本机全量结果

具名容器rh-demo-restore-20261119-v2，仅127.0.0.1临时端口，有专用label，未更改旧容器/端口。源快照文件只读。私有证据在.tmp/manual-rds-researchhub-20261119/restore-validation-v2/receipt.json；不入库数据或口令到Git/Notion。

- 原00–04执行后，真实插入1行再主动抛指定异常：数据与dataLoaded标记均回滚；不是插入前失败替代事务验收。
- 新库真实导入98,565行；182表规范化全内容摘要相同；dataLoaded与数据原子提交。
- 原05/06完成并再次比对全内容：182业务表、179强制RLS、209策略、0无效索引。原3个NOT VALID CHECK保持，不擅自升级验证。
- post-data状态重复run只回读核验，不二次导入。错误数据库拒绝；故意篡改目标1字段会拒绝后续操作，账号仍NOLOGIN；本机故障注入后精确恢复该字段。
- 原07事务守门＋原生libpq SCRAM生成与角色启用通过；原13.23客户端使用两份新密码实际分别登录owner/app，身份正确。不是只看rolcanlogin。
- 7条identity序列逐项核max/last_value/is_called，空序列未调用，原identity值保留。两特殊角色仍NOLOGIN，临时成员关系0。
- 新本机aisci哨兵与vector.rabitq_info哨兵未变；临时PGPASS移除。此哨兵只存在新测试集群，不读取真实旧aisci。
- 新库203,037,719字节（约194MiB），全新本机实例WAL目录201,326,592字节（约192MiB），两者合计约386MiB。不能将其视为RDS精确峰值或现有实例WAL增量；本次RDS容量由用户确认总3GB/用1GB/余2GB，执行时由现有监控观察，不扩容。

首个v2完整恢复约28.39秒是本机测量，不承诺RDS耗时。最后总超时微修补后，已完成实际全内容verify-enabled回读，并验证启用后拒绝重新run。独立总评无残余阻断P1/P2；最终封包核脚本字节与测试版本一致，再执行包内check。

## 四层结果

代码实现及本机启用/真实执行/数据库结果通过；目标RDS目前仅结构阶段00–04已验证。数据导入、05–07、新账号目标连接、对象文件/后端/客户页面尚待现场，不以本机测试代签。此次不改页面，因此不制作与任务无关的浏览器/录屏验收。
