# T04 最终代码审查（2026-11-11）

结论：**本次 T04 源码范围无未解决的 blocking 问题。** 已复核此前发现的跨 Study 回执读取、未知 requirement kind 错误边界，以及最后一轮 UI 失权残留修复。可以继续完成 T04 浏览器验收、产品文档同步并推进既定 T05；这不是 T05 已完成、生产放行或专业用户签收。

本评审只读源码与已有执行证据，仅写本文件；没有执行 DDL、启动服务、修改角色、调用模型或发送邮件。共享工作区还有其他修改，本结论不覆盖全部 dirty diff。最终 UI 异常路径的浏览器验证由主循环/UI 实施者留证，不能以本次静态审查代替。

## 1. 复核范围与结论

| 范围 | 实际核对 | 结论 |
| --- | --- | --- |
| Prisma / canonical migration | `app/server/prisma/schema.prisma` 中 VisitPlan 的 anchor 与三个整数列可空；唯一新增 migration 只移除这四列 NOT NULL 和三个数字 default，无旧值 UPDATE。rollback 在事务内取排他表锁、检查 NULL 后恢复，存在 NULL 时拒绝回滚，不造 0 | 与“未确认≠0”契约一致 |
| 旧服务 nullable 影响 | `study-operations-policy.ts` 日期计算拒绝不完整参数；`study-operations.service.ts` 的入组、启用/替换旧版本前检查、approved/executing 流转检查及事务内重查；完整计划缺锚点事件仍保留既有 pending_anchor 语义 | 未发现本次 nullable 变更新增的发布、入组或日期默认旁路 |
| 发布指纹与锁 | `protocol-release-policy.ts` 时间点完整性纳入四字段，sourceHash 包含 anchor/event key/三个数值；旧 transition 在同事务 CAS 更新锁定目标版本后重查时间配置、审计；存在已检查 findings 时再核对当前事实 | 对 T04 新增 NULL 和并发修改风险的守门已补；完整 T05 发布规则仍单列 |
| 旧核心复用 | Hub 初建调用 `createProtocolVersionInTransaction`；旧初建及追加 VisitPlan 保存完整 requirements；旧调用者省略数字的既有兼容逻辑保留，Hub 明确发送 NULL；无第二套 Protocol/VisitPlan 内核 | 满足复用边界 |
| 事务与权限 | `server/research-execution/protocols.mjs` 使用现有 Study 事务，事务内 feature 守门覆盖所有角色；有效 tenant_admin 与精确 Hub+组 owner 保留 configure；普通项目管理者还检查有效组角色 `study.configure`，父层工作台/项目范围检查继续有效 | 未把 Hub owner 冒充 PI；未新增 approve/collect/unblind 授权 |
| 固定引用 | 候选只读查询适用的已发布/锁定 FormVersion、已发布 ScaleVersion/OutcomeDefinition，不触发旧内置模板初始化；保存验证当前范围与状态。旧现场/H5 表单满足判定有固定 ID 时优先固定 ID；量表要求有固定 scaleVersionId 时优先它 | 不会因同模板 key / scale code 自动满足另一固定版本 |
| 幂等 / CAS / 子项 | actor/request 锁；更新先锁目标并验证完整 Study 父链，再 replay；合法历史回执先于当前 CAS/草稿状态检查。新操作检查完整配置 revision、子项所属/重复、已有关联事实；配置、审计、回执同事务 | 跨 Study 回执漏洞已修；合法超时重试保持原结果 |
| 输入边界 | requirement kind 限定实际数据库支持的七种：scale、form_response、profile_field、modality_file、procedure、sample、confirmation；未知 kind 返回 400；严格引用和数值校验保留 NULL、0、false 差异 | 不再把未知 kind 送至数据库后报 503 |
| UI 身份与权限 | `FormalPreparation.jsx` 读取前核对 `/auth/me`；焦点/可见性及定时探测；未确认权限时不能写。用户变化使请求 epoch 失效、清本账号 pending、数据与 draft；read/write token 防止旧 finally 清除新操作标志 | 源码无跨身份迟到结果写回路径 |
| UI 失权内容清除 | 401/403/404 回调和 `/auth/me` 身份不符分支均清 data/latest/draft；统一 client epoch 阻止已发出的配置/冲突读取回流 | 最后一轮残留 header / latest 内容问题已修 |
| UI 指定版本与恢复 | 显式 protocolId 不存在时明确缺失、不回退到其他草稿；恢复 pending 按账号存储键及 Study/Protocol 路径、方法、请求体允许字段检查；保留原请求键重试，不把失权或换身份后的 pending 自动重放 | 未发现误写其他研究/版本的客户端恢复旁路；后端仍执行完整校验 |
| UI 并发与离开保护 | 保存使用 draft 自身 revision；后台探测保留脏输入和原基准；提交期间后续输入不被回执覆盖；未知结果保持同键；站内确认复用组件，刷新关闭保留 beforeunload | 静态契约可接受；完整反例 UI 实测另留证 |

