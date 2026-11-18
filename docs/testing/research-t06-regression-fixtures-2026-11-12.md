# T06 旧业务回归 fixture 修复

日期：2026-11-12。源码修改仅限 `app/server/src/study-operations/study-operations.service.spec.ts`；未修改产品 service、participation、forms、outreach、scales 或权限门禁。保留该测试文件此前的共享修改，没有提交、重置或操作数据库/服务。

## 原因与修正

原失败记录为 `app/server/.tmp/t06-regression.tap`：47 项中 13 项失败。T06 新正式入组和采集路径要求当前授权、同租户正式被试、批准且固定的政策以及筛选/研究同意/数据用途同意三类事实；旧 fixture 缺少 tenantId、政策及事件，因而在进入原业务断言前失败。

- Subject 补齐真实 scope 的 tenantId；account/project membership mock 按 where 读取实际测试行，不再无条件返回第一账号或项目管理权限。feature、active group 和 group membership 也匹配查询条件。
- 既有执行中方案 helper 增加明确标注 synthetic 的批准政策版本、canonical hash、独立审核者及三项带证据的参与事实。研究同意绑定文本版本，数据用途同意绑定 scope；事件读取严格按 tenant/group/project/subject/protocol/policy 过滤。真实 gate 继续运行，没有 monkeypatch 掉新 gate 或添加 fixture 放行旁路。
- 三个原本无入组的现场/H5 测试先通过真实 `StudyOperationsService.enroll` 测试路径取得合法入组，并在 assignment 上明确绑定 enrollmentId。原有模板锁定、确定性计分、渠道同意撤回、失败投递和 H5 会话撤销断言保留。
- 两个期望 `NO_EXECUTING_PROTOCOL` 的旧测试因 Subject 缺 tenantId 提前失败；补齐 Subject 后继续验证原错误及 Remediation 契约，没有放宽产品错误顺序。
- 新增独立反例：无入组现场采集返回 `PARTICIPATION_CAPTURE_BLOCKED` 且不建 assignment/response；不同 policy 的同意事实不能满足入组；客户端自称管理员的未知当前账号仍返回 `AUTH_SESSION_EXPIRED`，无入组/访视写入。

上述政策/同意均是单元测试材料，不是实际临床决定，也不能替代 T06 的真实 PG、HTTP、浏览器或专业验收。

## 验证

在 `app/server` 执行独立编译：

```sh
pnpm exec tsc -p tsconfig.json --outDir .tmp/t06-regression-review --declaration false --sourceMap false
```

构建通过，日志：`app/server/.tmp/t06-regression-review/build.log`。未覆盖共享 dist。

在该 outDir 对以下 9 个文件运行 `node --test`：study-operations.service、study-operations-policy、study-forms-policy、study-outreach-policy、participation-gate、participation-events、participation-capture、protocol-migration-lock、execution-policy-gate 的 `.spec.js`。最终 **82/82 通过，0 失败/跳过**；service 31 项含原 29 项和新增 2 项。最终日志：`app/server/.tmp/t06-regression-review/regression.tap`。首轮修复后的原 service 29/29 日志另留 `service-first.tap`。测试期间后端并行补充了关联政策测试，因此最终汇总以最终日志 82 项为准，不与早一轮 81 项累计。

`git diff --check -- app/server/src/study-operations/study-operations.service.spec.ts` 通过。最终该 spec SHA256：`56d2d251bc897aa38aac3672fd89654a8ed40f7465cc7d87e937494c50905aac`。

## 适配器只读窄审

本轮未发现 blocking，范围限 `researchhub/server/research-execution/subjects.mjs`、`enrollment.mjs`、controller 装配及其实际 core 接口：

- subjects 在当前 Study 授权事务内重新检查 feature、实际账号、当前项目/组角色；菜单和按钮各自守门，Hub owner 本身不获得建档/执行权限，租户管理员按实际身份判定。继承的 Study 读取前提仍有效，未新增权限字符串。
- receiver scope 由 ctx 映射为 tenantId/studyGroupId/researchProjectId 后覆盖客户端身份中的 scope；controller 保留 `operations.enrollInTransaction.bind(operations)`，未丢失实例接收者。列表/详情只读同范围正式未删除对象，建档复用现有 Subject 核心及数据库唯一性。
- enrollment 在当前 context/权限及真实 subject 父链确认后查 actor-bound receipt；新命令比较固定政策版本/hash，在同事务记录/入组、再次读取 after state、生成审计及 JSON 快照回执。合法旧请求重试返回原结果；不能把它当成最新状态，后续状态变化应重新 GET。
- 快照包含具体 policy sections、参与事实和 eligibility；旧同意不会仅因 subjectId 相同而满足另一协议/政策。范围和能力均不来自客户端自报 metadata。

审核指纹：subjects.mjs `09765f6767ffb195ec40fbadb715fb6b26803a6ffc6b4793891dd986686c93b5`；enrollment.mjs `40dfcf99a46d4516cb2e4b762a9ab085570b7be2e73f89466fc9fb825cb9ddea`。本次未运行这些适配器的真实 PG/HTTP；主循环的 PG/HTTP/UI 证据应独立归档，不能由本次 mock 回归替代。

建议下一项：主循环完成 S03/S04 及筛选—同意—入组的真实 HTTP/浏览器闭环，核对当前状态与历史回执的展示，继续四层验收。
