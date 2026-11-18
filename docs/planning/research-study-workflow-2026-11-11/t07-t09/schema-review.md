# T07–T09 canonical schema 独立预审

## 2026-11-12 · 当前证据更新（优先于下方历史快照）

T07 canonical forward SHA256 `340a95acc2f8b16d35e0b903685d0cbd3e9a25e07383e88e0aa7d4172ee726e4` 已在fixture guard受控合成库应用；rollback SHA256 `22ce9ba20f552725a5d33a0e079edfee137d5bd151d0c17a928da945a3adbb8c` 已独立静态复核，未执行回滚。七张旧业务表及Prisma历史前后指纹不变，response新字段均初值；三张新表为空，强制RLS、应用角色仅SELECT/INSERT并有双guard。[实际记录](../../../testing/evidence/research-t07-2026-11-12/migration.json)。正式响应共同核心PG仍未完成，暂勿重载，不代表T07–T09已启用或验收。

共享锁真实转版双向等待和拒绝无半写、批量锁及worker先项目锁后claim已有合成PG证据；原40P01失败保留。worker证据不是完整转版，也不能泛称全仓锁序已保证。T06 S03/S04已有真实角色与异常页面证据；未知结果超时错误解禁正修复，单元通过不代表运行时启用。

日期：2026-11-12。范围：checkpoint、最终 migration/rollback SQL、Prisma 的 FormResponse 与三个新增模型；只读审查实现，不执行 DDL、不重载服务、不回填历史。

## 审核对象与结论

| 对象 | SHA-256 | 静态结论 |
|---|---|---|
| `app/server/prisma/migrations/20261112020000_form_response_revision/migration.sql` | `340a95acc2f8b16d35e0b903685d0cbd3e9a25e07383e88e0aa7d4172ee726e4` | 未发现新增 DDL 阻断；与已审候选相比，锁指针 CHECK 明确防止 NULL 绕过 |
| 同目录 `rollback.sql` | `22ce9ba20f552725a5d33a0e079edfee137d5bd151d0c17a928da945a3adbb8c` | 增量复核通过：显式事务、前置排他锁及 row_security=off 已补，原阻断解除 |

当前这对精确 hash 的迁移工件无剩余静态阻断，可由主循环按下述范围在受保护 wp01 合成目标执行单一 canonical forward SQL。此结论仅为静态预审，不代表迁移已执行、真实 PG 已通过或业务验收完成。

## 原阻断与本次修复

旧 rollback（SHA `89cf42573f6c172e35b295b16a68afa26b8e731c280c42b87572e067ee8256df`）的 DO/EXISTS 在三个新增表 FORCE RLS 下可能只看到当前 scope，未设置 scope 时可能完全看不到数据；没有 BYPASSRLS 的表 owner 仍可能具有 DROP 权限，于是空表判断错误后删除隐藏历史。其检查与后续 ALTER/DROP 没有显式事务和排他锁，存在检查后插入的竞争窗口。该旧版本不得使用。

已逐行确认新版本采用同一事务 `BEGIN`；`SET LOCAL row_security=off`；在检查前按 response/revision/review/receipt 顺序取得 `ACCESS EXCLUSIVE`；全局检查三表为空且所有 response 的 version=0、current/locked 指针均空；执行退回 DDL；`COMMIT`。锁覆盖检查至提交，防止检查后并发写入。row_security=off 不绕过 FORCE RLS：执行身份若不能获得全局视图，查询报错并使整个事务拒绝；没有取消 FORCE/ENABLE RLS。静态修复满足 fail-closed 要求。尚未执行回滚测试，后续真实 PG 应覆盖非 BYPASSRLS 身份、其他 scope 留有记录、version 已推进，以及检查期间另一事务试图写入。

## 已核对边界

- 新表均启用并强制 tenant/group/project RLS；显式 REVOKE ALL FROM PUBLIC, aisci_app 后只授予 SELECT/INSERT，抵消既有 owner 默认 arwd。UPDATE/DELETE 另有不可变触发器。实际 ACL 与隔离仍需在目标 PG 断言。
- revision 强制 response/assignment/subject/enrollment/form 的同 scope 父链；visit 可空，有值时严格校验入组、协议和 scope。固定 protocol、approved policy ID/hash；previous 必须属于同 response，并在响应行锁内核对当前指针与连续修订号。
- review 沿固定 revision 的政策版本与哈希；receipt 对 account 验 tenant、对 H5 session 验 scope 与 assignment，具有 actorKind/actorId/requestKey 唯一性与不可变保护。当前权限、session 有效性、请求内容 hash 和重放隐私仍属于共同服务核心责任，不能以 SQL 父链替代。
- lockedRevisionId 非空时 currentRevisionId 必须非空且两者相等；复合 FK 保证当前/锁定引用属于本 response。单调推进、answers/score/status 同事务投影、CAS、计分可复核仍需服务审查和真实竞争测试。
- Prisma 字段类型、nullable、表名及唯一键与本次 SQL 对应；父链 FK、CHECK、触发器由 canonical SQL 明确维护。禁止用 db push 或自动差异迁移移除这些约束。
- forward SQL 没有 UPDATE/历史回填；只给旧 response 增加空引用和初始 version=0，未重写旧答案、分数、提交者或提交时间。旧 submitted 无 revision 继续是 legacy_unversioned，不等于生成可审阅历史。
- project/protocol 前置共享锁方案已进入实施契约，但本轮没有终审服务代码，也没有执行转版与采集双事务测试；不能将锁序设计描述当成运行验证。

## 放行后的范围

本次允许的仅是由主循环在已核验的 wp01 合成目标、事务和 guard 下执行这一份 canonical migration.sql；记录精确 hash、fixture_run、旧列前后指纹、实际 ACL/RLS。不运行 migrate deploy/db push，不写 Prisma 历史，不动生产，不启动新服务。本审查没有授权实际回滚或任何历史数据删除。迁移执行证据、真实现场/H5请求、T08/T09审阅更正锁定与专业用户结果分别验收。
