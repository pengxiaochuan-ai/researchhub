## 2026-11-19 · 当前仅续04（00–03已完成）

用户真实RDS的00–03已成功；04误把vector扩展自动创建的vector.rabitq_info当作已有业务表。只读回执确认marker=initialized、唯一表为该具名持久对象、owner=aisci_control、直接属vector0.8.1.2。现仅04空库判断精确允许此对象，未知表仍拒绝；不删表，不重建库/角色，不重跑all/03。26项规则/CLI及真实13.23的14组本机模拟元数据流程通过，182业务表/4NOLOGIN/成员0与元数据哨兵均保持；模拟测试不冒称RDS二进制验收。修正版新目录researchhub-rds-04-rabitq先验SHA，再python3 run-server.py 04 --allow-vpc-demo-non-tls。实际RDS04结果待用户反馈，其他7份SQL和执行器保持。

[当前修正包与说明](manual-rds-vector-metadata-2026-11-19.md)。以下all顺序仅作首次安装参考，当前现场不要重复执行。

## 2026-11-19 · 已明确沿用既有VPC连接，直接推进部署

用户明确要求沿用既有部署方式，不再把其他连接加密事项作为本次部署前置，优先核验目标库、账号权限和旧数据保护。该确认授权本次独立演示库沿用ECS→RDS既有VPC私网非TLS连接；原G0/researchhub及4角色范围继续有效。当前包无需修改或重下，使用python3 run-server.py all --allow-vpc-demo-non-tls，先00只读，再顺序01–04，失败即停；不修改旧aisci业务数据、旧服务、SSL或公网。成功182表/pre-data-complete仅表示结构阶段完成，尚需恢复已核准的演示数据、05–07和目标业务验收。既有容量与恢复前置按原操作说明由操作者核实，不另起加密改造。

# 生产服务器手动执行00–04

2026-11-19。用户已要求补齐服务器执行脚本；本轮仅生成、测试和交付，不在ECS/RDS远程执行。脚本不安装客户端、不拉镜像、不改旧配置、不启动或停止旧服务，不执行05–07或切换入口。

## 2026-11-19 · 现有13.23客户端兼容修正

用户现场已确认psql13.23，原>=16检查在任何DB连接前拒绝。现已真实编译同版客户端验证SSL/SCRAM/PGPASS及9组00–04正反流程通过，只新增接受13.23，其他未核老版本仍拒绝；不是要求升级或重启服务器。修正版包为researchhub-rds-server-psql13-20261119.zip，解压进入researchhub-rds-server-psql13后先check；原包/失败记录保留。实际执行前TLS/例外仍需核准。详见[兼容证据](manual-rds-client13-compatibility-2026-11-19.md)。

## 交付与最短操作

新版私有包：`/Users/mac/aisciencesys/researchhub/.tmp/manual-rds-researchhub-20261119/researchhub-rds-server-psql13-20261119.zip`。含原8份SQL、新run-server.py、说明与SHA清单，不含数据/文件/密码。原8份SQL保持前轮已核字节，不使用公开仓库的未展开SQL模板。

请把ZIP上传服务器的独立目录，解压后进入其中的researchhub-rds-server-psql13目录。使用有权读取旧配置的运维身份执行（必要时sudo）；不修改旧文件权限、不把.env内容发聊天。

```bash
umask 077
cd /你解压后的目录/researchhub-rds-server-psql13
sha256sum -c SHA256SUMS
python3 run-server.py check
```

check是默认动作，省略check也相同：只核Python/psql/私有配置/执行包，不连接任何数据库，不写RDS。成功输出clientMajor、配置路径、源库名、实际允许的两个SQL库和SSL模式；不输出RDS地址、密码、完整DSN或.env。客户端缺失会明确PSQL_NOT_INSTALLED_NO_AUTOMATIC_INSTALL，不安装软件；若客户端已有但不在PATH，可指定`--psql /实际路径/psql`。

**当前建议先执行到check并反馈脱敏结果。旧RDS尚未提供TLS；脚本不会自动沿用旧配置的disable。**

具备获准的加密连接后，以同一运维身份执行：

```bash
python3 run-server.py all --allow-vpc-demo-non-tls
```

all默认强制require，不使用libpq的prefer降级。它依次执行00、01、02、03、04；02单独自动提交，其余保留原SQL事务。每步之前从postgres只读重核操作者、版本、四角色/成员、库owner和marker；任何一步失败立即停止、不自动重试。成功最终输出00-04-complete-stop-before-data、tables=182，**到此停下**，不启用数据库账号或应用。

### 现有VPC非TLS链路的单独选择

旧运维文档记录现有/srv/aisci/ops/.env.prod的DIRECT_URL为aisci_control、RDS私网5432、源aisci、sslmode=disable；此前远端只读探针严格TLS失败。参考旧配置不等于本次Hub演示获得非TLS例外，本轮没有自动作此决定，也不为开SSL重启共享RDS。

只有用户明确批准本次ECS→RDS VPC私网、仅合成演示、无公网/临床数据的非TLS连接后，人工执行才可额外加`--allow-vpc-demo-non-tls`。脚本已提供此显式选项，当前不默认使用，不把check通过当作该例外已获批。

## 配置与凭据边界

