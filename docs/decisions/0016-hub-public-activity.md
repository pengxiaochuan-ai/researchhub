# ADR-0016 · Hub公开领域动态首次公开证据索引

本机实施回执：按原精确SHA在`wp01_test_full_baseline`先回滚演练，再安装两表与最小授权，回填4条F03原生公开版本证据。已实测发布生命周期及跨Hub读取隔离。下方未执行描述为候选准备阶段，正式发布和其他类别事件桥接仍待验。

状态：**Proposed**。日期：2026-11-23。用户已确认六类动态方向、首次公开/身份规格及继续实施；数据库SQL执行仍按规格单独核准。本ADR与SQL为可审查候选，不表示已建表、已授权或已启用。

## 背景与决定

采用[Hub公开领域动态规格](../product/hub-public-activity-spec-2026-11-23.md)的两个独立条件：首次公开日期要有完整生效证据，是否交付要重新核对当前公开状态。现有批准时间、首次内部发布时间、观察时间及当前目录head均不足以自动证明全部历史首次公开。不能以一次页面读取或批量迁移时间冒充新增日。

建议新增Hub-owned schema `rh_hub_activity`，仅两表：

- `evidence`：按scope、类别、稳定身份和内容摘要唯一的追加式时间证据；`verified`必须有明确首次公开时间，`historical_undated`必须无日期。证据引用与规则版本保留，禁止UPDATE/DELETE。
- `first_public`：同scope/类别/身份仅一行，指向一条证据并复制该条最小时间字段；数据库触发器保证证据匹配。unknown可以变为有证日期；已有日期只能在更早证据支持下前移，不能后移或清空。撤下不删除证据，恢复不产生新首次日期。

这里没有公开状态或公开正文快照。公共动态仍须查询原当前有效公开投影并与索引匹配，索引记录不授予资料访问权限。别名归并不在本切片增设自动合并接口；沿原资料治理给定的规范身份写入，后续身份修正需要独立可审计证据，不能改键绕唯一约束。

## 权限和调用边界

候选SQL启用并强制RLS，scope同时绑定事务的tenant/Hub且核对Hub与租户active。`aisci_app`只获schema USAGE、first_public SELECT及两项无副作用RLS helper EXECUTE；不获evidence SELECT、任一表DML或跨scope权限。原source/directory/academic/public结构和授权不变。

写入只允许表所属migration owner，在受限的可信服务器事务中使用`recordFirstPublicFact(db, scope, fact)`；不是客户端可自报一个GUC后取得写权。暂无HTTP写路由、SECURITY DEFINER写入函数或启动迁移。该writer并不证明传入事实是真的；调用方必须在同一已授权业务事务/可信历史回填中建立全部资格和事件引用。

F03先接入原发布事务，读取同租户同Hub同内容的最早公开版本作为证据。候选库未装表时，原版本历史继续持久记录，并可在安装后回填；已装表时写入失败须整笔回滚。其他五类正常app审批事务仍无写权，尚需核定批准、来源就绪和领域纳入的可信事件接点。读取时间不充当公开时间。

## 候选接口

`readExistingFacts(db,{tenantId,hubKey})`返回`category,entityKey,firstPublicAt,timeStatus,proofRefs,ruleVersion`。调用前验证事务scope一致；无表错误原样传播，由外层预检/错误映射明确标记未启用，不能吞成空集合。

`recordFirstPublicFact(db,scope,fact,{observedAt})`参数化写入证据及索引，必须使用调用方已打开的可信事务。`observedAt`默认可信服务器当前时间，仅表示观察；首次日期从不默认采用它。证据幂等摘要不含观察时间，重复事件消费不造一份新证据；唯一约束与ON CONFLICT负责并发主键保护。更早历史证据可修正first_public，原证据仍保存。

## 精确SQL及迁移前置清单

候选文件：`server/hub-activity/schema.sql`，SHA-256：`290626b714b16d60c7463a57f1da6c07183e00ab7a668eeabfa1d46f5531492e`。该hash只覆盖候选SQL原字节；修改SQL后必须重算并重审，不准静默沿用批准。

新增对象为两表、一个日期索引、三个无SECURITY DEFINER函数、三项RLS策略及两个历史保护触发器。精确授权对象见SQL末尾；未在任何数据库执行。

执行前必须形成并核准以下实际值，不得把当前工作目录视为目标证明：

1. 目标仅本机既有开发库（历史使用`wp01_test_full_baseline`，执行前重新从原19501/19502受信配置核验），实际数据库名/marker摘要、migration owner及app角色、tenant/Hub和服务归属；不读取生产连接，不复制密钥到文档。
2. 以只读事务核对current_database/current_user/marker、目标Hub active、catalog中schema不存在、当前无不兼容半装对象。若schema已存在，不用IF NOT EXISTS跳过；必须比对全量列/约束/RLS/grants/函数/索引指纹和原迁移回执，不匹配即停。
3. 保存迁移前schema指纹、账号/角色/来源审核、既有任务状态和预算账本保护摘要；单独列出可回填/日期不明/身份冲突的具名清单。执行SQL不同时盲目执行回填，回填内容、数量、证据另列审查。
4. 核准确切SQL SHA及目标后，使用原支持迁移连接，在单一事务中设置有限lock/statement timeout、取本功能迁移advisory锁、再查catalog为空后逐`-- statement`执行。安装过程中失败整事务回滚，不启动新环境、不放宽旧策略。
5. 安装后在同一事务核全对象/约束/RLS/授权指纹，保存受审迁移回执。用app与owner分别验证本scope读、跨tenant/Hub拒绝、app DML及raw evidence拒绝、重复及并发写、证据不匹配、已知日期后移和DELETE拒绝。并发验收只用具名新合成事实及可回滚事务，不修改旧资料或账号。
6. 迁移实测完成后，模块指纹加入正式受控装配；共享重载另确认当前窗口。schema落地、业务事件接线、真实HTTP/页面结果分别记录，不能相互替代。

## 回退和替代方案

安装失败回退依赖原子事务ROLLBACK。安装成功但运行接线不满足条件时，回退应用接线并保留新增表与证据，返回明确不可用；不执行DROP/TRUNCATE/DELETE销毁已生成历史。实际数据清理另行审查，不能称为普通回滚步骤。

替代方案“只在读时取min(approve.created_at)”无法覆盖来源就绪、领域纳入和内部转公开；“首见即今天新增”会把全部存量伪装为新增，均不采用。只读历史适配可先交付已证明的子集，但日期未知及集合不完整必须显式标记，不能据此宣布六类首次公开完整。

## 当前验证状态

已完成8项纯契约测试（先运行缺模块RED，再落代码GREEN）：日期/unknown分离、六类及scope、证据输入、hash幂等、日期不后移、读scope/缺表错误、写前scope拒绝及参数化写入；`node --check`通过。尚未执行任何DDL/GRANT、数据库读写、模型、重载、生产或新fixture；PG并发、RLS及迁移验收未测，未来事件桥接待实施。
