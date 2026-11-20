# 04空库判断兼容RDS向量扩展元数据

用户现场00/01/02/03已成功，04在DDL之前报MANUAL_TARGET_NOT_EMPTY。只读目录已确认researchhub marker=initialized，唯一普通表为vector.rabitq_info，persistence=p、owner=aisci_control、直接属于vector扩展0.8.1.2。不是Hub业务表；不删除它、不重建库/角色、不重新运行all。

## 最小修正

仅04的空库判断允许这一具名对象，同时要求schema、表名、持久表（关系类型仍按原检查的r/p范围）、owner、pg_depend直接扩展成员关系、扩展名/版本与public安装schema均匹配。其余任何表（包括vector schema中的其他表、同名但非扩展成员、owner/版本不符）仍拒绝。保持库名、owner、marker/source SHA、角色、SQL事务与原DDL不变；vector schema不计入原public/rh_*的182表统计。

不修改03或已完成步骤，不向旧aisci执行SQL；不放开整个vector schema或所有扩展表。由生成器产出新04及准确manifest/SHA，不让用户手动编辑校验值。新包仅从04续行，05–07仍等待已批准数据恢复。

## 验证顺序

先写失败测试；在新本机合成PG模拟RDS扩展成员元数据，复现旧guard拒绝；验证正确对象通过，未知表/假同名/错误owner/版本/其他扩展成员拒绝。执行完整新04，核182表/4NOLOGIN/临时成员0及元数据哨兵保持；用真实13.23客户端，包校验和角色/marker守门保持。模拟扩展版本/对象的测试不称为真实RDS二进制验证。

已实现并通过8项构建器规则、5项执行器规则、9项CLI和4项快照回归，共26项。真实13.23客户端在新本机合成PG完成14组：00–03、旧04错误复现、8种反例和新04完整成功。最终182张Hub表、4角色NOLOGIN、临时成员0，扩展元数据哨兵和隔离旧库哨兵摘要相同。

8种反例为：public未知表、vector其他扩展成员、同名非成员、错误owner、unlogged持久性、错误扩展、错误版本、错误扩展namespace；均仍MANUAL_TARGET_NOT_EMPTY，事务结束元数据保持。NOT COALESCE确保未知/NULL不成为例外。

本机PG16.14/OSS vector0.8.2二进制；只在新容器添加测试用0.8.1.2安装脚本别名及模拟元数据成员，原生产SQL实际经13.23客户端执行。不是RDS供应商二进制验证；生产PG18/主机/5432/权限守门未改，只有测试驱动适配loopback随机端口/PG16。本机与真实RDS续行验收分开。

私有证据：.tmp/manual-rds-researchhub-20261119/rabitq-guard-validation/receipt.json；不得把模拟表当生产对象来源。生产对象依据为本轮用户只读目录回执。未知业务对象仍拒绝，不删除/重命名任何生产表。

## 服务器只续04

使用researchhub-rds-04-rabitq-20261119.zip新目录researchhub-rds-04-rabitq。先sha256sum -c SHA256SUMS，再python3 run-server.py 04 --allow-vpc-demo-non-tls。不重跑00–03/all，不重建数据库/角色或修改旧包校验；用户既有VPC部署方式批准继续有效。

新包仅04的空库判断有SQL差异，其他7份SQL和执行器字节不变，sourceSchemaSha256仍为同一冻结来源；清单完整重生成。成功应为tables=182、00-04-complete-stop-before-data；此时仍需恢复已核准演示数据并执行05–07，不称完整数据库/应用已交付。

用户真实RDS04续行结果待反馈；不触碰旧服务，不新增权限/费用或加密前置。
