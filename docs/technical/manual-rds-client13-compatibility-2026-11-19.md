## 2026-11-19 · 本次既有连接方式已获明确确认

用户明确要求沿用既有部署方式，不再把其他连接加密事项作为本次部署前置，优先核验目标库、账号权限和旧数据保护。该确认授权本次独立演示库沿用ECS→RDS既有VPC私网非TLS连接；原G0/researchhub及4角色范围继续有效。当前包无需修改或重下，使用python3 run-server.py all --allow-vpc-demo-non-tls，先00只读，再顺序01–04，失败即停；不修改旧aisci业务数据、旧服务、SSL或公网。成功182表/pre-data-complete仅表示结构阶段完成，尚需恢复已核准的演示数据、05–07和目标业务验收。既有容量与恢复前置按原操作说明由操作者核实，不另起加密改造。

## 2026-11-19 · 现场00定位为端点SSL拒绝

用户提供最新00-preflight日志：psql: error: server does not support SSL, but SSL was required。已定位当前RDS连接端点不支持SSL，与执行器require冲突；本次失败发生在SQL发送前，不能据此判断口令或建库权限。原G0/researchhub及4角色授权持续有效，当前仅待确认本次合成演示00–04的VPC私网非TLS例外（链路不加密）；不自动改SSL、开放公网或执行all。批准后先只读00，不先建库；容量等原写入前置仍保留。执行包/SQL/代码未改。

## 2026-11-19 · 用户现场check通过

用户反馈修正版在aisci-prod执行check=ok：实际Python3.6.8、clientMajor=13，成功读取/srv/aisci/ops/.env.prod并通过包/配置校验；原配置sslmode=disable，执行模式require，databaseConnected=false。这证实现场客户端/本地配置检查通过，不证明RDS连通、口令有效、DDL权限或PG18业务能力。没有本轮SQL执行记录，原失败保留；非TLS例外尚未批准；下一步可先以默认require执行00只读复核，不自动运行all，连接失败则停，不自行关闭加密。

# 既有psql13.23客户端兼容核对

用户在生产服务器执行check返回PSQL_16_OR_NEWER_REQUIRED，已确认真实版本psql(PostgreSQL)13.23；包SHA全部通过，执行器当时尚未读DIRECT_URL/连接RDS。原>=16门槛依据此前本机PG16验证，不是本包SQL的已知客户端硬依赖。

本轮只核本机真实13.23兼容性并修独立执行器；不安装或升级服务器客户端/数据库，不改旧系统/官网/角色权限，不访问生产、不降低TLS/PG18/host/库/包/阶段边界。不能让用户手改版本判断或manifest求通过。

## 证据与实现顺序

1. 查PG13官方psql、libpq环境/PGPASS文件文档。本包-X、-qAt、ON_ERROR_STOP、stdin分语句、--no-password、PGPASSFILE和PGSSLMODE在13存在；本包无psql目录反斜线命令，服务端DDL仍由目标PG18执行。官方不保证所有跨主版本情况，必须真实验证。
2. DockerHub客户端镜像下载网络超时，改从官方ftp.postgresql.org取13.23源码并校验官方SHA256：6ec3c82726af92b7dec873fa1cdf881eca92a4219787dfad05acb6b10e041fd6。仅本机私有目录编译psql及同版libpq，启用OpenSSL；不分发此本机二进制，不恢复PG13数据库服务。
3. 先补13.23接受与13.22/12/未知输出拒绝测试，再调整客户端检查。真实13.23执行00–04、TLS与SCRAM/PGPASS转义、UTF8、失败回滚/恢复及原守门通过后才生成新包；8份SQL原字节保持。
4. 用户已存在13.23是本包限定手动操作对象，允许版本边界由实测确定；不把临时客户端兼容当作PG13通用长期支持、dump/restore兼容或目标RDS验收。目标真实PG18/供应商扩展权限仍现场验证；非TLS例外仍未批。

## 当前结果

已用官方源码构建的真实psql13.23＋同版libpq验证通过，libpq链接OpenSSL3；不只依赖版本Mock。

- 9组实际流程：默认check无连接；错误密码拒绝；真实非TLS连接被require守门拒绝；all的02失败；02、03明确恢复；04事务失败回滚；04重做成功；完成后all拒绝。执行器真实TLS元数据8次ssl=true。
- 新本机PG16.14/vector0.8.2，SCRAM存储与错误密码反例通过；真实密码含冒号/反斜线/UTF8，PGPASS匹配、PG变量隔离、.psqlrc忽略和凭据清理通过。
- 最终182表、4NOLOGIN、临时成员0，新建aisci哨兵摘要不变。只连接postgres/researchhub；主机原5432已有SSH监听，未触碰，测试容器仅绑定127.0.0.1随机端口。
- 测试驱动仅本机适配loopback/随机端口、期望PG16和向量0.8.2及03扩展版本；正式代码未放开生产PG18、host/5432或扩展期望。不把本机结果称为RDS18.3/供应商扩展已验收。

修正仅客户端白名单：新接受精确13.23，保留原16+策略；13.22、13.24、12、14/15等未核老版本仍拒绝，无法识别的输出单列PSQL_VERSION_UNRECOGNIZED。check成功clientMajor=13；其他门禁和8份SQL保持。兼容限定本包00–04，不授权旧pg_dump/pg_restore处理新版本库，也不等于PG13通用长期支持。

5项规则＋9项假客户端CLI、11项原构建/快照回归通过；真实9组证据在.tmp/manual-rds-researchhub-20261119/psql13-validation/receipt.json，源码/编译日志仅本机。不分发本机编译二进制。

首次build因生成头文件并行依赖失败，先make generated-headers后编译成功；本机internal Docker网络未发布端口，改为只绑定loopback随机端口的新测试容器；失败尝试保留，不改旧Docker或服务配置。

依据：[PG13 psql](https://www.postgresql.org/docs/13/app-psql.html)、[环境变量](https://www.postgresql.org/docs/13/libpq-envars.html)、[PGPASS文件](https://www.postgresql.org/docs/13/libpq-pgpass.html)。