## 2. 合成库定点迁移判断

该 fixture 库由既有基线创建，预检没有 `_prisma_migrations` 历史，82 个 canonical 目录会被视为 pending。**在这个库执行 `prisma migrate deploy` 不可接受**，也不能伪造已应用历史、重建基线或另建自动迁移链。

本次仅执行一个已审 canonical SQL 的方案可接受，限定条件为：现有 fixture guard 确认专用合成数据库、身份、marker/runId；在同一直接连接事务中再次守门；执行精确文件 hash 的 SQL，并记录 `wp01_meta.fixture_run` 回执；核对前后列定义和旧行，不修改 `_prisma_migrations`。这是专用 fixture 验收操作，正式部署仍沿唯一 Prisma 迁移链另做基线和升级验收。

已读取 [migration.json](../../testing/evidence/research-t04-2026-11-11/migration.json)：库为 `wp01_test_full_baseline`，`syntheticOnly=true`，canonical SHA256 为 `90ca7f9c2c17a8862a554f819b6fc295e81b7221f5058cb95f87e0582b515dc5`，四列最终均 nullable、无 default；原 VisitPlan 行数 0，前后行 hash 相同，业务行修改 0，`prismaHistoryModified=false`，事务 committed。此为主循环执行记录，评审者未执行 DDL。因旧行数为 0，这项真实迁移证据不能独自证明非空生产库升级；旧值兼容另由 SQL 形态和旧服务回归支持。

## 3. 执行证据与四层状态

| 层级 | 已见证据 | 能证明 / 不能证明 |
| --- | --- | --- |
| 代码实现 | 本次源码审查；主循环报告 Hub 25、旧 core 48 项及两仓构建通过 | 支持 T04 配置和兼容契约；评审者没有冒称独立重跑这些测试 |
| 目标环境启用 | migration/reload 记录；本机 `127.0.0.1:19501` 实际请求 | 仅本机受保护合成环境，不等于生产 |
| 真实执行 | [PG 17 项](../../testing/evidence/research-t04-2026-11-11/pg-result.json) 覆盖受限角色、新合成范围、固定引用、NULL/0/false、同键并发、CAS、跨 Study/撤权、回滚及 feature 守门；[HTTP](../../testing/evidence/research-t04-2026-11-11/http-result.json) 实际创建、保存、追加 requirements、研究者/管理员回读、409/400 和会话保持 | 是实际数据库/HTTP 证据，不是 Mock；无患者数据、模型调用或真实采集 |
| 页面路径 | [浏览器已留证主链](../../testing/evidence/research-t04-2026-11-11/browser-3fe7b571/result.json) 验证 S01→正式 S11 已保存方案读回，并有 PNG/WebM | 此文件只有该主链，不能冒称最终身份/失权/未知提交全部浏览器反例已验收；后续由主循环关联最终证据 |
| 业务结果 | 合成配置已持久化且可读回；HTTP 记录明确 `professionalAcceptance=false` | T04 技术产物可供用户核对；用户专业验收、真实研究材料和生产发布尚不能销项 |

## 4. 不提前销项的后续边界

- T05 仍需完成统一发布/批准/启用规则、固定引用与政策有效性完整检查，以及真实伦理、研究同意/数据使用同意、中心权限和盲态政策的配置契约。缺失政策保持缺失状态，不能把本次 NULL 守门当完整临床启用资格。
- T06–T09 的正式采集、更正、快照、撤回与失效传播继续按 [T00 执行契约](t00-execution-contract.md) 实施，复用既有公共 FormResponse 核心；本审查未授权平行 EDC、真实临床采集或真实渠道发送。
- 主循环需把最终 UI 反例证据与 living spec、使用说明、变更记录及 Notion 同步关联到 T04 收尾；本文件不替代上述交付材料。

## 5. 最终复核指纹

| 文件 | SHA256 |
| --- | --- |
| `server/research-execution/protocols.mjs` | `67d0c69dffd04313881c9b1436e43704c546804f333c06f60f00014106880bbb` |
| `pages/shared/FormalPreparation.jsx` | `24d3b81cf1ca92dea5134bbfd1992aa8665ff2bfe2b596e70d3d8314223a9d3e` |
| `src/formal-preparation-session.js` | `4a318a3c6f1e3d300178bb68dd8cabef334ba8a8e9091aace53d090c58101900` |
| `app/server/src/study-operations/study-operations.service.ts`（上层仓库） | `56811966792ede6e80d5e8becd7bcf990d1ddaa561a09de1a4f416ff0a7bff61` |

建议下一项：完成最终 UI 异常路径证据与 T04 文档收尾后，继续 T05 的发布检查和政策状态守门，确保可保存草稿与可正式启用有清楚、可验证的边界。
