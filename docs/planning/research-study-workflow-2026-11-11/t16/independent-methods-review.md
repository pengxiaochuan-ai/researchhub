# T16 Methods 与 Worker 独立窄审（2026-11-12）

范围为冻结清单的 Methods、Hub adapter、真实 Python `serve.execute_job` 与描述统计，不改生产配置或用户资料。冻结清单 18 文件 SHA 核对一致。独立复跑 Methods 110/110、adapter 2/2、Python 14/14，分别保存 `app/server/.tmp/t16-independent-methods.tap`（SHA `130d72cce745025f39e05f1241f1f28d24fcaf6c9967deb2de1e0c140fa8b750`）、`researchhub/.tmp/t16-independent-adapter.tap`（`2fa4c2a71eb80fdd99c2813d9ece0cc781b32524740f9ac3c7e03e2b9b078b67`）、`/tmp/t16-independent-worker.log`（`b964b3461428450ee9755c2fdfed99aee8fa8f2d6ba3f6ec441e6a0f9f94c084`）。这些单元分别通过，不证明跨语言联通。

两个当前阻断已实际复现，最小回归 `server/research-analysis/t16-worker-contract-independent.test.mjs` 调用真实 Python `serve.execute_job` 再交实际 TypeScript 输入和结果映射；`.tmp/t16-worker-contract-red.tap` 为 2/2 失败证据：

1. Python `serve.py` 描述统计分支把 `executorVersion` 填全局 worker `t19-1`，实际 `mapDescriptiveWorkerResult` 要 `descriptive-v1`。真实 accepted 200 必然被 mapper 拒绝，无法发布结果。须保留 `workerVersion=t19-1` 并以真实算子版本标识 executor，跨语言用例转绿。
2. T15 方案与 TS builder 合法接受 `a-b` 等由字母、数字、下划线和连字符组成的键，Python Worker 只接受字母/下划线开头、无连字符且最多 80 字符。实际 `a-b` 经 TS 输入 builder 被 Python 400 拒绝。须统一整个链的键契约，不只在单侧放宽；包括起始数字和长度界限的正反例。

正常闭环需真实 Methods→认证 Worker→可信映射→持久运行/审核/回执，再执行同意撤回/更正与取消竞争及独立数值 oracle。当前 18862 运行时未加载该源码；没有执行目标 HTTP、真实 Worker 生产授权或浏览器验收，不能称 T16 已完成。

### 特殊别名与真实 Worker 独立复验

原始 RED `.tmp/t16-real-worker-pg-debug5.tap` 显示 `__proto__` 在 TS 映射输入仍为 own key，Prisma model JSON 写入后数据库 JSONB 中已丢失；直接 JSONB 字面量可保留该 key。不得把内存对象修复当成持久化修复。新增别名统一拒绝后，`.tmp/t16-proto-rejection-independent-green.tap` 为 8/8：T15 计划校验、TS 输入和真实 Python 源各自拒绝 `__proto__`；`constructor`、`toString` 的 0/false/null 与边界别名保持可用。历史投影测试保留，证明旧数据读取不应静默丢失。拒绝前 RED 保存在 `.tmp/t16-proto-rejection-red.tap`。

`.tmp/t16-real-worker-pg-independent-final.tap` 使用 fixture guard 限定合成库、实际 T15 计划与固定来源、真实 MethodsService 和已运行的 19505 Worker：`a-b`、`constructor`、`toString` 在实际 JSONB 持久化后均存在，数值均值/标准差、布尔和缺失计数符合合成输入，运行回执及复核成功。失效身份版本和不存在的 snapshot 调用 `createFromWorkbench` 均拒绝且无 session/run，管理员正例成功。测试外层真实数据库事务回滚；不证明独立提交、并发或 HTTP/浏览器验收。旧 proto 快照从真实历史计划路径的失败及其零副作用尚未独立构造验证，不得当作已验收。目标环境实际 Worker 在该次测试时使用旧运行进程，正例不依赖新版拒绝；Python 新拒绝由独立源码测试证明，运行进程需后续安全重载复验。

### 在途变化独立实测

`.tmp/t16-inflight-independent-final.tap`：四个独立全新合成 Study 均以 fixture guard 提交并在 `wp01_meta.fixture_run` 留 syntheticOnly 标记。实际 19505 Worker 返回 HTTP 200 后，测试 transport 暂停交付响应；另一真实连接分别完成取消、账号 authVersion 撤权、数据用途同意撤回、正式表单解锁并提交更正，再恢复原请求。4/4 阻止结果发布且 `artifactRefs` 为空：取消保持 cancelled，更正及撤回标记 failed，撤权保留 running 并返回 METHOD_AUTHORIZATION_REVOKED。运行继续显示 running 是当前可见限制，不代表任务已经终止或自动恢复。记录含 UTC 时间、真实请求/响应 SHA-256 与 worker/executor 版本；测试没有替代计算、授权或来源校验。此测试证明不同事务之间 Worker 在途后的变更被复验，不声称两个 PG 事务同时持锁或死锁覆盖。不可变审计父链与合成记录按要求保留，未删触发器、未改旧数据。

`.tmp/t16-legacy-proto-pg.tap` 在回滚事务以 canonical INSERT、启用的父链和不可变触发器构造历史合成 plan/review/snapshot，真实 MethodsService 经 T15 复验返回 ANALYSIS_PLAN_INVALID；session/run 均为零。该种子用来验证旧数据失败关闭，不作为真实历史发行链验收。此前本文件说未构造，现以此结果为准。

### 审核回执当前角色（独立复验）

真实合成 PI 通过真实 Worker 生成运行并审核后，降为仅保留 workbench/chat.use/data.analyze、项目及 Agent/Skill 权限的普通 researcher；原 `reviewReceipt` 仍返回审核回执，RED `.tmp/t16-review-receipt-red-final.tap`。修复后 `.tmp/t16-review-receipt-independent-green.tap` 通过：普通 run 详情仍可读，但审核回执与同键审核重放均返回 METHOD_REVIEW_FORBIDDEN；恢复 methodologist 角色后回执可读。PG 新合成事务回滚，Worker 为实际 19505，不涉及主样例。源码 `formal-descriptive-runs.ts` SHA e2f863460b5a760b70cf54a74eb6aa8a771226088e0fa50aa78d692d7aae446a；运行进程及目标 HTTP 尚待安全重载与复验。