- Python3.6+标准库；调用已验证的psql13.23或原16+客户端，不假称RDS服务端18.3就是客户端版本。Python3.6语法检查已通过，目标运行仍需现场check。
- 默认只读`/srv/aisci/ops/.env.prod`，仅解析唯一DIRECT_URL，不source/eval，不执行其中的shell表达式，不导出整份旧配置。配置必须是运维身份可读的私有普通文件，不接受符号链接或组/其他用户可读权限。
- 固定核原RDS主机SHA、5432、aisci_control与原配置源库aisci。主机不符/配置漂移停止，不改为任意host；生产CLI不提供绕过主机、版本或库绑定的选项。主机迁移时需重新核对，不改hash求通过。
- **只复用连接位置和当前获准运维身份，不复用目标库名**。实际psql只连接postgres/researchhub，不能向aisci执行这些SQL。默认读取路径可用`--config /已核准的私有配置路径`明确指定，仍保留相同目标与身份绑定。
- 子进程仅保留PATH/HOME/语言等必要环境，清除所有继承PG*及DIRECT_URL等变量，防PGSERVICE、PGDATABASE、PGOPTIONS、PGPASSWORD暗中改变连接/权限。-X不加载.psqlrc，ON_ERROR_STOP=1，连接超时10秒。
- 密码只存在内存和本轮临时0600 PGPASSFILE；文件目录0700，仅列postgres/researchhub两条匹配项，正确转义冒号和反斜线。密码不进入命令参数、标准输出或回执；退出、失败或可捕获中断时清理临时文件。SIGKILL/断电不能保证清理，重启后不要打包.server-run目录，它可能残留敏感临时文件，应先按准确目录核对处理。
- 输出仅阶段、错误代码和日志路径，详细psql输出保存在包内.server-run的0600日志，密码精确脱敏；不上传Git/Notion。日志目录须当前运维身份所有且0700，同一包用flock拒绝并发；不要复制多包并发执行。

## 每步前置与恢复

| 动作 | 执行前置／结果 |
| --- | --- |
| check | 不连接数据库，验证包、客户端和私有配置 |
| 00、01 | researchhub和4个新角色均不存在；操作者必须是aisci_control且具备建库/建角色能力 |
| 02 | 四角色必须存在、NOLOGIN/非超级用户/无建库建角色和非预期继承，只有owner可BYPASS；操作者可SET，角色本身不得新增成员关系；目标库不存在 |
| 03 | 同上且researchhub的owner正确、尚无marker；原03还在新库事务内检查空库/扩展/角色 |
| 04 | 同上且marker purpose/合成标识/源SHA/initialized准确；原04在事务内再次核库/owner/阶段与空库 |
| 结束 | 只读复核researchhub、操作者、182表、vector0.8.1.2和pre-data-complete；仍不执行数据恢复 |

例如02失败后：先看错误与.server-run日志，不重复all；确认真实库尚未创建且01已成功后，指定单步：

```bash
python3 run-server.py 02
python3 run-server.py 03
python3 run-server.py 04
```

一次执行一行，上一行非零立即停。单步也会重核真实状态，不仅依赖本地回执。若采用已获批非TLS例外，每次单步都必须带同一显式选项。

SQL可能已经提交但客户端未收到结果时，本地记录不代表成功或失败；先读真实marker/owner/角色/对象状态再决定下一步。不要重跑CREATE、DROP、改守门或自行跳过阶段。04事务失败正常回滚后应仍为initialized、0业务表，才可重新执行04；若已为pre-data-complete，禁止重跑04，转演示数据恢复。

任何权限、连接、TLS、版本、哈希或未知对象问题均停止；不自动授权、改旧账号、升级客户端、调整RDS、开放公网或启动旧Worker。详细SQL及原3个NOT VALID CHECK边界仍见[原手动说明](manual-rds-setup-2026-11-19.md)。

## 实施与验证

采用标准库执行器复用SQL，避免shell source配置和重写建表逻辑。先写配置、凭据、状态拒绝测试，再加CLI、包集成与隔离PG；按当前目录串行实施＋独立只读复核。

已通过5项规则＋9项假客户端CLI测试：check不连接、不执行配置表达式、密码不进argv、环境隔离、私有文件清理、失败即停/显式恢复、包损坏/缺客户端/05拒绝和同包并发。原SQL构建器7项＋快照4项回归通过。

无网络无宿主端口的新本机PG实际跑通8组流程：check、默认require拒绝本地非TLS、all在02模拟中断、02/03明确继续、04事务内错误回滚、04成功和完成后拒绝从头all。最终182表、4角色NOLOGIN、临时成员0；独立哨兵aisci的合成行摘要不变，仅对postgres/researchhub发出执行器SQL。

本机缓存PG16.14/vector0.8.2，测试驱动仅在本机替换期望host/PG/vector及03扩展版本，并用本机超级运维角色模拟RDS供应商建BYPASS/扩展能力；生产脚本没有这些测试绕过选项。Python3.6语法检查通过，不声称已经在目标Python3.6进程、RDS18.3/vector0.8.1.2或生产账号实际执行。没有页面变更，不宣称浏览器/客户专业验收。

私有证据：.tmp/manual-rds-researchhub-20261119/server-runner-rehearsal/receipt.json及脱敏阶段日志；不含生产连接。更多结果见[验证记录](../testing/manual-rds-server-runner-2026-11-19.md)。
