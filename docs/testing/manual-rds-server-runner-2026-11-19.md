## 2026-11-19 · 真实RDS元数据误拦与修正实证

用户真实RDS的00–03已成功；04误把vector扩展自动创建的vector.rabitq_info当作已有业务表。只读回执确认marker=initialized、唯一表为该具名持久对象、owner=aisci_control、直接属vector0.8.1.2。现仅04空库判断精确允许此对象，未知表仍拒绝；不删表，不重建库/角色，不重跑all/03。26项规则/CLI及真实13.23的14组本机模拟元数据流程通过，182业务表/4NOLOGIN/成员0与元数据哨兵均保持；模拟测试不冒称RDS二进制验收。修正版新目录researchhub-rds-04-rabitq先验SHA，再python3 run-server.py 04 --allow-vpc-demo-non-tls。实际RDS04结果待用户反馈，其他7份SQL和执行器保持。

新本机14组明细及RDS回执依据见[专项](../technical/manual-rds-vector-metadata-2026-11-19.md)。本次Agent未远程操作，旧库临床业务行未读取，已交付旧包不改写。

## 2026-11-19 · 连接方式确认完成，待现场00–04结果

用户明确要求沿用既有部署方式，不再把其他连接加密事项作为本次部署前置，优先核验目标库、账号权限和旧数据保护。该确认授权本次独立演示库沿用ECS→RDS既有VPC私网非TLS连接；原G0/researchhub及4角色范围继续有效。当前包无需修改或重下，使用python3 run-server.py all --allow-vpc-demo-non-tls，先00只读，再顺序01–04，失败即停；不修改旧aisci业务数据、旧服务、SSL或公网。成功182表/pre-data-complete仅表示结构阶段完成，尚需恢复已核准的演示数据、05–07和目标业务验收。既有容量与恢复前置按原操作说明由操作者核实，不另起加密改造。

## 2026-11-19 · 现场00的SSL拒绝证据

用户提供最新00-preflight日志：psql: error: server does not support SSL, but SSL was required。已定位当前RDS连接端点不支持SSL，与执行器require冲突；本次失败发生在SQL发送前，不能据此判断口令或建库权限。原G0/researchhub及4角色授权持续有效，当前仅待确认本次合成演示00–04的VPC私网非TLS例外（链路不加密）；不自动改SSL、开放公网或执行all。批准后先只读00，不先建库；容量等原写入前置仍保留。执行包/SQL/代码未改。

## 2026-11-19 · 用户现场修正版check成功（无DB连接）

用户提供生产控制台结果：check=ok、python=3.6.8、clientMajor=13、sourceConfig=/srv/aisci/ops/.env.prod、sourceDatabase=aisci、sqlDatabases=[postgres,researchhub]、configuredSslMode=disable、executionSslMode=require、databaseConnected=false。此为用户现场回执，Agent没有远程连接。现场Python/客户端/包与私有配置检查已通过；不代表数据库认证、SSL/网络或生产DDL/角色已验证。00–04、文件/行数据及客户页面仍未执行验收，旧非TLS配置不自动成为本次例外批准。原失败和本机测试按下方保留；私有摘要见server-check-user-20261119.json，未改变已交付ZIP或SHA。

## 2026-11-19 · 13.23现场失败与修正版复验

用户现场包SHA全部通过，check报PSQL_16_OR_NEWER_REQUIRED；已确认客户端13.23，当时未连接RDS。新增精确13.23接受规则，5规则＋9假CLI和11原规则通过。真实官方13.23＋同版libpq/OpenSSL另完成9组，含SCRAM错密、TLS正/反、PGPASS特殊字符、UTF8、02/04失败恢复与182表。原生产PG18/host/TLS/权限未放宽，8SQL不变，未安装生产软件或远端执行。[详细证据](../technical/manual-rds-client13-compatibility-2026-11-19.md)。下方原16客户端验证保留为历史，不把它充当13实测。

# 服务器00–04执行器验证

2026-11-19。对应[操作与设计](../technical/manual-rds-server-runner-2026-11-19.md)。本轮无远端连接/DDL、无旧服务操作、模型/邮件/费用或页面变更。

## 证据

1. deploy/manual-rds-server.test.py：5项，精确配置/host/角色/库/文件权限；URL密码解码及PGPASS转义；PG变量清理；argv无密码；状态/TLS/版本/包拒绝。
2. deploy/manual-rds-server-cli.test.py：8项，默认check无连接、不执行配置表达式；all只到04；02失败不重试或继续，02→03→04显式恢复；重复all拒绝；SQL篡改、锁占用、05、缺客户端及非法manifest拒绝；私有日志脱敏及临时密码清理。假客户端只证明控制合同，不作为SQL实际执行证据。
3. 原构建器7项＋快照4项回归，无失败/跳过。Python3.6 grammar解析通过；不等同目标Python3.6运行证据。
4. 新容器rh-server-runner-20261119，network=none，无宿主端口。新aisci合成哨兵库仅在该隔离容器建立，非原aisci。8组实际流程保存在私有receipt.json：check、TLS反例、all中断02、02续行、03、04事务失败、04重做成功、完成后all拒绝。SQL调用只到postgres/researchhub；最终182表、四角色NOLOGIN、临时角色成员0，哨兵原行摘要相同。
5. 本机PG16.14/vector0.8.2；只在私有测试驱动覆盖host、server major和vector期望，并改测试包03的扩展版本/对应SHA。生产脚本不提供host/major/vector绕过。供应商角色和扩展安装用本机超级运维身份模拟，不能证明RDS账号具有对应能力。上一轮已实际验证过结构阶段的非超级用户SET ROLE权限，本次保留其证据、不重置旧环境。

## 独立评审与交付门槛

执行器静态独立复核未发现新增P1/P2，确认默认不连接、凭据与目标隔离、逐步live状态及仅00–04范围；建议把脚本本身纳入包manifest，已接入。最终文档、测试及包字节核对已完成。失败恢复必须以服务端真实状态为准，不盲信本地回执。

新版包SQL8份必须与上一轮package-final逐份SHA相同；脚本、服务器说明、manifest与SHA清单新增，未覆写旧ZIP。最终新包已生成：8份SQL与旧包逐字节一致，run-server.py与已测试源码一致，脚本本身及说明均纳入manifest。最终独立新容器再次跑通8组流程，证据另存server-runner-final-rehearsal/receipt.json；两次隔离演练均无旧服务或远端操作。

## 尚未执行

生产客户端的版本/存在性、Python3.6实际运行、RDS18.3/向量0.8.1.2、角色权限、TLS和DMS/服务器环境尚未完成本轮验收。源旧配置disable不是本次Hub非TLS批准；默认require，无自动降级。先由用户执行check，无DB连接；真实00–04、数据/文件恢复、05–07及客户页面另验。
